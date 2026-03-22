import type {
  BiddingContext,
  BidResult,
  ConventionStrategy,
  StrategyEvaluation,
  AlternativeGroup,
  SurfaceGroup,
} from "../../core/contracts";
import type { BidMeaning, ConstraintDimension } from "../../core/contracts/meaning";
import type { PipelineResult } from "../../core/contracts/module-surface";
import type { EvaluatedFacts, FactCatalog } from "../../core/contracts/fact-catalog";
import type { PosteriorFactProvider } from "../../core/contracts/posterior";
import type { RelationalFactContext } from "../../conventions/core";
import {
  evaluateFacts,
  createSharedFactCatalog,
  evaluateAllBidMeanings,
  arbitrateMeanings,
  zipProposalsWithSurfaces,
} from "../../conventions/core";
import { getLegalCalls } from "../../engine/auction";
import { partnerSeat } from "../../engine/constants";
import { isVulnerable } from "../../engine/scoring";

import { buildBidResult } from "./bid-result-builder";
import { projectTeaching } from "../../teaching/teaching-projection-builder";

// ─── Core Pipeline ─────────────────────────────────────────────
//
// The meaning pipeline is a 4-step pure transformation:
//
//   surfaces → evaluate facts → evaluate meanings → arbitrate
//
// `runMeaningPipeline` is the single entry point used by the protocol
// adapter. Everything before the pipeline (surface selection via protocol
// replay) and after it (result mapping, teaching projection) is handled
// by the caller.

/** Input to the core meaning pipeline. */
export interface PipelineInput {
  readonly surfaces: readonly BidMeaning[];
  readonly context: BiddingContext;
  readonly catalog: FactCatalog;
  readonly posteriorProvider?: PosteriorFactProvider;
  /** Relational context for fact evaluation (e.g. publicCommitments from evaluation runtime). */
  readonly relationalContext?: RelationalFactContext;
  /** Maps meaningId → inherited constraint dimensions from prior-round context.
   *  Used by deriveSpecificity() to account for accumulated communicative dimensions. */
  readonly inheritedDimsLookup?: ReadonlyMap<string, readonly ConstraintDimension[]>;
}

/** Output from the core meaning pipeline. */
export interface PipelineOutput {
  readonly result: PipelineResult;
  readonly facts: EvaluatedFacts;
}

/**
 * Core meaning pipeline: evaluate facts → evaluate meanings → arbitrate.
 *
 * Pure transformation — no caching, no side effects, no state mutation.
 * Callers handle surface selection (upstream) and result mapping (downstream).
 */
export function runMeaningPipeline(input: PipelineInput): PipelineOutput {
  // Step 1: Evaluate facts against the hand
  const vulFlag = input.context.vulnerability !== null
    ? isVulnerable(input.context.seat, input.context.vulnerability)
    : undefined;
  const facts = evaluateFacts(
    input.context.hand, input.context.evaluation,
    input.catalog, {
      relationalContext: input.relationalContext,
      posterior: input.posteriorProvider,
      posteriorSeatId: input.posteriorProvider ? partnerSeat(input.context.seat) : undefined,
      isVulnerable: vulFlag,
    },
  );

  // Step 2: Evaluate each surface's clauses against the facts.
  // Thread fact catalog as a FactCatalogExtension so deriveSpecificity()
  // can resolve constrainsDimensions for module-derived facts.
  const catalogAsExtension = {
    definitions: input.catalog.definitions,
    evaluators: input.catalog.evaluators,
  };
  const proposals = evaluateAllBidMeanings(
    input.surfaces, facts, undefined,
    [catalogAsExtension], input.inheritedDimsLookup,
  );

  // Step 3: Arbitrate — encode, gate-check, rank, and select winner
  const inputs = zipProposalsWithSurfaces(proposals, input.surfaces);
  const legalCalls = getLegalCalls(input.context.auction, input.context.seat);
  const result = arbitrateMeanings(inputs, { legalCalls });

  return { result, facts };
}

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
      const { result, facts } = runMeaningPipeline({
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
