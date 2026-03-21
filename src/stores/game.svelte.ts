import type { EnginePort } from "../engine/port";
import type {
  Deal,
  Auction,
  Contract,
} from "../engine/types";
import { Seat } from "../engine/types";
import type { DrillSession, DrillBundle, DevServicePort, SessionHandle } from "../service";
import type { PublicBeliefs } from "../core/contracts";
import type {
  InferenceSnapshot,
  PublicBeliefState,
} from "../service";
import { createInferenceCoordinator } from "../service";
import { partnerSeat, areSamePartnership } from "../engine/constants";
import { createDDSStore } from "./dds.svelte";
import { createPlayStore } from "./play.svelte";
import { createBiddingStore } from "./bidding.svelte";
import { buildBiddingViewport, buildDeclarerPromptViewport, buildPlayingViewport, buildExplanationViewport } from "../service";
import type { BiddingViewport, ViewportBidFeedback, TeachingDetail, DeclarerPromptViewport, PlayingViewport, ExplanationViewport } from "../service";
import { isValidTransition } from "../core/phase-machine";
import type { GamePhase } from "../core/phase-machine";

export type { GamePhase } from "../core/phase-machine";

export interface GameStoreOptions {
  /** Override the delay function used for AI bid/play timing. Defaults to setTimeout-based delay. */
  delayFn?: (ms: number) => Promise<void>;
}

// Re-export types from sub-stores for backward compat
export type { BidHistoryEntry, BidFeedback } from "./bidding.svelte";

// Re-export seatController from play sub-store for backward compat
export { seatController } from "./play.svelte";

type PromptMode = "defender" | "south-declarer" | "declarer-swap";

