import type { Call } from "../../engine/types";

/** Discriminator for how members within a family are related. */
export type SurfaceGroupRelationship =
  | "mutually_exclusive"    // Only one applies per hand (e.g., game vs limit raise)
  | "equivalent_encoding"   // Same meaning, different call (e.g., relay paths)
  | "policy_alternative";   // Both valid, convention policy prefers one

/** Declares that multiple meaning leaves belong to the same conceptual family.
 *  Members reference meaningIds (bidName). Convention-level grouping for
 *  diagnostics, teaching, and relationship-aware grading. */
export interface SurfaceGroup {
  readonly id: string;
  readonly label: string;
  readonly members: readonly string[];
  readonly relationship: SurfaceGroupRelationship;
  readonly description: string;
}

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
  /** Intent family relationship, if the bid belongs to an SurfaceGroup. */
  readonly relationship?: SurfaceGroupRelationship;
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
  /** Calls that are in the same surface group as a correct answer but fail a constraint.
   *  When populated, matching a near-miss call yields NearMiss instead of Incorrect. */
  readonly nearMissCalls?: readonly { call: Call; reason: string }[];
}
