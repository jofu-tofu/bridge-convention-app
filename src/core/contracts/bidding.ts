import type {
  Auction,
  Call,
  Hand,
  HandEvaluation,
  Seat,
  Vulnerability,
} from "../../engine/types";
import type { TreeInferenceData } from "./inference";
import type {
  CandidateSet,
  ConditionDetail,
  DecisionTrace,
  EvaluationTrace,
} from "./tree-evaluation";

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
  readonly conditions?: readonly ConditionDetail[];
  readonly decisionTrace?: DecisionTrace;
  readonly candidateSet?: CandidateSet;
  readonly evaluationTrace?: EvaluationTrace;
  /** Structured inference data from tree evaluation — hand conditions on the matched path
   *  and rejected branches. Used by the inference engine for positive/negative inference. */
  readonly treeInferenceData?: TreeInferenceData;
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
  readonly conditions?: readonly ConditionDetail[];
  readonly isCorrect?: boolean;
  readonly expectedResult?: BidResult;
  readonly decisionTrace?: DecisionTrace;
  readonly candidateSet?: CandidateSet;
}

export interface BiddingStrategy {
  readonly id: string;
  readonly name: string;
  suggest(context: BiddingContext): BidResult | null;
}