export function createGameStore(engine: EnginePort, options?: GameStoreOptions) {
  // Coordinator state — owns phase, deal, contract, and cross-cutting concerns
  let deal = $state<Deal | null>(null);
  let phase = $state<GamePhase>("BIDDING");
  let contract = $state<Contract | null>(null);
  let effectiveUserSeat = $state<Seat | null>(null);
  let drillSession = $state<DrillSession | null>(null);
  let conventionName = $state("");

  // Inference coordinator — manages engines, belief state, and annotation production
  const inference = createInferenceCoordinator();
  let playInferences = $state<Record<Seat, PublicBeliefs> | null>(null);
  let publicBeliefState = $state<PublicBeliefState>(inference.getPublicBeliefState());

  // Service delegation — saved at startDrill for passing to sub-stores
  let activeService: DevServicePort | undefined;
  let activeHandle: SessionHandle | undefined;

  // Sub-stores
  const dds = createDDSStore(engine);
  const play = createPlayStore(engine);
  const bidding = createBiddingStore(engine, options);

  const userSeat = $derived<Seat | null>(
    drillSession ? drillSession.config.userSeat : null,
  );

  /**
   * Guard: only allow valid phase transitions.
   * DEV mode throws on invalid transitions; prod mode warns and returns false.
   */
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

  /** Transition to EXPLANATION phase and trigger DDS solve. */
  function transitionToExplanation() {
    if (!transitionTo("EXPLANATION")) return;
    if (deal && contract) {
      void dds.triggerSolve(deal, contract);
    }
  }

  async function completeAuction(finalAuction: Auction) {
    // Capture inferences before transitioning — merge NS + EW data
    playInferences = inference.capturePlayInferences();

    const result = await engine.getContract(finalAuction);
    contract = result;
    if (result) {
      effectiveUserSeat = userSeat;
      transitionTo("DECLARER_PROMPT");
    } else {
      transitionToExplanation();
    }
  }

  async function skipToExplanation(finalAuction: Auction) {
    contract = await engine.getContract(finalAuction);
    transitionToExplanation();
  }

  function startPlayPhase() {
    if (!contract || !deal) return;
    if (!transitionTo("PLAYING")) return;
    play.startPlay({
      deal,
      contract,
      effectiveUserSeat: effectiveUserSeat ?? userSeat ?? Seat.South,
      playStrategy: drillSession?.config.playStrategy ?? null,
      inferences: playInferences,
      onPlayComplete: (_score) => {
        transitionToExplanation();
      },
      service: activeService,
      handle: activeHandle,
    });
  }

  /**
   * Unified play-accept: optional seatOverride sets effectiveUserSeat
   * (e.g., contract.declarer for declarer swap). No override = keep current seat.
   */
  function acceptPlay(seatOverride?: Seat) {
    if (!contract || phase !== "DECLARER_PROMPT") return;
    if (seatOverride) {
      effectiveUserSeat = seatOverride;
    }
    startPlayPhase();
  }

  /** Unified skip-to-review from DECLARER_PROMPT. */
  function declinePlay() {
    if (phase !== "DECLARER_PROMPT") return;
    transitionToExplanation();
  }

  // Backward-compatible aliases
  function acceptDeclarerSwap() {
    if (!contract) return;
    acceptPlay(contract.declarer);
  }

  function declineDeclarerSwap() {
    declinePlay();
  }

  function acceptDefend() {
    acceptPlay();
  }

  function declineDefend() {
    declinePlay();
  }

  function acceptSouthPlay() {
    acceptPlay();
  }

  function declineSouthPlay() {
    declinePlay();
  }

  /** Determine the current prompt mode from game state. */
  function getPromptMode(): PromptMode | null {
    if (phase !== "DECLARER_PROMPT" || !contract || !userSeat) return null;
    if (contract.declarer !== userSeat && partnerSeat(contract.declarer) !== userSeat) return "defender";
    if (contract.declarer === userSeat) return "south-declarer";
    return "declarer-swap";
  }

  /** Accept the current prompt, dispatching based on prompt mode. */
  function acceptPrompt() {
    if (!contract || phase !== "DECLARER_PROMPT") return;
    const mode = getPromptMode();
    if (mode === "declarer-swap") {
      acceptPlay(contract.declarer);
    } else {
      acceptPlay();
    }
  }

  /** Decline the current prompt (skip to review). */
  function declinePrompt() {
    declinePlay();
  }

  /** Compute which seats should be shown face-up, based on current phase and user perspective. */
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
      // defender: only user's hand
    }

    if (phase === "PLAYING" && contract) {
      const dummy = partnerSeat(contract.declarer);
      if (areSamePartnership(dummy, seat)) {
        seats.add(dummy);
      }
    }

    // EXPLANATION: only user's hand (showAll is component-local)

    return seats;
  }

  function resetImpl() {
    deal = null;
    phase = "BIDDING";
    contract = null;
    effectiveUserSeat = null;
    drillSession = null;
    conventionName = "";
    activeService = undefined;
    activeHandle = undefined;
    inference.reset();
    playInferences = null;
    publicBeliefState = inference.getPublicBeliefState();
    // Reset sub-stores
    bidding.reset();
    play.reset();
    dds.reset();
  }

  return {
    get deal() {
      return deal;
    },
    get phase() {
      return phase;
    },
    get contract() {
      return contract;
    },
    get effectiveUserSeat() {
      return effectiveUserSeat;
    },
    /** The seat the user is playing as (effectiveUserSeat after swap, or default userSeat). */
    get playUserSeat(): Seat {
      return effectiveUserSeat ?? userSeat ?? Seat.South;
    },
    /** True when the table should be rotated (user playing as North after declarer swap). */
    get rotated(): boolean {
      return effectiveUserSeat === Seat.North;
    },
    // Bidding state — delegated to bidding sub-store
    get auction() {
      return bidding.auction;
    },
    get currentTurn() {
      return bidding.currentTurn;
    },
    get bidHistory() {
      return bidding.bidHistory;
    },
    get isProcessing() {
      return bidding.isProcessing || play.isProcessing;
    },
    get isUserTurn() {
      return bidding.isUserTurn;
    },
    get legalCalls() {
      return bidding.legalCalls;
    },
    get bidFeedback() {
      return bidding.bidFeedback;
    },
    get isFeedbackBlocking() {
      return bidding.isFeedbackBlocking;
    },
    // Play state — delegated to play sub-store
    get tricks() {
      return play.tricks;
    },
    get currentTrick() {
      return play.currentTrick;
    },
    get currentPlayer() {
      return play.currentPlayer;
    },
    get declarerTricksWon() {
      return play.declarerTricksWon;
    },
    get defenderTricksWon() {
      return play.defenderTricksWon;
    },
    get dummySeat() {
      return play.dummySeat;
    },
    get score() {
      return play.score;
    },
    get trumpSuit() {
      return play.trumpSuit;
    },
    get legalPlaysForCurrentPlayer() {
      return play.legalPlaysForCurrentPlayer;
    },
    get userControlledSeats() {
      return play.userControlledSeats;
    },
    get remainingCardsPerSeat() {
      return play.remainingCardsPerSeat;
    },
    // DDS analysis state — delegated to DDS sub-store
    get ddsSolution() {
      return dds.ddsSolution;
    },
    get ddsSolving() {
      return dds.ddsSolving;
    },
    get ddsError() {
      return dds.ddsError;
    },
    /** True when DECLARER_PROMPT is showing because E/W declares (user defends). */
    get isDefenderPrompt() {
      if (!contract || !userSeat) return false;
      return (
        contract.declarer !== userSeat &&
        partnerSeat(contract.declarer) !== userSeat
      );
    },
    /** True when DECLARER_PROMPT is showing because South (user) is declarer. */
    get isSouthDeclarerPrompt() {
      if (!contract || !userSeat) return false;
      return contract.declarer === userSeat;
    },
    /** Current prompt mode during DECLARER_PROMPT phase. */
    get promptMode(): PromptMode | null {
      return getPromptMode();
    },
    /** Which seats should be shown face-up based on current phase and user perspective. */
    get faceUpSeats(): ReadonlySet<Seat> {
      return getFaceUpSeats();
    },

    // ── Viewport getters ──────────────────────────────────────────

    /** Player-safe viewport for the bidding phase. Null when deal or turn is unavailable. */
    get biddingViewport(): BiddingViewport | null {
      if (!deal || !bidding.currentTurn) return null;
      const seat = userSeat ?? Seat.South;
      return buildBiddingViewport({
        deal,
        userSeat: seat,
        auction: bidding.auction,
        bidHistory: bidding.bidHistory,
        legalCalls: bidding.legalCalls,
        faceUpSeats: getFaceUpSeats(),
        conventionName,
        isUserTurn: bidding.isUserTurn,
        currentBidder: bidding.currentTurn,
      });
    },

    /** Viewport-safe bid feedback. Null when no feedback is active. */
    get viewportFeedback(): ViewportBidFeedback | null {
      const fb = bidding.bidFeedback;
      if (!fb) return null;
      return fb.viewportFeedback;
    },

    /** Teaching detail from the evaluation oracle. Null when no feedback is active. */
    get teachingDetail(): TeachingDetail | null {
      const fb = bidding.bidFeedback;
      if (!fb) return null;
      return fb.teaching;
    },

    /** Player-safe viewport for the declarer prompt phase. Null when not in DECLARER_PROMPT or missing contract. */
    get declarerPromptViewport(): DeclarerPromptViewport | null {
      if (!deal || !contract || phase !== "DECLARER_PROMPT") return null;
      const seat = userSeat ?? Seat.South;
      const mode = getPromptMode();
      if (!mode) return null;
      return buildDeclarerPromptViewport({
        deal,
        userSeat: seat,
        faceUpSeats: getFaceUpSeats(),
        auction: bidding.auction,
        bidHistory: bidding.bidHistory,
        contract,
        promptMode: mode,
      });
    },

    /** Player-safe viewport for the play phase. Null when not in PLAYING or missing deal. */
    get playingViewport(): PlayingViewport | null {
      if (!deal || phase !== "PLAYING") return null;
      return buildPlayingViewport({
        deal,
        faceUpSeats: getFaceUpSeats(),
        auction: bidding.auction,
        bidHistory: bidding.bidHistory,
        rotated: effectiveUserSeat === Seat.North,
        contract,
        currentPlayer: play.currentPlayer,
        currentTrick: play.currentTrick,
        trumpSuit: play.trumpSuit,
        legalPlays: play.legalPlaysForCurrentPlayer,
        userControlledSeats: play.userControlledSeats,
        remainingCards: play.remainingCardsPerSeat ?? {},
        tricks: play.tricks,
        declarerTricksWon: play.declarerTricksWon,
        defenderTricksWon: play.defenderTricksWon,
      });
    },

    /** Player-safe viewport for the explanation/review phase. Null when not in EXPLANATION or missing deal. */
    get explanationViewport(): ExplanationViewport | null {
      if (!deal || phase !== "EXPLANATION") return null;
      const seat = userSeat ?? Seat.South;
      return buildExplanationViewport({
        deal,
        userSeat: seat,
        auction: bidding.auction,
        bidHistory: bidding.bidHistory,
        contract,
        score: play.score,
        declarerTricksWon: play.declarerTricksWon,
      });
    },

    /** Set the convention display name (called by UI layer with app store data). */
    setConventionName(name: string) {
      conventionName = name;
    },

    // --- Namespaced sub-store accessors ---
    get bidding() {
      return {
        get auction() { return bidding.auction; },
        get bidHistory() { return bidding.bidHistory; },
        get bidFeedback() { return bidding.bidFeedback; },
        get legalCalls() { return bidding.legalCalls; },
        get currentTurn() { return bidding.currentTurn; },
        get isUserTurn() { return bidding.isUserTurn; },
      };
    },
    get play() {
      return {
        get tricks() { return play.tricks; },
        get currentTrick() { return play.currentTrick; },
        get currentPlayer() { return play.currentPlayer; },
        get declarerTricksWon() { return play.declarerTricksWon; },
        get defenderTricksWon() { return play.defenderTricksWon; },
        get dummySeat() { return play.dummySeat; },
        get score() { return play.score; },
        get trumpSuit() { return play.trumpSuit; },
      };
    },
    get dds() {
      return {
        get solution() { return dds.ddsSolution; },
        get solving() { return dds.ddsSolving; },
        get error() { return dds.ddsError; },
      };
    },

    // --- Public belief state ---
    get publicBeliefState(): PublicBeliefState {
      return publicBeliefState;
    },

    // --- Debug observability getters ---
    get debugLog() {
      return bidding.debugLog;
    },
    get playLog() {
      return play.playLog;
    },
    get playInferences() {
      return playInferences;
    },
    get inferenceTimeline(): readonly InferenceSnapshot[] {
      return inference.getNSTimeline();
    },
    get ewInferenceTimeline(): readonly InferenceSnapshot[] {
      return inference.getEWTimeline();
    },

    /** Get legal plays for a seat based on current trick context. */
    getLegalPlaysForSeat: play.getLegalPlaysForSeat,

    /** Refresh legal plays for current player (async). */
    refreshLegalPlays: play.refreshLegalPlays,

    /** Get remaining cards for a seat (hand minus played cards). */
    getRemainingCards: play.getRemainingCards,

    userPlayCard: play.userPlayCard,
    skipToReview: play.skipToReview,
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

    /** Return to DECLARER_PROMPT from EXPLANATION so the user can play the hand. */
    playThisHand() {
      if (!contract) return;
      if (phase !== "EXPLANATION") return;
      // Reset play and DDS state before transitioning back
      play.reset();
      effectiveUserSeat = userSeat;
      dds.reset();
      transitionTo("DECLARER_PROMPT");
    },

    async startDrill(bundle: DrillBundle, service?: DevServicePort, handle?: SessionHandle) {
      deal = bundle.deal;
      drillSession = bundle.session;
      conventionName = bundle.session.config.conventionId;
      contract = null;
      phase = "BIDDING";
      effectiveUserSeat = null;

      // Save service + handle for passing to sub-stores (bidding + play)
      activeService = service;
      activeHandle = handle;

      // Reset sub-stores
      play.reset();
      dds.reset();

      // Initialize inference coordinator with engines from bundle
      playInferences = null;
      inference.initialize(bundle.nsInferenceEngine, bundle.ewInferenceEngine);
      publicBeliefState = inference.getPublicBeliefState();

      // When service is wired, call startDrill to run initial AI bids in
      // the service's session state. Pass results to bidding init.
      let initialAiBids: readonly import("../service").AiBidEntry[] | undefined;
      let initialLegalCalls: readonly import("../engine/types").Call[] | undefined;
      let initialAuctionComplete = false;
      if (service && handle) {
        const startResult = await service.startDrill(handle);
        initialAiBids = startResult.aiBids;
        initialLegalCalls = startResult.viewport.legalCalls;
        initialAuctionComplete = startResult.auctionComplete;
      }

      // Initialize bidding sub-store with callbacks
      await bidding.init({
        deal: bundle.deal,
        session: bundle.session,
        strategy: bundle.strategy ?? null,
        initialAuction: bundle.initialAuction,
        onAuctionComplete: completeAuction,
        onSkipToExplanation: skipToExplanation,
        onProcessBid: (bid, auctionBefore, bidResult) => {
          const conventionId = bundle.session.config.conventionId ?? null;
          publicBeliefState = inference.processBid(bid, auctionBefore, bidResult, conventionId);
        },
        service,
        handle,
        initialAiBids,
        initialLegalCalls,
        initialAuctionComplete,
      });
    },

    // Bidding actions — delegated to bidding sub-store
    userBid: bidding.userBid,
    retryBid: bidding.retryBid,
    getExpectedBid: bidding.getExpectedBid,
    getDebugSnapshot: bidding.getDebugSnapshot,

    /** Reset all game state. Returns void — safe for event handlers. */
    reset(): void {
      resetImpl();
    },
  };
}
