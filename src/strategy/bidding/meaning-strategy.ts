import type {
  BiddingContext,
  BidResult,
  AlternativeGroup,
  SurfaceGroup,
} from "../../core/contracts";
import type { ConventionStrategy, StrategyEvaluation, BidMeaning } from "../../conventions";
import type { FactCatalog } from "../../core/contracts/fact-catalog";
import { createSharedFactCatalog, runPipeline } from "../../conventions";

import { buildBidResult } from "./bid-result-builder";
import { projectTeaching } from "../../conventions";

// ─── Public API ────────────────────────────────────────────────

/**
 * Create a ConventionStrategy from a set of MeaningSurfaces.
 * Tree-free: uses the meaning pipeline (facts → evaluate → arbitrate).
 */
export function meaningToStrategy(
  surfaces: readonly BidMeaning[],
  moduleId: string,
  options?: {
    name?: string;
    factCatalog?: FactCatalog;
    acceptableAlternatives?: readonly AlternativeGroup[];
    surfaceGroups?: readonly SurfaceGroup[];
  },
): ConventionStrategy {
  let lastEvaluation: StrategyEvaluation | null = {
    practicalRecommendation: null,
    acceptableAlternatives: options?.acceptableAlternatives ?? null,
    surfaceGroups: options?.surfaceGroups ?? null,
    pipelineResult: null,
    posteriorSummary: null,
    explanationCatalog: null,
    teachingProjection: null,
    facts: null,
    machineSnapshot: null,
    auctionContext: null,
  };

  const catalog = options?.factCatalog ?? createSharedFactCatalog();

  return {
    id: moduleId,
    name: options?.name ?? moduleId,
    getLastEvaluation() { return lastEvaluation; },
    suggest(context: BiddingContext): BidResult | null {
      const { result, facts } = runPipeline({
        surfaces,
        context,
        catalog,
      });

      const teachingProjection = projectTeaching(result);

      lastEvaluation = {
        practicalRecommendation: null,
        acceptableAlternatives: options?.acceptableAlternatives ?? null,
        surfaceGroups: options?.surfaceGroups ?? null,
        pipelineResult: result,
        posteriorSummary: null,
        explanationCatalog: null,
        teachingProjection,
        facts,
        machineSnapshot: null,
        auctionContext: null,
      };

      if (!result.selected) return null;
      return buildBidResult(result.selected, context, moduleId, result);
    },
  };
}
