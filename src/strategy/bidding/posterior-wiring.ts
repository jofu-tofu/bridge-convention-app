import type { BiddingContext } from "../../core/contracts";
import type { MeaningSurface } from "../../core/contracts/meaning";
import type { FactCatalog, EvaluatedFacts } from "../../core/contracts/fact-catalog";
import type { PosteriorFactProvider, PosteriorFactValue } from "../../core/contracts/posterior";
import type { PosteriorBackend, PosteriorState } from "../../core/contracts/posterior-backend";
import type { ConditioningContext } from "../../core/contracts/posterior-query";
import type { PosteriorSummary } from "../../core/contracts/recommendation";
import type { Auction, Seat } from "../../engine/types";
import { buildSnapshotFromAuction } from "../../conventions/core/runtime/public-snapshot-builder";
import { compileFactorGraph } from "../../inference/posterior/factor-compiler";
import { createPosteriorFactProviderFromBackend } from "../../inference/posterior";

// ─── Posterior Helpers ──────────────────────────────────────────

/** Default sample count for posterior inference. */
export const DEFAULT_SAMPLE_COUNT = 200;

/** Posterior wiring state — caches PosteriorState across calls at the same auction length. */
export interface PosteriorCache {
  state: PosteriorState | null;
  auctionLength: number;
}

/**
 * Build a PosteriorFactProvider from the posterior backend, or undefined if not available.
 * Caches the initialized PosteriorState by auction length to avoid redundant computation.
 */
export function buildPosteriorProvider(
  backend: PosteriorBackend,
  surfaceRouter: (auction: Auction, seat: Seat) => readonly MeaningSurface[],
  context: BiddingContext,
  cache: PosteriorCache,
  sampleCount: number,
): { provider?: PosteriorFactProvider; state?: PosteriorState } {
  const auctionLength = context.auction.entries.length;
  if (cache.auctionLength !== auctionLength) {
    const snapshot = buildSnapshotFromAuction(
      context.auction, context.seat, [],
      { surfaceRouter },
    );
    const factorGraph = compileFactorGraph(snapshot);
    const conditioningContext: ConditioningContext = {
      snapshot,
      factorGraph,
      observerSeat: context.seat,
      ownHand: context.hand,
    };
    cache.state = backend.initialize(conditioningContext);
    cache.auctionLength = auctionLength;
  }
  if (!cache.state || cache.state.particles.length === 0) return {};

  return {
    provider: createPosteriorFactProviderFromBackend(cache.state, context.hand, sampleCount),
    state: cache.state,
  };
}

/**
 * Build a PosteriorSummary from evaluated facts and the active posterior state.
 * Returns null if no posterior facts were evaluated.
 */
export function buildPosteriorSummary(
  catalog: FactCatalog,
  facts: EvaluatedFacts,
  provider: PosteriorFactProvider,
  state: PosteriorState,
  partnerSeatId: string,
): PosteriorSummary | null {
  const posteriorIds = catalog.posteriorEvaluators
    ? [...catalog.posteriorEvaluators.keys()]
    : [];

  const posteriorFacts: PosteriorFactValue[] = [];
  for (const id of posteriorIds) {
    const fv = facts.facts.get(id);
    if (fv) {
      const conditionedOn = catalog.posteriorEvaluators?.get(id)?.conditionedOn;
      const request = conditionedOn
        ? { factId: id, seatId: partnerSeatId, conditionedOn }
        : { factId: id, seatId: partnerSeatId };
      const queryResult = provider.queryFact(request);
      posteriorFacts.push({
        factId: id,
        seatId: partnerSeatId,
        expectedValue: queryResult?.expectedValue ?? (fv.value as number),
        confidence: queryResult?.confidence ?? 0,
        conditionedOn: queryResult?.conditionedOn ?? conditionedOn,
      });
    }
  }

  if (posteriorFacts.length === 0) return null;

  const avgConfidence = posteriorFacts.reduce((sum, f) => sum + f.confidence, 0) / posteriorFacts.length;
  return {
    factValues: posteriorFacts,
    sampleCount: state.particles.length,
    confidence: avgConfidence,
  };
}
