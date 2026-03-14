import type { Call } from "../../engine/types";

export interface SiblingConditionDetail {
  readonly name: string;
  readonly description: string;
  /** Primary role of this condition — teaching consumers filter by role !== "routing". */
  readonly conditionRole?: "semantic" | "inferential" | "pedagogical" | "routing";
}

/** Unified eligibility model — all four dimensions that gate candidate selectability.
 *  CONSTRAINT: Pure DTO — no methods, no imports from conventions/ or engine/. */
export interface CandidateEligibility {
  readonly hand: {
    readonly satisfied: boolean;
    readonly failedConditions: readonly SiblingConditionDetail[];
  };
  readonly protocol: {
    readonly satisfied: boolean;
    readonly reasons: readonly string[];
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

/** Strategy-resolved candidate — what the system actually considered for this auction+hand.
 *  Serializable DTO (no function refs) from ResolvedCandidate in candidate-generator. */
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
  /** DFS traversal order from intent collection. Used for deterministic tie-breaking within selection tiers. */
  readonly orderKey?: number;
  /** All resolver encodings with legality — retained for teaching and obligation enrichment.
   *  `resolvedCall` is the first legal encoding (selection unchanged). */
  readonly allEncodings?: readonly { readonly call: Call; readonly legal: boolean }[];
}

/** Check three eligibility dimensions for DTO — pedagogical is post-selection annotation, not a gate.
 *  Falls back to legacy `legal` + `failedConditions` when eligibility is absent. */
export function isDtoSelectable(c: ResolvedCandidateDTO): boolean {
  if (!c.eligibility) return c.legal && c.failedConditions.length === 0;
  return c.eligibility.hand.satisfied
    && c.eligibility.protocol.satisfied
    && c.eligibility.encoding.legal;
}

/** Check pedagogical acceptability on DTO — post-selection annotation for teaching consumers. */
export function isDtoPedagogicallyAcceptable(c: ResolvedCandidateDTO): boolean {
  if (!c.eligibility) return true;
  return c.eligibility.pedagogical.acceptable;
}

/** Groups of intents that are acceptable alternatives to each other for grading.
 *  When the matched intent is in a group, other group members become acceptable bids.
 *  Bypasses tree path-condition exclusivity — these are semantic, not structural, neighbors. */
export interface AlternativeGroup {
  /** Human-readable label for the group (e.g., "Bergen strength raises") */
  readonly label: string;
  /** bidNames (IntentNode.name) of intents in this group.
   *  Uses bidName (e.g., "bergen-game-raise") NOT nodeId ("bergen/bergen-game-raise")
   *  because ResolvedCandidateDTO carries bidName, not nodeId. */
  readonly members: readonly string[];
  /** Whether alternatives get full credit or partial.
   *  "preferred" → fullCredit: true (teal, same as correct).
   *  "alternative" → fullCredit: false (teal, partial credit).
   *  Maps to existing AcceptableBid.fullCredit in teaching-resolution.ts. */
  readonly tier: "preferred" | "alternative";
  /** Optional: only activate when matched intent is one of these specific bidNames.
   *  If omitted, any member match activates all other members as alternatives.
   *  If present, ONLY matching one of these members activates the group. */
  readonly whenMatched?: readonly string[];
}

/** Discriminator for how IntentNode members within a family are related. */
export type IntentRelationship =
  | "mutually_exclusive"    // Only one applies per hand (e.g., game vs limit raise)
  | "equivalent_encoding"   // Same intent, different call (e.g., relay paths)
  | "policy_alternative";   // Both valid, convention policy prefers one

/** Declares that multiple IntentNode leaves belong to the same conceptual family.
 *  Members reference IntentNode names (bidName). Convention-level grouping for
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
  readonly protocolMatched: boolean;
  readonly candidateCount: number;
  readonly selectedTier?: "matched" | "preferred" | "alternative" | "none";
  /** True when a strategy result was rejected by the chain's resultFilter. */
  readonly forcingFiltered?: boolean;
  /** Error message from the practical recommendation pipeline, if it failed. */
  readonly practicalError?: string;
  readonly strategyChainPath: readonly { readonly strategyId: string; readonly result: "suggested" | "declined" | "filtered" | "error" }[];
  /** Active convention IDs when this bid was evaluated via a bundle. */
  readonly bundleActiveConventions?: readonly string[];
  /** Convention that won bundle arbitration. */
  readonly bundleWinningConvention?: string;
  /** Number of posterior samples drawn. Set by meaning-pipeline strategies with posterior engine. */
  readonly posteriorSampleCount?: number;
  /** Confidence from posterior engine (0-1). Set by meaning-pipeline strategies with posterior engine. */
  readonly posteriorConfidence?: number;
}
