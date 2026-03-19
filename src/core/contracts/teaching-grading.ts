import type { Call } from "../../engine/types";
import type { IntentRelationship } from "./tree-evaluation";

export enum BidGrade {
  Correct = "correct",
  CorrectNotPreferred = "correct-not-preferred",
  Acceptable = "acceptable",
  NearMiss = "near-miss",
  Incorrect = "incorrect",
}

export interface AcceptableBid {
  readonly call: Call;
  readonly bidName: string;
  readonly meaning: string;
  readonly reason: string;
  readonly fullCredit: boolean;
  readonly tier: "preferred" | "alternative";
  /** Intent family relationship, if the bid belongs to an IntentFamily. */
  readonly relationship?: IntentRelationship;
  /** Originating module — threaded from ResolvedCandidateDTO. */
  readonly moduleId?: string;
}

export interface TeachingResolution {
  readonly primaryBid: Call;
  readonly acceptableBids: readonly AcceptableBid[];
  readonly gradingType: "exact" | "primary_plus_acceptable" | "intent_based";
  readonly ambiguityScore: number;
  /** All calls in the truth set (correct bids that aren't the primary recommendation).
   *  When populated, matching a truth-set call yields CorrectNotPreferred instead of Incorrect. */
  readonly truthSetCalls?: readonly Call[];
  /** Calls that are in the same intent family as a correct answer but fail a constraint.
   *  When populated, matching a near-miss call yields NearMiss instead of Incorrect. */
  readonly nearMissCalls?: readonly { call: Call; reason: string }[];
}
