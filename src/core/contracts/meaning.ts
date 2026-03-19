import type { ConditionResult } from "./evidence-bundle";
import type { Call } from "../../engine/types";
import type {
  PriorityClass,
  PrioritySpec,
  ChoiceClosurePolicy,
  FactConstraintIR,
} from "./agreement-module";

// MeaningId — string, colon-namespaced (e.g., "stayman:ask-major", "bridge:nt-invite")
export type MeaningId = string;

// SemanticClassId — string, cross-module equivalence class (e.g., "bridge:game-invite")
export type SemanticClassId = string;

/** Recommendation band — authored semantic priority. */
export type RecommendationBand = "must" | "should" | "may" | "avoid";

/** How the specificity value was determined. */
export type SpecificityBasis = "derived" | "asserted" | "partial";

/** Operator for fact-based clause evaluation. */
export type FactOperator = "gte" | "lte" | "eq" | "range" | "boolean" | "in";

/** Operator subset for evaluated meaning clauses (excludes "in" which is resolved during evaluation). */
export type MeaningClauseOperator = Exclude<FactOperator, "in">;

/** Ranking metadata — the frozen ranking knob matrix. */
export interface RankingMetadata {
  /** Authored semantic priority. Replaces implicit orderKey-as-truth. */
  readonly recommendationBand: RecommendationBand;
  /** More specific conventions beat general ones. Higher = more specific. */
  readonly specificity: number;
  /** Cross-module tiebreaker. Lower = higher priority. Never decides truth. */
  readonly modulePrecedence: number;
  /** Preserves DFS orderKey for backward compat. Deterministic last resort. */
  readonly intraModuleOrder: number;
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
export interface MeaningEvaluationEvidence {
  readonly factDependencies: readonly string[];
  readonly evaluatedConditions: readonly (ConditionResult & {
    readonly conditionId: string;
  })[];
  readonly provenance: {
    readonly moduleId: string;
    readonly roundName?: string;
    readonly nodeName: string;
    readonly origin:
      | "tree"
      | "overlay-override";
    readonly overlayId?: string;
  };
}

/** The core meaning proposal type — what a bid means, independent of encoding. */
export interface MeaningProposal {
  readonly meaningId: MeaningId;
  readonly semanticClassId?: SemanticClassId;
  readonly moduleId: string;
  readonly clauses: readonly MeaningClause[];
  readonly ranking: RankingMetadata;
  readonly evidence: MeaningEvaluationEvidence;
  readonly sourceIntent: {
    readonly type: string;
    readonly params: Readonly<Record<string, string | number | boolean>>;
  };
  readonly modulePriority?: "preferred" | "alternative";
  /** Human-readable teaching label (e.g., "Stayman 2C", "Transfer to hearts").
   *  Threaded from MeaningSurface.teachingLabel through the evaluation pipeline. */
  readonly teachingLabel?: string;
  /** Structured constraints auto-derived from primitive/bridge-observable clauses.
   *  Threaded through the pipeline for BidAlert construction in the strategy layer. */
  readonly publicConstraints?: readonly FactConstraintIR[];
  /** True when this bid is alertable (derived from priorityClass/sourceIntent). */
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
  const modDiff = a.modulePrecedence - b.modulePrecedence;
  if (modDiff !== 0) return modDiff;

  // Intra-module order (lower = earlier DFS = ranks higher)
  return a.intraModuleOrder - b.intraModuleOrder;
}

/**
 * Structural transform applied to the meaning candidate pool before/during arbitration.
 *
 * `targetId` matches against `meaningId` for suppress/remap, or is set to the
 * injected surface's meaningId for inject transforms. Suppress may also match
 * against `semanticClassId` as a batch operation. The arbitrator tries meaningId
 * first, then semanticClassId — first match wins.
 */
export interface CandidateTransform {
  readonly transformId: string;
  readonly kind: "suppress" | "inject" | "remap";
  readonly targetId: string;
  readonly sourceModuleId: string;
  readonly reason: string;
  readonly surface?: MeaningSurface; // required when kind === "inject"
  readonly newCall?: Call; // shorthand when remap only changes the call
  readonly remapTo?: {
    readonly meaningId?: string;
    readonly semanticClassId?: string;
    readonly encoderRef?: string;
    readonly defaultCall?: Call;
  };
}

/** Trace of a transform applied during arbitration. */
export interface TransformTrace {
  readonly transformId: string;
  readonly kind: "suppress" | "inject" | "remap";
  readonly targetId: string;
  readonly sourceModuleId: string;
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// MeaningSurface types (merged from meaning-surface.ts to break circular dep)
// ---------------------------------------------------------------------------

export interface MeaningSurfaceClause {
  readonly clauseId: string;
  readonly factId: string;
  readonly operator: FactOperator;
  readonly value:
    | number
    | boolean
    | string
    | { min: number; max: number }
    | readonly string[];
  readonly description: string;
  /** When true, this clause is included in the alert's public constraints.
   *  Primitive hand facts (hand.*) are always public regardless of this flag.
   *  Use this for bridge-derived or module facts the bundle wants to disclose. */
  readonly isPublic?: boolean;
}

export interface MeaningSurface {
  readonly meaningId: MeaningId;
  readonly semanticClassId: SemanticClassId;
  readonly moduleId: string;
  readonly encoding: {
    readonly defaultCall: Call;
    readonly alternateEncodings?: readonly {
      call: Call;
      condition?: string;
    }[];
  };
  readonly clauses: readonly MeaningSurfaceClause[];
  readonly ranking: RankingMetadata;
  /** Factored priority specification — separates obligation strength from conventionality.
   *  When set, the pipeline resolves recommendationBand from `prioritySpec.obligation`
   *  and alertability from `prioritySpec.conventionality`. */
  readonly prioritySpec?: PrioritySpec;
  /** @deprecated Use prioritySpec instead.
   *  Author-declared semantic priority class.
   *  When set, the SystemProfile's `priorityClassMapping` resolves this to a
   *  `RecommendationBand` at runtime, overriding `ranking.recommendationBand`.
   *  Optional for backward compatibility — surfaces without this field use the
   *  band from `ranking` directly. */
  readonly priorityClass?: PriorityClass;
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
