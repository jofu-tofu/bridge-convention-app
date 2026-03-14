/**
 * Teaching Projection Builder
 *
 * Builds a read-only TeachingProjection from arbitration results and decision provenance.
 * Pure function — no side effects, no imports from strategy/stores/components.
 * NEVER affects truth/recommendation/selection.
 */

import type { Call } from "../engine/types";
import { callsMatch } from "../engine/call-helpers";

import type {
  ArbitrationResult,
  EncodedProposal,
} from "../core/contracts/module-surface";

import type {
  MeaningClause,
} from "../core/contracts/meaning";

import type {
  DecisionProvenance,
  EliminationTrace,
} from "../core/contracts/provenance";

import type {
  TeachingProjection,
  CallProjection,
  MeaningView,
  ExplanationNode,
  WhyNotEntry,
  PedagogicalRelationEntry,
  ConventionContribution,
  SeatRelativeHandSpaceSummary,
} from "../core/contracts/teaching-projection";

import type { ConditionEvidenceIR } from "../core/contracts/evidence-bundle";


import type {
  ExplanationCatalogIR,
  ExplanationEntry,
} from "../core/contracts/explanation-catalog";

import type { PedagogicalRelation } from "../core/contracts/pedagogical-relations";

import type { PosteriorSummary } from "../core/contracts/recommendation";

import {
  buildPedagogicalGraph,
  findRelationsFor,
  type PedagogicalGraph,
} from "./pedagogical-graph";

// -- Options --

/** Options for teaching projection construction. */
export interface TeachingProjectionOptions {
  /** Seat label for the hand space summary (defaults to "South"). */
  readonly seatLabel?: string;
  /** HCP range override for hand space summary. */
  readonly hcpRange?: { readonly min: number; readonly max: number };
  /** Shape description override for hand space summary. */
  readonly shapeDescription?: string;
  /** Explanation catalog for enriching nodes with explanationId/templateKey. */
  readonly explanationCatalog?: ExplanationCatalogIR;
  /** Pedagogical relations for enriching WhyNot entries with family context. */
  readonly pedagogicalRelations?: readonly PedagogicalRelation[];
  /** Posterior summary for enriching the hand space with probabilistic partner info.
   *  Convention-agnostic: renders whatever posterior-derived facts are present. */
  readonly posteriorSummary?: PosteriorSummary;
}

// -- Catalog Index --

/** Pre-indexed catalog for O(1) lookups by factId and meaningId. */
interface CatalogIndex {
  readonly byFactId: ReadonlyMap<string, ExplanationEntry>;
  readonly byMeaningId: ReadonlyMap<string, ExplanationEntry>;
}

/** Build a CatalogIndex from an ExplanationCatalogIR. */
function buildCatalogIndex(catalog: ExplanationCatalogIR): CatalogIndex {
  const byFactId = new Map<string, ExplanationEntry>();
  const byMeaningId = new Map<string, ExplanationEntry>();

  for (const entry of catalog.entries) {
    if (entry.factId) {
      byFactId.set(entry.factId, entry);
    }
    if (entry.meaningId) {
      byMeaningId.set(entry.meaningId, entry);
    }
  }

  return { byFactId, byMeaningId };
}

// -- Display Text Resolver --

/** Resolve display text from a catalog entry.
 *  When isContrastive is true, prefers contrastiveDisplayText, falling back to displayText. */
function resolveDisplayText(
  catalogEntry: ExplanationEntry | undefined,
  isContrastive?: boolean,
): string | undefined {
  if (!catalogEntry) return undefined;
  if (isContrastive) {
    return catalogEntry.contrastiveDisplayText ?? catalogEntry.displayText;
  }
  return catalogEntry.displayText;
}

// -- Main entry point --

/**
 * Build a TeachingProjection from an ArbitrationResult and DecisionProvenance.
 *
 * Pure function — no side effects, no imports from strategy/stores/components.
 * This is a read-only projection for UI display; it NEVER affects truth/recommendation/selection.
 */
export function projectTeaching(
  arbitration: ArbitrationResult,
  provenance: DecisionProvenance,
  options?: TeachingProjectionOptions,
): TeachingProjection {
  const catalogIndex = options?.explanationCatalog
    ? buildCatalogIndex(options.explanationCatalog)
    : undefined;

  const pedGraph = options?.pedagogicalRelations
    ? buildPedagogicalGraph(options.pedagogicalRelations)
    : undefined;

  const truthMeaningIds = new Set(arbitration.truthSet.map(e => e.proposal.meaningId));

  // Build a clause description index from the selected proposal for primary explanation
  const clauseDescriptions = buildClauseDescriptionIndex(arbitration);

  const meaningViews = buildMeaningViews(arbitration, provenance);
  const callViews = buildCallViews(arbitration);
  const primaryExplanation = buildPrimaryExplanation(provenance, catalogIndex, clauseDescriptions);
  const whyNot = buildWhyNot(arbitration, provenance, catalogIndex, pedGraph, truthMeaningIds);
  const conventionsApplied = buildConventionContributions(arbitration, provenance);
  const handSpace = buildHandSpace(options, catalogIndex);

  return {
    callViews,
    meaningViews,
    primaryExplanation,
    whyNot,
    conventionsApplied,
    handSpace,
  };
}

