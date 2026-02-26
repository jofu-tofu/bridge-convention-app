import type { EnginePort } from "../engine/port";
import type {
  Deal,
  Auction,
  Contract,
} from "../engine/types";
import { Seat } from "../engine/types";
import type { DrillSession } from "../drill/types";
import type { BiddingStrategy } from "../shared/types";
import type { InferredHoldings } from "../shared/types";
import type { InferenceEngine } from "../inference/inference-engine";
import type { InferenceSnapshot } from "../inference/types";
import { partnerSeat } from "../engine/constants";
import { createDDSStore } from "./dds.svelte";
import { createPlayStore } from "./play.svelte";
import { createBiddingStore } from "./bidding.svelte";

export interface GameStoreOptions {
  /** Override the delay function used for AI bid/play timing. Defaults to setTimeout-based delay. */
  delayFn?: (ms: number) => Promise<void>;
}

export type GamePhase =
  | "BIDDING"
  | "DECLARER_PROMPT"
  | "PLAYING"
  | "EXPLANATION";

// Re-export types from sub-stores for backward compat
export type { BidHistoryEntry, BidFeedback } from "./bidding.svelte";
export type { PlayLogEntry } from "./play.svelte";

// Re-export seatController from play sub-store for backward compat
export { seatController } from "./play.svelte";

/** Valid phase transitions. Key = source phase, value = allowed target phases. */
const VALID_TRANSITIONS: Record<GamePhase, readonly GamePhase[]> = {
  BIDDING: ["DECLARER_PROMPT", "EXPLANATION"],
  DECLARER_PROMPT: ["PLAYING", "EXPLANATION"],
  PLAYING: ["EXPLANATION"],
  EXPLANATION: ["DECLARER_PROMPT"],
};

export function createGameStore(engine: EnginePort, options?: GameStoreOptions) {
  // Coordinator state — owns phase, deal, contract, and cross-cutting concerns
  let deal = $state<Deal | null>(null);
  let phase = $state<GamePhase>("BIDDING");
  let contract = $state<Contract | null>(null);
  let effectiveUserSeat = $state<Seat | null>(null);
  let drillSession = $state<DrillSession | null>(null);

  // Inference state — used during both bidding (processBid) and play (getInferences)
  let nsInferenceEngine = $state<InferenceEngine | null>(null);
  let ewInferenceEngine = $state<InferenceEngine | null>(null);
  let playInferences = $state<Record<Seat, InferredHoldings> | null>(null);

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
    const allowed = VALID_TRANSITIONS[phase];
    if (allowed.includes(target)) {
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
      dds.triggerSolve(deal, contract);
    }
  }

  async function completeAuction(finalAuction: Auction) {
    // Capture inferences before transitioning — merge NS + EW data
    if (nsInferenceEngine || ewInferenceEngine) {
      const nsInferences = nsInferenceEngine?.getInferences() ?? {};
      const ewInferences = ewInferenceEngine?.getInferences() ?? {};
      playInferences = { ...nsInferences, ...ewInferences } as Record<Seat, InferredHoldings>;
    }

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

  function resetImpl() {
    deal = null;
    phase = "BIDDING";
    contract = null;
    effectiveUserSeat = null;
    drillSession = null;
    nsInferenceEngine = null;
    ewInferenceEngine = null;
    playInferences = null;
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

    // --- Debug observability getters ---
    get playLog() {
      return play.playLog;
    },
    get playInferences() {
      return playInferences;
    },
    get inferenceTimeline(): readonly InferenceSnapshot[] {
      return nsInferenceEngine?.getTimeline() ?? [];
    },
    get ewInferenceTimeline(): readonly InferenceSnapshot[] {
      return ewInferenceEngine?.getTimeline() ?? [];
    },

    /** Get legal plays for a seat based on current trick context. */
    getLegalPlaysForSeat: play.getLegalPlaysForSeat,

    /** Get remaining cards for a seat (hand minus played cards). */
    getRemainingCards: play.getRemainingCards,

    userPlayCard: play.userPlayCard,
    skipToReview: play.skipToReview,
    acceptPlay,
    declinePlay,
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

    async startDrill(
      newDeal: Deal,
      session: DrillSession,
      initialAuction?: Auction,
      strategy?: BiddingStrategy,
    ) {
      // Eagerly load inference engine BEFORE any $state mutations —
      // dynamic await import() breaks the Svelte 5 scheduler, causing
      // subsequent $state mutations to not trigger DOM updates.
      let inferenceFactory: typeof import("../inference/inference-engine") | null = null;
      const needsInference = session.config.nsInferenceConfig || session.config.ewInferenceConfig;
      if (needsInference) {
        inferenceFactory = await import("../inference/inference-engine");
      }

      deal = newDeal;
      drillSession = session;
      contract = null;
      phase = "BIDDING";
      effectiveUserSeat = null;

      // Reset sub-stores
      play.reset();
      dds.reset();

      // Set up inference engines if configured
      playInferences = null;
      if (inferenceFactory && session.config.nsInferenceConfig) {
        nsInferenceEngine = inferenceFactory.createInferenceEngine(
          session.config.nsInferenceConfig,
          Seat.North,
        );
      } else {
        nsInferenceEngine = null;
      }
      if (inferenceFactory && session.config.ewInferenceConfig) {
        ewInferenceEngine = inferenceFactory.createInferenceEngine(
          session.config.ewInferenceConfig,
          Seat.East,
        );
      } else {
        ewInferenceEngine = null;
      }

      // Initialize bidding sub-store with callbacks
      await bidding.init({
        deal: newDeal,
        session,
        strategy: strategy ?? null,
        initialAuction,
        onAuctionComplete: completeAuction,
        onSkipToExplanation: skipToExplanation,
        onProcessBid: (nsInferenceEngine || ewInferenceEngine)
          ? (bid, auctionBefore) => {
              nsInferenceEngine?.processBid(bid, auctionBefore);
              ewInferenceEngine?.processBid(bid, auctionBefore);
            }
          : undefined,
      });
    },

    // Bidding actions — delegated to bidding sub-store
    userBid: bidding.userBid,
    dismissBidFeedback: bidding.dismissBidFeedback,
    retryBid: bidding.retryBid,
    skipFromFeedback: bidding.skipFromFeedback,
    getExpectedBid: bidding.getExpectedBid,

    /** Reset all game state. Returns void — safe for event handlers. */
    reset(): void {
      resetImpl();
    },
  };
}
