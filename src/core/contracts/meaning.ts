import type { ConditionResult } from "./evidence-bundle";
import type { Call } from "../../engine/types";
import type {
  ChoiceClosurePolicy,
  FactConstraint,
} from "./agreement-module";
import type { TeachingTagRef } from "./teaching-tag";

// MeaningId — string, colon-namespaced (e.g., "stayman:ask-major", "bridge:nt-invite")
export type MeaningId = string;

// SemanticClassId — string, cross-module equivalence class (e.g., "bridge:game-invite")
export type SemanticClassId = string;

/** Recommendation band — authored semantic priority. */
export type RecommendationBand = "must" | "should" | "may" | "avoid";

/** How the specificity value was determined. */
export type SpecificityBasis = "derived" | "asserted" | "partial";

/** Communicative constraint dimensions for specificity derivation.
 *  Each dimension represents a type of hand information a bid communicates to partner. */
export type ConstraintDimension =
  | "suitIdentity"   // which specific suit(s) the bid promises
  | "suitLength"     // min/max cards in specific suits
  | "pointRange"     // HCP or total point bounds
  | "shapeClass"     // distributional shape (balanced, two-suited, shortage, etc.)
  | "suitRelation"   // relational constraints between suits
  | "suitQuality";   // honor holdings, suit solidity (A/K/Q count, "solid suit")

/** Operator for fact-based clause evaluation. */
export type FactOperator = "gte" | "lte" | "eq" | "range" | "boolean" | "in";

/** Operator subset for evaluated meaning clauses (excludes "in" which is resolved during evaluation). */
export type MeaningClauseOperator = Exclude<FactOperator, "in">;

/** Authored ranking metadata — what convention authors write.
 *  Excludes `specificity` and `specificityBasis`, which are derived by the
 *  pipeline via `deriveSpecificity()`. */
export interface AuthoredRankingMetadata {
  /** Authored semantic priority. Replaces implicit orderKey-as-truth. */
  readonly recommendationBand: RecommendationBand;
  /** Cross-module tiebreaker. Lower = higher priority. Never decides truth.
   *  Optional — defaults to 0 when absent. Injected by `createSurface()` builder
   *  from `ModuleContext.modulePrecedence`, or derived as 0 by the pipeline. */
  readonly modulePrecedence?: number;
  /** Preserves DFS orderKey for backward compat. Deterministic last resort. */
  readonly intraModuleOrder: number;
}

/** Resolved ranking metadata — the frozen ranking knob matrix.
 *  Produced by the pipeline from AuthoredRankingMetadata + derived specificity. */
export interface RankingMetadata extends AuthoredRankingMetadata {
  /** More specific conventions beat general ones. Higher = more specific.
   *  Derived by deriveSpecificity() — never hand-authored. */
  readonly specificity: number;
  /** How the specificity value was determined:
   *  - "derived": all clauses reference primitive or bridge-derived facts with known constraint structure
   *  - "asserted": at least one clause references an opaque module-derived boolean fact
   *  - "partial": mix of derived and asserted clauses */
  readonly specificityBasis?: SpecificityBasis;
}

/** A single clause in a meaning proposal. */
export interface MeaningClause {
  readonly factId: string;
  readonly operator: MeaningClauseOperator;
  readonly value: number | boolean | { min: number; max: number };
  readonly satisfied: boolean;
  readonly description: string;
  readonly observedValue?: number | boolean | string;
}

/** Evidence for how and why a meaning was evaluated. */
export interface EvaluationEvidence {
  readonly factDependencies: readonly string[];
  readonly evaluatedConditions: readonly (ConditionResult & {
    readonly conditionId: string;
  })[];
  readonly provenance: {
    readonly moduleId: string;
    readonly roundName?: string;
    readonly nodeName: string;
    readonly origin: "meaning-pipeline";
  };
}

/** The core meaning proposal type — what a bid means, independent of encoding. */
export interface MeaningProposal {
  readonly meaningId: MeaningId;
  readonly semanticClassId?: SemanticClassId;
  readonly moduleId: string;
  readonly clauses: readonly MeaningClause[];
  readonly ranking: RankingMetadata;
  readonly evidence: EvaluationEvidence;
  readonly sourceIntent: {
    readonly type: string;
    readonly params: Readonly<Record<string, string | number | boolean>>;
  };
  readonly modulePriority?: "preferred" | "alternative";
  /** Human-readable teaching label (e.g., "Stayman 2C", "Transfer to hearts").
   *  Threaded from BidMeaning.teachingLabel through the evaluation pipeline. */
  readonly teachingLabel?: string;
  /** Structured constraints auto-derived from primitive/bridge-observable clauses.
   *  Threaded through the pipeline for BidAlert construction in the strategy layer. */
  readonly publicConstraints?: readonly FactConstraint[];
  /** True when this bid is alertable (derived from sourceIntent.type). */
  readonly isAlertable?: boolean;
}

