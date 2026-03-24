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
} from "../../conventions/pipeline/tree-evaluation";
import type { TeachingProjection } from "../../conventions/teaching/teaching-types";
import type { FactConstraint } from "../../conventions/core/agreement-module";

export interface BiddingContext {
  readonly hand: Hand;
  readonly auction: Auction;
  readonly seat: Seat;
  readonly evaluation: HandEvaluation;
  /** Optional — defaults are supplied via createBiddingContext() when not provided. */
  readonly vulnerability?: Vulnerability;
  /** Optional — defaults are supplied via createBiddingContext() when not provided. */
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

/** Alert at the bridge table — this bid is conventional and its meaning
 *  should be disclosed to opponents. */
export interface BidAlert {
  /** Human-readable label for UI display (from surface.teachingLabel). */
  readonly teachingLabel: string;
  /** ACBL annotation type: alert (conventional bid), announce (announced range/transfer),
   *  or educational (informational label for learning, not ACBL-required). */
  readonly annotationType?: "alert" | "announce" | "educational";
}

export interface BidResult {
  readonly call: Call;
  readonly ruleName: string | null;
  readonly explanation: string;
  readonly meaning?: string;
  /** Alert information when this bid is conventional/alertable. Null for natural bids. */
  readonly alert?: BidAlert | null;
  /** All constraints from the winning surface's clauses, with isPublic flag preserved.
   *  Consumers filter by isPublic as needed. */
  readonly constraints?: readonly FactConstraint[];
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
  readonly meaning?: string;
  readonly isUser: boolean;
  readonly isCorrect?: boolean;
  readonly expectedResult?: BidResult;
  /** Alert/announcement label for this bid (e.g., "Transfer to hearts", "15 to 17"). */
  readonly alertLabel?: string;
  /** Annotation type: alert (conventional), announce (spoken), educational (learning aid). */
  readonly annotationType?: "alert" | "announce" | "educational";
  /** Teaching projection snapshot — persisted for review-phase convention analysis.
   *  Present for user bids when the meaning pipeline produced one. */
  readonly teachingProjection?: TeachingProjection;
}

export interface BiddingStrategy {
  readonly id: string;
  readonly name: string;
  suggest(context: BiddingContext): BidResult | null;
}