// -- Call Views --

/**
 * Build CallProjection[] from truth set and acceptable set.
 *
 * Projection rules (per spec):
 *   - Same call + same semanticClassId -> "merged-equivalent"
 *   - Same call + different semanticClassIds -> "multi-rationale-same-call"
 *   - Single meaning for a call -> "single-rationale"
 */
function buildCallViews(arbitration: ArbitrationResult): CallProjection[] {
  const views: CallProjection[] = [];

  // Truth set entries
  const truthCallGroups = groupByCall(arbitration.truthSet);
  for (const [, encodeds] of truthCallGroups) {
    const meaningIds = encodeds.map(e => e.proposal.meaningId);
    const call = encodeds[0]!.call;
    const projectionKind = classifyProjectionKind(encodeds);
    const primaryMeaning = selectPrimaryMeaning(encodeds);

    views.push({
      call,
      status: "truth",
      supportingMeanings: meaningIds,
      primaryMeaning,
      projectionKind,
    });
  }

  // Acceptable set entries (not already in truth set by call)
  const truthCallKeys = new Set([...truthCallGroups.keys()]);
  const acceptableCallGroups = groupByCall(arbitration.acceptableSet);
  for (const [key, encodeds] of acceptableCallGroups) {
    if (truthCallKeys.has(key)) continue;

    const meaningIds = encodeds.map(e => e.proposal.meaningId);
    const call = encodeds[0]!.call;
    const projectionKind = classifyProjectionKind(encodeds);
    const primaryMeaning = selectPrimaryMeaning(encodeds);

    views.push({
      call,
      status: "acceptable",
      supportingMeanings: meaningIds,
      primaryMeaning,
      projectionKind,
    });
  }

  return views;
}

/** Group encoded proposals by their concrete call. */
function groupByCall(
  encoded: readonly EncodedProposal[],
): Map<string, EncodedProposal[]> {
  const groups = new Map<string, EncodedProposal[]>();
  for (const e of encoded) {
    const key = formatCallKey(e.call);
    const group = groups.get(key);
    if (group) {
      group.push(e);
    } else {
      groups.set(key, [e]);
    }
  }
  return groups;
}

/** Produce a stable string key for call grouping. */
function formatCallKey(call: Call): string {
  if (call.type === "bid") {
    return `${call.level}${call.strain}`;
  }
  return call.type;
}

/** Classify the projectionKind for a group of proposals encoding to the same call. */
function classifyProjectionKind(
  encodeds: readonly EncodedProposal[],
): CallProjection["projectionKind"] {
  if (encodeds.length <= 1) return "single-rationale";

  const semanticClassIds = new Set(
    encodeds.map(e => e.proposal.semanticClassId).filter(Boolean),
  );

  // All share the same semanticClassId (or none have one, but there are multiple)
  if (semanticClassIds.size <= 1) return "merged-equivalent";

  return "multi-rationale-same-call";
}

/**
 * Select the primary meaning for display.
 * Per spec: prefer alphabetically by meaningId as a stable tiebreak.
 */
function selectPrimaryMeaning(encodeds: readonly EncodedProposal[]): string | undefined {
  if (encodeds.length === 0) return undefined;
  const sorted = [...encodeds].sort((a, b) =>
    a.proposal.meaningId.localeCompare(b.proposal.meaningId),
  );
  return sorted[0]!.proposal.meaningId;
}

// -- Meaning Views --

/** Convert a MeaningClause to ConditionEvidenceIR for supporting evidence. */
function clauseToEvidence(clause: MeaningClause): ConditionEvidenceIR {
  return {
    conditionId: clause.factId,
    satisfied: clause.satisfied,
    factId: clause.factId,
    observedValue: clause.observedValue,
  };
}

/** Build MeaningView[] from truth set, acceptable set, and eliminated proposals. */
function buildMeaningViews(
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

    const evidence: ConditionEvidenceIR[] = eliminationTrace?.evidence
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
      eliminationReason: "Hand conditions not fully satisfied",
      supportingEvidence: encoded.proposal.clauses.map(clauseToEvidence),
    });
  }

  return views;
}

// -- Clause Description Index --

