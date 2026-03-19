// Practical scorer types — local to strategy/bidding/.
// Only PracticalRecommendation crosses to contracts/.

import type { ResolvedCandidateDTO, PracticalScoreBreakdown } from "../../core/contracts";
import type { PragmaticCandidate } from "./pragmatic-generator";

// Re-export from contracts so existing importers continue to work
export type { PracticalScoreBreakdown } from "../../core/contracts";

/** Discriminated union for scorer input — normative (from convention pipeline) or pragmatic (tactical). */
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
