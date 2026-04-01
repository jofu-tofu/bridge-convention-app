import { tick } from "svelte";

import type {
  Deal,
  Auction,
  Contract,
  Call,
  Card,
  DDSolution,
} from "../service";
import { Seat } from "../service";
import type {
  DevServicePort,
  SessionHandle,
  SessionConfig,
} from "../service";
import type { BidResult, BidHistoryEntry } from "../service";
import type { ServicePublicBeliefs } from "../service";
import type { StrategyEvaluation } from "../service/debug-types";
import type { ServicePublicBeliefState, ServiceInferenceSnapshot } from "../service";
import { partnerSeat } from "../service";

import type {
  BiddingViewport,
  ViewportBidFeedback,
  TeachingDetail,
  DeclarerPromptViewport,
  PlayingViewport,
  ExplanationViewport,
} from "../service";
import type { ViewportBidGrade } from "../service";
import { PracticeMode, PlayPreference, PromptMode } from "../service";
import type { BidFeedbackDTO } from "../service/debug-types";
import { isValidTransition, resolveTransition } from "../service";
import type { GamePhase, ViewportNeeded } from "../service";
import { delay } from "../service";
import { formatError } from "../service/util/format-error";
import { computePromptMode, computeFaceUpSeats } from "./prompt-logic";
import { createBiddingPhase } from "./bidding-phase.svelte";
import { createPlayPhase } from "./play-phase.svelte";

// ── Re-exports ──────────────────────────────────────────────────────

export type { BidHistoryEntry } from "../service";

// ── Exported types (previously in sub-stores) ───────────────────────

interface GameStoreOptions {
  /** Override the delay function used for AI bid/play timing. Defaults to setTimeout-based delay. */
  delayFn?: (ms: number) => Promise<void>;
}

/** Viewport-safe bid feedback for the current turn. */
export interface BidFeedback {
  readonly grade: ViewportBidGrade;
  readonly viewportFeedback: ViewportBidFeedback;
  readonly teaching: TeachingDetail | null;
}

/** Aggregated debug snapshot — strategy evaluation plus the expected bid. */
export interface DebugSnapshot extends StrategyEvaluation {
  readonly expectedBid: BidResult | null;
}

/** Internal feedback stored in debug log entries (richer than viewport BidFeedback). */
export type DebugBidFeedback = BidFeedbackDTO;

/** A single entry in the persistent debug log — captures a snapshot at a specific moment. */
export interface DebugLogEntry {
  readonly kind: "pre-bid" | "user-bid" | "ai-bid";
  readonly turnIndex: number;
  readonly seat: Seat;
  readonly call?: Call;
  /** Pipeline state at this moment (null for AI bids). */
  readonly snapshot: DebugSnapshot;
  /** Feedback from grading (only on user-bid entries). */
  readonly feedback: BidFeedbackDTO | null;
}

export interface PlayLogEntry {
  readonly seat: Seat;
  readonly card: Card;
  readonly reason: string;
  readonly trickIndex: number;
}

/** Determine who controls a seat: 'user' or 'ai'. */
export function seatController(
  seat: Seat,
  declarer: Seat,
  userSeat: Seat,
): "user" | "ai" {
  if (seat === userSeat) return "user";
  if (seat === partnerSeat(declarer) && declarer === userSeat) return "user";
  return "ai";
}


// ── Internal constants ──────────────────────────────────────────────


/** Default empty evaluation — used when no strategy is wired or before first suggest(). */
const EMPTY_EVALUATION: StrategyEvaluation = {
  practicalRecommendation: null,
  surfaceGroups: null,
  pipelineResult: null,
  posteriorSummary: null,
  explanationCatalog: null,
  teachingProjection: null,
  facts: null,
  machineSnapshot: null,
  auctionContext: null,
};

// ── Grouped phase state types ───────────────────────────────────────

interface DDSState { solution: DDSolution | null; solving: boolean; error: string | null; }
interface InferenceState { playInferences: Record<Seat, ServicePublicBeliefs> | null; publicBeliefState: ServicePublicBeliefState; }
interface ViewportCache { bidding: BiddingViewport | null; declarerPrompt: DeclarerPromptViewport | null; playing: PlayingViewport | null; explanation: ExplanationViewport | null; }

