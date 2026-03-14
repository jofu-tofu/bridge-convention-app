import type {
  BiddingContext,
  BidResult,
  ConventionBiddingStrategy,
  AlternativeGroup,
  IntentFamily,
} from "../../core/contracts";
import type { ConditionDetail, ResolvedCandidateDTO } from "../../core/contracts/evaluation-dtos";
import type { MeaningSurface } from "../../core/contracts/meaning-surface";
import type { CandidateTransform } from "../../core/contracts/meaning";
import type { DecisionProvenance } from "../../core/contracts/provenance";
import type { ArbitrationResult } from "../../core/contracts/module-surface";
import type { FactCatalog, EvaluatedFacts } from "../../core/contracts/fact-catalog";
import type { PosteriorEngine, PublicHandSpace, PosteriorFactProvider, PosteriorFactValue, SeatPosterior } from "../../core/contracts/posterior";
import type { ExplanationCatalogIR } from "../../core/contracts/explanation-catalog";
import type { PosteriorSummary } from "../../core/contracts/recommendation";
import type { TeachingProjection } from "../../core/contracts/teaching-projection";
import type { Auction, Seat } from "../../engine/types";
import type { ConversationMachine, MachineEvalResult } from "../../conventions/core/runtime/machine-types";
import { evaluateMachine } from "../../conventions/core/runtime/machine-evaluator";
import { buildSnapshotFromAuction } from "../../conventions/core/runtime/public-snapshot-builder";
import { evaluateFacts, createSharedFactCatalog } from "../../conventions/core/pipeline/fact-evaluator";
import { evaluateAllSurfaces } from "../../conventions/core/pipeline/meaning-evaluator";
import {
  arbitrateMeanings,
  zipProposalsWithSurfaces,
} from "../../conventions/core/pipeline/meaning-arbitrator";
import { composeSurfaces, mergeUpstreamProvenance } from "../../conventions/core/pipeline/surface-composer";
import { getLegalCalls } from "../../engine/auction";
import { formatHandSummary } from "../../core/display/hand-summary";
import { createPosteriorFactProvider } from "../../inference/posterior";
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
    input.catalog, undefined, input.posteriorProvider,
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

function getPartnerSeat(seat: Seat): string {
  const partners: Record<string, string> = { N: "S", S: "N", E: "W", W: "E" };
  return partners[seat] ?? "N";
}

/** Posterior wiring state — caches PublicHandSpace[] across calls at the same auction length. */
interface PosteriorCache {
  handSpaces: PublicHandSpace[] | null;
  auctionLength: number;
}

/**
 * Build a PosteriorFactProvider from the posterior engine, or undefined if not available.
 * Caches the compiled hand spaces by auction length to avoid redundant computation.
 */
function buildPosteriorProvider(
  engine: PosteriorEngine,
  surfaceRouter: (auction: Auction, seat: Seat) => readonly MeaningSurface[],
  context: BiddingContext,
  cache: PosteriorCache,
): { provider?: PosteriorFactProvider; seatPosterior?: SeatPosterior } {
  const auctionLength = context.auction.entries.length;
  if (cache.auctionLength !== auctionLength) {
    const snapshot = buildSnapshotFromAuction(
      context.auction, context.seat, [],
      { surfaceRouter },
    );
    cache.handSpaces = engine.compilePublic(snapshot);
    cache.auctionLength = auctionLength;
  }
  const partnerSeat = getPartnerSeat(context.seat);
  const partnerSpace = cache.handSpaces?.find((s) => s.seatId === partnerSeat);
  if (!partnerSpace) return {};

  const seatPosterior = engine.conditionOnHand(partnerSpace, context.seat, context.hand);
  return {
    provider: createPosteriorFactProvider(seatPosterior),
    seatPosterior,
  };
}

/**
 * Build a PosteriorSummary from evaluated facts and the active seat posterior.
 * Returns null if no posterior facts were evaluated.
 */
