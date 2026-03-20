/**
 * Per-session state — encapsulates all mutable state for a single drill session.
 *
 * No Svelte dependencies. No $state. No tick(). Plain mutable class.
 */

import type { Deal, Auction, AuctionEntry, Contract, Call, Seat } from "../engine/types";
import type { DrillSession, DrillBundle } from "../bootstrap/types";
import type { ConventionBiddingStrategy, BidResult, BidHistoryEntry, StrategyEvaluation } from "../core/contracts";
import type { PublicBeliefs } from "../core/contracts";
import type { InferenceCoordinator } from "../inference/inference-coordinator";
import type { InferenceSnapshot, PublicBeliefState } from "../inference/types";
import type { GamePhase } from "../stores/phase-machine";
import type { BidFeedbackDTO } from "../bootstrap/bid-feedback-builder";
import type { DebugSnapshot, DebugLogEntry } from "../stores/bidding.svelte";

/** Default empty evaluation — used when no strategy is wired. */
const EMPTY_EVALUATION: StrategyEvaluation = {
  practicalRecommendation: null,
  acceptableAlternatives: null,
  intentFamilies: null,
  provenance: null,
  arbitration: null,
  posteriorSummary: null,
  explanationCatalog: null,
  teachingProjection: null,
  facts: null,
  machineSnapshot: null,
};

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
  readonly strategy: ConventionBiddingStrategy | null;
  readonly inferenceCoordinator: InferenceCoordinator;
  readonly conventionId: string;
  readonly isOffConvention: boolean;

  // Inference state
  playInferences: Record<Seat, PublicBeliefs> | null;
  publicBeliefState: PublicBeliefState;

  // Debug state
  debugLog: DebugLogEntry[];
  debugTurnCounter: number;

  // Feedback
  currentFeedback: BidFeedbackDTO | null;

  constructor(
    bundle: DrillBundle,
    coordinator: InferenceCoordinator,
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
    this.isOffConvention = bundle.isOffConvention ?? false;

    this.playInferences = null;
    this.publicBeliefState = coordinator.getPublicBeliefState();

    this.debugLog = [];
    this.debugTurnCounter = 0;
    this.currentFeedback = null;

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
}
