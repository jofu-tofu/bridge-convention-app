import type {
  BiddingContext,
  BidResult,
  BidAlert,
} from "../../core/contracts";
import type { ResolvedCandidateDTO } from "../../core/contracts/tree-evaluation";
import type { ArbitrationResult } from "../../core/contracts/module-surface";
import type { PosteriorSummary } from "../../core/contracts/recommendation";
import { formatHandSummary } from "../../core/display/hand-summary";

// Re-export from teaching layer so existing callers don't break.
export { buildTeachingProjection } from "../../teaching/teaching-projection-builder";

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
    orderKey: ep.proposal.ranking.declarationOrder,
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

  // Build alert from proposal's threaded alertability metadata
  const alert: BidAlert | null = selected.proposal.isAlertable
    ? {
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


