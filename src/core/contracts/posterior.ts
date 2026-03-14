import type { HandPredicateIR } from "./predicate-surfaces";
import type { PublicSnapshot } from "./module-surface";
import type { Hand, Seat } from "../../engine/types";
import type { FactConstraintIR } from "./agreement-module";

// ─── Posterior factor types ─────────────────────────────────
export interface PosteriorFactor {
  readonly factorId: string;
  readonly kind: "call-meaning" | "announcement" | "inference" | "prior";
  readonly weight: number;
  readonly description: string;
}

export interface LikelihoodModel {
  readonly factors: readonly PosteriorFactor[];
  readonly combinationRule: "independent" | "chained";
}

// ─── Hand space types ───────────────────────────────────────
export interface PublicHandSpace {
  readonly seatId: string;
  readonly constraints: readonly HandPredicateIR[];
  readonly estimatedSize?: number;
  readonly latentBranches?: readonly LatentBranchSet[];
}

// ─── Seat posterior with query methods ──────────────────────
export interface SeatPosterior {
  readonly seatId: string;
  readonly handSpace: PublicHandSpace;
  readonly likelihoodModel: LikelihoodModel;
  /** Actual number of samples accepted by rejection sampling.
   *  May be less than requested when constraints are tight. */
  readonly effectiveSampleSize: number;
  readonly probability: (query: PosteriorFactRequest) => number;
  readonly distribution: (target: string) => readonly { value: number; probability: number }[];
}

// ─── Fact request/response ──────────────────────────────────
export interface PosteriorFactRequest {
  readonly factId: string;
  readonly seatId: string;
  readonly conditionedOn?: readonly string[];
}

export interface PosteriorFactValue {
  readonly factId: string;
  readonly seatId: string;
  readonly expectedValue: number;
  readonly variance?: number;
  readonly confidence: number;
}

// ─── Belief view ────────────────────────────────────────────

/** Reference to the subject of a belief (which seat's hand). */
export interface SubjectRef {
  readonly seatId: string;
  readonly role?: string;
}

/** Reference to the posterior source that produced this belief. */
export interface PosteriorSourceRef {
  readonly sourceKind: "posterior-engine" | "announcement" | "inference";
  readonly sampleSize?: number;
  readonly confidence?: number;
}

/** Opaque identifier for grouping related beliefs. */
export type EvidenceGroupId = string;

export interface BeliefView {
  readonly seatId: string;
  readonly observerSeat: string;
  readonly facts: readonly PosteriorFactValue[];
  readonly staleness: number;
  /** Unique identifier: `${factId}:${seatId}` for per-fact beliefs,
   *  or `${seatId}` for aggregate seat beliefs. */
  readonly beliefId?: string;
  /** The subject (seat) this belief is about. */
  readonly subject?: SubjectRef;
  /** Constraint derived from fact values (uses first fact with boolean/numeric value). */
  readonly constraint?: FactConstraintIR;
  /** Provenance references to the posterior sources. */
  readonly provenance?: readonly PosteriorSourceRef[];
  /** Human-readable explanation key for UI. */
  readonly explanationKey?: string;
  /** Groups related beliefs for UI display. */
  readonly evidenceGroupId?: EvidenceGroupId;
}

// ─── Latent branches ────────────────────────────────────────
export interface LatentBranchAlternative {
  readonly branchId: string;
  readonly meaningId: string;
  readonly probability?: number;
  readonly description: string;
}

export interface LatentBranchSet {
  readonly setId: string;
  readonly alternatives: readonly LatentBranchAlternative[];
  readonly resolvedBy?: string;
}

// ─── Posterior fact provider ────────────────────────────────
export interface PosteriorFactProvider {
  readonly queryFact: (request: PosteriorFactRequest) => PosteriorFactValue | null;
  readonly getBeliefView: (seatId: string, observerSeat: string) => BeliefView | null;
}

// ─── Posterior fact IDs ────────────────────────────────────

/** Shared posterior fact IDs — generic facts parameterized via conditionedOn.
 *  Convention-specific posterior facts belong in their module's FactCatalogExtension. */
export const SHARED_POSTERIOR_FACT_IDS = [
  "bridge.partnerHas4CardMajorLikely",
  "bridge.combinedHcpInRangeLikely",
] as const;

// ─── Posterior engine interface ─────────────────────────────
export interface PosteriorEngine {
  readonly compilePublic: (snapshot: PublicSnapshot) => PublicHandSpace[];
  readonly conditionOnHand: (
    space: PublicHandSpace,
    seat: Seat,
    hand: Hand,
  ) => SeatPosterior;
  readonly deriveActingHandFacts: (
    handSpace: PublicHandSpace,
    factIds: readonly string[],
  ) => readonly PosteriorFactValue[];
}