/** Recommendation band priority values for comparison (lower = higher priority). */
export const BAND_PRIORITY: Record<RecommendationBand, number> = {
  must: 0,
  should: 1,
  may: 2,
  avoid: 3,
};

/**
 * Compare two RankingMetadata values using the frozen lexicographic order.
 * Returns negative if a ranks higher, positive if b ranks higher, 0 if equal.
 *
 * Frozen ranking order:
 * 1. Hard gates (handled externally, not here)
 * 2. recommendationBand (must > should > may > avoid)
 * 3. Hand-fit score (handled externally by ranker)
 * 4. specificity (higher = more specific = ranks higher)
 * 5. modulePrecedence (lower = higher priority)
 * 6. intraModuleOrder (lower = earlier DFS = ranks higher)
 */
export function compareRanking(a: RankingMetadata, b: RankingMetadata): number {
  // Band comparison (lower BAND_PRIORITY = higher rank)
  const bandDiff =
    BAND_PRIORITY[a.recommendationBand] - BAND_PRIORITY[b.recommendationBand];
  if (bandDiff !== 0) return bandDiff;

  // Specificity (higher = ranks higher, so negate)
  const specDiff = b.specificity - a.specificity;
  if (specDiff !== 0) return specDiff;

  // Module precedence (lower = higher priority)
  const modDiff = (a.modulePrecedence ?? 0) - (b.modulePrecedence ?? 0);
  if (modDiff !== 0) return modDiff;

  // Intra-module order (lower = earlier DFS = ranks higher)
  return a.intraModuleOrder - b.intraModuleOrder;
}

// ---------------------------------------------------------------------------
// BidMeaning types (merged from meaning-surface.ts to break circular dep)
// ---------------------------------------------------------------------------

export interface BidMeaningClause extends FactConstraint {
  /** Deterministic identifier. Optional — auto-derived from factId:operator:value
   *  by the `createSurface()` builder or pipeline fallback. */
  readonly clauseId?: string;
  /** Human-readable description. Optional — auto-derived from factId/operator/value
   *  by the `createSurface()` builder or pipeline fallback. Provide explicitly only
   *  when adding convention-specific rationale (e.g., parenthetical context). */
  readonly description?: string;
  /** When true, this clause is included in the alert's public constraints.
   *  Primitive hand facts (hand.*) are always public regardless of this flag.
   *  Use this for bridge-derived or module facts the bundle wants to disclose. */
  readonly isPublic?: boolean;
}

export interface BidMeaning {
  readonly meaningId: MeaningId;
  readonly semanticClassId: SemanticClassId;
  /** Module that owns this surface. Optional — injected by `createSurface()` builder
   *  from `ModuleContext.moduleId`, or falls back to `"unknown"` in the pipeline. */
  readonly moduleId?: string;
  readonly encoding: {
    readonly defaultCall: Call;
    readonly alternateEncodings?: readonly {
      call: Call;
      condition?: string;
    }[];
  };
  readonly clauses: readonly BidMeaningClause[];
  readonly ranking: AuthoredRankingMetadata;
  readonly sourceIntent: {
    readonly type: string;
    readonly params: Readonly<Record<string, string | number | boolean>>;
  };
  readonly teachingLabel: string;
  /** Closure policy for entailed denials — known only to your partnership.
   *  When a surface in a closed domain is chosen, unchosen peers' derived
   *  public constraints become entailed denials for partnership posterior. */
  readonly closurePolicy?: ChoiceClosurePolicy;
  readonly surfaceBindings?: Readonly<Record<string, string>>;
  /** Cross-module pedagogical tags for deriving relations and alternatives. */
  readonly teachingTags?: readonly TeachingTagRef[];
}

// ---------------------------------------------------------------------------
// Semantic class catalog (merged from semantic-classes.ts)
// ---------------------------------------------------------------------------

/**
 * Convenience catalog of platform-owned canonical semantic class IDs.
 * Modules declare their own semantic classes as plain string constants.
 * This file is a convenience catalog, not a gating registry — adding a
 * new convention MUST NOT require editing this file.
 * (Frozen Contract #14 from Agreement Module IR spec)
 */
export const BRIDGE_SEMANTIC_CLASSES = {
  NT_OPENING: "bridge:1nt-opening",
  NT_INVITE: "bridge:nt-invite",
  NT_GAME: "bridge:to-3nt",
} as const;
