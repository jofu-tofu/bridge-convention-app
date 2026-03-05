// Practical scorer types — local to strategy/bidding/.
// Only PracticalRecommendation crosses to shared/types.ts.

import type { ResolvedCandidateDTO } from "../../shared/types";
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

export interface PracticalScoredCandidate {
  readonly candidate: ResolvedCandidateDTO | PragmaticCandidate;
  readonly practicalScore: number;
  readonly scoreBreakdown: PracticalScoreBreakdown;
  readonly source: "normative" | "pragmatic";
}
