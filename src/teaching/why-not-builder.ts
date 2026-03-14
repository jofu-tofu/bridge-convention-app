/**
 * WhyNot Builder
 *
 * Extracted from teaching-projection-builder.ts — builds WhyNotEntry[] for
 * calls that are in the acceptable set but NOT in the truth set.
 */

import { callsMatch } from "../engine/call-helpers";

import type {
  ArbitrationResult,
  EncodedProposal,
} from "../core/contracts/module-surface";

import type {
  DecisionProvenance,
  EliminationTrace,
} from "../core/contracts/provenance";

import type {
  WhyNotEntry,
  PedagogicalRelationEntry,
  ExplanationNode,
} from "../core/contracts/teaching-projection";

import type { PedagogicalGraph } from "./pedagogical-graph";
import { findRelationsFor } from "./pedagogical-graph";

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
  pedGraph?: PedagogicalGraph,
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
    const familyRelation = pedGraph
      ? findNearMissRelation(pedGraph, encoded.proposal.meaningId, truthMeaningIds)
      : undefined;

    entries.push({
      call: encoded.call,
      grade: "near-miss",
      familyRelation,
      explanation,
      eliminationStage: stage,
    });
  }

  return entries;
}

/**
 * Find the best pedagogical relation between a near-miss meaning and any truth-set meaning.
 * Prefers `near-miss-of` relations, then any relation linking the two.
 */
function findNearMissRelation(
  graph: PedagogicalGraph,
  nearMissMeaningId: string,
  truthMeaningIds?: ReadonlySet<string>,
): PedagogicalRelationEntry | undefined {
  if (!truthMeaningIds || truthMeaningIds.size === 0) return undefined;

  const relations = findRelationsFor(graph, nearMissMeaningId);
  if (relations.length === 0) return undefined;

  // Find relations that connect this near-miss to a truth-set meaning
  const connecting = relations.filter(r => {
    const otherRef = r.a === nearMissMeaningId ? r.b : r.a;
    return truthMeaningIds.has(otherRef);
  });

  if (connecting.length === 0) return undefined;

  // Prefer near-miss-of relations
  const nearMissRelation = connecting.find(r => r.kind === "near-miss-of");
  const best = nearMissRelation ?? connecting[0]!;

  return { kind: best.kind, a: best.a, b: best.b };
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
        content: "Hand conditions not satisfied",
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
