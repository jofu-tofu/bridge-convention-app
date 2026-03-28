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
import type { StrategyEvaluation } from "../service/debug-types";
import type { ServicePublicBeliefState, ServiceInferenceSnapshot } from "../service";
import { nextSeat, partnerSeat } from "../service";

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
import type { PracticeMode, PlayPreference } from "../service";
import type { BidFeedbackDTO, PlaySuggestions } from "../service/debug-types";
import { isValidTransition } from "../service";
import type { GamePhase } from "../service";
import { delay } from "../service";
import { TRICK_PAUSE, AI_PLAY_DELAY } from "./animate";

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

// ── Grouped phase state types ───────────────────────────────────────

export interface BiddingPhaseState { processing: boolean; error: string | null; debugLog: DebugLogEntry[]; }
export interface PlayPhaseState { score: number | null; aborted: boolean; showingTrickResult: boolean; processing: boolean; log: PlayLogEntry[]; suggestions: PlaySuggestions; }
export interface DDSState { solution: DDSolution | null; solving: boolean; error: string | null; }
export interface InferenceState { playInferences: Record<Seat, ServicePublicBeliefs> | null; publicBeliefState: ServicePublicBeliefState; }
export interface ViewportCache { bidding: BiddingViewport | null; declarerPrompt: DeclarerPromptViewport | null; playing: PlayingViewport | null; explanation: ExplanationViewport | null; }

