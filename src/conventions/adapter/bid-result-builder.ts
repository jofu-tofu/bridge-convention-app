import type { BiddingContext, BidResult, BidAlert } from "../core/strategy-types";
import type { FactConstraint } from "../core/agreement-module";
import type { ResolvedCandidateDTO } from "../pipeline/tree-evaluation";
import type { PipelineCarrier, PipelineResult } from "..";
import type { PosteriorSummary } from "../core/strategy-types";
import { formatHandSummary } from "../../service/display/hand-summary";

// ─── Result Mapping ────────────────────────────────────────────

export function buildBidResult(
  selected: PipelineCarrier,
  context: BiddingContext,
  moduleId: string,
  result: PipelineResult,
  posteriorSummary?: PosteriorSummary | null,
): BidResult {
  // Map truth + acceptable sets to ResolvedCandidateDTO for teaching-resolution
  const resolvedCandidates: ResolvedCandidateDTO[] = [
    ...result.truthSet,
    ...result.acceptableSet,
  ].map((ep) => ({
    bidName: ep.proposal.meaningId,
    call: ep.call,
    resolvedCall: ep.call,
    isMatched: ep.eligibility.hand.satisfied,
    isDefaultCall: ep.isDefaultEncoding,
    legal: ep.eligibility.encoding.legal,
    meaning: ep.proposal.teachingLabel?.name ?? ep.proposal.meaningId,
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
        teachingLabel: selected.proposal.teachingLabel?.name ?? selected.proposal.meaningId,
        annotationType: selected.proposal.annotationType,
      }
    : null;

  // Thread constraints from the pipeline's evaluated clauses
  const constraints: readonly FactConstraint[] = selected.proposal.clauses.map((c) => ({
    factId: c.factId,
    operator: c.operator,
    value: c.value,
  }));

  // isPublic is the sole predicate — see FactConstraint.isPublic in agreement-module.ts
  const publicConditions = selected.proposal.clauses
    .filter((c) => c.isPublic)
    .map((c) => c.description);

  return {
    call: selected.call,
    ruleName: selected.proposal.meaningId,
    explanation: selected.proposal.teachingLabel?.name ?? selected.proposal.evidence.provenance.nodeName,
    meaning: selected.proposal.teachingLabel?.name ?? selected.proposal.meaningId,
    alert,
    constraints,
    publicConditions,
    handSummary: formatHandSummary(context.evaluation),
    evaluationTrace: {
      conventionId: moduleId,
      candidateCount: result.truthSet.length + result.acceptableSet.length,
      strategyChainPath: [],
      ...(posteriorSummary ? {
        posteriorSampleCount: posteriorSummary.sampleCount,
        posteriorConfidence: posteriorSummary.confidence,
      } : {}),
    },
    resolvedCandidates,
  };
}
