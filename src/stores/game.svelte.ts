import { tick } from "svelte";

import type {
  Deal,
  Auction,
  Contract,
  Call,
  Card,
  PlayedCard,
  DDSolution,
} from "../service";
import { Seat } from "../service";
import type {
  DevServicePort,
  SessionHandle,
} from "../service";
import type { BidResult, BidHistoryEntry } from "../service";
import type { ServicePublicBeliefs } from "../service";
import type { StrategyEvaluation } from "../service";
import type { PublicBeliefState, InferenceSnapshot } from "../service";
import { nextSeat, partnerSeat, areSamePartnership } from "../service";

import type {
  BiddingViewport,
  AuctionEntryView,
  ViewportBidFeedback,
  TeachingDetail,
  DeclarerPromptViewport,
  PlayingViewport,
  ExplanationViewport,
} from "../service";
import type { ViewportBidGrade } from "../service";
import type { BidFeedbackDTO } from "../service";
import { isValidTransition } from "../service";
import type { GamePhase } from "../service";
import { delay } from "../service";
import { TRICK_PAUSE, AI_PLAY_DELAY } from "./animate";

// ── Re-exports ──────────────────────────────────────────────────────

export type { ServiceGamePhase as GamePhase } from "../service";
export type { BidHistoryEntry } from "../service";

// ── Exported types (previously in sub-stores) ───────────────────────

