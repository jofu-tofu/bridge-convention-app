/**
 * Per-session state — encapsulates all mutable state for a single drill session.
 *
 * No Svelte dependencies. No $state. No tick(). Plain mutable class.
 */

import type { Deal, Auction, AuctionEntry, Contract, Call, Seat, Card, Trick, PlayedCard } from "../engine/types";
import { BidSuit, Suit } from "../engine/types";
import type { DrillSession, DrillBundle } from "../bootstrap/types";
import type { BidResult, BidHistoryEntry, PlayStrategy } from "../core/contracts";
import type { ConventionStrategy, StrategyEvaluation } from "../conventions";
import type { PublicBeliefs } from "../core/contracts";
import type { InferenceCoordinator } from "../inference/inference-coordinator";
import type { InferenceSnapshot, PublicBeliefState } from "../inference/types";
import type { GamePhase } from "../core/phase-machine";
import type { DebugSnapshot, DebugLogEntry } from "../stores/game.svelte";
import { nextSeat, partnerSeat } from "../engine/constants";

/** Default empty evaluation — used when no strategy is wired. */
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

/** Get current turn seat from the auction in a session state. */
export function getCurrentTurn(state: SessionState): Seat | null {
  if (state.auction.entries.length === 0) {
    return state.deal.dealer;
  }
  const lastEntry = state.auction.entries[state.auction.entries.length - 1]!;
  return nextSeat(lastEntry.seat);
}

export class SessionState {
  // Game state
  deal: Deal;
  auction: Auction;
  bidHistory: BidHistoryEntry[];
  phase: GamePhase;
  contract: Contract | null;
  effectiveUserSeat: Seat | null;
  legalCalls: Call[];

  // Session objects
  readonly session: DrillSession;
  readonly strategy: ConventionStrategy | null;
  readonly inferenceCoordinator: InferenceCoordinator;
  readonly conventionId: string;
  readonly conventionName: string;
  readonly isOffConvention: boolean;
  /** Transitional: raw bundle for stores that still need it. Will be removed (Phases 2-4). */
  readonly bundle: DrillBundle;

  // Inference state
  playInferences: Record<Seat, PublicBeliefs> | null;
  publicBeliefState: PublicBeliefState;

  // Debug state
  debugLog: DebugLogEntry[];
  debugTurnCounter: number;

  // ── Play state ──────────────────────────────────────────────────
  tricks: Trick[];
  currentTrick: PlayedCard[];
  currentPlayer: Seat | null;
  declarerTricksWon: number;
  defenderTricksWon: number;
  dummySeat: Seat | null;
  trumpSuit: Suit | undefined;
  playScore: number | null;
  playStrategy: PlayStrategy | null;

  constructor(
    bundle: DrillBundle,
    coordinator: InferenceCoordinator,
    conventionName?: string,
  ) {
    this.deal = bundle.deal;
    this.auction = { entries: [], isComplete: false };
    this.bidHistory = [];
    this.phase = "BIDDING";
    this.contract = null;
    this.effectiveUserSeat = null;
    this.legalCalls = [];

    this.session = bundle.session;
    this.strategy = bundle.strategy ?? null;
    this.inferenceCoordinator = coordinator;
    this.conventionId = bundle.session.config.conventionId;
    this.conventionName = conventionName ?? bundle.session.config.conventionId;
    this.isOffConvention = bundle.isOffConvention ?? false;
    this.bundle = bundle;

    this.playInferences = null;
    this.publicBeliefState = coordinator.getPublicBeliefState();

    this.debugLog = [];
    this.debugTurnCounter = 0;

    // Play state defaults
    this.tricks = [];
    this.currentTrick = [];
    this.currentPlayer = null;
    this.declarerTricksWon = 0;
    this.defenderTricksWon = 0;
    this.dummySeat = null;
    this.trumpSuit = undefined;
    this.playScore = null;
    this.playStrategy = bundle.session.config.playStrategy ?? null;

    // Initialize inference coordinator with engines from bundle
    coordinator.initialize(bundle.nsInferenceEngine, bundle.ewInferenceEngine);
  }