/** Build a map from factId → human-readable description from the selected proposal's clauses. */
function buildClauseDescriptionIndex(
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
function buildPrimaryExplanation(
  provenance: DecisionProvenance,
  catalogIndex?: CatalogIndex,
  clauseDescriptions?: ReadonlyMap<string, string>,
): ExplanationNode[] {
  const nodes: ExplanationNode[] = [];
  const seenMeaningIds = new Set<string>();

  for (const condition of provenance.applicability.evaluatedConditions) {
    const catalogEntry = catalogIndex?.byFactId.get(condition.conditionId);
    // Prefer clause description, then catalog display text, then fall back to conditionId
    const displayContent = clauseDescriptions?.get(condition.conditionId)
      ?? resolveDisplayText(catalogEntry)
      ?? condition.conditionId;

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

    // If there is a meaning-level catalog entry linked via the same factId,
    // emit a convention-reference node (deduplicated by meaningId).
    if (catalogEntry?.meaningId && !seenMeaningIds.has(catalogEntry.meaningId)) {
      const meaningEntry = catalogIndex?.byMeaningId.get(catalogEntry.meaningId);
      if (meaningEntry) {
        seenMeaningIds.add(catalogEntry.meaningId);
        const meaningContent = resolveDisplayText(meaningEntry) ?? meaningEntry.meaningId!;
        nodes.push({
          kind: "convention-reference",
          content: meaningContent,
          explanationId: meaningEntry.explanationId,
          templateKey: meaningEntry.templateKey,
        });
      }
    }
  }

  return nodes;
}

// -- WhyNot --

/**
 * Build WhyNotEntry[] for calls that are in the acceptable set but NOT in the truth set.
 * These represent "near-miss" calls that almost made it.
 */
function buildWhyNot(
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

// -- Convention Contributions --

/** Build ConventionContribution[] from arbitration and provenance. */
function buildConventionContributions(
  arbitration: ArbitrationResult,
  provenance: DecisionProvenance,
): ConventionContribution[] {
  const moduleMap = new Map<string, {
    role: ConventionContribution["role"];
    meanings: Set<string>;
    transforms: Set<string>;
  }>();

  // Selected module is primary
  const selectedModuleId = arbitration.selected?.proposal.moduleId;

  // Truth set contributions
  for (const encoded of arbitration.truthSet) {
    const moduleId = encoded.proposal.moduleId;
    const entry = getOrCreateModuleEntry(moduleMap, moduleId);
    entry.meanings.add(encoded.proposal.meaningId);
    if (moduleId === selectedModuleId) {
      entry.role = "primary";
    } else if (entry.role !== "primary") {
      entry.role = "alternative";
    }
  }

  // Eliminations — modules that proposed but were eliminated
  for (const elimination of arbitration.eliminations) {
    const moduleId = elimination.moduleId;
    const entry = getOrCreateModuleEntry(moduleMap, moduleId);
    entry.meanings.add(elimination.candidateBidName);
    // Don't override primary/alternative with suppressed
  }

  // Transform contributions
  for (const transform of provenance.transforms) {
    const entry = getOrCreateModuleEntry(moduleMap, transform.sourceModuleId);
    entry.transforms.add(transform.transformId);
  }

  return [...moduleMap.entries()].map(([moduleId, data]) => ({
    moduleId,
    role: data.role,
    meaningsProposed: [...data.meanings],
    transformsApplied: [...data.transforms],
  }));
}

function getOrCreateModuleEntry(
  map: Map<string, {
    role: ConventionContribution["role"];
    meanings: Set<string>;
    transforms: Set<string>;
  }>,
  moduleId: string,
): { role: ConventionContribution["role"]; meanings: Set<string>; transforms: Set<string> } {
  let entry = map.get(moduleId);
  if (!entry) {
    entry = { role: "suppressed", meanings: new Set(), transforms: new Set() };
    map.set(moduleId, entry);
  }
  return entry;
}

// -- Hand Space --

/** Build a partner summary from posterior fact values.
 *  Convention-agnostic: renders facts above a confidence threshold,
 *  resolving labels from the explanation catalog. */
function buildPartnerSummary(
  posterior: PosteriorSummary,
  catalogIndex?: CatalogIndex,
): string | undefined {
  const HIGH_CONFIDENCE = 0.55;
  const insights: string[] = [];

  for (const fv of posterior.factValues) {
    if (fv.confidence < HIGH_CONFIDENCE) continue;
    // Look up label from catalog, fall back to factId
    const catalogEntry = catalogIndex?.byFactId.get(fv.factId);
    const label = catalogEntry?.displayText ?? fv.factId;
    const pct = Math.round(fv.confidence * 100);
    insights.push(`${label} (${pct}%)`);
  }

  if (insights.length === 0) return undefined;
  return insights.join(". ");
}

/** Build hand space summary, enriched with posterior data when available. */
function buildHandSpace(
  options?: TeachingProjectionOptions,
  catalogIndex?: CatalogIndex,
): SeatRelativeHandSpaceSummary {
  const base: SeatRelativeHandSpaceSummary = {
    seatLabel: options?.seatLabel ?? "South",
    hcpRange: options?.hcpRange ?? { min: 0, max: 40 },
    shapeDescription: options?.shapeDescription ?? "Unknown shape",
  };

  if (!options?.posteriorSummary) return base;

  const partnerSummary = buildPartnerSummary(options.posteriorSummary, catalogIndex);
  if (!partnerSummary) return base;

  return {
    ...base,
    partnerSummary,
  };
}
