import type {
  BiddingContext,
  BidResult,
  ConventionBiddingStrategy,
  AlternativeGroup,
  IntentFamily,
} from "../../core/contracts";
import type { ResolvedCandidateDTO } from "../../core/contracts/tree-evaluation";
import type { MeaningSurface } from "../../core/contracts/meaning-surface";
import type { CandidateTransform } from "../../core/contracts/meaning";
import type { DecisionProvenance } from "../../core/contracts/provenance";
import type { ArbitrationResult, PublicSnapshot } from "../../core/contracts/module-surface";
import type { FactCatalog, EvaluatedFacts } from "../../core/contracts/fact-catalog";
import type { PosteriorFactProvider, PosteriorFactValue } from "../../core/contracts/posterior";
import type { PosteriorBackend, PosteriorState } from "../../core/contracts/posterior-backend";
import type { ConditioningContext } from "../../core/contracts/posterior-query";
import type { ExplanationCatalogIR } from "../../core/contracts/explanation-catalog";
import type { PedagogicalRelation } from "../../core/contracts/pedagogical-relations";
import type { PosteriorSummary, MachineDebugSnapshot } from "../../core/contracts/recommendation";
import type { TeachingProjection } from "../../core/contracts/teaching-projection";
import type { Auction, Seat } from "../../engine/types";
import type { ConversationMachine, MachineEvalResult } from "../../conventions/core/runtime/machine-types";
import type { RuntimeModule, EvaluationResult } from "../../conventions/core/runtime/types";
import { evaluateMachine } from "../../conventions/core/runtime/machine-evaluator";
import { buildSnapshotFromAuction } from "../../conventions/core/runtime/public-snapshot-builder";
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
import { formatHandSummary } from "../../core/display/hand-summary";
import { createPosteriorFactProviderFromBackend } from "../../inference/posterior";
import { compileFactorGraph } from "../../inference/posterior/factor-compiler";
import { projectTeaching } from "../../teaching/teaching-projection-builder";

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

// ─── Posterior Helpers ──────────────────────────────────────────

/** Default sample count for posterior inference. */
const DEFAULT_SAMPLE_COUNT = 200;

/** Posterior wiring state — caches PosteriorState across calls at the same auction length. */
interface PosteriorCache {
  state: PosteriorState | null;
  auctionLength: number;
}

/**
 * Build a PosteriorFactProvider from the posterior backend, or undefined if not available.
 * Caches the initialized PosteriorState by auction length to avoid redundant computation.
 */
