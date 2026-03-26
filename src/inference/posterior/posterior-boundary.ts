import type { Hand, SuitName } from "../../engine/types";
import type { PublicConstraint, PublicEvent } from "../../conventions/core/agreement-module";
import type { PublicSnapshot } from "../../conventions/core/module-surface";

// ═══════════════════════════════════════════════════════════════
// Factor Graph IR (formerly core/contracts/factor-graph.ts)
// ═══════════════════════════════════════════════════════════════

// ─── Factor strength ────────────────────────────────────────
/** Whether a factor is a hard constraint (rejection) or soft evidence (weighting). */
export type FactorStrength = "hard" | "soft";

// ─── Factor origin (compilation trace) ──────────────────────
/** Maps a compiled factor back to its pedagogical source. */
export interface FactorOrigin {
  readonly sourceConstraint?: PublicConstraint;
  readonly sourceMeaning?: string;
  readonly sourceModule?: string;
  readonly originKind: "call-meaning";
}

// ─── Factor specifications (discriminated union) ────────────
export type FactorSpec =
  | HcpRangeFactor
  | SuitLengthFactor
  | ShapeFactor
  | ExclusionFactor
  | FitFactor;

/** Common properties shared by all factor types. */
interface BaseFactor {
  readonly strength: FactorStrength;
  readonly origin: FactorOrigin;
}

/** Factor constrained to a single seat. */
interface SingleSeatFactor extends BaseFactor {
  readonly seat: string;
}

export interface HcpRangeFactor extends SingleSeatFactor {
  readonly kind: "hcp-range";
  readonly min: number;
  readonly max: number;
}

export interface SuitLengthFactor extends SingleSeatFactor {
  readonly kind: "suit-length";
  readonly suit: SuitName;
  readonly min: number;
  readonly max: number;
}

export interface ShapeFactor extends SingleSeatFactor {
  readonly kind: "shape";
  readonly pattern: string; // "balanced", "semi-balanced", etc.
}

export interface ExclusionFactor extends SingleSeatFactor {
  readonly kind: "exclusion";
  readonly constraint: string; // description of what's excluded
}

export interface FitFactor extends BaseFactor {
  readonly kind: "fit";
  readonly seats: readonly string[];
  readonly suit: SuitName;
  readonly minCombined: number;
}

// ─── Ambiguity schema ───────────────────────────────────────
export interface AmbiguityAlternative {
  readonly branchId: string;
  readonly meaningId: string;
  readonly description: string;
}

export interface AmbiguityFamily {
  readonly familyId: string;
  readonly alternatives: readonly AmbiguityAlternative[];
  readonly exclusivity: "xor" | "or";
}

// ─── Evidence pins ──────────────────────────────────────────
export type EvidencePin = OwnHandPin | AuctionRecordPin | AlertPin;

export interface OwnHandPin {
  readonly kind: "own-hand";
  readonly seat: string;
  readonly hand: Hand;
}

export interface AuctionRecordPin {
  readonly kind: "auction-record";
  readonly events: readonly PublicEvent[];
}

export interface AlertPin {
  readonly kind: "alert";
  readonly seat: string;
  readonly message: string;
}

// ─── Factor Graph IR ────────────────────────────────────────
/** The compiled, convention-erased IR passed to the posterior backend. */
export interface FactorGraph {
  readonly factors: readonly FactorSpec[];
  readonly ambiguitySchema: readonly AmbiguityFamily[];
  readonly evidencePins: readonly EvidencePin[];
}

// ═══════════════════════════════════════════════════════════════
// Posterior Query Port (formerly core/contracts/posterior-query.ts)
// ═══════════════════════════════════════════════════════════════

// ─── Inference health ───────────────────────────────────────
/** Quality metrics for posterior inference results. */
export interface InferenceHealth {
  readonly effectiveSampleSize: number;
  readonly totalParticles: number;
  readonly acceptanceRate: number;
  readonly posteriorEntropy?: number;
}

