import type { Call } from "../../engine/types";
import type { BiddingStrategy } from "./bidding";
import type { AlternativeGroup } from "./tree-evaluation";

/** Practical recommendation — what an experienced player might prefer given imperfect information.
 *  Separate from teaching grading (which is deterministic and unchanged by this). */
export interface PracticalRecommendation {
  readonly topCandidateBidName: string;
  readonly topCandidateCall: Call;
  readonly topScore: number;
  readonly rationale: string;
}

/** Extended strategy interface for convention-based strategies that produce practical recommendations.
 *  The accessor returns the recommendation from the most recent suggest() call (reset to null at start of each suggest()). */
export interface ConventionBiddingStrategy extends BiddingStrategy {
  getLastPracticalRecommendation(): PracticalRecommendation | null;
  /** Convention-level alternative groups for teaching grading.
   *  Returns the groups from the convention config, or undefined if not set. */
  getAcceptableAlternatives(): readonly AlternativeGroup[] | undefined;
}
