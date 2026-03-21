import type {
  BiddingContext,
  BidResult,
  ConventionBiddingStrategy,
  StrategyEvaluation,
  AlternativeGroup,
  IntentFamily,
} from "../../core/contracts";
import type { MeaningSurface, ConstraintDimension } from "../../core/contracts/meaning";
import type { CandidateTransform } from "../../core/contracts/meaning";
import type { ArbitrationResult } from "../../core/contracts/module-surface";
import type { EvaluatedFacts, FactCatalog } from "../../core/contracts/fact-catalog";
import type { PosteriorFactProvider } from "../../core/contracts/posterior";
import type { RelationalFactContext } from "../../conventions/core";
import {
  evaluateFacts,
  createSharedFactCatalog,
  evaluateAllSurfaces,
  arbitrateMeanings,
  zipProposalsWithSurfaces,
  composeSurfaces,
  mergeUpstreamProvenance,
} from "../../conventions/core";
import { getLegalCalls } from "../../engine/auction";
import { partnerSeat } from "../../engine/constants";
import { isVulnerable } from "../../engine/scoring";
import { Vulnerability } from "../../engine/types";
import { buildBidResult, buildTeachingProjection } from "./bid-result-builder";

// ─── Core Pipeline ─────────────────────────────────────────────
//
// The meaning pipeline is a 5-step pure transformation:
//
//   surfaces → compose → evaluate facts → evaluate meanings → arbitrate
//
// `runMeaningPipeline` is the single entry point used by the protocol
// adapter. Everything before the pipeline (surface selection via protocol
// replay) and after it (result mapping, teaching projection) is handled
// by the caller.

/** Input to the core meaning pipeline. */
export interface PipelineInput {
  readonly surfaces: readonly MeaningSurface[];
  readonly transforms?: readonly CandidateTransform[];
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
  readonly result: ArbitrationResult;
  readonly facts: EvaluatedFacts;
}

/**
 * Core meaning pipeline: compose → evaluate facts → evaluate meanings → arbitrate.
 *
 * Pure transformation — no caching, no side effects, no state mutation.
 * Callers handle surface selection (upstream) and result mapping (downstream).
 */
export function runMeaningPipeline(input: PipelineInput): PipelineOutput {
  // Step 1: Compose surfaces (apply suppress/inject/remap transforms)
  const { composedSurfaces, appliedTransforms, diagnostics } = composeSurfaces(
    input.surfaces,
    input.transforms,
  );

  // Step 2: Evaluate facts against the hand
  const vulFlag = input.context.vulnerability != null
    ? isVulnerable(input.context.seat, input.context.vulnerability)
    : undefined;
  const facts = evaluateFacts(
    input.context.hand, input.context.evaluation,
    input.catalog, input.relationalContext, input.posteriorProvider,
    input.posteriorProvider ? partnerSeat(input.context.seat) : undefined,
    vulFlag,
  );

  // Step 3: Evaluate each surface's clauses against the facts.
  // Thread fact catalog as a FactCatalogExtension so deriveSpecificity()
  // can resolve constrainsDimensions for module-derived facts.
  const catalogAsExtension = {
    definitions: input.catalog.definitions,
    evaluators: input.catalog.evaluators,
  };
  const proposals = evaluateAllSurfaces(
    composedSurfaces, facts, undefined,
    [catalogAsExtension], input.inheritedDimsLookup,
  );

  // Step 4: Arbitrate — encode, gate-check, rank, and select winner
  const inputs = zipProposalsWithSurfaces(proposals, composedSurfaces);
  const legalCalls = getLegalCalls(input.context.auction, input.context.seat);
  const arbitration = arbitrateMeanings(inputs, { legalCalls });

  // Step 5: Graft upstream provenance (transform traces) into the result
  const result = mergeUpstreamProvenance(arbitration, appliedTransforms, diagnostics);

  return { result, facts };
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Create a ConventionBiddingStrategy from a set of MeaningSurfaces.
 * Tree-free: uses the meaning pipeline (compose → facts → evaluate → arbitrate).
 */
export function meaningToStrategy(
  surfaces: readonly MeaningSurface[],
  moduleId: string,
  options?: {
    name?: string;
    factCatalog?: FactCatalog;
    transforms?: readonly CandidateTransform[];
    acceptableAlternatives?: readonly AlternativeGroup[];
    intentFamilies?: readonly IntentFamily[];
  },
): ConventionBiddingStrategy {
  let lastEvaluation: StrategyEvaluation | null = {
    practicalRecommendation: null,
    acceptableAlternatives: options?.acceptableAlternatives ?? null,
    intentFamilies: options?.intentFamilies ?? null,
    provenance: null,
    arbitration: null,
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
        transforms: options?.transforms,
        context,
        catalog,
      });

      const provenance = result.provenance ?? null;
      const teachingProjection = buildTeachingProjection(result, provenance);

      lastEvaluation = {
        practicalRecommendation: null,
        acceptableAlternatives: options?.acceptableAlternatives ?? null,
        intentFamilies: options?.intentFamilies ?? null,
        provenance,
        arbitration: result,
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
