import type {
  BiddingContext,
  BidResult,
  ConventionBiddingStrategy,
  AlternativeGroup,
  IntentFamily,
} from "../../core/contracts";
import type { MeaningSurface } from "../../core/contracts/meaning-surface";
import type { CandidateTransform } from "../../core/contracts/meaning";
import type { DecisionProvenance } from "../../core/contracts/provenance";
import type { ArbitrationResult, PublicSnapshot } from "../../core/contracts/module-surface";
import type { FactCatalog, EvaluatedFacts } from "../../core/contracts/fact-catalog";
import type { PosteriorFactProvider } from "../../core/contracts/posterior";
import type { PosteriorBackend, PosteriorState } from "../../core/contracts/posterior-backend";
import type { ExplanationCatalogIR } from "../../core/contracts/explanation-catalog";
import type { PedagogicalRelation } from "../../core/contracts/pedagogical-relations";
import type { PosteriorSummary } from "../../core/contracts/recommendation";
import type { TeachingProjection } from "../../core/contracts/teaching-projection";
import type { Auction, Seat } from "../../engine/types";
import type { ConversationMachine } from "../../conventions/core/runtime/machine-types";
import type { RuntimeModule } from "../../conventions/core/runtime/types";
import { evaluate } from "../../conventions/core/runtime/evaluation-runtime";
import { evaluateFacts, createSharedFactCatalog } from "../../conventions/core/pipeline/fact-evaluator";
import type { RelationalFactContext } from "../../conventions/core/pipeline/fact-evaluator";
import { evaluateAllSurfaces } from "../../conventions/core/pipeline/meaning-evaluator";
import {
  arbitrateMeanings,
  zipProposalsWithSurfaces,
} from "../../conventions/core/pipeline/meaning-arbitrator";
import { composeSurfaces, mergeUpstreamProvenance } from "../../conventions/core/pipeline/surface-composer";
import { getLegalCalls } from "../../engine/auction";
import { partnerSeat } from "../../engine/constants";
import type { PosteriorCache } from "./posterior-wiring";
import { DEFAULT_SAMPLE_COUNT, buildPosteriorProvider, buildPosteriorSummary } from "./posterior-wiring";
import { buildBidResult, buildTeachingProjection } from "./bid-result-builder";
import type { MachineCache } from "./surface-selection";
import { getMachineResult, selectActiveSurfaces, buildSurfacesFromEvaluation, toMachineDebugSnapshot } from "./surface-selection";

// ─── Core Pipeline ─────────────────────────────────────────────
//
// The meaning pipeline is a 5-step pure transformation:
//
//   surfaces → compose → evaluate facts → evaluate meanings → arbitrate
//
// `runMeaningPipeline` is the single entry point. Both `meaningToStrategy`
// (single-module) and `meaningBundleToStrategy` (multi-module) delegate to it.
// Everything before the pipeline (surface selection, posterior wiring) and
// after it (result mapping, teaching projection) is handled by the caller.

/** Input to the core meaning pipeline. */
interface PipelineInput {
  readonly surfaces: readonly MeaningSurface[];
  readonly transforms?: readonly CandidateTransform[];
  readonly context: BiddingContext;
  readonly catalog: FactCatalog;
  readonly posteriorProvider?: PosteriorFactProvider;
  /** Relational context for fact evaluation (e.g. publicCommitments from evaluation runtime). */
  readonly relationalContext?: RelationalFactContext;
}

/** Output from the core meaning pipeline. */
interface PipelineOutput {
  readonly result: ArbitrationResult;
  readonly facts: EvaluatedFacts;
}

/**
 * Core meaning pipeline: compose → evaluate facts → evaluate meanings → arbitrate.
 *
 * Pure transformation — no caching, no side effects, no state mutation.
 * Callers handle surface selection (upstream) and result mapping (downstream).
 */
function runMeaningPipeline(input: PipelineInput): PipelineOutput {
  // Step 1: Compose surfaces (apply suppress/inject/remap transforms)
  const { composedSurfaces, appliedTransforms, diagnostics } = composeSurfaces(
    input.surfaces,
    input.transforms,
  );

  // Step 2: Evaluate facts against the hand
  const facts = evaluateFacts(
    input.context.hand, input.context.evaluation,
    input.catalog, input.relationalContext, input.posteriorProvider,
    input.posteriorProvider ? partnerSeat(input.context.seat) : undefined,
  );

  // Step 3: Evaluate each surface's clauses against the facts
  const proposals = evaluateAllSurfaces(composedSurfaces, facts);

  // Step 4: Arbitrate — encode, gate-check, rank, and select winner
  const inputs = zipProposalsWithSurfaces(proposals, composedSurfaces);
  const legalCalls = getLegalCalls(input.context.auction, input.context.seat);
  const arbitration = arbitrateMeanings(inputs, { legalCalls });

  // Step 5: Graft upstream provenance (transform traces) into the result
  const result = mergeUpstreamProvenance(arbitration, appliedTransforms, diagnostics);

  return { result, facts };
}