  /** Get the user seat from the session config. */
  get userSeat(): Seat {
    return this.session.config.userSeat;
  }

  /** Check if the given seat is the user's seat. */
  isUserSeat(seat: Seat): boolean {
    return this.session.isUserSeat(seat);
  }

  /** Process a bid through inference. */
  processBid(entry: AuctionEntry, auctionBefore: Auction, bidResult: BidResult | null): void {
    this.publicBeliefState = this.inferenceCoordinator.processBid(
      entry,
      auctionBefore,
      bidResult,
      this.conventionId,
    );
  }

  /** Capture inferences at auction end. */
  capturePlayInferences(): void {
    this.playInferences = this.inferenceCoordinator.capturePlayInferences();
  }

  /** Build a DebugSnapshot from the convention strategy's cached state. */
  captureSnapshot(): DebugSnapshot {
    const evaluation = this.strategy?.getLastEvaluation() ?? EMPTY_EVALUATION;
    return { expectedBid: null, ...evaluation };
  }

  /** Append a debug log entry. */
  pushDebugLog(entry: DebugLogEntry): void {
    this.debugLog = [...this.debugLog, entry];
  }

  /** NS inference timeline. */
  getNSTimeline(): readonly InferenceSnapshot[] {
    return this.inferenceCoordinator.getNSTimeline();
  }

  /** EW inference timeline. */
  getEWTimeline(): readonly InferenceSnapshot[] {
    return this.inferenceCoordinator.getEWTimeline();
  }

  // ── Play initialization ───────────────────────────────────────────

  /** Map BidSuit to Suit for trump. NoTrump returns undefined. */
  private static bidSuitToSuit(strain: BidSuit): Suit | undefined {
    switch (strain) {
      case BidSuit.Clubs: return Suit.Clubs;
      case BidSuit.Diamonds: return Suit.Diamonds;
      case BidSuit.Hearts: return Suit.Hearts;
      case BidSuit.Spades: return Suit.Spades;
      case BidSuit.NoTrump: return undefined;
      default: {
        const _exhaustive: never = strain;
        throw new Error(`Unknown BidSuit: ${String(_exhaustive)}`);
      }
    }
  }

  /** Initialize play state from the contract. Called when transitioning to PLAYING. */
  initializePlay(contract: Contract): void {
    this.tricks = [];
    this.currentTrick = [];
    this.declarerTricksWon = 0;
    this.defenderTricksWon = 0;
    this.dummySeat = partnerSeat(contract.declarer);
    this.trumpSuit = SessionState.bidSuitToSuit(contract.strain);
    this.playScore = null;
    // Opening leader: left of declarer
    this.currentPlayer = nextSeat(contract.declarer);
  }

  /** Check if a seat is user-controlled during play. */
  isUserControlledPlay(seat: Seat): boolean {
    if (!this.contract || !this.effectiveUserSeat) return false;
    if (seat === this.effectiveUserSeat) return true;
    if (seat === partnerSeat(this.contract.declarer) && this.contract.declarer === this.effectiveUserSeat) return true;
    return false;
  }

  /** Get remaining cards for a seat (original hand minus played cards). */
  getRemainingCards(seat: Seat): Card[] {
    const played = new Set<string>();
    for (const trick of this.tricks) {
      for (const p of trick.plays) {
        if (p.seat === seat) played.add(`${p.card.suit}${p.card.rank}`);
      }
    }
    for (const p of this.currentTrick) {
      if (p.seat === seat) played.add(`${p.card.suit}${p.card.rank}`);
    }
    return this.deal.hands[seat].cards.filter(
      (c) => !played.has(`${c.suit}${c.rank}`),
    );
  }

  /** Get lead suit of current trick (undefined if no cards played yet). */
  getLeadSuit(): Suit | undefined {
    return this.currentTrick.length > 0 ? this.currentTrick[0]!.card.suit : undefined;
  }
}
