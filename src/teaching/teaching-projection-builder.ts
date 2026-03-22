/**
 * Teaching Projection Builder
 *
 * Builds a read-only TeachingProjection from arbitration results and decision provenance.
 * Pure function — no side effects, no imports from strategy/stores/components.
 * NEVER affects truth/recommendation/selection.
 */

import type {
  ArbitrationResult,
} from "../core/contracts/module-surface";

import type {
  DecisionProvenance,
} from "../core/contracts/provenance";

import type {
  TeachingProjection,
  ConventionContribution,
  HandSpaceSummary,
} from "../core/contracts/teaching-projection";

import type {
  ExplanationCatalog,
  ExplanationEntry,
} from "../core/contracts/explanation-catalog";

import type { TeachingRelation } from "../core/contracts/teaching-projection";

import type { PosteriorSummary } from "../core/contracts/recommendation";

import {
  buildTeachingGraph,
} from "./teaching-graph";

import { buildCallViews } from "./call-view-builder";
import { buildMeaningViews } from "./meaning-view-builder";
import { buildPrimaryExplanation, buildClauseDescriptionIndex } from "./explanation-builder";
import { buildWhyNot } from "./why-not-builder";
import { buildParseTree } from "./parse-tree-builder";

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
  readonly explanationCatalog?: ExplanationCatalog;
  /** Pedagogical relations for enriching WhyNot entries with family context. */
  readonly teachingRelations?: readonly TeachingRelation[];
  /** Posterior summary for enriching the hand space with probabilistic partner info.
   *  Convention-agnostic: renders whatever posterior-derived facts are present. */
  readonly posteriorSummary?: PosteriorSummary;
}

// -- Catalog Index --

/** Pre-indexed catalog for O(1) lookups by factId and meaningId. */
export interface CatalogIndex {
  readonly byFactId: ReadonlyMap<string, ExplanationEntry>;
  readonly byMeaningId: ReadonlyMap<string, ExplanationEntry>;
}

/** Build a CatalogIndex from an ExplanationCatalog. */
function buildCatalogIndex(catalog: ExplanationCatalog): CatalogIndex {
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
export function resolveDisplayText(
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

  const teachingGraph = options?.teachingRelations
    ? buildTeachingGraph(options.teachingRelations)
    : undefined;

  const truthMeaningIds = new Set(arbitration.truthSet.map(e => e.proposal.meaningId));

  // Build a clause description index from the selected proposal for primary explanation
  const clauseDescriptions = buildClauseDescriptionIndex(arbitration);

  const meaningViews = buildMeaningViews(arbitration, provenance);
  const callViews = buildCallViews(arbitration);
  const primaryExplanation = buildPrimaryExplanation(provenance, catalogIndex, clauseDescriptions);
  const whyNot = buildWhyNot(arbitration, provenance, catalogIndex, teachingGraph, truthMeaningIds);
  const conventionsApplied = buildConventionContributions(arbitration, provenance);
  const handSpace = buildHandSpace(options, catalogIndex);
  const parseTree = buildParseTree(arbitration, provenance, catalogIndex);

  return {
    callViews,
    meaningViews,
    primaryExplanation,
    whyNot,
    conventionsApplied,
    handSpace,
    parseTree,
  };
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

  return [...moduleMap.entries()].map(([moduleId, data]) => ({
    moduleId,
    role: data.role,
    meaningsProposed: [...data.meanings],
  }));
}

function getOrCreateModuleEntry(
  map: Map<string, {
    role: ConventionContribution["role"];
    meanings: Set<string>;
  }>,
  moduleId: string,
): { role: ConventionContribution["role"]; meanings: Set<string> } {
  let entry = map.get(moduleId);
  if (!entry) {
    entry = { role: "suppressed", meanings: new Set() };
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
  const MIN_PROBABILITY = 0.55;
  const insights: string[] = [];

  for (const fv of posterior.factValues) {
    if (fv.confidence < HIGH_CONFIDENCE) continue;
    // Use expectedValue (the actual probability), not confidence (sample completion rate)
    const probability = fv.expectedValue ?? 0;
    if (probability < MIN_PROBABILITY) continue;
    // Look up label from catalog, fall back to factId
    const catalogEntry = catalogIndex?.byFactId.get(fv.factId);
    const label = catalogEntry?.displayText ?? fv.factId;
    const pct = Math.round(probability * 100);
    insights.push(`${label} (${pct}%)`);
  }

  if (insights.length === 0) return undefined;
  return insights.join(". ");
}

/** Build hand space summary, enriched with posterior data when available. */
function buildHandSpace(
  options?: TeachingProjectionOptions,
  catalogIndex?: CatalogIndex,
): HandSpaceSummary {
  const base: HandSpaceSummary = {
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

/**
 * Build a TeachingProjection from arbitration and provenance, returning null if provenance is missing.
 */
export function buildTeachingProjection(
  arbitration: ArbitrationResult,
  provenance: DecisionProvenance | null,
  explanationCatalog?: ExplanationCatalog,
  posteriorSummary?: PosteriorSummary | null,
  teachingRelations?: readonly TeachingRelation[],
): TeachingProjection | null {
  if (!provenance) return null;
  return projectTeaching(arbitration, provenance, {
    explanationCatalog,
    posteriorSummary: posteriorSummary ?? undefined,
    teachingRelations,
  });
}