// ─── Public API ────────────────────────────────────────────────

// Re-export buildSurfacesFromEvaluation so existing consumers that import it
// from this module continue to work.
export { buildSurfacesFromEvaluation } from "./surface-selection";

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
  let lastProvenance: DecisionProvenance | null = null;
  let lastArbitration: ArbitrationResult | null = null;
  let lastTeachingProjection: TeachingProjection | null = null;
  let lastFacts: EvaluatedFacts | null = null;

  const catalog = options?.factCatalog ?? createSharedFactCatalog();

  return {
    id: moduleId,
    name: options?.name ?? moduleId,
    getLastPracticalRecommendation() { return null; },
    getAcceptableAlternatives() { return options?.acceptableAlternatives; },
    getIntentFamilies() { return options?.intentFamilies; },
    getLastProvenance() { return lastProvenance; },
    getLastArbitration() { return lastArbitration; },
    getLastPosteriorSummary() { return null; },
    getExplanationCatalog() { return undefined; },
    getLastTeachingProjection() { return lastTeachingProjection; },
    getLastFacts() { return lastFacts; },
    getLastMachineSnapshot() { return null; },
    suggest(context: BiddingContext): BidResult | null {
      lastProvenance = null;
      lastArbitration = null;
      lastTeachingProjection = null;
      lastFacts = null;

      const { result, facts } = runMeaningPipeline({
        surfaces,
        transforms: options?.transforms,
        context,
        catalog,
      });

      lastFacts = facts;
      lastArbitration = result;
      lastProvenance = result.provenance ?? null;
      lastTeachingProjection = buildTeachingProjection(result, lastProvenance);

      if (!result.selected) return null;
      return buildBidResult(result.selected, context, moduleId, result);
    },
  };
}

/**
 * Create a ConventionBiddingStrategy from multiple modules' surfaces.
 * Evaluates and arbitrates across all modules.
 *
 * The suggest() method runs a 3-phase sequence:
 * 1. **Surface selection** — machine, router, or all surfaces
 * 2. **Core pipeline** — compose → facts → evaluate → arbitrate
 * 3. **Output** — teaching projection + BidResult mapping
 *
 * Posterior enrichment (when configured) runs as a sidecar to fact evaluation.
 */