export interface GameStoreOptions {
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

type PromptMode = "defender" | "south-declarer" | "declarer-swap";

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

// ── Store factory ───────────────────────────────────────────────────

export function createGameStore(
  service: DevServicePort,
  options?: GameStoreOptions,
) {
  const delayFn = options?.delayFn ?? delay;

  // ── Session state ─────────────────────────────────────────────
  let activeHandle = $state<SessionHandle | null>(null);
  // Not $state — swapped per-drill, not reactive (components access via closures)
  let activeService: DevServicePort = service;
  let deal = $state<Deal | null>(null);
  let phase = $state<GamePhase>("BIDDING");
  let contract = $state<Contract | null>(null);
  let conventionName = $state("");
  let effectiveUserSeat = $state<Seat | null>(null);

  // ── Bidding state ─────────────────────────────────────────────
  let biddingProcessing = $state(false);
  let bidFeedback = $state.raw<BidFeedback | null>(null);
  let biddingError = $state<string | null>(null);
  let debugLog = $state<DebugLogEntry[]>([]);

  // ── Play state ────────────────────────────────────────────────
  let score = $state<number | null>(null);
  let playAborted = $state(false);
  let isShowingTrickResult = $state(false);
  let playProcessing = $state(false);
  let playLog = $state<PlayLogEntry[]>([]);

  // ── DDS state ─────────────────────────────────────────────────
  let ddsSolution = $state<DDSolution | null>(null);
  let ddsSolving = $state(false);
  let ddsError = $state<string | null>(null);

  // ── Inference state ───────────────────────────────────────────
  let playInferences = $state<Record<Seat, ServicePublicBeliefs> | null>(null);
  let publicBeliefState = $state<PublicBeliefState>({ beliefs: {} as Record<Seat, ServicePublicBeliefs>, annotations: [] });

  // ── Cached viewports ───────────────────────────────────────────
  let cachedBiddingViewport = $state<BiddingViewport | null>(null);
  let cachedDeclarerPromptViewport = $state<DeclarerPromptViewport | null>(null);
  let cachedPlayingViewport = $state<PlayingViewport | null>(null);
  let cachedExplanationViewport = $state<ExplanationViewport | null>(null);

  // ── Bidding animation state ──────────────────────────────────
  // Animation overlay: controls incremental reveal of AI bids from the viewport.
  // When non-null, displayedAuctionEntries slices the viewport's entries.
  let biddingAnim = $state<{ totalAiBids: number; revealed: number } | null>(null);

  // Viewport-derived display values — single source of truth for bidding UI
  const displayedAuctionEntries = $derived.by((): readonly AuctionEntryView[] => {
    const vp = cachedBiddingViewport;
    if (!vp) return [];
    if (!biddingAnim) return vp.auctionEntries;
    const baseCount = vp.auctionEntries.length - biddingAnim.totalAiBids;
    return vp.auctionEntries.slice(0, baseCount + biddingAnim.revealed);
  });

  const displayedLegalCalls = $derived.by((): readonly Call[] => {
    if (biddingProcessing || biddingAnim) return [];
    return cachedBiddingViewport?.legalCalls ?? [];
  });

  const displayedCurrentBidder = $derived.by((): Seat | null => {
    const vp = cachedBiddingViewport;
    if (!vp) return null;
    if (!biddingAnim) return vp.currentBidder;
    // During animation, derive current bidder from the last displayed entry
    const displayed = displayedAuctionEntries;
    if (displayed.length === 0) return vp.dealer;
    return nextSeat(displayed[displayed.length - 1]!.seat);
  });

  const displayedIsUserTurn = $derived(
    !biddingProcessing &&
    !biddingAnim &&
    phase === "BIDDING" &&
    cachedBiddingViewport !== null &&
    cachedBiddingViewport.isUserTurn,
  );

  // ── Play animation state ─────────────────────────────────────
  let playAnim = $state<{ totalAiPlays: number; revealed: number } | null>(null);

  const displayedCurrentTrick = $derived.by((): readonly PlayedCard[] => {
    const vp = cachedPlayingViewport;
    if (!vp) return [];
    if (!playAnim) return vp.currentTrick;
    const baseCount = vp.currentTrick.length - playAnim.totalAiPlays;
    return vp.currentTrick.slice(0, baseCount + playAnim.revealed);
  });

  async function refreshViewport() {
    if (!activeHandle) return;
    switch (phase) {
      case "BIDDING":
        cachedBiddingViewport = await activeService.getBiddingViewport(activeHandle);
        break;
      case "DECLARER_PROMPT":
        cachedDeclarerPromptViewport = await activeService.getDeclarerPromptViewport(activeHandle);
        break;
      case "PLAYING":
        cachedPlayingViewport = await activeService.getPlayingViewport(activeHandle);
        break;
      case "EXPLANATION":
        cachedExplanationViewport = await activeService.getExplanationViewport(activeHandle);
        break;
    }
  }

  // ── Derived ───────────────────────────────────────────────────

  const userSeat = $derived<Seat | null>(
    cachedBiddingViewport?.seat ?? cachedDeclarerPromptViewport?.userSeat ?? cachedPlayingViewport?.userSeat ?? cachedExplanationViewport?.userSeat ?? null,
  );

  const isFeedbackBlocking = $derived(
    bidFeedback !== null &&
      bidFeedback.grade !== "correct",
  );

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
    if (phase !== "DECLARER_PROMPT" || !contract || !userSeat) return null;
    if (contract.declarer !== userSeat && partnerSeat(contract.declarer) !== userSeat) return "defender";
    if (contract.declarer === userSeat) return "south-declarer";
    return "declarer-swap";
  }

  /** Compute which seats should be shown face-up. */
  function getFaceUpSeats(): ReadonlySet<Seat> {
    const seat = effectiveUserSeat ?? userSeat;
    if (!seat) return new Set();

    const seats = new Set<Seat>([seat]);

    if (phase === "DECLARER_PROMPT" && contract) {
      const mode = getPromptMode();
      if (mode === "south-declarer") {
        seats.add(partnerSeat(contract.declarer));
      } else if (mode === "declarer-swap") {
        seats.add(contract.declarer);
      }
    }

    if (phase === "PLAYING" && contract) {
      const dummy = partnerSeat(contract.declarer);
      if (areSamePartnership(dummy, seat)) {
        seats.add(dummy);
      }
    }

    return seats;
  }

  // ── DDS helpers ───────────────────────────────────────────────

  async function triggerDDSSolve() {
    if (!activeHandle || ddsSolving) return;
    const handle = activeHandle;
    ddsSolving = true;
    ddsError = null;
    ddsSolution = null;

    try {
      const result = await activeService.getDDSSolution(handle);
      if (activeHandle !== handle) return; // cancelled
      ddsSolution = result.solution;
      if (result.error) ddsError = result.error;
    } catch (err: unknown) {
      if (activeHandle !== handle) return;
      ddsError = err instanceof Error ? err.message : String(err);
    } finally {
      if (activeHandle === handle) {
        ddsSolving = false;
      }
    }
  }

