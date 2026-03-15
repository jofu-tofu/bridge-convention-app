import type { Call } from "../../engine/types";
import type { ConditionRole } from "./evidence-bundle";
import type { RecommendationBand } from "./meaning";

export interface SiblingConditionDetail {
  readonly name: string;
  readonly description: string;
  /** Primary role of this condition — teaching consumers filter by role !== "routing". */
  readonly conditionRole?: ConditionRole;
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
export function isDtoPedagogicallyAcceptable(c: ResolvedCandidateDTO): boolean {
  if (!c.eligibility) return true;
  return c.eligibility.pedagogical.acceptable;
}

/** Groups of meanings that are acceptable alternatives to each other for grading.
 *  When the matched meaning is in a group, other group members become acceptable bids.
 *  Bypasses surface clause exclusivity — these are semantic, not structural, neighbors. */
export interface AlternativeGroup {
  /** Human-readable label for the group (e.g., "Bergen strength raises") */
  readonly label: string;
  /** bidNames (meaningIds) of meanings in this group. */
  readonly members: readonly string[];
  /** Whether alternatives get full credit or partial.
   *  "preferred" → fullCredit: true (teal, same as correct).
   *  "alternative" → fullCredit: false (teal, partial credit).
   *  Maps to existing AcceptableBid.fullCredit in teaching-resolution.ts. */
  readonly tier: "preferred" | "alternative";
  /** Optional: only activate when matched meaning is one of these specific bidNames.
   *  If omitted, any member match activates all other members as alternatives.
   *  If present, ONLY matching one of these members activates the group. */
  readonly whenMatched?: readonly string[];
}

/** Discriminator for how members within a family are related. */
export type IntentRelationship =
  | "mutually_exclusive"    // Only one applies per hand (e.g., game vs limit raise)
  | "equivalent_encoding"   // Same meaning, different call (e.g., relay paths)
  | "policy_alternative";   // Both valid, convention policy prefers one

/** Declares that multiple meaning leaves belong to the same conceptual family.
 *  Members reference meaningIds (bidName). Convention-level grouping for
 *  diagnostics, teaching, and relationship-aware grading. */
export interface IntentFamily {
  readonly id: string;
  readonly label: string;
  readonly members: readonly string[];
  readonly relationship: IntentRelationship;
  readonly description: string;
}

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
