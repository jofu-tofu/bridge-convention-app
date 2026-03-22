import type { Call } from "../../engine/types";
import type { ConditionResult } from "./evidence-bundle";
import type { RecommendationBand } from "./meaning";

export interface SiblingConditionDetail extends Omit<ConditionResult, "satisfied"> {
  readonly name: string;
  readonly description: string;
}

/** Unified eligibility model — all dimensions that gate candidate selectability.
 *  CONSTRAINT: Pure DTO — no methods, no imports from conventions/ or engine/. */
export interface CandidateEligibility {
  readonly hand: {
    readonly satisfied: boolean;
    readonly failedConditions: readonly SiblingConditionDetail[];
  };
  readonly encoding: {
    readonly legal: boolean;
    readonly reason?: "all_encodings_illegal" | "illegal_in_auction";
  };
  readonly pedagogical: {
    readonly acceptable: boolean;
    readonly reasons: readonly string[];
  };
}

/** Strategy-resolved candidate — what the pipeline actually considered for this auction+hand.
 *  Serializable DTO (no function refs). */
export interface ResolvedCandidateDTO {
  readonly bidName: string;
  readonly meaning: string;
  readonly call: Call;
  readonly resolvedCall: Call;
  readonly isDefaultCall: boolean;
  readonly legal: boolean;
  readonly isMatched: boolean;
  readonly priority?: "preferred" | "alternative";
  readonly intentType: string;
  readonly failedConditions: readonly SiblingConditionDetail[];
  readonly eligibility?: CandidateEligibility;
  /** Ordering key for deterministic tie-breaking within selection tiers. */
  readonly orderKey?: number;
  /** All encoder encodings with legality — retained for teaching and obligation enrichment.
   *  `resolvedCall` is the first legal encoding (selection unchanged). */
  readonly allEncodings?: readonly { readonly call: Call; readonly legal: boolean }[];
  /** Originating module — threaded from MeaningProposal for downstream consumers. */
  readonly moduleId?: string;
  /** Semantic equivalence class — threaded from MeaningProposal. */
  readonly semanticClassId?: string;
  /** Authored recommendation band — threaded from MeaningProposal ranking. */
  readonly recommendationBand?: RecommendationBand;
}

/** Check eligibility dimensions for DTO — pedagogical is post-selection annotation, not a gate.
 *  Falls back to legacy `legal` + `failedConditions` when eligibility is absent. */
export function isDtoSelectable(c: ResolvedCandidateDTO): boolean {
  if (!c.eligibility) return c.legal && c.failedConditions.length === 0;
  return c.eligibility.hand.satisfied
    && c.eligibility.encoding.legal;
}

/** Check pedagogical acceptability on DTO — post-selection annotation for teaching consumers. */
export function isDtoTeachingAcceptable(c: ResolvedCandidateDTO): boolean {
  if (!c.eligibility) return true;
  return c.eligibility.pedagogical.acceptable;
}

// Re-export teaching/grading types that were moved to teaching-grading.ts.
// Kept here so existing consumers importing from tree-evaluation continue to work.
export type { AlternativeGroup, IntentFamily, IntentRelationship } from "./teaching-grading";

/** Structured trace of how the convention pipeline evaluated a bid.
 *  Always-on (not DEV-gated). Plain DTO — no convention-core imports. */
export interface EvaluationTrace {
  readonly conventionId: string;
  readonly candidateCount: number;
  /** True when a strategy result was rejected by the chain's resultFilter. */
  readonly forcingFiltered?: boolean;
  readonly strategyChainPath: readonly { readonly strategyId: string; readonly result: "suggested" | "declined" | "filtered" | "error" }[];
  /** Number of posterior samples drawn. Set by meaning-pipeline strategies with posterior engine. */
  readonly posteriorSampleCount?: number;
  /** Confidence from posterior engine (0-1). Set by meaning-pipeline strategies with posterior engine. */
  readonly posteriorConfidence?: number;
}
