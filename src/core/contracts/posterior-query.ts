import type { Hand } from "../../engine/types";
import type { PublicSnapshot } from "./module-surface";
import type { FactorGraphIR, FactorSpec } from "./factor-graph";

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
  readonly factorGraph: FactorGraphIR;
  readonly observerSeat: string;
  readonly ownHand?: Hand;
}

// ─── Query port ─────────────────────────────────────────────
/** Consumer-facing query interface for posterior inference.
 *  All queries return results paired with InferenceHealth. */
export interface PosteriorQueryPort {
  readonly marginalHcp: (seat: string) => PosteriorQueryResult<number>;
  readonly suitLength: (seat: string, suit: string) => PosteriorQueryResult<number>;
  readonly fitProbability: (seats: readonly string[], suit: string, threshold: number) => PosteriorQueryResult<number>;
  readonly isBalanced: (seat: string) => PosteriorQueryResult<number>;
  readonly jointHcp: (seats: readonly string[], min: number, max: number) => PosteriorQueryResult<number>;
  readonly branchProbability: (familyId: string, branchId: string) => PosteriorQueryResult<number>;
  readonly activeFactors: () => readonly FactorIntrospection[];
}