export function meaningBundleToStrategy(
  moduleSurfaces: readonly {
    moduleId: string;
    surfaces: readonly MeaningSurface[];
  }[],
  bundleId: string,
  options?: {
    name?: string;
    factCatalog?: FactCatalog;
    transforms?: readonly CandidateTransform[];
    acceptableAlternatives?: readonly AlternativeGroup[];
    intentFamilies?: readonly IntentFamily[];
    /** Surface router — filters surfaces based on auction position. */
    surfaceRouter?: (auction: Auction, seat: Seat) => readonly MeaningSurface[];
    /** Conversation machine — when present, overrides surfaceRouter for surface selection. */
    conversationMachine?: ConversationMachine;
    /** Posterior backend for probabilistic fact enrichment. */
    posteriorBackend?: PosteriorBackend;
    /** Surface router used for commitment extraction in posterior snapshot building. */
    surfaceRouterForCommitments?: (auction: Auction, seat: Seat) => readonly MeaningSurface[];
    /** Explanation catalog for enriching teaching projections with template keys. */
    explanationCatalog?: ExplanationCatalogIR;
    /** Pedagogical relations for enriching WhyNot entries with family context. */
    pedagogicalRelations?: readonly PedagogicalRelation[];
    /** Evaluation runtime modules — when present with conversationMachine, uses the
     *  two-phase evaluate() for surface selection instead of ad-hoc selectActiveSurfaces(). */
    evaluationRuntime?: {
      readonly modules: readonly RuntimeModule[];
      readonly getActiveIds: (auction: Auction, seat: Seat) => readonly string[];
    };
  },
): ConventionBiddingStrategy {
  const allSurfaces = moduleSurfaces.flatMap((m) => m.surfaces);

  let lastProvenance: DecisionProvenance | null = null;
  let lastArbitration: ArbitrationResult | null = null;
  let lastPosteriorSummary: PosteriorSummary | null = null;
  let lastTeachingProjection: TeachingProjection | null = null;
  let lastFacts: EvaluatedFacts | null = null;

  const catalog = options?.factCatalog ?? createSharedFactCatalog();
  const machineCache: MachineCache = { result: null, auctionLength: -1 };
  const posteriorCache: PosteriorCache = { state: null, auctionLength: -1 };

  return {
    id: bundleId,
    name: options?.name ?? bundleId,
    getLastPracticalRecommendation() { return null; },
    getAcceptableAlternatives() { return options?.acceptableAlternatives; },
    getIntentFamilies() { return options?.intentFamilies; },
    getLastProvenance() { return lastProvenance; },
    getLastArbitration() { return lastArbitration; },
    getLastPosteriorSummary() { return lastPosteriorSummary; },
    getExplanationCatalog() { return options?.explanationCatalog; },
    getLastTeachingProjection() { return lastTeachingProjection; },
    getLastFacts() { return lastFacts; },
    getLastMachineSnapshot() { return machineCache.result ? toMachineDebugSnapshot(machineCache.result) : null; },
    suggest(context: BiddingContext): BidResult | null {
      lastProvenance = null;
      lastArbitration = null;
      lastPosteriorSummary = null;
      lastTeachingProjection = null;
      lastFacts = null;

      // Phase 1: Select active surfaces for this auction position
      let selectedSurfaces: readonly MeaningSurface[];
      let machineTransforms: readonly CandidateTransform[] = [];
      let runtimeSnapshot: PublicSnapshot | undefined;

      if (options?.evaluationRuntime && options?.conversationMachine) {
        // Evaluation runtime path: unified two-phase evaluate() for surface selection
        const activeModuleIds = options.evaluationRuntime.getActiveIds(
          context.auction, context.seat,
        );
        const evalResult = evaluate(
          options.evaluationRuntime.modules,
          context.auction,
          context.seat,
          activeModuleIds,
          { machine: options.conversationMachine, surfaceRouter: options.surfaceRouter },
        );
        const evalSurfaces = buildSurfacesFromEvaluation(evalResult);
        if (evalSurfaces.length === 0) return null;
        selectedSurfaces = evalSurfaces;
        runtimeSnapshot = evalResult.publicSnapshot;

        // Collect machine transforms through existing cache for transform merging
        const machineResult = getMachineResult(
          options.conversationMachine, context.auction, context.seat, machineCache,
        );
        machineTransforms = machineResult.collectedTransforms;
      } else {
        // Fallback: ad-hoc surface selection via machine, router, or all surfaces
        const selection = selectActiveSurfaces(
          moduleSurfaces, allSurfaces, context,
          { conversationMachine: options?.conversationMachine, surfaceRouter: options?.surfaceRouter },
          machineCache,
        );
        if (!selection) return null;
        selectedSurfaces = selection.surfaces;
        machineTransforms = selection.machineTransforms;
      }

      // Merge machine transforms with static transforms
      const allTransforms = machineTransforms.length > 0
        ? [...machineTransforms, ...(options?.transforms ?? [])]
        : options?.transforms;

      // Build relational context from evaluation runtime snapshot when available
      const relationalContext: RelationalFactContext | undefined = runtimeSnapshot?.publicCommitments
        ? { publicCommitments: runtimeSnapshot.publicCommitments }
        : undefined;

      // Phase 2: Build posterior provider (sidecar — enriches fact evaluation)
      let posteriorProvider: PosteriorFactProvider | undefined;
      let posteriorState: PosteriorState | undefined;
      if (options?.posteriorBackend && options?.surfaceRouterForCommitments) {
        const posterior = buildPosteriorProvider(
          options.posteriorBackend, options.surfaceRouterForCommitments,
          context, posteriorCache, DEFAULT_SAMPLE_COUNT,
        );
        posteriorProvider = posterior.provider;
        posteriorState = posterior.state;
      }

      // Phase 3: Run the core meaning pipeline
      const { result, facts } = runMeaningPipeline({
        surfaces: selectedSurfaces,
        transforms: allTransforms,
        context,
        catalog,
        posteriorProvider,
        relationalContext,
      });

      lastFacts = facts;

      // Phase 4: Build posterior summary from evaluated facts
      if (posteriorProvider && posteriorState) {
        const partner = partnerSeat(context.seat);
        lastPosteriorSummary = buildPosteriorSummary(catalog, facts, posteriorProvider, posteriorState, partner);
      }

      // Phase 5: Build output (teaching projection + BidResult)
      lastArbitration = result;
      lastProvenance = result.provenance ?? null;
      lastTeachingProjection = buildTeachingProjection(
        result, lastProvenance, options?.explanationCatalog, lastPosteriorSummary,
        options?.pedagogicalRelations,
      );

      if (!result.selected) return null;
      const winningModuleId = result.selected.proposal.moduleId;
      return buildBidResult(result.selected, context, winningModuleId, result, lastPosteriorSummary);
    },
  };
}
