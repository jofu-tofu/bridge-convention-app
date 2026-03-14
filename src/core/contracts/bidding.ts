import type {
  Auction,
  Call,
  Hand,
  HandEvaluation,
  Seat,
  Vulnerability,
} from "../../engine/types";
import type {
  EvaluationTrace,
  ResolvedCandidateDTO,
} from "./tree-evaluation";
import type { TeachingProjection } from "./teaching-projection";

export interface BiddingContext {
  readonly hand: Hand;
  readonly auction: Auction;
  readonly seat: Seat;
  readonly evaluation: HandEvaluation;
  /** Added in Phase 1 of tree migration. Optional during migration; tree evaluator uses defaults via createBiddingContext(). */
  readonly vulnerability?: Vulnerability;
  /** Added in Phase 1 of tree migration. Optional during migration; tree evaluator uses defaults via createBiddingContext(). */
  readonly dealer?: Seat;
  /** Convention IDs opponents are known to play (from alerts, pre-game card).
   *  Empty array = natural bidding only. Used by evaluation pipeline to compute
   *  opponent inferences from the auction + convention rules. */
  readonly opponentConventionIds: readonly string[];
}

export enum ForcingState {
  Nonforcing = "nonforcing",
  ForcingOneRound = "forcing-one-round",
  GameForcing = "game-forcing",
  PassForcing = "pass-forcing",
}

/** Alert information for conventional (non-natural) bids. */
export interface BidAlert {
  readonly artificial: boolean;
  readonly forcingType: "forcing" | "game-forcing" | "invitational" | "signoff" | null;
}

export interface BidResult {
  readonly call: Call;
  readonly ruleName: string | null;
  readonly explanation: string;
  readonly meaning?: string;
  readonly handSummary?: string;
  readonly evaluationTrace?: EvaluationTrace;
  /** All candidates the pipeline considered for this auction+hand.
   *  Used by teaching-resolution for alternative grading. */
  readonly resolvedCandidates?: readonly ResolvedCandidateDTO[];
}

/** A single entry in the bid history, shown in review/feedback screens. */
export interface BidHistoryEntry {
  readonly seat: Seat;
  readonly call: Call;
  readonly ruleName: string | null;
  readonly explanation: string;
  readonly meaning?: string;
  readonly handSummary?: string;
  readonly isUser: boolean;
  readonly isCorrect?: boolean;
  readonly expectedResult?: BidResult;
  /** Teaching projection snapshot — persisted for review-phase convention analysis.
   *  Present for user bids when the meaning or tree pipeline produced one. */
  readonly teachingProjection?: TeachingProjection;
}

export interface BiddingStrategy {
  readonly id: string;
  readonly name: string;
  suggest(context: BiddingContext): BidResult | null;
}
