import type { Hand, SuitName } from "../../engine/types";
import type { ConditioningContext, PosteriorQueryResult, FactorIntrospection } from "./posterior-query";

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
