import type { HandPredicate } from "../../conventions/core/agreement-module";

// ─── Hand space types ───────────────────────────────────────
export interface PublicHandSpace {
  readonly seatId: string;
  readonly constraints: readonly HandPredicate[];
  readonly estimatedSize?: number;
  readonly latentBranches?: readonly LatentBranchSet[];
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
  readonly confidence: number;
  readonly conditionedOn?: readonly string[];
}

// ─── Belief view ────────────────────────────────────────────

export interface BeliefView {
  readonly seatId: string;
  readonly observerSeat: string;
  readonly facts: readonly PosteriorFactValue[];
  readonly staleness: number;
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
  "bridge.partnerHas4HeartsLikely",
  "bridge.partnerHas4SpadesLikely",
  "bridge.partnerHas4DiamondsLikely",
  "bridge.partnerHas4ClubsLikely",
  "bridge.combinedHcpInRangeLikely",
] as const;