function buildPosteriorSummary(
  catalog: FactCatalog,
  facts: EvaluatedFacts,
  provider: PosteriorFactProvider,
  seatPosterior: SeatPosterior,
): PosteriorSummary | null {
  const posteriorIds = catalog.posteriorEvaluators
    ? [...catalog.posteriorEvaluators.keys()]
    : [];

  const posteriorFacts: PosteriorFactValue[] = [];
  for (const id of posteriorIds) {
    const fv = facts.facts.get(id);
    if (fv) {
      const queryResult = provider.queryFact({ factId: id, seatId: seatPosterior.seatId });
      posteriorFacts.push({
        factId: id,
        seatId: seatPosterior.seatId,
        expectedValue: fv.value as number,
        confidence: queryResult?.confidence ?? 0,
      });
    }
  }

  if (posteriorFacts.length === 0) return null;

  const avgConfidence = posteriorFacts.reduce((sum, f) => sum + f.confidence, 0) / posteriorFacts.length;
  return {
    factValues: posteriorFacts,
    sampleCount: seatPosterior.effectiveSampleSize,
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
  const conditions: ConditionDetail[] = selected.proposal.clauses.map(
    (c) => ({
      name: c.factId,
      passed: c.satisfied,
      description: c.description,
    }),
  );

  // Map truth + acceptable sets to ResolvedCandidateDTO for candidateSet
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
  }));

  return {
    call: selected.call,
    ruleName: selected.proposal.meaningId,
    explanation: selected.proposal.evidence.provenance.nodeName,
    meaning: selected.proposal.teachingLabel ?? selected.proposal.meaningId,
    handSummary: formatHandSummary(context.evaluation),
    conditions,
    evaluationTrace: {
      conventionId: moduleId,
      protocolMatched: true,
      overlaysActivated: [],
      overlayErrors: [],
      candidateCount: arbitration.truthSet.length + arbitration.acceptableSet.length,
      strategyChainPath: [],
      ...(posteriorSummary ? {
        posteriorSampleCount: posteriorSummary.sampleCount,
        posteriorConfidence: posteriorSummary.confidence,
      } : {}),
    },
    candidateSet: {
      siblings: [],
      resolvedCandidates,
    },
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
): TeachingProjection | null {
  if (!provenance) return null;
  return projectTeaching(arbitration, provenance, {
    explanationCatalog,
    posteriorSummary: posteriorSummary ?? undefined,
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
    suggest(context: BiddingContext): BidResult | null {
      lastProvenance = null;
      lastArbitration = null;
      lastTeachingProjection = null;

      const { result } = runMeaningPipeline({
        surfaces,
        transforms: options?.transforms,
        context,
        catalog,
      });

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
    /** Posterior engine for probabilistic fact enrichment. */
    posteriorEngine?: PosteriorEngine;
    /** Surface router used for commitment extraction in posterior snapshot building. */
    surfaceRouterForCommitments?: (auction: Auction, seat: Seat) => readonly MeaningSurface[];
    /** Explanation catalog for enriching teaching projections with template keys. */
    explanationCatalog?: ExplanationCatalogIR;
  },
): ConventionBiddingStrategy {
  const allSurfaces = moduleSurfaces.flatMap((m) => m.surfaces);

  let lastProvenance: DecisionProvenance | null = null;
  let lastArbitration: ArbitrationResult | null = null;
  let lastPosteriorSummary: PosteriorSummary | null = null;
  let lastTeachingProjection: TeachingProjection | null = null;

  const catalog = options?.factCatalog ?? createSharedFactCatalog();
  const machineCache: MachineCache = { result: null, auctionLength: -1 };
  const posteriorCache: PosteriorCache = { handSpaces: null, auctionLength: -1 };

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
    suggest(context: BiddingContext): BidResult | null {
      lastProvenance = null;
      lastArbitration = null;
      lastPosteriorSummary = null;
      lastTeachingProjection = null;

      // Phase 1: Select active surfaces for this auction position
      const selection = selectActiveSurfaces(
        moduleSurfaces, allSurfaces, context,
        { conversationMachine: options?.conversationMachine, surfaceRouter: options?.surfaceRouter },
        machineCache,
      );
      if (!selection) return null;

      // Merge machine transforms with static transforms
      const allTransforms = selection.machineTransforms.length > 0
        ? [...selection.machineTransforms, ...(options?.transforms ?? [])]
        : options?.transforms;

      // Phase 2: Build posterior provider (sidecar — enriches fact evaluation)
      let posteriorProvider: PosteriorFactProvider | undefined;
      let seatPosterior: SeatPosterior | undefined;
      if (options?.posteriorEngine && options?.surfaceRouterForCommitments) {
        const posterior = buildPosteriorProvider(
          options.posteriorEngine, options.surfaceRouterForCommitments,
          context, posteriorCache,
        );
        posteriorProvider = posterior.provider;
        seatPosterior = posterior.seatPosterior;
      }

      // Phase 3: Run the core meaning pipeline
      const { result, facts } = runMeaningPipeline({
        surfaces: selection.surfaces,
        transforms: allTransforms,
        context,
        catalog,
        posteriorProvider,
      });

      // Phase 4: Build posterior summary from evaluated facts
      if (posteriorProvider && seatPosterior) {
        lastPosteriorSummary = buildPosteriorSummary(catalog, facts, posteriorProvider, seatPosterior);
      }

      // Phase 5: Build output (teaching projection + BidResult)
      lastArbitration = result;
      lastProvenance = result.provenance ?? null;
      lastTeachingProjection = buildTeachingProjection(
        result, lastProvenance, options?.explanationCatalog, lastPosteriorSummary,
      );

      if (!result.selected) return null;
      const winningModuleId = result.selected.proposal.moduleId;
      return buildBidResult(result.selected, context, winningModuleId, result, lastPosteriorSummary);
    },
  };
}
