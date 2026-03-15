import type {
  PosteriorFactProvider,
  PosteriorFactRequest,
  PosteriorFactValue,
  SeatPosterior,
} from "../../core/contracts/posterior";
import { SHARED_POSTERIOR_FACT_IDS } from "../../core/contracts/posterior";
import type { PosteriorFactEvaluatorFn, FactValue } from "../../core/contracts/fact-catalog";
import type { Hand } from "../../engine/types";
import type { PosteriorState } from "../../core/contracts/posterior-backend";
import { POSTERIOR_FACT_HANDLERS } from "./posterior-facts";

/**
 * Create PosteriorFactEvaluatorFn instances that bridge posterior provider
 * responses into FactValue entries for the fact catalog.
 *
 * Each evaluator:
 * 1. Calls provider.queryFact with the fact ID
 * 2. If result is non-null: returns { factId, value: result.expectedValue }
 * 3. If result is null: returns { factId, value: 0 } (fail-open)
 */
export function createPosteriorFactEvaluators(
  factIds?: readonly string[],
): ReadonlyMap<string, PosteriorFactEvaluatorFn> {
  const evaluators = new Map<string, PosteriorFactEvaluatorFn>();
  const ids = factIds ?? SHARED_POSTERIOR_FACT_IDS;

  for (const factId of ids) {
    evaluators.set(factId, (provider: PosteriorFactProvider, request: PosteriorFactRequest): FactValue => {
      const result = provider.queryFact(request);
      return { factId: request.factId, value: result?.expectedValue ?? 0 };
    });
  }

  return evaluators;
}

/** Default sample count used by createPosteriorEngine. */
const DEFAULT_SAMPLE_COUNT = 200;

/**
 * Wrap a SeatPosterior as a PosteriorFactProvider.
 * All queryFact calls delegate to the posterior's probability() method.
 * Confidence is derived from the acceptance rate (effectiveSampleSize / requestedCount).
 */
export function createPosteriorFactProvider(
  posterior: SeatPosterior,
  requestedSampleCount?: number,
): PosteriorFactProvider {
  const requested = requestedSampleCount ?? DEFAULT_SAMPLE_COUNT;
  const confidence = requested > 0
    ? Math.min(posterior.effectiveSampleSize / requested, 1)
    : 0;

  return {
    queryFact(request: PosteriorFactRequest): PosteriorFactValue | null {
      const probability = posterior.probability(request);
      return {
        factId: request.factId,
        seatId: posterior.seatId,
        expectedValue: probability,
        confidence,
      };
    },
    getBeliefView() {
      return null;
    },
  };
}

/**
 * Create a PosteriorFactProvider from PosteriorState by running the existing
 * POSTERIOR_FACT_HANDLERS against the backend's particle hands.
 * This bridges the new backend boundary to the old fact evaluation interface.
 *
 * Each queryFact call delegates to the matching handler in POSTERIOR_FACT_HANDLERS,
 * passing the particle hiddenDeal maps as samples. Unknown fact IDs return null.
 */
export function createPosteriorFactProviderFromBackend(
  state: PosteriorState,
  ownHand: Hand,
  totalRequested: number,
): PosteriorFactProvider {
  // Extract hand maps from particles (same format as the old sampler output)
  const sampleHandMaps: ReadonlyMap<string, Hand>[] = state.particles.map(
    (p) => p.world.hiddenDeal,
  );

  return {
    queryFact(request: PosteriorFactRequest): PosteriorFactValue | null {
      const handler = POSTERIOR_FACT_HANDLERS.get(request.factId);
      if (!handler) return null;
      return handler(request, sampleHandMaps, ownHand, totalRequested);
    },
    getBeliefView() {
      return null;
    },
  };
}
