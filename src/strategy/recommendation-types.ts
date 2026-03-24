import type { Call } from "../engine/types";
import type { PosteriorFactValue } from "../inference/posterior/posterior-types";

/** Summary of posterior engine results from the most recent suggest() call. */
export interface PosteriorSummary {
  readonly factValues: readonly PosteriorFactValue[];
  readonly sampleCount: number;
  readonly confidence: number;
}

/** Component-level breakdown of the practical score.
 *  Allows consumers to see how fit, HCP, convention distance, and
 *  misunderstanding risk contributed to the recommendation. */
export interface PracticalScoreBreakdown {
  readonly fitScore: number;
  readonly hcpScore: number;
  readonly conventionDistance: number;
  readonly misunderstandingRisk: number;
  readonly totalScore: number;
}

/** Practical recommendation — what an experienced player might prefer given imperfect information.
 *  Separate from teaching grading (which is deterministic and unchanged by this). */
export interface PracticalRecommendation {
  readonly topCandidateBidName: string;
  readonly topCandidateCall: Call;
  readonly topScore: number;
  readonly rationale: string;
  /** Component-level breakdown of the practical score. */
  readonly scoreBreakdown?: PracticalScoreBreakdown;
}