function freshDDSState(): DDSState { return { solution: null, solving: false, error: null }; }
function freshInferenceState(): InferenceState { return { playInferences: null, publicBeliefState: { beliefs: {} as Record<Seat, ServicePublicBeliefs>, annotations: [] } }; }
function freshViewportCache(): ViewportCache { return { bidding: null, declarerPrompt: null, playing: null, explanation: null }; }

// ── Store factory ───────────────────────────────────────────────────

export function createGameStore(
  service: DevServicePort,
  options?: GameStoreOptions,
) {
  const delayFn = options?.delayFn ?? delay;

  // ── Session state (flat — span all phases) ───────────────────
  let activeHandle = $state<SessionHandle | null>(null);
  // Not $state — activeService is swapped atomically per-drill, not per-render.
  // Making it reactive would cause components to re-render mid-transition when
  // the old drill's service is still being cleaned up. Closures capture it at
  // call time, ensuring each async chain uses the service it started with.
  let activeService: DevServicePort = service;
  let deal = $state<Deal | null>(null);
  let phase = $state<GamePhase>("BIDDING");
  let conventionName = $state("");
  let effectiveUserSeat = $state<Seat | null>(null);
  let practiceMode = $state<PracticeMode>(PracticeMode.DecisionDrill);
  let playPreference = $state<PlayPreference>(PlayPreference.Prompt);

  // ── Grouped phase state ─────────────────────────────────────
  // Grouped into typed objects so phase resets are a single assignment
  // (e.g., `dds = freshDDSState()`) rather than resetting N individual fields.
  // Svelte 5's proxy tracks fine-grained property mutations within each object.

  let dds = $state<DDSState>(freshDDSState());
  let inference = $state<InferenceState>(freshInferenceState());
  let viewports = $state<ViewportCache>(freshViewportCache());

  // ── Derived contract ────────────────────────────────────────
  // Single source of truth: always derived from whichever viewport has it.
  // Eliminates manual syncing via extractContractFromViewport().
  const contract = $derived.by((): Contract | null => {
    return viewports.declarerPrompt?.contract
      ?? viewports.playing?.contract
      ?? viewports.explanation?.contract
      ?? null;
  });

  // ── Lifecycle guard ─────────────────────────────────────────
  // guarded() drops concurrent calls rather than queuing them because lifecycle
  // actions (skip-to-review, accept-prompt, etc.) are user-initiated and
  // idempotent — a dropped click is harmless, but a queued action executing
  // after the phase has changed would be wrong. Queuing would also require
  // tracking/flushing the queue on drill reset, adding complexity for no benefit.
  let transitioning = $state(false);
  // startNewDrill uses cancel-based concurrency (not guarded) — a new drill
  // supersedes any in-progress drill via activeHandle comparison. This flag
  // provides UI-disabling behavior that guarded() would have provided.
  let isStarting = $state(false);

  function guarded<Args extends unknown[]>(
    fn: (...args: Args) => void | Promise<void>,
  ): (...args: Args) => void {
    return (...args: Args): void => {
      if (transitioning) {
        if (import.meta.env.DEV) console.warn('[guarded] dropped concurrent call to', fn.name || 'anonymous');
        return;
      }
      transitioning = true;
      try {
        const result = fn(...args);
        if (result instanceof Promise) {
          // Intentionally not returned — callers should not await lifecycle actions.
          // The promise is tracked internally for flag cleanup.
          void result.catch((err) => {
            console.error('[guarded] lifecycle action failed:', err);
          }).finally(() => { transitioning = false; });
        } else {
          transitioning = false;
        }
      } catch (err) {
        transitioning = false;
        console.error('[guarded] lifecycle action threw synchronously:', err);
      }
    };
  }

  async function refreshViewport() {
    if (!activeHandle) return;
    switch (phase) {
      case "BIDDING":
        viewports.bidding = await activeService.getBiddingViewport(activeHandle);
        break;
      case "DECLARER_PROMPT":
        viewports.declarerPrompt = await activeService.getDeclarerPromptViewport(activeHandle);
        break;
      case "PLAYING":
        viewports.playing = await activeService.getPlayingViewport(activeHandle);
        break;
      case "EXPLANATION":
        viewports.explanation = await activeService.getExplanationViewport(activeHandle);
        break;
    }
  }

  async function fetchAndCacheViewport(handle: SessionHandle, vpName: ViewportNeeded): Promise<void> {
    switch (vpName) {
      case "bidding":
        viewports.bidding = await activeService.getBiddingViewport(handle);
        break;
      case "declarerPrompt":
        viewports.declarerPrompt = await activeService.getDeclarerPromptViewport(handle);
        break;
      case "playing":
        viewports.playing = await activeService.getPlayingViewport(handle);
        break;
      case "explanation":
        viewports.explanation = await activeService.getExplanationViewport(handle);
        break;
    }
  }

  // ── Derived ───────────────────────────────────────────────────

  const userSeat = $derived<Seat | null>(
    viewports.bidding?.seat ?? viewports.declarerPrompt?.userSeat ?? viewports.playing?.userSeat ?? viewports.explanation?.userSeat ?? null,
  );

  // ── Practice mode helpers ────────────────────────────────────

  /**
   * Handle auto-transition from DECLARER_PROMPT based on playPreference.
   * Uses phase coordinator to decide whether to auto-accept or auto-skip.
   * Returns true if still active (not cancelled).
   */
  async function handleAutoPromptTransition(handle: SessionHandle): Promise<boolean> {
    const desc = resolveTransition("DECLARER_PROMPT", { type: "PROMPT_ENTERED", playPreference });
    if (!desc.chainedEvent) return true; // "prompt" mode — stay at DECLARER_PROMPT

    if (desc.chainedEvent.type === "ACCEPT_PLAY") {
      await acceptPrompt();
      return activeHandle === handle;
    }
    if (desc.chainedEvent.type === "DECLINE_PLAY") {
      try {
        await activeService.acceptPrompt(handle, "skip");
      } catch (err) {
        console.error("auto-skip acceptPrompt failed:", err);
      }
      transitionToExplanation();
      return true;
    }
    return true;
  }

  /**
   * Handle post-auction phase transition using the phase coordinator.
   * Replaces the duplicated if/else chain in userBidViaService, startDrillFromHandle, and skipToPhase.
   */
  async function handlePostAuction(
    handle: SessionHandle,
    servicePhase: GamePhase,
    options?: { autoPromptTransition?: boolean; playInferences?: Record<Seat, ServicePublicBeliefs> | null },
  ): Promise<boolean> {
    const desc = resolveTransition("BIDDING", { type: "AUCTION_COMPLETE", servicePhase });
    if (!desc.targetPhase) return true;

    // 1. Apply inferences from the result that triggered the phase transition
    if (desc.captureInferences && options?.playInferences !== undefined) {
      inference.playInferences = options.playInferences;
    }

    // 2. Fetch viewports (contract is auto-derived from them)
    for (const vpName of desc.viewportsNeeded) {
      await fetchAndCacheViewport(handle, vpName);
      if (activeHandle !== handle) return false;
    }
    if (desc.targetPhase === "DECLARER_PROMPT" || desc.targetPhase === "PLAYING") {
      effectiveUserSeat = userSeat;
    }

    // 3. Phase transition
    transitionTo(desc.targetPhase);

    // 4. Post-transition actions
    if (desc.resetPlay) playPhase.play.aborted = false;
    if (desc.targetPhase === "PLAYING") void playPhase.fetchPlaySuggestions(handle);
    if (desc.triggerDDS) void triggerDDSSolve();

    // 5. Auto-transition from prompt (unless caller handles it)
    if (options?.autoPromptTransition !== false && desc.targetPhase === "DECLARER_PROMPT") {
      return handleAutoPromptTransition(handle);
    }

    return true;
  }

  // ── Bidding sub-module ────────────────────────────────────────

  const biddingPhase = createBiddingPhase({
    getActiveHandle: () => activeHandle,
    getActiveService: () => activeService,
    getPhase: () => phase,
    getBiddingViewport: () => viewports.bidding,
    setBiddingViewport: (vp) => { viewports.bidding = vp; },
    setPublicBeliefState: (state) => { inference.publicBeliefState = state; },
    handlePostAuction,
    delayFn,
  });

  // ── Phase helpers ─────────────────────────────────────────────

  function transitionTo(target: GamePhase): boolean {
    if (isValidTransition(phase, target)) {
      phase = target;
      return true;
    }
    const msg = `Invalid phase transition: ${phase} → ${target}`;
    if (import.meta.env.DEV) {
      throw new Error(msg);
    }
    return false;
  }

  function transitionToExplanation() {
    if (!transitionTo("EXPLANATION")) return;
    if (activeHandle) {
      void triggerDDSSolve();
    }
    void refreshViewport();
  }

  /** Determine the current prompt mode from game state. */
  function getPromptMode(): PromptMode | null {
    return computePromptMode(phase, contract, userSeat);
  }

  /** Compute which seats should be shown face-up. */
  function getFaceUpSeats(): ReadonlySet<Seat> {
    return computeFaceUpSeats(effectiveUserSeat, userSeat, phase, contract);
  }

  // ── DDS helpers ───────────────────────────────────────────────

  async function triggerDDSSolve() {
    if (!activeHandle || dds.solving) return;
    const handle = activeHandle;
    dds.solving = true;
    dds.error = null;
    dds.solution = null;

    try {
      const result = await activeService.getDDSSolution(handle);
      if (activeHandle !== handle) return; // cancelled
      dds.solution = result.solution;
      if (result.error) dds.error = result.error;
    } catch (err: unknown) {
      if (activeHandle !== handle) return;
      dds.error = formatError(err);
    } finally {
      if (activeHandle === handle) {
        dds.solving = false;
      }
    }
  }

  // ── Play sub-module ───────────────────────────────────────────

  const playPhase = createPlayPhase({
    getActiveHandle: () => activeHandle,
    getActiveService: () => activeService,
    getPlayingViewport: () => viewports.playing,
    setPlayingViewport: (vp) => { viewports.playing = vp; },
    transitionToExplanation,
    delayFn,
  });

  // ── Play phase transitions ────────────────────────────────────

  async function acceptPlay(seatOverride?: Seat) {
    if (!contract || phase !== "DECLARER_PROMPT") return;
    if (!activeHandle) return;
    const seat = seatOverride ?? effectiveUserSeat ?? userSeat ?? Seat.South;
    effectiveUserSeat = seat;
    const handle = activeHandle;

    try {
      // Accept prompt on service side (initializes play state + runs initial AI plays)
      const result = await activeService.acceptPrompt(handle, "play", seat);
      if (activeHandle !== handle) return;

      // Load viewport before transitioning phase so GameScreen has data to render
      const playingVp = await activeService.getPlayingViewport(handle);
      if (activeHandle !== handle) return;

      if (!transitionTo("PLAYING")) return;
      playPhase.play.aborted = false;
      playPhase.animatedTrickOverride = null;
      playPhase.play.score = null;
      playPhase.play.showingTrickResult = false;
      playPhase.play.processing = false;
      playPhase.play.log = [];
      viewports.playing = playingVp;

      // Animate AI plays from the result
      const aiPlays = result.aiPlays ?? [];
      if (aiPlays.length > 0) {
        const { ok } = await playPhase.animateAiPlays(handle, [...aiPlays], []);
        if (!ok) return;
      }

      // Fetch play suggestions for the user's first turn
      void playPhase.fetchPlaySuggestions(handle);
    } catch (err) {
      console.error('acceptPlay failed:', err);
    }
  }

  function declinePlay() {
    if (phase !== "DECLARER_PROMPT") return;
    void (async () => {
      try {
        await activeService.acceptPrompt(activeHandle!, "skip");
      } catch (err) {
        console.error('acceptPrompt (skip) failed:', err);
      }
    })();
    transitionToExplanation();
  }

  function acceptDeclarerSwap() {
    if (!contract) return;
    acceptPlay(contract.declarer);
  }
  function declineDeclarerSwap() { declinePlay(); }
  function acceptDefend() { acceptPlay(); }
  function declineDefend() { declinePlay(); }
  function acceptSouthPlay() { acceptPlay(); }
  function declineSouthPlay() { declinePlay(); }

  function acceptPrompt() {
    if (!contract || phase !== "DECLARER_PROMPT") return;
    const mode = getPromptMode();
    if (mode === PromptMode.DeclarerSwap) {
      return acceptPlay(contract.declarer);
    } else {
      return acceptPlay();
    }
  }

  function declinePrompt() { declinePlay(); }

  // ── Reset ─────────────────────────────────────────────────────

  function resetImpl() {
    // Clear lifecycle guard — any in-flight operations will bail via activeHandle check
    transitioning = false;

    // Session
    activeHandle = null;
    activeService = service;
    deal = null;
    phase = "BIDDING";
    effectiveUserSeat = null;
    conventionName = "";
    practiceMode = PracticeMode.DecisionDrill;
    playPreference = PlayPreference.Prompt;

    // Grouped state
    biddingPhase.reset();
    playPhase.resetPlay(); // aborted=true cancels in-flight animations
    dds = freshDDSState();
    inference = freshInferenceState();
    viewports = freshViewportCache();
  }

  function resetPlay() {
    playPhase.resetPlay(); // includes aborted=true, clears viewport
  }

  // ── Lifecycle inner functions (guarded at the public boundary) ──

  function skipToReviewImpl() {
    playPhase.play.aborted = true;
    if (activeHandle) {
      activeService.skipToReview(activeHandle)
        .then(() => transitionToExplanation())
        .catch((err) => { console.error('skipToReview failed:', err); });
    }
  }

  function restartPlayImpl() {
    if (!contract || phase !== "PLAYING") return;
    if (!activeHandle) return;
    const handle = activeHandle;

    // Cancel in-flight animations (keep stale viewport to avoid UI flash)
    playPhase.play.aborted = true;
    playPhase.play.score = null;
    playPhase.play.showingTrickResult = false;
    playPhase.play.processing = false;
    playPhase.play.log = [];
    playPhase.play.suggestions = [];
    playPhase.animatedTrickOverride = null;

    void (async () => {
      try {
        playPhase.play.aborted = false;
        const result = await activeService.acceptPrompt(handle, "restart");
        if (activeHandle !== handle) return;

        // Show play table
        viewports.playing = await activeService.getPlayingViewport(handle);
        if (activeHandle !== handle) return;

        // Animate AI plays from the result
        const aiPlays = result.aiPlays ?? [];
        if (aiPlays.length > 0) {
          const { ok } = await playPhase.animateAiPlays(handle, [...aiPlays], []);
          if (!ok) return;
        }

        void playPhase.fetchPlaySuggestions(handle);
      } catch (err) {
        console.error('restartPlay failed:', err);
      }
    })();
  }

  function playThisHandImpl() {
    // contract is auto-derived from viewports — always in sync.
    if (!contract) return;
    if (phase !== "EXPLANATION") return;
    if (!activeHandle) return;
    const handle = activeHandle;
    const currentContract = contract; // capture before resetPlay clears viewports
    resetPlay();
    effectiveUserSeat = userSeat;
    dds = freshDDSState();

    // Determine seat: if partner declares, play as declarer (swap); otherwise keep user seat
    const declarer = currentContract.declarer;
    const seat = (declarer !== userSeat && partnerSeat(declarer) === userSeat)
      ? declarer  // declarer-swap: play as declarer from partner's seat
      : effectiveUserSeat ?? userSeat ?? Seat.South;
    effectiveUserSeat = seat;

    // Go straight to PLAYING — skip DECLARER_PROMPT UI
    if (!transitionTo("DECLARER_PROMPT")) return; // service needs EXPLANATION → DECLARER_PROMPT first
    if (!transitionTo("PLAYING")) return;
    playPhase.play.aborted = false;
    playPhase.animatedTrickOverride = null;
    playPhase.play.score = null;
    playPhase.play.showingTrickResult = false;
    playPhase.play.processing = false;
    playPhase.play.log = [];

    void (async () => {
      try {
        // Transition service: EXPLANATION → DECLARER_PROMPT → PLAYING
        await activeService.acceptPrompt(handle, "replay");
        if (activeHandle !== handle) return;
        const result = await activeService.acceptPrompt(handle, "play", seat);
        if (activeHandle !== handle) return;

        // Show play table
        viewports.playing = await activeService.getPlayingViewport(handle);
        if (activeHandle !== handle) return;

        // Animate AI plays from the result
        const aiPlays = result.aiPlays ?? [];
        if (aiPlays.length > 0) {
          const { ok } = await playPhase.animateAiPlays(handle, [...aiPlays], []);
          if (!ok) return;
        }

        void playPhase.fetchPlaySuggestions(handle);
      } catch (err) {
        console.error('playThisHand failed:', err);
      }
    })();
  }

  async function startDrillFromHandleImpl(handle: SessionHandle, drillService?: DevServicePort) {
    resetImpl();
    activeHandle = handle;
    activeService = drillService ?? service;

    // Fetch convention name from service
    conventionName = await activeService.getConventionName(handle);
    if (activeHandle !== handle) return;

    phase = "BIDDING";

    // Start drill via service
    const startResult = await activeService.startDrill(handle);
    if (activeHandle !== handle) return;
    viewports.bidding = startResult.viewport;
    practiceMode = startResult.practiceMode;
    playPreference = startResult.playPreference;

    // Animate initial AI bids via incremental reveal
    if (startResult.aiBids.length > 0 && !startResult.auctionComplete) {
      biddingPhase.biddingAnim = { totalAiBids: startResult.aiBids.length, revealed: 0 };

      for (let i = 0; i < startResult.aiBids.length; i++) {
        await delayFn(300);
        if (activeHandle !== handle) return;
        biddingPhase.biddingAnim = { totalAiBids: startResult.aiBids.length, revealed: i + 1 };
      }
      biddingPhase.biddingAnim = null;
    }

    // Fetch belief state from service
    inference.publicBeliefState = await activeService.getPublicBeliefState(handle);
    if (activeHandle !== handle) return;

    // Handle auction complete during initial bids
    if (startResult.auctionComplete) {
      const ok = await handlePostAuction(handle, startResult.phase as GamePhase, { playInferences: startResult.playInferences });
      if (!ok || activeHandle !== handle) return;
    }

    // Populate debug drawer
    if (import.meta.env.DEV) {
      const log = await activeService.getDebugLog(handle);
      biddingPhase.bidding.debugLog = [...log] as DebugLogEntry[];
    }

    await refreshViewport();
    await tick();
  }

  // startNewDrill uses cancel-based concurrency instead of guarded(): starting a
  // new drill always succeeds, superseding any in-progress drill. Cancellation
  // works via activeHandle comparison in startDrillFromHandleImpl — when a new
  // drill starts, the old handle no longer matches and all async operations bail.
  // Do NOT reintroduce guarded() here.
  async function startNewDrillImpl(config: SessionConfig) {
    isStarting = true;
    try {
      const handle = await service.createSession(config);
      await startDrillFromHandleImpl(handle);
    } finally {
      isStarting = false;
    }
  }

  // ── Return ────────────────────────────────────────────────────

  return {
    get activeHandle() { return activeHandle; },
    /** True when a drill has been started (deal is loaded). Use instead of `deal !== null`. */
    get isInitialized(): boolean { return deal !== null || activeHandle !== null; },
    get deal() { return deal; },
    get phase() { return phase; },
    get contract(): Contract | null { return contract; },
    get effectiveUserSeat() { return effectiveUserSeat; },
    get practiceMode() { return practiceMode; },
    get playPreference() { return playPreference; },
    get playUserSeat(): Seat {
      return effectiveUserSeat ?? userSeat ?? Seat.South;
    },
    get rotated(): boolean {
      return effectiveUserSeat === Seat.North;
    },

    // Bidding state — always viewport-derived
    get auction(): Auction {
      if (viewports.bidding) {
        return {
          entries: biddingPhase.displayedAuctionEntries.map(e => ({ seat: e.seat, call: e.call })),
          isComplete: phase !== "BIDDING",
        };
      }
      return { entries: [], isComplete: false };
    },
    get currentTurn(): Seat | null {
      return biddingPhase.displayedCurrentBidder;
    },
    get bidHistory(): BidHistoryEntry[] {
      if (viewports.bidding) {
        return biddingPhase.displayedAuctionEntries.map(e => ({
          seat: e.seat,
          call: e.call,
          isUser: false,
          alertLabel: e.alertLabel,
          annotationType: e.annotationType,
        }));
      }
      return [];
    },
    get isProcessing() { return transitioning || isStarting || biddingPhase.bidding.processing || playPhase.play.processing; },
    get isTransitioning() { return transitioning; },
    get isUserTurn() {
      return biddingPhase.displayedIsUserTurn;
    },
    get legalCalls(): Call[] {
      return [...biddingPhase.displayedLegalCalls];
    },
    get bidFeedback() { return biddingPhase.bidFeedback; },
    get isFeedbackBlocking() { return biddingPhase.isFeedbackBlocking; },

    // Play state — always viewport-derived
    get tricks() {
      const vp = viewports.playing;
      return vp ? vp.tricks : [];
    },
    get currentTrick() {
      return viewports.playing ? playPhase.displayedCurrentTrick : [];
    },
    get currentPlayer() {
      const vp = viewports.playing;
      return vp ? vp.currentPlayer : null;
    },
    get declarerTricksWon() {
      const vp = viewports.playing;
      return vp ? vp.declarerTricksWon : 0;
    },
    get defenderTricksWon() {
      const vp = viewports.playing;
      return vp ? vp.defenderTricksWon : 0;
    },
    get dummySeat() {
      const vp = viewports.playing;
      return vp ? partnerSeat(vp.contract?.declarer ?? Seat.North) : null;
    },
    get score() { return playPhase.play.score; },
    get trumpSuit() {
      const vp = viewports.playing;
      return vp ? vp.trumpSuit : undefined;
    },
    get legalPlaysForCurrentPlayer() {
      const vp = viewports.playing;
      return vp ? [...vp.legalPlays] : [];
    },
    get userControlledSeats() {
      const vp = viewports.playing;
      return vp ? [...vp.userControlledSeats] : [];
    },
    get remainingCardsPerSeat() {
      const vp = viewports.playing;
      return vp ? (vp.remainingCards ?? {}) : {};
    },

    // DDS state
    get ddsSolution() { return dds.solution; },
    get ddsSolving() { return dds.solving; },
    get ddsError() { return dds.error; },

    // Prompt state
    get isDefenderPrompt() {
      if (!contract || !userSeat) return false;
      return (
        contract.declarer !== userSeat &&
        partnerSeat(contract.declarer) !== userSeat
      );
    },
    get isSouthDeclarerPrompt() {
      if (!contract || !userSeat) return false;
      return contract.declarer === userSeat;
    },
    get promptMode(): PromptMode | null { return getPromptMode(); },
    get faceUpSeats(): ReadonlySet<Seat> { return getFaceUpSeats(); },

    // ── Viewport getters ──────────────────────────────────────
    get biddingViewport() { return viewports.bidding; },
    get viewportFeedback(): ViewportBidFeedback | null {
      const fb = biddingPhase.bidFeedback;
      if (!fb) return null;
      return fb.viewportFeedback;
    },
    get teachingDetail(): TeachingDetail | null {
      const fb = biddingPhase.bidFeedback;
      if (!fb) return null;
      return fb.teaching;
    },
    get declarerPromptViewport() { return viewports.declarerPrompt; },
    get playingViewport() { return viewports.playing; },
    get explanationViewport() { return viewports.explanation; },

    // Namespaced sub-store accessors (backward compat) — delegates to top-level getters
    get bidding() {
      // Capture `this` (the returned store object) to delegate to top-level getters
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const store = this;
      return {
        get auction() { return store.auction; },
        get bidHistory() { return store.bidHistory; },
        get bidFeedback() { return biddingPhase.bidFeedback; },
        get legalCalls() { return store.legalCalls; },
        get currentTurn() { return store.currentTurn; },
        get isUserTurn() { return store.isUserTurn; },
      };
    },
    get play() {
      const vp = viewports.playing;
      return {
        get tricks() { return vp ? vp.tricks : []; },
        get currentTrick() { return vp ? playPhase.displayedCurrentTrick : []; },
        get currentPlayer() { return vp ? vp.currentPlayer : null; },
        get declarerTricksWon() { return vp ? vp.declarerTricksWon : 0; },
        get defenderTricksWon() { return vp ? vp.defenderTricksWon : 0; },
        get dummySeat() { return vp ? partnerSeat(vp.contract?.declarer ?? Seat.North) : null; },
        get score() { return playPhase.play.score; },
        get trumpSuit() { return vp ? vp.trumpSuit : undefined; },
      };
    },
    get dds() {
      return {
        get solution() { return dds.solution; },
        get solving() { return dds.solving; },
        get error() { return dds.error; },
      };
    },

    // Public belief state
    get publicBeliefState(): ServicePublicBeliefState { return inference.publicBeliefState; },

    // Session stats (in-memory, per-bid)
    get sessionStats() { return biddingPhase.sessionStats; },

    // Debug observability
    get debugLog() { return biddingPhase.bidding.debugLog; },
    get playLog() { return playPhase.play.log; },
    get playSuggestions() { return playPhase.play.suggestions; },
    get playInferences() { return inference.playInferences; },
    get inferenceTimeline(): readonly ServiceInferenceSnapshot[] {
      if (!activeHandle) return [];
      // Inference timeline is fetched from service when needed — return empty for now
      return [];
    },
    get ewInferenceTimeline(): readonly ServiceInferenceSnapshot[] {
      if (!activeHandle) return [];
      return [];
    },

    setConventionName(name: string) { conventionName = name; },

    userPlayCard(card: Card, seat: Seat): void {
      playPhase.userPlayCardViaService(card, seat).catch((err) => { console.error('userPlayCard failed:', err); });
    },

    skipToReview: guarded(skipToReviewImpl),
    restartPlay: guarded(restartPlayImpl),
    playThisHand: guarded(playThisHandImpl),
    startDrillFromHandle: startDrillFromHandleImpl,
    startNewDrill: startNewDrillImpl,

    acceptPlay: guarded(acceptPlay),
    declinePlay: guarded(declinePlay),
    acceptPrompt: guarded(acceptPrompt),
    declinePrompt: guarded(declinePrompt),
    acceptDeclarerSwap: guarded(acceptDeclarerSwap),
    declineDeclarerSwap: guarded(declineDeclarerSwap),
    acceptDefend: guarded(acceptDefend),
    declineDefend: guarded(declineDefend),
    acceptSouthPlay: guarded(acceptSouthPlay),
    declineSouthPlay: guarded(declineSouthPlay),

    /**
     * Instantly auto-complete bidding and advance to the target phase.
     * Used by ?phase= URL param to skip animation and reach review/playing/declarer.
     * Returns true if the target phase was reached.
     */
    async skipToPhase(targetPhase: "review" | "playing" | "declarer"): Promise<boolean> {
      if (!activeHandle) return false;
      const handle = activeHandle;

      // Auto-bid through the auction instantly (no animation).
      // When the strategy can't determine the user's bid (e.g., hand doesn't match
      // any convention rule), fall back to Pass so the auction can still complete.
      while (phase === "BIDDING" && activeHandle === handle) {
        const expected = await activeService.getExpectedBid(handle);
        if (activeHandle !== handle) return false;

        const call: Call = expected?.call ?? { type: "pass" as const };
        const result = await activeService.submitBid(handle, call);
        if (activeHandle !== handle) return false;

        if (result.nextViewport) {
          viewports.bidding = result.nextViewport;
        }

        // Check if auction completed (phaseTransition is always set when auction ends)
        if (result.phaseTransition) {
          const ok = await handlePostAuction(handle, result.phaseTransition.to as GamePhase, { autoPromptTransition: false, playInferences: result.playInferences });
          if (!ok) return false;
          break;
        }
      }

      // Now advance from DECLARER_PROMPT to target
      if (targetPhase === "declarer") {
        // Already there (or explanation if all passed)
        return phase === "DECLARER_PROMPT";
      }

      if (targetPhase === "playing" && phase === "DECLARER_PROMPT") {
        await acceptPrompt();
        return (phase as GamePhase) === "PLAYING";
      }

      if (targetPhase === "review") {
        if (phase === "DECLARER_PROMPT") {
          declinePrompt(); // skip to review
        }
        // Ensure the explanation viewport is loaded before returning, so the
        // review screen renders immediately without a momentary blank flash.
        // The viewport may already be cached (from the while-loop EXPLANATION
        // branch), so only fetch if missing.
        if (phase === "EXPLANATION" && !viewports.explanation) {
          await refreshViewport();
        }
        return phase === "EXPLANATION";
      }

      return false;
    },

    // Bidding actions
    userBid(call: Call): void {
      biddingPhase.userBidViaService(call).catch((e: unknown) => {
        biddingPhase.bidding.error = formatError(e);
      });
    },
    retryBid(): void {
      biddingPhase.retryBid();
    },
    dismissFeedback(): void {
      biddingPhase.dismissFeedback();
    },

    // Debug
    async getExpectedBid(): Promise<{ call: Call } | null> {
      if (!activeHandle) return null;
      return activeService.getExpectedBid(activeHandle);
    },
    async getDebugSnapshot(): Promise<DebugSnapshot> {
      if (!activeHandle) {
        return { expectedBid: null, ...EMPTY_EVALUATION };
      }
      const snap = await activeService.getDebugSnapshot(activeHandle);
      return { ...snap, expectedBid: snap.expectedBid ?? null };
    },

    reset(): void {
      resetImpl();
    },
  };
}
