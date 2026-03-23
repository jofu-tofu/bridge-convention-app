/**
 * Meaning View Builder
 *
 * Extracted from teaching-projection-builder.ts — builds MeaningView[] from
 * truth set, acceptable set, and eliminated proposals.
 */

import type {
  ArbitrationResult,
} from "../pipeline/pipeline-types";

import type {
  DecisionProvenance,
} from "../../core/contracts/provenance";

import type {
  MeaningView,
} from "../../core/contracts/teaching-projection";

import type { MeaningClause } from "../../core/contracts/meaning";

import type { ConditionEvidence } from "../../core/contracts/evidence-bundle";

// -- Meaning Views --

/** Convert a MeaningClause to ConditionEvidence for supporting evidence. */
function clauseToEvidence(clause: MeaningClause): ConditionEvidence {
  return {
    conditionId: clause.factId,
    satisfied: clause.satisfied,
    factId: clause.factId,
    observedValue: clause.observedValue,
  };
}

/** Build MeaningView[] from truth set, acceptable set, and eliminated proposals. */
export function buildMeaningViews(
  arbitration: ArbitrationResult,
  provenance: DecisionProvenance,
): MeaningView[] {
  const views: MeaningView[] = [];
  const seenMeaningIds = new Set<string>();

  // Live meanings: truth set entries
  for (const encoded of arbitration.truthSet) {
    seenMeaningIds.add(encoded.proposal.meaningId);
    views.push({
      meaningId: encoded.proposal.meaningId,
      semanticClassId: encoded.proposal.semanticClassId,
      displayLabel: encoded.proposal.teachingLabel ?? encoded.proposal.meaningId,
      status: "live",
      supportingEvidence: encoded.proposal.clauses.map(clauseToEvidence),
    });
  }

  // Eliminated meanings: from elimination records + provenance
  for (const elimination of arbitration.eliminations) {
    if (seenMeaningIds.has(elimination.candidateBidName)) continue;
    seenMeaningIds.add(elimination.candidateBidName);

    const eliminationTrace = provenance.eliminations.find(
      e => e.candidateId === elimination.candidateBidName,
    );

    const evidence: ConditionEvidence[] = eliminationTrace?.evidence
      ? [...eliminationTrace.evidence]
      : [];

    views.push({
      meaningId: elimination.candidateBidName,
      displayLabel: elimination.candidateBidName,
      status: "eliminated",
      eliminationReason: elimination.reason,
      supportingEvidence: evidence,
    });
  }

  // Acceptable-but-not-truth meanings: from acceptable set
  for (const encoded of arbitration.acceptableSet) {
    if (seenMeaningIds.has(encoded.proposal.meaningId)) continue;
    seenMeaningIds.add(encoded.proposal.meaningId);

    views.push({
      meaningId: encoded.proposal.meaningId,
      semanticClassId: encoded.proposal.semanticClassId,
      displayLabel: encoded.proposal.teachingLabel ?? encoded.proposal.meaningId,
      status: "eliminated",
      eliminationReason: "Your hand doesn't fully match",
      supportingEvidence: encoded.proposal.clauses.map(clauseToEvidence),
    });
  }

  return views;
}