// ─── Query result ───────────────────────────────────────────
/** Result of a posterior query, always paired with health metrics. */
export interface PosteriorQueryResult<T = number> {
  readonly value: T;
  readonly health: InferenceHealth;
}

// ─── Factor introspection ───────────────────────────────────
/** Runtime introspection data for an active factor. */
export interface FactorIntrospection {
  readonly factor: FactorSpec;
  readonly satisfactionRate: number;
  readonly effectiveWeight: number;
}

// ─── Conditioning context ───────────────────────────────────
/** Branded input for posterior initialization — all data needed to condition. */
export interface ConditioningContext {
  readonly snapshot: PublicSnapshot;
  readonly factorGraph: FactorGraph;
  readonly observerSeat: string;
  readonly ownHand?: Hand;
}

// ─── Query port ─────────────────────────────────────────────
/** Consumer-facing query interface for posterior inference.
 *  All queries return results paired with InferenceHealth. */
export interface PosteriorQueryPort {
  readonly marginalHcp: (seat: string) => PosteriorQueryResult<number>;
  readonly suitLength: (seat: string, suit: SuitName) => PosteriorQueryResult<number>;
  readonly fitProbability: (seats: readonly string[], suit: SuitName, threshold: number) => PosteriorQueryResult<number>;
  readonly isBalanced: (seat: string) => PosteriorQueryResult<number>;
  readonly jointHcp: (seats: readonly string[], min: number, max: number) => PosteriorQueryResult<number>;
  readonly branchProbability: (familyId: string, branchId: string) => PosteriorQueryResult<number>;
  readonly activeFactors: () => readonly FactorIntrospection[];
}

// ═══════════════════════════════════════════════════════════════
// Posterior Backend (formerly core/contracts/posterior-backend.ts)
// ═══════════════════════════════════════════════════════════════

// ─── Latent world ───────────────────────────────────────────
/** Canonical hidden state: a complete deal + latent branch assignment. */
export interface LatentWorld {
  readonly hiddenDeal: ReadonlyMap<string, Hand>;
  readonly branchAssignment: ReadonlyMap<string, string>;
}

// ─── Weighted particle ──────────────────────────────────────
/** A weighted sample from the posterior distribution. */
export interface WeightedParticle {
  readonly world: LatentWorld;
  readonly weight: number;
}

// ─── Posterior state ────────────────────────────────────────
/** Opaque state managed by the backend. Contains weighted particles. */
export interface PosteriorState {
  readonly particles: readonly WeightedParticle[];
  readonly context: ConditioningContext;
}

// ─── Query IR ───────────────────────────────────────────────
/** Query sent to the backend — discriminated union of query types. */
export type PosteriorQuery =
  | { readonly kind: "marginal-hcp"; readonly seat: string }
  | { readonly kind: "suit-length"; readonly seat: string; readonly suit: SuitName }
  | { readonly kind: "fit-probability"; readonly seats: readonly string[]; readonly suit: SuitName; readonly threshold: number }
  | { readonly kind: "is-balanced"; readonly seat: string }
  | { readonly kind: "joint-hcp"; readonly seats: readonly string[]; readonly min: number; readonly max: number }
  | { readonly kind: "branch-probability"; readonly familyId: string; readonly branchId: string };

// ─── Backend interface ──────────────────────────────────────
/** Replaceable compute boundary — a TS sampler today, Rust/WASM tomorrow.
 *  Consumers never call this directly; they use PosteriorQueryPort. */
export interface PosteriorBackend {
  readonly initialize: (context: ConditioningContext) => PosteriorState;
  readonly query: (state: PosteriorState, query: PosteriorQuery) => PosteriorQueryResult;
  readonly conditionOnHand: (state: PosteriorState, seat: string, hand: Hand) => PosteriorState;
  readonly introspect: (state: PosteriorState) => readonly FactorIntrospection[];
}
