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
import type { FactCatalog } from "../../core/contracts/fact-catalog";
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

function getPartnerSeat(seat: Seat): string {
  const partners: Record<string, string> = { N: "S", S: "N", E: "W", W: "E" };
  return partners[seat] ?? "N";
}

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

/**
 * Create a ConventionBiddingStrategy from a set of MeaningSurfaces.
 * Tree-free: uses fact-evaluator → meaning-evaluator → meaning-arbitrator pipeline.
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

      // Upstream: compose surfaces (apply transforms before pipeline)
      const { composedSurfaces, appliedTransforms, diagnostics } = composeSurfaces(
        surfaces,
        options?.transforms,
      );

      // Pipeline: evaluate composed surfaces — no transform awareness
      const facts = evaluateFacts(context.hand, context.evaluation, catalog);
      const proposals = evaluateAllSurfaces(composedSurfaces, facts);
      const inputs = zipProposalsWithSurfaces(proposals, composedSurfaces);
      const legalCalls = getLegalCalls(context.auction, context.seat);
      const arbitration = arbitrateMeanings(inputs, { legalCalls });

      // Graft upstream provenance
      const result = mergeUpstreamProvenance(arbitration, appliedTransforms, diagnostics);

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
 * Flattens all surfaces, evaluates and arbitrates across all modules.
 *
 * When `surfaceRouter` is provided, only surfaces active for the current
 * auction position and seat are evaluated — enabling round-aware selection
 * for multi-round conventions.
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

  // Machine evaluation memoization: cache by auction length
  let cachedMachineResult: MachineEvalResult | null = null;
  let cachedMachineAuctionLength = -1;

  function getMachineResult(machine: ConversationMachine, auction: Auction, seat: Seat): MachineEvalResult {
    if (cachedMachineAuctionLength === auction.entries.length && cachedMachineResult) {
      return cachedMachineResult;
    }
    cachedMachineResult = evaluateMachine(machine, auction, seat);
    cachedMachineAuctionLength = auction.entries.length;
    return cachedMachineResult;
  }

  // Posterior memoization: cache PublicHandSpace[] by auction length
  let cachedHandSpaces: PublicHandSpace[] | null = null;
  let cachedAuctionLength = -1;

  /** When machine is present, use activeSurfaceGroupIds to select surfaces. */
  function selectSurfacesViaMachine(
    machineResult: MachineEvalResult,
  ): readonly MeaningSurface[] {
    const activeGroupIds = new Set(machineResult.activeSurfaceGroupIds);
    return moduleSurfaces
      .filter((g) => activeGroupIds.has(g.moduleId))
      .flatMap((g) => g.surfaces);
  }

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

      let activeSurfaces: readonly MeaningSurface[];
      let machineTransforms: readonly CandidateTransform[] = [];

      if (options?.conversationMachine) {
        // Machine-driven surface selection: machine determines which surface groups are live
        const machineResult: MachineEvalResult = getMachineResult(
          options.conversationMachine,
          context.auction,
          context.seat,
        );
        activeSurfaces = selectSurfacesViaMachine(machineResult);
        machineTransforms = machineResult.collectedTransforms;
      } else if (options?.surfaceRouter) {
        // Legacy surface router path
        activeSurfaces = options.surfaceRouter(context.auction, context.seat);
      } else {
        activeSurfaces = allSurfaces;
      }

      if (activeSurfaces.length === 0) return null;

      // Merge machine transforms with static transforms
      const allTransforms = machineTransforms.length > 0
        ? [...machineTransforms, ...(options?.transforms ?? [])]
        : options?.transforms;

      // Upstream: compose surfaces (apply transforms before pipeline)
      const { composedSurfaces, appliedTransforms, diagnostics: surfaceDiagnostics } = composeSurfaces(
        activeSurfaces,
        allTransforms,
      );

      // Posterior wiring: build provider from posterior engine when available
      let posteriorProvider: PosteriorFactProvider | undefined;
      let activeSeatPosterior: SeatPosterior | undefined;
      if (options?.posteriorEngine && options?.surfaceRouterForCommitments) {
        const auctionLength = context.auction.entries.length;
        if (cachedAuctionLength !== auctionLength) {
          const snapshot = buildSnapshotFromAuction(
            context.auction, context.seat, [],
            { surfaceRouter: options.surfaceRouterForCommitments },
          );
          cachedHandSpaces = options.posteriorEngine.compilePublic(snapshot);
          cachedAuctionLength = auctionLength;
        }
        const partnerSeat = getPartnerSeat(context.seat);
        const partnerSpace = cachedHandSpaces?.find((s) => s.seatId === partnerSeat);
        if (partnerSpace) {
          activeSeatPosterior = options.posteriorEngine.conditionOnHand(
            partnerSpace, context.seat, context.hand,
          );
          posteriorProvider = createPosteriorFactProvider(activeSeatPosterior);
        }
      }

      // Pipeline: evaluate composed surfaces — no transform awareness
      const facts = evaluateFacts(context.hand, context.evaluation, catalog, undefined, posteriorProvider);

      // Build posterior summary from evaluated facts when posterior was active
      if (posteriorProvider && activeSeatPosterior) {
        const posteriorFacts: PosteriorFactValue[] = [];
        const posteriorIds = catalog.posteriorEvaluators
          ? [...catalog.posteriorEvaluators.keys()]
          : [];
        for (const id of posteriorIds) {
          const fv = facts.facts.get(id);
          if (fv) {
            const queryResult = posteriorProvider.queryFact({ factId: id, seatId: activeSeatPosterior.seatId });
            posteriorFacts.push({
              factId: id,
              seatId: activeSeatPosterior.seatId,
              expectedValue: fv.value as number,
              confidence: queryResult?.confidence ?? 0,
            });
          }
        }
        if (posteriorFacts.length > 0) {
          const avgConfidence = posteriorFacts.reduce((sum, f) => sum + f.confidence, 0) / posteriorFacts.length;
          lastPosteriorSummary = {
            factValues: posteriorFacts,
            sampleCount: activeSeatPosterior.effectiveSampleSize,
            confidence: avgConfidence,
          };
        }
      }

      const proposals = evaluateAllSurfaces(composedSurfaces, facts);
      const inputs = zipProposalsWithSurfaces(proposals, composedSurfaces);
      const legalCalls = getLegalCalls(context.auction, context.seat);
      const arbitration = arbitrateMeanings(inputs, { legalCalls });

      // Graft upstream provenance
      const result = mergeUpstreamProvenance(arbitration, appliedTransforms, surfaceDiagnostics);

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
