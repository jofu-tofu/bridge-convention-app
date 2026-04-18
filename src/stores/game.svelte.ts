import { tick } from "svelte";

import type {
  Deal,
  Auction,
  Contract,
  Call,
  Card,
} from "../service";
import { Seat } from "../service";
import type {
  DevServicePort,
  DrillHandle,
  SessionConfig,
} from "../service";
import type { BidResult, BidHistoryEntry } from "../service";
import type { StrategyEvaluation } from "../service/debug-types";
import type { ServicePublicBeliefState } from "../service";
import type { ServicePublicBeliefs } from "../service";
import { partnerSeat } from "../service";

import type {
  ViewportBidFeedback,
  TeachingDetail,
} from "../service";
import type { ViewportBidGrade } from "../service";
import { PracticeMode, PlayPreference, PromptMode } from "../service";
import type { BidFeedbackDTO } from "../service/debug-types";
import type { GamePhase } from "../service";
import { delay } from "../service";
import { computeFaceUpSeats } from "./prompt-logic";
import { AI_BID_DELAY, animateIncremental } from "./animate";
import { createBiddingPhase } from "./bidding-phase.svelte";
import { createPlayPhase } from "./play-phase.svelte";
import { createViewportCache, viewportNeededForPhase } from "./viewport-cache.svelte";
import { createDDSSolver } from "./dds-solver.svelte";
import { createPhaseTransitions } from "./phase-transitions.svelte";

// ── Re-exports ──────────────────────────────────────────────────────

export type { BidHistoryEntry } from "../service";

// ── Exported types (previously in sub-stores) ───────────────────────

interface GameStoreOptions {
  /** Override the delay function used for AI bid/play timing. Defaults to setTimeout-based delay. */
  delayFn?: (ms: number) => Promise<void>;
  /** Active launch snapshot from the app store for multi-module drill rotation. */
  getActiveLaunch?: () => { readonly moduleIds: readonly string[] } | null;
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
  /** Pipeline state at this moment (null in release builds). */
  readonly snapshot?: DebugSnapshot | null;
  /** Feedback from grading (only on user-bid entries). */
  readonly feedback?: DebugBidFeedback | null;
}

export interface PlayLogEntry {
  readonly seat: Seat;
  readonly card: Card;
  readonly reason: string;
  readonly trickIndex: number;
}

// ── Helpers ─────────────────────────────────────────────────────────

function freshPublicBeliefState(): ServicePublicBeliefState {
  return {
    beliefs: {} as Record<Seat, ServicePublicBeliefs>,
    annotations: [],
  };
}

// ── Store factory ───────────────────────────────────────────────────