function buildPosteriorProvider(
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
function buildPosteriorSummary(
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
      const queryResult = provider.queryFact({ factId: id, seatId: partnerSeatId });
      posteriorFacts.push({
        factId: id,
        seatId: partnerSeatId,
        expectedValue: queryResult?.expectedValue ?? (fv.value as number),
        confidence: queryResult?.confidence ?? 0,
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

// ─── Result Mapping ────────────────────────────────────────────

function buildBidResult(
  selected: NonNullable<ArbitrationResult["selected"]>,
  context: BiddingContext,
  moduleId: string,
  arbitration: ArbitrationResult,
  posteriorSummary?: PosteriorSummary | null,
): BidResult {
  // Map truth + acceptable sets to ResolvedCandidateDTO for teaching-resolution
  const resolvedCandidates: ResolvedCandidateDTO[] = [
    ...arbitration.truthSet,
    ...arbitration.acceptableSet,
  ].map((ep) => ({
    bidName: ep.proposal.meaningId,
    call: ep.call,
    resolvedCall: ep.call,
    isMatched: ep.eligibility.hand.satisfied,
    isDefaultCall: ep.isDefaultEncoding,
    legal: ep.eligibility.encoding.legal,
    meaning: ep.proposal.teachingLabel ?? ep.proposal.meaningId,
    intentType: ep.proposal.sourceIntent.type,
    priority: ep.proposal.modulePriority,
    orderKey: ep.proposal.ranking.intraModuleOrder,
    failedConditions: ep.proposal.clauses
      .filter((c) => !c.satisfied)
      .map((c) => ({
        name: c.factId,
        passed: false as const,
        description: c.description,
      })),
    eligibility: ep.eligibility,
    allEncodings: ep.allEncodings,
    moduleId: ep.proposal.moduleId,
    semanticClassId: ep.proposal.semanticClassId,
    recommendationBand: ep.proposal.ranking.recommendationBand,
  }));

  return {
    call: selected.call,
    ruleName: selected.proposal.meaningId,
    explanation: selected.proposal.evidence.provenance.nodeName,
    meaning: selected.proposal.teachingLabel ?? selected.proposal.meaningId,
    handSummary: formatHandSummary(context.evaluation),
    evaluationTrace: {
      conventionId: moduleId,
      candidateCount: arbitration.truthSet.length + arbitration.acceptableSet.length,
      strategyChainPath: [],
      ...(posteriorSummary ? {
        posteriorSampleCount: posteriorSummary.sampleCount,
        posteriorConfidence: posteriorSummary.confidence,
      } : {}),
    },
    resolvedCandidates,
  };
}

/**
 * Build a TeachingProjection from arbitration and provenance, returning null if provenance is missing.
 */
function buildTeachingProjection(
  arbitration: ArbitrationResult,
  provenance: DecisionProvenance | null,
  explanationCatalog?: ExplanationCatalogIR,
  posteriorSummary?: PosteriorSummary | null,
  pedagogicalRelations?: readonly PedagogicalRelation[],
): TeachingProjection | null {
  if (!provenance) return null;
  return projectTeaching(arbitration, provenance, {
    explanationCatalog,
    posteriorSummary: posteriorSummary ?? undefined,
    pedagogicalRelations,
  });
}

// ─── Surface Selection ─────────────────────────────────────────

/** Machine evaluation cache — avoids redundant FSM evaluation at the same auction length. */
interface MachineCache {
  result: MachineEvalResult | null;
  auctionLength: number;
}

function getMachineResult(
  machine: ConversationMachine,
  auction: Auction,
  seat: Seat,
  cache: MachineCache,
): MachineEvalResult {
  if (cache.auctionLength === auction.entries.length && cache.result) {
    return cache.result;
  }
  cache.result = evaluateMachine(machine, auction, seat);
  cache.auctionLength = auction.entries.length;
  return cache.result;
}

/** Select surfaces and collect machine transforms for the current auction position. */
function selectActiveSurfaces(
  moduleSurfaces: readonly { moduleId: string; surfaces: readonly MeaningSurface[] }[],
  allSurfaces: readonly MeaningSurface[],
  context: BiddingContext,
  options?: {
    conversationMachine?: ConversationMachine;
    surfaceRouter?: (auction: Auction, seat: Seat) => readonly MeaningSurface[];
  },
  machineCache?: MachineCache,
): { surfaces: readonly MeaningSurface[]; machineTransforms: readonly CandidateTransform[] } | null {
  if (options?.conversationMachine && machineCache) {
    const machineResult = getMachineResult(
      options.conversationMachine, context.auction, context.seat, machineCache,
    );
    const activeGroupIds = new Set(machineResult.activeSurfaceGroupIds);
    const surfaces = moduleSurfaces
      .filter((g) => activeGroupIds.has(g.moduleId))
      .flatMap((g) => g.surfaces);
    if (surfaces.length === 0) return null;
    return { surfaces, machineTransforms: machineResult.collectedTransforms };
  }

  if (options?.surfaceRouter) {
    const surfaces = options.surfaceRouter(context.auction, context.seat);
    if (surfaces.length === 0) return null;
    return { surfaces, machineTransforms: [] };
  }

  if (allSurfaces.length === 0) return null;
  return { surfaces: allSurfaces, machineTransforms: [] };
}

// ─── Evaluation Runtime Bridge ─────────────────────────────────

/**
 * Flatten DecisionSurfaceEntry[] from the evaluation runtime into MeaningSurface[]
 * for the existing meaning pipeline. Bridges the gap between the two-phase
 * evaluation runtime and the strategy pipeline's surface input format.
 */
export function buildSurfacesFromEvaluation(
  evalResult: EvaluationResult,
): MeaningSurface[] {
  return evalResult.decisionSurfaces.flatMap(entry => entry.surfaces);
}

// ─── Debug Helpers ─────────────────────────────────────────────

/** Convert a MachineEvalResult to a lightweight debug DTO. */
function toMachineDebugSnapshot(mr: MachineEvalResult): MachineDebugSnapshot {
  return {
    currentStateId: mr.context.currentStateId,
    stateHistory: [...mr.context.stateHistory],
    transitionHistory: [...mr.context.transitionHistory],
    activeSurfaceGroupIds: [...mr.activeSurfaceGroupIds],
    registers: {
      forcingState: mr.context.registers.forcingState,
      obligation: mr.context.registers.obligation,
      agreedStrain: mr.context.registers.agreedStrain,
      competitionMode: mr.context.registers.competitionMode,
      captain: mr.context.registers.captain,
      systemCapabilities: mr.context.registers.systemCapabilities,
    },
    diagnostics: mr.diagnostics.map(d => ({ level: d.level, message: d.message, moduleId: d.moduleId })),
    handoffTraces: mr.handoffTraces.map(h => ({ fromModuleId: h.fromModuleId, toModuleId: h.toModuleId, reason: h.reason })),
    submachineStack: mr.context.submachineStack.map(f => ({ parentMachineId: f.parentMachineId, returnStateId: f.returnStateId })),
  };
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
