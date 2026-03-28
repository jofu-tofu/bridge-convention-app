/**
 * Parse Tree Builder
 *
 * Builds a ParseTreeView from arbitration results and decision provenance.
 * Shows the full decision chain: which convention modules were considered,
 * why each was accepted/rejected, and the path to the correct bid.
 *
 * Pure function — no side effects, no imports from strategy/stores/components.
 */

import type { ArbitrationResult } from "../pipeline/pipeline-types";
import type { DecisionProvenance } from "../pipeline/evaluation/provenance";
import type { Call } from "../../engine/types";
import type {
  ParseTreeView,
  ParseTreeModuleNode,
  ParseTreeModuleVerdict,
  ParseTreeCondition,
} from "./teaching-types";
import type { CatalogIndex } from "./teaching-projection-builder";
import { resolveDisplayText } from "./teaching-projection-builder";

/** Build a ParseTreeView from arbitration results and provenance.
 *  Groups proposals by module, determines verdict per module,
 *  and constructs the decision chain. */
export function buildParseTree(
  arbitration: ArbitrationResult,
  provenance: DecisionProvenance,
  catalogIndex?: CatalogIndex,
): ParseTreeView {
  const selectedModuleId = arbitration.selected?.proposal.moduleId;

  // Collect per-module data: meanings proposed, verdicts, conditions
  const moduleMap = new Map<string, {
    displayLabel: string;
    truthMeanings: { meaningId: string; displayLabel: string; call?: Call }[];
    eliminatedMeanings: { meaningId: string; displayLabel: string; reason?: string }[];
    conditions: ParseTreeCondition[];
    eliminationReason?: string;
  }>();

  // Process truth-set entries (modules that produced valid proposals)
  for (const encoded of arbitration.truthSet) {
    const moduleId = encoded.proposal.moduleId;
    const entry = getOrCreate(moduleMap, moduleId);
    if (!encoded.proposal.teachingLabel && import.meta.env.DEV) {
      console.warn(`[teaching] No teachingLabel for meaningId: ${encoded.proposal.meaningId}`);
    }
    entry.truthMeanings.push({
      meaningId: encoded.proposal.meaningId,
      displayLabel: encoded.proposal.teachingLabel?.name ?? encoded.proposal.meaningId,
      call: encoded.call,
    });
    // Collect conditions from the first truth-set meaning per module
    if (entry.conditions.length === 0) {
      entry.conditions = encoded.proposal.clauses.map(clause => ({
        factId: clause.factId,
        description: resolveDisplayText(catalogIndex?.byFactId.get(clause.factId))
          ?? clause.description,
        satisfied: clause.satisfied,
        observedValue: clause.observedValue,
      }));
    }
  }

  // Process eliminations (modules that proposed but were rejected)
  for (const elimination of arbitration.eliminations) {
    const moduleId = elimination.moduleId;
    const entry = getOrCreate(moduleMap, moduleId);
    entry.eliminatedMeanings.push({
      meaningId: elimination.candidateBidName,
      displayLabel: elimination.candidateBidName,
      reason: elimination.reason,
    });
    if (!entry.eliminationReason) {
      entry.eliminationReason = elimination.reason;
    }
  }

  // Enrich eliminated modules with conditions from provenance
  for (const elimTrace of provenance.eliminations) {
    // Find which module this elimination belongs to
    for (const [, data] of moduleMap) {
      const hasElim = data.eliminatedMeanings.some(
        m => m.meaningId === elimTrace.candidateId,
      );
      if (hasElim && data.conditions.length === 0 && elimTrace.evidence.length > 0) {
        data.conditions = elimTrace.evidence.map(ev => {
          const catalogText = resolveDisplayText(catalogIndex?.byFactId.get(ev.factId ?? ev.conditionId));
          if (!catalogText && !ev.description && catalogIndex && import.meta.env.DEV) {
            console.warn(`[teaching] No catalog entry found for factId: ${ev.factId ?? ev.conditionId}`);
          }
          return {
            factId: ev.conditionId,
            description: catalogText ?? ev.description ?? ev.conditionId,
            satisfied: ev.satisfied,
            observedValue: ev.observedValue,
          };
        });
      }
    }
  }

  // Enrich with activation traces (modules that were activated/deactivated)
  for (const activation of provenance.activation) {
    const entry = getOrCreate(moduleMap, activation.moduleId);
    if (!activation.activated && !entry.eliminationReason) {
      entry.eliminationReason = activation.reason ?? "Module not activated";
    }
  }

  // Build module nodes
  const modules: ParseTreeModuleNode[] = [];
  for (const [moduleId, data] of moduleMap) {
    const isSelected = moduleId === selectedModuleId;
    const hasTruthMeanings = data.truthMeanings.length > 0;

    let verdict: ParseTreeModuleVerdict;
    if (isSelected) {
      verdict = "selected";
    } else if (hasTruthMeanings) {
      verdict = "applicable";
    } else {
      verdict = "eliminated";
    }

    const meanings = [
      ...data.truthMeanings.map(m => ({
        meaningId: m.meaningId,
        displayLabel: m.displayLabel,
        matched: true as const,
        call: m.call,
      })),
      ...data.eliminatedMeanings.map(m => ({
        meaningId: m.meaningId,
        displayLabel: m.displayLabel,
        matched: false as const,
      })),
    ];

    modules.push({
      moduleId,
      displayLabel: data.displayLabel,
      verdict,
      conditions: data.conditions,
      meanings,
      ...(verdict === "eliminated" && data.eliminationReason
        ? { eliminationReason: data.eliminationReason }
        : {}),
    });
  }

  // Sort: selected first, then applicable, then eliminated
  const verdictOrder: Record<ParseTreeModuleVerdict, number> = {
    selected: 0,
    applicable: 1,
    eliminated: 2,
  };
  modules.sort((a, b) => verdictOrder[a.verdict] - verdictOrder[b.verdict]);

  // Build selected path
  const selectedPath = arbitration.selected
    ? {
        moduleId: arbitration.selected.proposal.moduleId,
        meaningId: arbitration.selected.proposal.meaningId,
        call: arbitration.selected.call,
      }
    : null;

  return { modules, selectedPath };
}

function getOrCreate(
  map: Map<string, {
    displayLabel: string;
    truthMeanings: { meaningId: string; displayLabel: string; call?: Call }[];
    eliminatedMeanings: { meaningId: string; displayLabel: string; reason?: string }[];
    conditions: ParseTreeCondition[];
    eliminationReason?: string;
  }>,
  moduleId: string,
) {
  let entry = map.get(moduleId);
  if (!entry) {
    entry = {
      displayLabel: moduleId,
      truthMeanings: [],
      eliminatedMeanings: [],
      conditions: [],
    };
    map.set(moduleId, entry);
  }
  return entry;
}