export function createGameStore(
  service: DevServicePort,
  options?: GameStoreOptions,
) {
  const delayFn = options?.delayFn ?? delay;

  // ── Session state (flat — span all phases) ───────────────────
  let activeHandle = $state<DrillHandle | null>(null);
  // Not $state — activeService is swapped atomically per-drill, not per-render.
  // Making it reactive would cause components to re-render mid-transition when
  // the old drill's service is still being cleaned up. Closures capture it at
  // call time, ensuring each async chain uses the service it started with.
  let activeService: DevServicePort = service;
  let deal = $state<Deal | null>(null);
  let phase = $state<GamePhase>("BIDDING");
  let effectiveUserSeat = $state<Seat | null>(null);
  let practiceMode = $state<PracticeMode>(PracticeMode.DecisionDrill);
  let playPreference = $state<PlayPreference>(PlayPreference.Prompt);
  let launchDealIndex = $state(0);
  let activeLaunchRef: { readonly moduleIds: readonly string[] } | null = null;

  // ── Grouped phase state ─────────────────────────────────────
  let publicBeliefState = $state<ServicePublicBeliefState>(freshPublicBeliefState());

  // startNewDrill uses cancel-based concurrency (not guarded) — a new drill
  // supersedes any in-progress drill via activeHandle comparison. This flag
  // provides UI-disabling behavior that guarded() would have provided.
  let isStarting = $state(false);

  // ── Sub-modules ─────────────────────────────────────────────

  const vpCache = createViewportCache({
    getActiveService: () => activeService,
  });

  const ddsSolver = createDDSSolver({
    getActiveHandle: () => activeHandle,
    getActiveService: () => activeService,
  });

  // ── Derived contract ────────────────────────────────────────
  // Single source of truth: always derived from whichever viewport has it.
  const contract = $derived.by((): Contract | null => {
    return vpCache.viewports.declarerPrompt?.contract
      ?? vpCache.viewports.playing?.contract
      ?? vpCache.viewports.explanation?.contract
      ?? null;
  });

  // ── Derived ───────────────────────────────────────────────────

  const userSeat = $derived<Seat | null>(
    vpCache.viewports.bidding?.seat ?? vpCache.viewports.declarerPrompt?.userSeat ?? vpCache.viewports.playing?.userSeat ?? vpCache.viewports.explanation?.userSeat ?? null,
  );

  // ── Play sub-module ───────────────────────────────────────────

  const playPhase = createPlayPhase({
    getActiveHandle: () => activeHandle,
    getActiveService: () => activeService,
    getPlayingViewport: () => vpCache.viewports.playing,
    setPlayingViewport: (vp) => { vpCache.viewports.playing = vp; },
    dispatchEvent: (handle, event) => transitions.executeTransition(handle, event),
    delayFn,
  });

  // ── Phase transition sub-module ───────────────────────────────

  const transitions = createPhaseTransitions({
    getActiveHandle: () => activeHandle,
    getActiveService: () => activeService,
    getPhase: () => phase,
    setPhase: (p) => { phase = p; },
    getEffectiveUserSeat: () => effectiveUserSeat,
    setEffectiveUserSeat: (s) => { effectiveUserSeat = s; },
    getUserSeat: () => userSeat,
    getContract: () => contract,
    getPlayPreference: () => playPreference,
    playPhase,
    viewportCache: vpCache,
    ddsSolver,
  });

  // ── Bidding sub-module ────────────────────────────────────────

  const biddingPhase = createBiddingPhase({
    getActiveHandle: () => activeHandle,
    getActiveService: () => activeService,
    getPhase: () => phase,
    getBiddingViewport: () => vpCache.viewports.bidding,
    setBiddingViewport: (vp) => { vpCache.viewports.bidding = vp; },
    setPublicBeliefState: (state) => { publicBeliefState = state; },
    handlePostAuction: transitions.handlePostAuction,
    delayFn,
  });

  // ── Prompt helpers ────────────────────────────────────────────

  function getFaceUpSeats(): ReadonlySet<Seat> {
    return computeFaceUpSeats(effectiveUserSeat, userSeat, phase, contract);
  }

  function getActiveLaunchSnapshot(): { readonly moduleIds: readonly string[] } | null {
    return options?.getActiveLaunch?.() ?? null;
  }

  function syncLaunchDealIndex(): void {
    const launch = getActiveLaunchSnapshot();
    if (!launch || launch.moduleIds.length === 0) return;

    if (launch !== activeLaunchRef) {
      activeLaunchRef = launch;
      launchDealIndex = 0;
      return;
    }

    if (activeHandle) {
      launchDealIndex += 1;
    }
  }

  function getCurrentModuleId(): string {
    const launch = getActiveLaunchSnapshot();
    if (!launch || launch.moduleIds.length === 0) {
      throw new Error("currentModuleId called with no activeLaunch");
    }
    return launch.moduleIds[launchDealIndex % launch.moduleIds.length] ?? launch.moduleIds[0]!;
  }

  function resolveSessionConfig(config: SessionConfig): SessionConfig {
    const launch = getActiveLaunchSnapshot();
    if (!launch || launch.moduleIds.length === 0) return config;
    const moduleId = getCurrentModuleId();
    return {
      ...config,
      conventionId: moduleId,
      targetModuleId: moduleId,
    };
  }

  // ── User action handlers ──────────────────────────────────────

  async function acceptPromptAction(): Promise<void> {
    if (!contract || phase !== "DECLARER_PROMPT") return;
    if (!activeHandle) return;
    const handle = activeHandle;
    const mode = transitions.getPromptMode();
    const seat = mode === PromptMode.DeclarerSwap
      ? contract.declarer
      : (effectiveUserSeat ?? userSeat ?? Seat.South);
    effectiveUserSeat = seat;
    await transitions.dispatchPlayTransition(handle, { type: "ACCEPT_PLAY", seat });
  }

  async function declinePromptAction(): Promise<void> {
    if (phase !== "DECLARER_PROMPT") return;
    if (!activeHandle) return;
    await transitions.executeTransition(activeHandle, { type: "DECLINE_PLAY" });
  }

  function acceptPrompt() { return acceptPromptAction(); }
  function declinePrompt() { return declinePromptAction(); }

  async function skipToReviewAction(): Promise<void> {
    playPhase.play.aborted = true;
    if (!activeHandle) return;
    await transitions.executeTransition(activeHandle, { type: "SKIP_TO_REVIEW" });
  }

  async function restartPlayAction(): Promise<void> {
    if (!contract || phase !== "PLAYING") return;
    if (!activeHandle) return;
    // Cancel in-flight animations before restart
    playPhase.play.aborted = true;
    playPhase.animatedTrickOverride = null;
    await transitions.dispatchPlayTransition(activeHandle, { type: "RESTART_PLAY" });
  }

  async function playThisHandAction(): Promise<void> {
    if (!contract) return;
    if (phase !== "EXPLANATION") return;
    if (!activeHandle) return;
    const handle = activeHandle;
    const currentContract = contract;
    playPhase.resetPlay();
    effectiveUserSeat = userSeat;
    ddsSolver.reset();

    // Determine seat: if partner declares, play as declarer (swap); otherwise keep user seat
    const declarer = currentContract.declarer;
    const seat = (declarer !== userSeat && partnerSeat(declarer) === userSeat)
      ? declarer
      : effectiveUserSeat ?? userSeat ?? Seat.South;
    effectiveUserSeat = seat;

    await transitions.dispatchPlayTransition(handle, { type: "PLAY_THIS_HAND", seat });
  }

  // ── Reset ─────────────────────────────────────────────────────

  function resetImpl(clearLaunchTracking = false) {
    // Clear lifecycle guard — any in-flight operations will bail via activeHandle check
    transitions.transitioning = false;

    // Session
    activeHandle = null;
    activeService = service;
    deal = null;
    phase = "BIDDING";
    effectiveUserSeat = null;
    practiceMode = PracticeMode.DecisionDrill;
    playPreference = PlayPreference.Prompt;
    if (clearLaunchTracking) {
      launchDealIndex = 0;
      activeLaunchRef = null;
    }

    // Sub-module state
    biddingPhase.reset();
    playPhase.resetPlay(); // aborted=true cancels in-flight animations
    ddsSolver.reset();
    publicBeliefState = freshPublicBeliefState();
    vpCache.reset();
  }

  // ── Drill lifecycle ───────────────────────────────────────────

  async function startDrillFromHandleImpl(handle: DrillHandle, drillService?: DevServicePort) {
    resetImpl();
    activeHandle = handle;
    activeService = drillService ?? service;

    phase = "BIDDING";

    // Start drill via service
    const startResult = await activeService.startDrill(handle);
    if (activeHandle !== handle) return;
    vpCache.viewports.bidding = startResult.viewport;
    practiceMode = startResult.practiceMode;
    playPreference = startResult.playPreference;

    // Animate initial AI bids via incremental reveal
    if (startResult.aiBids.length > 0 && !startResult.auctionComplete) {
      const count = startResult.aiBids.length;
      biddingPhase.biddingAnim = { totalAiBids: count, revealed: 0 };
      const ok = await animateIncremental({
        count,
        delayMs: AI_BID_DELAY,
        delayFn,
        isCancelled: () => activeHandle !== handle,
        onReveal: (i) => { biddingPhase.biddingAnim = { totalAiBids: count, revealed: i + 1 }; },
      });
      biddingPhase.biddingAnim = null;
      if (!ok) return;
    }

    // Fetch belief state from service
    publicBeliefState = await activeService.getPublicBeliefState(handle);
    if (activeHandle !== handle) return;

    // Handle auction complete during initial bids
    if (startResult.auctionComplete) {
      const ok = await transitions.handlePostAuction(handle, startResult.phase);
      if (!ok || activeHandle !== handle) return;
    }

    // Populate debug drawer
    if (import.meta.env.DEV) {
      const log = await activeService.getDebugLog(handle);
      biddingPhase.bidding.debugLog = [...log] as DebugLogEntry[];
    }

    const vpName = viewportNeededForPhase(phase);
    if (vpName) {
      await vpCache.fetchAndCache(handle, vpName);
    }
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
      syncLaunchDealIndex();
      const handle = await service.createDrillSession(resolveSessionConfig(config));
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
    get practiceMode() { return practiceMode; },
    get currentModuleId(): string { return getCurrentModuleId(); },

    // Bidding state — always viewport-derived
    get auction(): Auction {
      if (vpCache.viewports.bidding) {
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
      if (vpCache.viewports.bidding) {
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
    get isProcessing() { return transitions.transitioning || isStarting || biddingPhase.bidding.processing || playPhase.play.processing; },
    get isTransitioning() { return transitions.transitioning; },
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
      const vp = vpCache.viewports.playing;
      return vp ? vp.tricks : [];
    },
    get currentTrick() {
      return vpCache.viewports.playing ? playPhase.displayedCurrentTrick : [];
    },
    get currentPlayer() {
      const vp = vpCache.viewports.playing;
      return vp ? vp.currentPlayer : null;
    },
    get declarerTricksWon() {
      const vp = vpCache.viewports.playing;
      return vp ? vp.declarerTricksWon : 0;
    },
    get defenderTricksWon() {
      const vp = vpCache.viewports.playing;
      return vp ? vp.defenderTricksWon : 0;
    },
    get dummySeat() {
      const vp = vpCache.viewports.playing;
      return vp ? partnerSeat(vp.contract?.declarer ?? Seat.North) : null;
    },
    get score() { return playPhase.play.score; },
    get trumpSuit() {
      const vp = vpCache.viewports.playing;
      return vp ? vp.trumpSuit : undefined;
    },

    // DDS state
    get ddsSolution() { return ddsSolver.solution; },
    get ddsSolving() { return ddsSolver.solving; },
    get ddsError() { return ddsSolver.error; },

    // Prompt state
    get promptMode(): PromptMode | null { return transitions.getPromptMode(); },
    get faceUpSeats(): ReadonlySet<Seat> { return getFaceUpSeats(); },

    // ── Viewport getters ──────────────────────────────────────
    get biddingViewport() { return vpCache.viewports.bidding; },
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
    get declarerPromptViewport() { return vpCache.viewports.declarerPrompt; },
    get playingViewport() { return vpCache.viewports.playing; },
    get explanationViewport() { return vpCache.viewports.explanation; },

    // Public belief state
    get publicBeliefState(): ServicePublicBeliefState { return publicBeliefState; },

    // Session stats (in-memory, per-bid)
    get sessionStats() { return biddingPhase.sessionStats; },

    // Debug observability
    get debugLog() { return biddingPhase.bidding.debugLog; },
    get playLog() { return playPhase.play.log; },

    userPlayCard(card: Card, seat: Seat): void {
      void playPhase.userPlayCardViaService(card, seat);
    },

    skipToReview: transitions.guarded(skipToReviewAction),
    restartPlay: transitions.guarded(restartPlayAction),
    playThisHand: transitions.guarded(playThisHandAction),
    startDrillFromHandle: startDrillFromHandleImpl,
    startNewDrill: startNewDrillImpl,

    acceptPrompt: transitions.guarded(acceptPrompt),
    declinePrompt: transitions.guarded(declinePrompt),

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
          vpCache.viewports.bidding = result.nextViewport;
        }

        // Check if auction completed (phaseTransition is always set when auction ends)
        if (result.phaseTransition) {
          const ok = await transitions.handlePostAuction(handle, result.phaseTransition.to);
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
          await declinePromptAction();
        }
        // Ensure the explanation viewport is loaded before returning, so the
        // review screen renders immediately without a momentary blank flash.
        // The viewport may already be cached (from the while-loop EXPLANATION
        // branch), so only fetch if missing.
        if (phase === "EXPLANATION" && !vpCache.viewports.explanation) {
          const vpName = viewportNeededForPhase(phase);
          if (vpName) {
            await vpCache.fetchAndCache(handle, vpName);
          }
        }
        return phase === "EXPLANATION";
      }

      return false;
    },

    // Bidding actions
    userBid(call: Call): void {
      void biddingPhase.userBidViaService(call);
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
    reset(): void {
      resetImpl(true);
    },
  };
}
