import type { BiddingContext, BidResult } from "../core/strategy-types";
import type { SurfaceGroup } from "../teaching/teaching-types";
import type { ConventionStrategy, StrategyEvaluation, BidMeaning } from "..";
import type { FactCatalog } from "../core/fact-catalog";
import type { ExplanationCatalog } from "../core/explanation-catalog";
import { createSharedFactCatalog, runPipeline, PLATFORM_EXPLANATION_ENTRIES } from "..";
import { createExplanationCatalog } from "../core/explanation-catalog";

import { buildBidResult } from "./bid-result-builder";
import { projectTeaching } from "..";

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
    surfaceGroups?: readonly SurfaceGroup[];
    explanationCatalog?: ExplanationCatalog;
  },
): ConventionStrategy {
  // Build explanation catalog: use provided catalog or default to platform entries only
  const explCatalog = options?.explanationCatalog
    ?? createExplanationCatalog([...PLATFORM_EXPLANATION_ENTRIES]);

  let lastEvaluation: StrategyEvaluation | null = {
    practicalRecommendation: null,
    surfaceGroups: options?.surfaceGroups ?? null,
    pipelineResult: null,
    posteriorSummary: null,
    explanationCatalog: explCatalog,
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

      const teachingProjection = projectTeaching(result, { explanationCatalog: explCatalog });

      lastEvaluation = {
        practicalRecommendation: null,
        surfaceGroups: options?.surfaceGroups ?? null,
        pipelineResult: result,
        posteriorSummary: null,
        explanationCatalog: explCatalog,
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