  function resetDDS() {
    ddsSolution = null;
    ddsSolving = false;
    ddsError = null;
  }

  // ── Play helpers ──────────────────────────────────────────────

  async function userPlayCardViaService(card: Card, seat: Seat) {
    if (!activeHandle) return;
    if (playProcessing || playAborted) return;

    const handle = activeHandle;
    playProcessing = true;
    try {
      const result = await activeService.playCard(handle, card, seat);
      if (activeHandle !== handle) return; // cancelled

      if (!result.accepted) return;

      // Fetch updated viewport (includes user's card + all AI plays)
      cachedPlayingViewport = await activeService.getPlayingViewport(handle);
      if (activeHandle !== handle) return;

      // Log AI plays
      for (const aiPlay of result.aiPlays) {
        playLog = [...playLog, { seat: aiPlay.seat, card: aiPlay.card, reason: aiPlay.reason, trickIndex: (cachedPlayingViewport?.tricks.length ?? 0) }];
      }

      // Animate AI plays via incremental reveal on currentTrick
      if (result.aiPlays.length > 0 && cachedPlayingViewport) {
        playAnim = { totalAiPlays: result.aiPlays.length, revealed: 0 };

        for (let i = 0; i < result.aiPlays.length; i++) {
          await delayFn(AI_PLAY_DELAY);
          if (activeHandle !== handle || playAborted) return;

          playAnim = { totalAiPlays: result.aiPlays.length, revealed: i + 1 };
        }
        playAnim = null;
      }

      // Handle trick completion pause
      if (result.trickComplete && !playAborted) {
        isShowingTrickResult = true;
        await delayFn(TRICK_PAUSE);
        isShowingTrickResult = false;
        if (activeHandle !== handle || playAborted) return;

        // Refresh viewport for post-trick state
        cachedPlayingViewport = await activeService.getPlayingViewport(handle);
        if (activeHandle !== handle) return;
      }

      // Handle play completion
      if (result.playComplete) {
        score = result.score;
        transitionToExplanation();
      }
    } finally {
      playProcessing = false;
      await tick();
    }
  }

  function startPlayPhaseImpl() {
    const effectiveContract = contract;
    if (!effectiveContract) return;

    playAborted = false;
    playAnim = null;
    score = null;
    isShowingTrickResult = false;
    playProcessing = false;
    playLog = [];

    // Service path: fetch initial playing viewport + handle AI opening lead
    void (async () => {
      try {
        cachedPlayingViewport = await activeService.getPlayingViewport(activeHandle!);
      } catch (err) {
        console.error('Failed to fetch initial playing viewport:', err);
      }
    })();

    void refreshViewport();
  }

  // ── Bidding helpers ───────────────────────────────────────────