function freshBiddingState(): BiddingPhaseState { return { processing: false, error: null, debugLog: [] }; }
function freshPlayState(aborted = false): PlayPhaseState { return { score: null, aborted, showingTrickResult: false, processing: false, log: [], suggestions: [] }; }
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
  // Not $state — swapped per-drill, not reactive (components access via closures)
  let activeService: DevServicePort = service;
  let deal = $state<Deal | null>(null);
  let phase = $state<GamePhase>("BIDDING");
  let contract = $state<Contract | null>(null);
  let conventionName = $state("");
  let effectiveUserSeat = $state<Seat | null>(null);
  let practiceMode = $state<PracticeMode>("decision-drill");
  let playPreference = $state<PlayPreference>("prompt");

  // ── Grouped phase state ─────────────────────────────────────
  // $state.raw required — deep proxy breaks reference equality. Do not fold into BiddingPhaseState.
  let bidFeedback = $state.raw<BidFeedback | null>(null);

  let bidding = $state<BiddingPhaseState>(freshBiddingState());
  let play = $state<PlayPhaseState>(freshPlayState());
  let dds = $state<DDSState>(freshDDSState());
  let inference = $state<InferenceState>(freshInferenceState());
  let viewports = $state<ViewportCache>(freshViewportCache());

  // ── Animation state (flat — independent lifecycles) ─────────
  // biddingAnim: controls incremental reveal of AI bids from the viewport.
  // When non-null, displayedAuctionEntries slices the viewport's entries.
  let biddingAnim = $state<{ totalAiBids: number; revealed: number } | null>(null);

  // Viewport-derived display values — single source of truth for bidding UI
  const displayedAuctionEntries = $derived.by((): readonly AuctionEntryView[] => {
    const vp = viewports.bidding;
    if (!vp) return [];
    if (!biddingAnim) return vp.auctionEntries;
    const baseCount = vp.auctionEntries.length - biddingAnim.totalAiBids;
    return vp.auctionEntries.slice(0, baseCount + biddingAnim.revealed);
  });

  const displayedLegalCalls = $derived.by((): readonly Call[] => {
    if (bidding.processing || biddingAnim) return [];
    return viewports.bidding?.legalCalls ?? [];
  });

  const displayedCurrentBidder = $derived.by((): Seat | null => {
    const vp = viewports.bidding;
    if (!vp) return null;
    if (!biddingAnim) return vp.currentBidder;
    // During animation, derive current bidder from the last displayed entry
    const displayed = displayedAuctionEntries;
    if (displayed.length === 0) return vp.dealer;
    return nextSeat(displayed[displayed.length - 1]!.seat);
  });

  const displayedIsUserTurn = $derived(
    !bidding.processing &&
    !biddingAnim &&
    phase === "BIDDING" &&
    viewports.bidding !== null &&
    viewports.bidding.isUserTurn,
  );

  // ── Play animation state ─────────────────────────────────────
  /** When set, overrides the viewport's currentTrick for display during animation. */
  let animatedTrickOverride = $state<readonly PlayedCard[] | null>(null);

  const displayedCurrentTrick = $derived.by((): readonly PlayedCard[] => {
    if (animatedTrickOverride) return animatedTrickOverride;
    const vp = viewports.playing;
    if (!vp) return [];
    return vp.currentTrick;
  });

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

  // ── Derived ───────────────────────────────────────────────────

  const userSeat = $derived<Seat | null>(
    viewports.bidding?.seat ?? viewports.declarerPrompt?.userSeat ?? viewports.playing?.userSeat ?? viewports.explanation?.userSeat ?? null,
  );

  // Grade-acceptance policy: only near-miss/incorrect block.
  // Acceptable/correct-not-preferred show non-blocking feedback below bid table.
  const isFeedbackBlocking = $derived(
    bidFeedback !== null &&
      (bidFeedback.grade === "near-miss" || bidFeedback.grade === "incorrect"),
  );

  // ── Practice mode helpers ────────────────────────────────────

  /**
   * Handle auto-transition from DECLARER_PROMPT based on playPreference.
   * Returns true if an auto-transition was performed (caller should not
   * do normal DECLARER_PROMPT handling).
   */
  async function maybeAutoTransitionFromPrompt(handle: SessionHandle): Promise<boolean> {
    if (playPreference === "prompt") return false;

    if (playPreference === "always") {
      // Auto-accept play without showing the declarer prompt
      acceptPrompt();
      return true;
    }

    if (playPreference === "skip") {
      // Auto-skip to explanation without showing the declarer prompt
      try {
        await activeService.acceptPrompt(handle, "skip");
      } catch (err) {
        console.error("auto-skip acceptPrompt failed:", err);
      }
      transitionToExplanation();
      return true;
    }

    return false;
  }

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
      // Dummy is always visible to all players in bridge
      const dummy = partnerSeat(contract.declarer);
      seats.add(dummy);
    }

    return seats;
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
      dds.error = err instanceof Error ? err.message : String(err);
    } finally {
      if (activeHandle === handle) {
        dds.solving = false;
      }
    }
  }

  // ── Play helpers ──────────────────────────────────────────────

  async function fetchPlaySuggestions(handle: SessionHandle) {
    if (!import.meta.env.DEV) return;
    try {
      play.suggestions = await activeService.getPlaySuggestions(handle);
    } catch {
      play.suggestions = [];
    }
  }

  /**
   * Animate a sequence of AI plays with delays between cards and pauses at trick boundaries.
   * Builds a local trick buffer that overrides the viewport's currentTrick for display.
   */
  async function animateAiPlays(
    handle: SessionHandle,
    aiPlays: readonly { seat: Seat; card: Card; reason: string; trickComplete?: boolean }[],
    baseTrick: readonly PlayedCard[],
  ): Promise<{ ok: boolean; finalCompletedTrick: readonly PlayedCard[] | null }> {
    if (aiPlays.length === 0) return { ok: true, finalCompletedTrick: null };
    // Start with the cards already visible in the current trick
    const trickBuffer: PlayedCard[] = [...baseTrick];
    animatedTrickOverride = trickBuffer;
    let finalCompletedTrick: readonly PlayedCard[] | null = null;

    for (const aiPlay of aiPlays) {
      await delayFn(AI_PLAY_DELAY);
      if (activeHandle !== handle || play.aborted) return { ok: false, finalCompletedTrick: null };

      // Add the AI card to the display buffer
      trickBuffer.push({ card: aiPlay.card, seat: aiPlay.seat });
      animatedTrickOverride = [...trickBuffer];

      play.log = [...play.log, {
        seat: aiPlay.seat, card: aiPlay.card, reason: aiPlay.reason,
        trickIndex: viewports.playing?.tricks.length ?? 0,
      }];

      // Pause at trick boundaries (4th card in trick)
      if (aiPlay.trickComplete) {
        play.showingTrickResult = true;

        // Capture the completed trick if this is the last AI play
        const isLastAiPlay = aiPlay === aiPlays[aiPlays.length - 1];
        if (isLastAiPlay) {
          finalCompletedTrick = [...trickBuffer];
        }

        await delayFn(TRICK_PAUSE);
        if (activeHandle !== handle || play.aborted) return { ok: false, finalCompletedTrick: null };

        play.showingTrickResult = false;
        // Clear the trick buffer for the next trick
        trickBuffer.length = 0;
        animatedTrickOverride = [...trickBuffer];
      }
    }

    animatedTrickOverride = null;
    return { ok: true, finalCompletedTrick };
  }

  /**
   * Show the final completed trick briefly, then transition to review.
   */
  async function showFinalTrickAndTransition(
    handle: SessionHandle,
    finalTrick: readonly PlayedCard[],
    resultScore: number | null,
  ): Promise<void> {
    animatedTrickOverride = finalTrick;
    play.showingTrickResult = true;
    await delayFn(TRICK_PAUSE);
    if (activeHandle !== handle || play.aborted) return;
    play.score = resultScore;
    animatedTrickOverride = null;
    transitionToExplanation();
  }

  async function userPlayCardViaService(card: Card, seat: Seat) {
    if (!activeHandle) return;
    if (play.processing || play.aborted) return;

    const handle = activeHandle;
    play.processing = true;
    try {
      // Snapshot the current trick before the service processes the play
      const trickBeforePlay: PlayedCard[] = viewports.playing
        ? [...viewports.playing.currentTrick]
        : [];

      const result = await activeService.playCard(handle, card, seat);
      if (activeHandle !== handle) return;

      if (!result.accepted) return;

      // When play completes, skip viewport refresh to keep hands visible during
      // the last trick animation (otherwise all hands show as empty)
      if (!result.playComplete) {
        viewports.playing = await activeService.getPlayingViewport(handle);
        if (activeHandle !== handle) return;
      }

      // Build the base trick: cards that were visible + the user's card
      const baseTrick: PlayedCard[] = [...trickBeforePlay, { card, seat }];

      // If the user's card completed the trick (4th card), pause to show it
      if (baseTrick.length === 4) {
        animatedTrickOverride = baseTrick;
        play.showingTrickResult = true;
        await delayFn(TRICK_PAUSE);
        if (activeHandle !== handle || play.aborted) return;

        if (!result.playComplete) {
          play.showingTrickResult = false;
          animatedTrickOverride = null;
          // Start fresh for AI plays in the next trick
          const { ok } = await animateAiPlays(handle, result.aiPlays, []);
          if (!ok) return;
        }
        // When play completes, keep the last trick visible on the table
      } else {
        // User's card didn't complete the trick — AI continues
        const { ok, finalCompletedTrick } = await animateAiPlays(handle, result.aiPlays, baseTrick);
        if (!ok) return;

        if (result.playComplete) {
          // AI completed the final trick. finalCompletedTrick should be non-null here
          // because playComplete + baseTrick.length < 4 means AI played the completing card.
          // Guard defensively in case the service contract changes.
          if (finalCompletedTrick) {
            await showFinalTrickAndTransition(handle, finalCompletedTrick, result.score);
          } else {
            play.score = result.score;
            transitionToExplanation();
          }
          return;
        }
      }

      // Handle play completion (baseTrick.length === 4 branch)
      if (result.playComplete) {
        play.score = result.score;
        play.suggestions = [];
        transitionToExplanation();
      } else {
        // Normal mid-game — refresh viewport for next turn
        viewports.playing = await activeService.getPlayingViewport(handle);
        if (activeHandle !== handle) return;
        void fetchPlaySuggestions(handle);
      }
    } finally {
      play.processing = false;
      animatedTrickOverride = null;
      await tick();
    }
  }

  // ── Bidding helpers ───────────────────────────────────────────

  async function userBidViaService(call: Call) {
    if (!activeHandle) return;
    if (bidding.processing) return;
    if (!displayedIsUserTurn) return;

    // Clear non-blocking feedback from previous bid (acceptable/correct-not-preferred)
    if (bidFeedback && !isFeedbackBlocking) {
      bidFeedback = null;
    }

    const handle = activeHandle;
    bidding.processing = true;
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
          bidding.debugLog = [...log] as DebugLogEntry[];
        }
        await tick();
        return;
      }

      // Show non-blocking feedback for accepted bids with non-correct grades
      if (result.grade && result.grade !== "correct" && result.feedback) {
        bidFeedback = {
          grade: result.grade,
          viewportFeedback: result.feedback,
          teaching: result.teaching,
        };
      } else {
        bidFeedback = null;
      }

      // Update viewport — always non-null for accepted bids (PR 0 fix)
      if (result.nextViewport) {
        viewports.bidding = result.nextViewport;
      }

      if (import.meta.env.DEV) {
        const log = await activeService.getDebugLog(handle);
        bidding.debugLog = [...log] as DebugLogEntry[];
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
      inference.publicBeliefState = await activeService.getPublicBeliefState(handle);
      if (activeHandle !== handle) return;

      // Handle phase transition (auction complete)
      const phaseTransitioned = result.phaseTransition ||
        (result.aiBids.length > 0 && await activeService.getPhase(handle) !== "BIDDING");
      if (activeHandle !== handle) return;

      if (phaseTransitioned) {
        inference.playInferences = await activeService.capturePlayInferences(handle);
        if (activeHandle !== handle) return;
        const servicePhase = await activeService.getPhase(handle);
        if (activeHandle !== handle) return;
        if (servicePhase === "DECLARER_PROMPT") {
          const dpvp = await activeService.getDeclarerPromptViewport(handle);
          if (activeHandle !== handle) return;
          viewports.declarerPrompt = dpvp;
          contract = dpvp?.contract ?? null;
          effectiveUserSeat = userSeat;
          transitionTo("DECLARER_PROMPT");
          const autoHandled = await maybeAutoTransitionFromPrompt(handle);
          if (autoHandled && activeHandle !== handle) return;
        } else if (servicePhase === "EXPLANATION") {
          // Fetch explanation viewport first so we can capture the contract
          // (non-null when playPreference="skip" bypassed DECLARER_PROMPT).
          viewports.explanation = await activeService.getExplanationViewport(handle);
          if (activeHandle !== handle) return;
          contract = viewports.explanation?.contract ?? null;
          transitionToExplanation();
        }
        await tick();
        return;
      }
    } catch (e) {
      bidding.error = e instanceof Error ? e.message : "Unknown error during bid";
    } finally {
      bidding.processing = false;
      await tick();
    }
  }

  // ── Play phase transitions ────────────────────────────────────

  function acceptPlay(seatOverride?: Seat) {
    if (!contract || phase !== "DECLARER_PROMPT") return;
    if (!activeHandle) return;
    const seat = seatOverride ?? effectiveUserSeat ?? userSeat ?? Seat.South;
    effectiveUserSeat = seat;
    const handle = activeHandle;

    // Transition to PLAYING immediately for responsive UI
    if (!transitionTo("PLAYING")) return;
    play.aborted = false;
    animatedTrickOverride = null;
    play.score = null;
    play.showingTrickResult = false;
    play.processing = false;
    play.log = [];

    void (async () => {
      try {
        // Accept prompt on service side (initializes play + runs initial AI plays)
        const result = await activeService.acceptPrompt(handle, "play", seat);
        if (activeHandle !== handle) return;

        // Fetch viewport (includes any AI plays already applied)
        viewports.playing = await activeService.getPlayingViewport(handle);
        if (activeHandle !== handle) return;

        // Animate initial AI plays (e.g., opening lead by AI)
        const aiPlays = result.aiPlays ?? [];
        if (aiPlays.length > 0) {
          const { ok } = await animateAiPlays(handle, aiPlays, []);
          if (!ok) return;
        }

        // Fetch play suggestions for the user's first turn
        void fetchPlaySuggestions(handle);
      } catch (err) {
        console.error('acceptPlay failed:', err);
      }
    })();
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
    practiceMode = "decision-drill";
    playPreference = "prompt";

    // Grouped state
    bidding = freshBiddingState();
    bidFeedback = null;
    play = freshPlayState(true); // aborted=true cancels in-flight animations
    dds = freshDDSState();
    inference = freshInferenceState();
    viewports = freshViewportCache();

    // Animation
    biddingAnim = null;
    animatedTrickOverride = null;
  }

  function resetPlay() {
    play = freshPlayState(true); // aborted=true cancels in-flight animations
    animatedTrickOverride = null;
    viewports.playing = null; // direct property mutation — fine-grained
  }

  // ── Return ────────────────────────────────────────────────────

  return {
    get activeHandle() { return activeHandle; },
    /** True when a drill has been started (deal is loaded). Use instead of `deal !== null`. */
    get isInitialized(): boolean { return deal !== null || activeHandle !== null; },
    get deal() { return deal; },
    get phase() { return phase; },
    get contract(): Contract | null {
      if (viewports.declarerPrompt) return viewports.declarerPrompt.contract;
      if (viewports.playing) return viewports.playing.contract;
      if (viewports.explanation) return viewports.explanation.contract;
      return contract; // fallback during transitions
    },
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
      if (viewports.bidding) {
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
    get isProcessing() { return bidding.processing || play.processing; },
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
      const vp = viewports.playing;
      return vp ? vp.tricks : [];
    },
    get currentTrick() {
      return viewports.playing ? displayedCurrentTrick : [];
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
    get score() { return play.score; },
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
      const fb = bidFeedback;
      if (!fb) return null;
      return fb.viewportFeedback;
    },
    get teachingDetail(): TeachingDetail | null {
      const fb = bidFeedback;
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
        get bidFeedback() { return bidFeedback; },
        get legalCalls() { return store.legalCalls; },
        get currentTurn() { return store.currentTurn; },
        get isUserTurn() { return store.isUserTurn; },
      };
    },
    get play() {
      const vp = viewports.playing;
      return {
        get tricks() { return vp ? vp.tricks : []; },
        get currentTrick() { return vp ? displayedCurrentTrick : []; },
        get currentPlayer() { return vp ? vp.currentPlayer : null; },
        get declarerTricksWon() { return vp ? vp.declarerTricksWon : 0; },
        get defenderTricksWon() { return vp ? vp.defenderTricksWon : 0; },
        get dummySeat() { return vp ? partnerSeat(vp.contract?.declarer ?? Seat.North) : null; },
        get score() { return play.score; },
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

    // Debug observability
    get debugLog() { return bidding.debugLog; },
    get playLog() { return play.log; },
    get playSuggestions() { return play.suggestions; },
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
      userPlayCardViaService(card, seat).catch((err) => { console.error('userPlayCard failed:', err); });
    },

    skipToReview(): void {
      play.aborted = true;
      if (activeHandle) {
        activeService.skipToReview(activeHandle)
          .then(() => transitionToExplanation())
          .catch((err) => { console.error('skipToReview failed:', err); });
      }
    },

    restartPlay(): void {
      if (!contract || phase !== "PLAYING") return;
      if (!activeHandle) return;
      const handle = activeHandle;

      // Cancel in-flight animations (keep stale viewport to avoid UI flash)
      play.aborted = true;
      play.score = null;
      play.showingTrickResult = false;
      play.processing = false;
      play.log = [];
      play.suggestions = [];
      animatedTrickOverride = null;

      void (async () => {
        try {
          play.aborted = false;
          const result = await activeService.restartPlay(handle);
          if (activeHandle !== handle) return;

          // Replace stale viewport with fresh one
          viewports.playing = await activeService.getPlayingViewport(handle);
          if (activeHandle !== handle) return;

          const aiPlays = result.aiPlays ?? [];
          if (aiPlays.length > 0) {
            const { ok } = await animateAiPlays(handle, aiPlays, []);
            if (!ok) return;
          }

          void fetchPlaySuggestions(handle);
        } catch (err) {
          console.error('restartPlay failed:', err);
        }
      })();
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
      // Check viewport contract — the internal `contract` variable may be null
      // when playPreference="skip" bypassed DECLARER_PROMPT (contract was never
      // stored locally, but the session and viewport still have it).
      const viewportContract = viewports.explanation?.contract ?? contract;
      if (!viewportContract) return;
      if (phase !== "EXPLANATION") return;
      if (!activeHandle) return;
      const handle = activeHandle;
      resetPlay();
      effectiveUserSeat = userSeat;
      dds = freshDDSState();
      // Transition service-side phase back to DECLARER_PROMPT, fetch viewport, then transition store
      void (async () => {
        try {
          await activeService.acceptPrompt(handle, "replay");
          if (activeHandle !== handle) return;
          const dpvp = await activeService.getDeclarerPromptViewport(handle);
          if (activeHandle !== handle) return;
          viewports.declarerPrompt = dpvp;
          transitionTo("DECLARER_PROMPT");
          await tick();
        } catch (err) {
          console.error('playThisHand failed:', err);
        }
      })();
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
      viewports.bidding = startResult.viewport;
      practiceMode = startResult.practiceMode;
      playPreference = startResult.playPreference;

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
      inference.publicBeliefState = await activeService.getPublicBeliefState(handle);
      if (activeHandle !== handle) return;

      // Handle auction complete during initial bids
      if (startResult.auctionComplete) {
        inference.playInferences = await activeService.capturePlayInferences(handle);
        if (activeHandle !== handle) return;
        const servicePhase = await activeService.getPhase(handle);
        if (activeHandle !== handle) return;
        if (servicePhase === "DECLARER_PROMPT") {
          const dpvp = await activeService.getDeclarerPromptViewport(handle);
          if (activeHandle !== handle) return;
          viewports.declarerPrompt = dpvp;
          contract = dpvp?.contract ?? null;
          effectiveUserSeat = userSeat;
          transitionTo("DECLARER_PROMPT");
          const autoHandled = await maybeAutoTransitionFromPrompt(handle);
          if (autoHandled && activeHandle !== handle) return;
        } else if (servicePhase === "EXPLANATION") {
          // Fetch explanation viewport to capture contract before transitioning
          viewports.explanation = await activeService.getExplanationViewport(handle);
          if (activeHandle !== handle) return;
          contract = viewports.explanation?.contract ?? null;
          transitionToExplanation();
        }
      }

      // Populate debug drawer
      if (import.meta.env.DEV) {
        const log = await activeService.getDebugLog(handle);
        bidding.debugLog = [...log] as DebugLogEntry[];
      }

      await refreshViewport();
      await tick();
    },

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

        // Check if auction completed
        const servicePhase = await activeService.getPhase(handle);
        if (activeHandle !== handle) return false;

        if (servicePhase !== "BIDDING") {
          inference.playInferences = await activeService.capturePlayInferences(handle);
          if (activeHandle !== handle) return false;

          if (servicePhase === "DECLARER_PROMPT") {
            const dpvp = await activeService.getDeclarerPromptViewport(handle);
            if (activeHandle !== handle) return false;
            viewports.declarerPrompt = dpvp;
            contract = dpvp?.contract ?? null;
            effectiveUserSeat = userSeat;
            transitionTo("DECLARER_PROMPT");
          } else if (servicePhase === "EXPLANATION") {
            // Fetch explanation viewport to capture contract before transitioning
            viewports.explanation = await activeService.getExplanationViewport(handle);
            if (activeHandle !== handle) return false;
            contract = viewports.explanation?.contract ?? null;
            transitionToExplanation();
          }
          break;
        }
      }

      // Now advance from DECLARER_PROMPT to target
      if (targetPhase === "declarer") {
        // Already there (or explanation if all passed)
        return phase === "DECLARER_PROMPT";
      }

      if (targetPhase === "playing" && phase === "DECLARER_PROMPT") {
        acceptPrompt();
        return true;
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
      userBidViaService(call).catch((e: unknown) => {
        bidding.error = e instanceof Error ? e.message : "Unknown error during bid";
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
