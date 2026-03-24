// Practical scorer types — local to strategy/bidding/.
// Only PracticalRecommendation crosses to contracts/.

import type { ResolvedCandidateDTO } from "../../conventions/pipeline/tree-evaluation";
import type { PracticalScoreBreakdown } from "../recommendation-types";
import type { PragmaticCandidate } from "./pragmatic-generator";

/** Discriminated union for scorer input — normative (from convention pipeline) or pragmatic (tactical). */
export type ScorableCandidate =
  | { readonly kind: "normative"; readonly candidate: ResolvedCandidateDTO }
  | { readonly kind: "pragmatic"; readonly candidate: PragmaticCandidate };

export type ScoredCandidate =
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