  async function userBidViaService(call: Call) {
    if (!activeHandle) return;
    if (biddingProcessing) return;
    if (!displayedIsUserTurn) return;

    const handle = activeHandle;
    biddingProcessing = true;
    try {
      const result = await activeService.submitBid(handle, call);
      if (activeHandle !== handle) return; // cancelled

      if (!result.accepted) {
        if (result.feedback && result.grade) {
          bidFeedback = {
            grade: result.grade,
            viewportFeedback: result.feedback,
            teaching: result.teaching,
          };
        }
        if (import.meta.env.DEV) {
          const log = await activeService.getDebugLog(handle);
          debugLog = [...log] as DebugLogEntry[];
        }
        await tick();
        return;
      }

      bidFeedback = null;

      // Update viewport — always non-null for accepted bids (PR 0 fix)
      if (result.nextViewport) {
        cachedBiddingViewport = result.nextViewport;
      }

      if (import.meta.env.DEV) {
        const log = await activeService.getDebugLog(handle);
        debugLog = [...log] as DebugLogEntry[];
      }

      // Animate AI bids via incremental reveal
      if (result.aiBids.length > 0) {
        biddingAnim = { totalAiBids: result.aiBids.length, revealed: 0 };

        for (let i = 0; i < result.aiBids.length; i++) {
          await delayFn(300);
          if (activeHandle !== handle) return; // cancelled — bail
          biddingAnim = { totalAiBids: result.aiBids.length, revealed: i + 1 };
        }
        biddingAnim = null;
      }

      // Fetch belief state from service (single source of truth for inference)
      publicBeliefState = await activeService.getPublicBeliefState(handle);
      if (activeHandle !== handle) return;

      // Handle phase transition (auction complete)
      const phaseTransitioned = result.phaseTransition ||
        (result.aiBids.length > 0 && await activeService.getPhase(handle) !== "BIDDING");
      if (activeHandle !== handle) return;

      if (phaseTransitioned) {
        playInferences = await activeService.capturePlayInferences(handle);
        if (activeHandle !== handle) return;
        const servicePhase = await activeService.getPhase(handle);
        if (activeHandle !== handle) return;
        if (servicePhase === "DECLARER_PROMPT") {
          const dpvp = await activeService.getDeclarerPromptViewport(handle);
          if (activeHandle !== handle) return;
          cachedDeclarerPromptViewport = dpvp;
          contract = dpvp?.contract ?? null;
          effectiveUserSeat = userSeat;
          transitionTo("DECLARER_PROMPT");
        } else if (servicePhase === "EXPLANATION") {
          contract = null;
          transitionToExplanation();
        }
        await tick();
        return;
      }
    } catch (e) {
      biddingError = e instanceof Error ? e.message : "Unknown error during bid";
    } finally {
      biddingProcessing = false;
      await tick();
    }
  }

  // ── Play phase transitions ────────────────────────────────────

  function startPlayPhase() {
    if (!contract) return;
    if (!activeHandle) return;
    if (!transitionTo("PLAYING")) return;
    startPlayPhaseImpl();
  }

  function acceptPlay(seatOverride?: Seat) {
    if (!contract || phase !== "DECLARER_PROMPT") return;
    if (seatOverride) {
      effectiveUserSeat = seatOverride;
    }
    void (async () => {
      try {
        await activeService.acceptPrompt(activeHandle!, "play");
      } catch (err) {
        console.error('acceptPrompt failed:', err);
      }
    })();
    startPlayPhase();
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
    if (mode === "declarer-swap") {
      acceptPlay(contract.declarer);
    } else {
      acceptPlay();
    }
  }

  function declinePrompt() { declinePlay(); }

  // ── Reset ─────────────────────────────────────────────────────

  function resetImpl() {
    // Session
    activeHandle = null;
    activeService = service;
    deal = null;
    phase = "BIDDING";
    contract = null;
    effectiveUserSeat = null;
    conventionName = "";

    // Bidding
    biddingProcessing = false;
    bidFeedback = null;
    biddingError = null;
    debugLog = [];

    // Play
    playAborted = true;
    score = null;
    isShowingTrickResult = false;
    playProcessing = false;
    playLog = [];

    // DDS
    resetDDS();

    // Animation
    biddingAnim = null;
    playAnim = null;

    // Cached viewports
    cachedBiddingViewport = null;
    cachedDeclarerPromptViewport = null;
    cachedPlayingViewport = null;
    cachedExplanationViewport = null;

    // Inference
    playInferences = null;
    publicBeliefState = { beliefs: {} as Record<Seat, ServicePublicBeliefs>, annotations: [] };
  }

  function resetPlay() {
    playAborted = true;
    score = null;
    isShowingTrickResult = false;
    playProcessing = false;
    playLog = [];
    playAnim = null;
    cachedPlayingViewport = null;
  }

  // ── Return ────────────────────────────────────────────────────

