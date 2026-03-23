/**
 * WhyNot Builder
 *
 * Extracted from teaching-projection-builder.ts — builds WhyNotEntry[] for
 * calls that are in the acceptable set but NOT in the truth set.
 */

import { callsMatch } from "../../engine/call-helpers";

import type {
  ArbitrationResult,
  EncodedProposal,
} from "../pipeline/pipeline-types";

import type {
  DecisionProvenance,
  EliminationTrace,
} from "../../core/contracts/provenance";

import type {
  WhyNotEntry,
  ExplanationNode,
} from "../../core/contracts/teaching-projection";

import type { SurfaceGroup } from "../../core/contracts/teaching-grading";

import type { CatalogIndex } from "./teaching-projection-builder";
import { resolveDisplayText } from "./teaching-projection-builder";

// -- WhyNot --

/**
 * Build WhyNotEntry[] for calls that are in the acceptable set but NOT in the truth set.
 * These represent "near-miss" calls that almost made it.
 */
export function buildWhyNot(
  arbitration: ArbitrationResult,
  provenance: DecisionProvenance,
  catalogIndex?: CatalogIndex,
  surfaceGroups?: readonly SurfaceGroup[],
  truthMeaningIds?: ReadonlySet<string>,
): WhyNotEntry[] {
  const entries: WhyNotEntry[] = [];
  const truthCalls = arbitration.truthSet.map(e => e.call);

  // Acceptable-set entries that are not in the truth set are near-misses
  for (const encoded of arbitration.acceptableSet) {
    if (truthCalls.some(tc => callsMatch(tc, encoded.call))) continue;

    const eliminationTrace = provenance.eliminations.find(
      t => t.candidateId === encoded.proposal.meaningId,
    );

    const explanation = buildWhyNotExplanation(encoded, eliminationTrace, catalogIndex);
    const stage = eliminationTrace?.stage ?? "applicability";

    // Grade based on surface group membership: bids in the same group as
    // any truth-set meaning are "near-miss"; unrelated bids are "wrong".
    const grade: "near-miss" | "wrong" = surfaceGroups && truthMeaningIds
      ? isInSameGroup(encoded.proposal.meaningId, truthMeaningIds, surfaceGroups)
        ? "near-miss"
        : "wrong"
      : "wrong";

    entries.push({
      call: encoded.call,
      grade,
      explanation,
      eliminationStage: stage,
    });
  }

  return entries;
}

/**
 * Check if a meaningId shares a SurfaceGroup with any truth-set meaningId.
 */
function isInSameGroup(
  meaningId: string,
  truthMeaningIds: ReadonlySet<string>,
  surfaceGroups: readonly SurfaceGroup[],
): boolean {
  for (const group of surfaceGroups) {
    if (!group.members.includes(meaningId)) continue;
    for (const truthId of truthMeaningIds) {
      if (group.members.includes(truthId)) return true;
    }
  }
  return false;
}

/** Build explanation nodes for a WhyNot entry. */
function buildWhyNotExplanation(
  encoded: EncodedProposal,
  eliminationTrace: EliminationTrace | undefined,
  catalogIndex?: CatalogIndex,
): ExplanationNode[] {
  const nodes: ExplanationNode[] = [];

  if (eliminationTrace) {
    nodes.push({
      kind: "text",
      content: eliminationTrace.reason,
    });
    for (const evidence of eliminationTrace.evidence) {
      const catalogEntry = catalogIndex?.byFactId.get(evidence.conditionId);
      const templateKey = catalogEntry
        ? (catalogEntry.contrastiveTemplateKey ?? catalogEntry.templateKey)
        : undefined;
      // Use resolved display text or clause description from the proposal
      const clauseDesc = encoded.proposal.clauses.find(c => c.factId === evidence.conditionId)?.description;
      const contrastiveText = resolveDisplayText(catalogEntry, /* isContrastive */ true);
      const displayContent = contrastiveText
        ?? clauseDesc
        ?? evidence.conditionId;
      const node: ExplanationNode = catalogEntry
        ? {
            kind: "condition",
            content: displayContent,
            passed: evidence.satisfied,
            explanationId: catalogEntry.explanationId,
            templateKey,
          }
        : {
            kind: "condition",
            content: displayContent,
            passed: evidence.satisfied,
          };
      nodes.push(node);
    }
  } else {
    // Fall back to clause-level detail from the proposal
    const failedClauses = encoded.proposal.clauses.filter(c => !c.satisfied);
    if (failedClauses.length > 0) {
      nodes.push({
        kind: "text",
        content: "Your hand doesn't meet the requirements",
      });
      for (const clause of failedClauses) {
        nodes.push({
          kind: "condition",
          content: clause.description,
          passed: false,
        });
      }
    }
  }

  return nodes;
}
