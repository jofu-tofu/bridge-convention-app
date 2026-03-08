// Practical scorer types — local to strategy/bidding/.
// Only PracticalRecommendation crosses to contracts/.

import type { ResolvedCandidateDTO } from "../../core/contracts";
import type { PragmaticCandidate } from "./pragmatic-generator";

export interface PracticalScoreBreakdown {
  readonly fitScore: number;
  readonly hcpScore: number;
  readonly conventionDistance: number;
  readonly misunderstandingRisk: number;
  readonly totalScore: number;
}

/** Discriminated union for scorer input — normative (from convention tree) or pragmatic (tactical). */
export type ScorableCandidate =
  | { readonly kind: "normative"; readonly candidate: ResolvedCandidateDTO }
  | { readonly kind: "pragmatic"; readonly candidate: PragmaticCandidate };

export type PracticalScoredCandidate =
  | {
      readonly candidate: ResolvedCandidateDTO;
      readonly practicalScore: number;
      readonly scoreBreakdown: PracticalScoreBreakdown;
      readonly source: "normative";
    }
  | {
      readonly candidate: PragmaticCandidate;
      readonly practicalScore: number;
      readonly scoreBreakdown: PracticalScoreBreakdown;
      readonly source: "pragmatic";
    };