  return {
    get activeHandle() { return activeHandle; },
    /** True when a drill has been started (deal is loaded). Use instead of `deal !== null`. */
    get isInitialized(): boolean { return deal !== null || activeHandle !== null; },
    get deal() { return deal; },
    get phase() { return phase; },
    get contract(): Contract | null {
      if (cachedDeclarerPromptViewport) return cachedDeclarerPromptViewport.contract;
      if (cachedPlayingViewport) return cachedPlayingViewport.contract;
      if (cachedExplanationViewport) return cachedExplanationViewport.contract;
      return contract; // fallback during transitions
    },
    get effectiveUserSeat() { return effectiveUserSeat; },
    get playUserSeat(): Seat {
      return effectiveUserSeat ?? userSeat ?? Seat.South;
    },
    get rotated(): boolean {
      return effectiveUserSeat === Seat.North;
    },

    // Bidding state — always viewport-derived
    get auction(): Auction {
      if (cachedBiddingViewport) {
        return {
          entries: displayedAuctionEntries.map(e => ({ seat: e.seat, call: e.call })),
          isComplete: phase !== "BIDDING",
        };
      }
      return { entries: [], isComplete: false };
    },
    get currentTurn(): Seat | null {
      return displayedCurrentBidder;
    },
    get bidHistory(): BidHistoryEntry[] {
      if (cachedBiddingViewport) {
        return displayedAuctionEntries.map(e => ({
          seat: e.seat,
          call: e.call,
          isUser: false,
          alertLabel: e.alertLabel,
          annotationType: e.annotationType,
        }));
      }
      return [];
    },
    get isProcessing() { return biddingProcessing || playProcessing; },
    get isUserTurn() {
      return displayedIsUserTurn;
    },
    get legalCalls(): Call[] {
      return [...displayedLegalCalls];
    },
    get bidFeedback() { return bidFeedback; },
    get isFeedbackBlocking() { return isFeedbackBlocking; },

    // Play state — always viewport-derived
    get tricks() {
      const vp = cachedPlayingViewport;
      return vp ? vp.tricks : [];
    },
    get currentTrick() {
      return cachedPlayingViewport ? displayedCurrentTrick : [];
    },
    get currentPlayer() {
      const vp = cachedPlayingViewport;
      return vp ? vp.currentPlayer : null;
    },
    get declarerTricksWon() {
      const vp = cachedPlayingViewport;
      return vp ? vp.declarerTricksWon : 0;
    },
    get defenderTricksWon() {
      const vp = cachedPlayingViewport;
      return vp ? vp.defenderTricksWon : 0;
    },
    get dummySeat() {
      const vp = cachedPlayingViewport;
      return vp ? partnerSeat(vp.contract?.declarer ?? Seat.North) : null;
    },
    get score() { return score; },
    get trumpSuit() {
      const vp = cachedPlayingViewport;
      return vp ? vp.trumpSuit : undefined;
    },
    get legalPlaysForCurrentPlayer() {
      const vp = cachedPlayingViewport;
      return vp ? [...vp.legalPlays] : [];
    },
    get userControlledSeats() {
      const vp = cachedPlayingViewport;
      return vp ? [...vp.userControlledSeats] : [];
    },
    get remainingCardsPerSeat() {
      const vp = cachedPlayingViewport;
      return vp ? (vp.remainingCards ?? {}) : {};
    },

    // DDS state
    get ddsSolution() { return ddsSolution; },
    get ddsSolving() { return ddsSolving; },
    get ddsError() { return ddsError; },

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
    get biddingViewport() { return cachedBiddingViewport; },
    get viewportFeedback(): ViewportBidFeedback | null {
      const fb = bidFeedback;
      if (!fb) return null;
      return fb.viewportFeedback;
    },
    get teachingDetail(): TeachingDetail | null {
      const fb = bidFeedback;
      if (!fb) return null;
      return fb.teaching;
    },
    get declarerPromptViewport() { return cachedDeclarerPromptViewport; },
    get playingViewport() { return cachedPlayingViewport; },
    get explanationViewport() { return cachedExplanationViewport; },

    // Namespaced sub-store accessors (backward compat) — delegates to top-level getters
    get bidding() {
      // Capture `this` (the returned store object) to delegate to top-level getters
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const store = this;
      return {
        get auction() { return store.auction; },
        get bidHistory() { return store.bidHistory; },
        get bidFeedback() { return bidFeedback; },
        get legalCalls() { return store.legalCalls; },
        get currentTurn() { return store.currentTurn; },
        get isUserTurn() { return store.isUserTurn; },
      };
    },
    get play() {
      const vp = cachedPlayingViewport;
      return {
        get tricks() { return vp ? vp.tricks : []; },
        get currentTrick() { return vp ? displayedCurrentTrick : []; },
        get currentPlayer() { return vp ? vp.currentPlayer : null; },
        get declarerTricksWon() { return vp ? vp.declarerTricksWon : 0; },
        get defenderTricksWon() { return vp ? vp.defenderTricksWon : 0; },
        get dummySeat() { return vp ? partnerSeat(vp.contract?.declarer ?? Seat.North) : null; },
        get score() { return score; },
        get trumpSuit() { return vp ? vp.trumpSuit : undefined; },
      };
    },
    get dds() {
      return {
        get solution() { return ddsSolution; },
        get solving() { return ddsSolving; },
        get error() { return ddsError; },
      };
    },

    // Public belief state
    get publicBeliefState(): PublicBeliefState { return publicBeliefState; },

    // Debug observability
    get debugLog() { return debugLog; },
    get playLog() { return playLog; },
    get playInferences() { return playInferences; },
    get inferenceTimeline(): readonly InferenceSnapshot[] {
      if (!activeHandle) return [];
      // Inference timeline is fetched from service when needed — return empty for now
      return [];
    },
    get ewInferenceTimeline(): readonly InferenceSnapshot[] {
      if (!activeHandle) return [];
      return [];
    },

    setConventionName(name: string) { conventionName = name; },

    userPlayCard(card: Card, seat: Seat): void {
      userPlayCardViaService(card, seat).catch((err) => { console.error('userPlayCard failed:', err); });
    },

    skipToReview(): void {
      playAborted = true;
      transitionToExplanation();
    },

    acceptPlay,
    declinePlay,
    acceptPrompt,
    declinePrompt,
    acceptDeclarerSwap,
    declineDeclarerSwap,
    acceptDefend,
    declineDefend,
    acceptSouthPlay,
    declineSouthPlay,

    playThisHand() {
      if (!contract) return;
      if (phase !== "EXPLANATION") return;
      resetPlay();
      effectiveUserSeat = userSeat;
      resetDDS();
      transitionTo("DECLARER_PROMPT");
      void refreshViewport();
    },

    async startDrillFromHandle(handle: SessionHandle, drillService?: DevServicePort) {
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
      cachedBiddingViewport = startResult.viewport;

      // Animate initial AI bids via incremental reveal
      if (startResult.aiBids.length > 0 && !startResult.auctionComplete) {
        biddingAnim = { totalAiBids: startResult.aiBids.length, revealed: 0 };

        for (let i = 0; i < startResult.aiBids.length; i++) {
          await delayFn(300);
          if (activeHandle !== handle) return;
          biddingAnim = { totalAiBids: startResult.aiBids.length, revealed: i + 1 };
        }
        biddingAnim = null;
      }

      // Fetch belief state from service
      publicBeliefState = await activeService.getPublicBeliefState(handle);
      if (activeHandle !== handle) return;

      // Handle auction complete during initial bids
      if (startResult.auctionComplete) {
        playInferences = await activeService.capturePlayInferences(handle);
        if (activeHandle !== handle) return;
        const servicePhase = await activeService.getPhase(handle);
        if (activeHandle !== handle) return;
        if (servicePhase === "DECLARER_PROMPT") {
          const dpvp = await activeService.getDeclarerPromptViewport(handle);
          if (activeHandle !== handle) return;
          cachedDeclarerPromptViewport = dpvp;
          contract = dpvp?.contract ?? null;
          effectiveUserSeat = userSeat;
          transitionTo("DECLARER_PROMPT");
        } else if (servicePhase === "EXPLANATION") {
          transitionToExplanation();
        }
      }

      // Populate debug drawer
      if (import.meta.env.DEV) {
        const log = await activeService.getDebugLog(handle);
        debugLog = [...log] as DebugLogEntry[];
      }

      await refreshViewport();
      await tick();
    },

    // Bidding actions
    userBid(call: Call): void {
      userBidViaService(call).catch((e: unknown) => {
        biddingError = e instanceof Error ? e.message : "Unknown error during bid";
      });
    },
    retryBid(): void {
      bidFeedback = null;
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
      return { ...snap, expectedBid: null };
    },

    reset(): void {
      resetImpl();
    },
  };
}
