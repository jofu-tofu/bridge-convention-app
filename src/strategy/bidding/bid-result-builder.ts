import type {
  BiddingContext,
  BidResult,
  BidAlert,
} from "../../core/contracts";
import type { ResolvedCandidateDTO } from "../../core/contracts/tree-evaluation";
import type { DecisionProvenance } from "../../core/contracts/provenance";
import type { ArbitrationResult } from "../../core/contracts/module-surface";
import type { ExplanationCatalogIR } from "../../core/contracts/explanation-catalog";
import type { PedagogicalRelation } from "../../core/contracts/pedagogical-relations";
import type { PosteriorSummary } from "../../core/contracts/recommendation";
import type { TeachingProjection } from "../../core/contracts/teaching-projection";
import { formatHandSummary } from "../../core/display/hand-summary";
import { projectTeaching } from "../../teaching/teaching-projection-builder";

// ─── Result Mapping ────────────────────────────────────────────

export function buildBidResult(
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

  // Build alert from proposal's threaded alert metadata
  const alert: BidAlert | null = selected.proposal.alert
    ? {
        kind: selected.proposal.alert,
        publicConstraints: selected.proposal.publicConstraints ?? [],
        teachingLabel: selected.proposal.teachingLabel ?? selected.proposal.meaningId,
      }
    : null;

  return {
    call: selected.call,
    ruleName: selected.proposal.meaningId,
    explanation: selected.proposal.evidence.provenance.nodeName,
    meaning: selected.proposal.teachingLabel ?? selected.proposal.meaningId,
    alert,
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
export function buildTeachingProjection(
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
