/**
 * Explanation Builder
 *
 * Extracted from teaching-projection-builder.ts — builds primary explanation
 * nodes and clause description index.
 */

import type {
  ArbitrationResult,
} from "../pipeline/pipeline-types";

import type {
  DecisionProvenance,
} from "../pipeline/provenance";

import type {
  ExplanationNode,
} from "./teaching-types";

import type { CatalogIndex } from "./teaching-projection-builder";
import { resolveDisplayText } from "./teaching-projection-builder";

// -- Clause Description Index --

/** Build a map from factId → human-readable description from the selected proposal's clauses. */
export function buildClauseDescriptionIndex(
  arbitration: ArbitrationResult,
): ReadonlyMap<string, string> {
  const index = new Map<string, string>();

  // Primary source: selected proposal clauses
  if (arbitration.selected) {
    for (const clause of arbitration.selected.proposal.clauses) {
      if (clause.description) {
        index.set(clause.factId, clause.description);
      }
    }
  }

  // Secondary: truth set clauses (may add entries the selected didn't have)
  for (const encoded of arbitration.truthSet) {
    for (const clause of encoded.proposal.clauses) {
      if (clause.description && !index.has(clause.factId)) {
        index.set(clause.factId, clause.description);
      }
    }
  }

  return index;
}

// -- Primary Explanation --

/** Build the primary explanation from provenance applicability evidence,
 *  enriched with clause descriptions and catalog template keys. */
export function buildPrimaryExplanation(
  provenance: DecisionProvenance,
  catalogIndex?: CatalogIndex,
  clauseDescriptions?: ReadonlyMap<string, string>,
): ExplanationNode[] {
  const nodes: ExplanationNode[] = [];

  for (const condition of provenance.applicability.evaluatedConditions) {
    const catalogEntry = catalogIndex?.byFactId.get(condition.conditionId);
    // Prefer clause description, then catalog display text, then fall back to conditionId
    const clauseDesc = clauseDescriptions?.get(condition.conditionId);
    const catalogText = resolveDisplayText(catalogEntry);
    const displayContent = clauseDesc ?? catalogText ?? condition.conditionId;
    if (!clauseDesc && !catalogText && catalogIndex) {
      if (import.meta.env.DEV) {
        console.warn(`[teaching] No catalog entry found for factId: ${condition.conditionId}`);
      }
    }

    const node: ExplanationNode = catalogEntry
      ? {
          kind: "condition",
          content: displayContent,
          passed: condition.satisfied,
          explanationId: catalogEntry.explanationId,
          templateKey: catalogEntry.templateKey,
        }
      : {
          kind: "condition",
          content: displayContent,
          passed: condition.satisfied,
        };
    nodes.push(node);
  }

  return nodes;
}
