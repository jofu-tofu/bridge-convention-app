import type { MeaningSurface } from "../../../core/contracts/meaning-surface";
import type {
  DecisionSurfaceIR,
  PriorityClass,
  FactConstraintIR,
} from "../../../core/contracts/agreement-module";
import type { RecommendationBand } from "../../../core/contracts/meaning";

/**
 * Map RecommendationBand to PriorityClass.
 *
 * RecommendationBand is the authored semantic priority on MeaningSurface (via RankingMetadata).
 * PriorityClass is the richer IR equivalent on DecisionSurfaceIR.
 */
function bandToPriorityClass(band: RecommendationBand): PriorityClass {
  switch (band) {
    case "must":
      return "obligatory";
    case "should":
      return "preferredConventional";
    case "may":
      return "neutralCorrect";
    case "avoid":
      return "fallbackCorrect";
  }
}

/**
 * Adapt a MeaningSurface to a DecisionSurfaceIR.
 *
 * This enables the pipeline to consume both types via a dual-path adapter.
 * Fields present on MeaningSurface are mapped directly; fields only on
 * DecisionSurfaceIR (encoderScope, localRegisters, decisionProgram) get
 * appropriate defaults.
 */
export function adaptMeaningSurface(surface: MeaningSurface): DecisionSurfaceIR {
  // Convert MeaningSurfaceClause[] to FactConstraintIR[] for inline evaluation
  const inlineClauses: FactConstraintIR[] = surface.clauses.map((c) => ({
    factId: c.factId,
    operator: c.operator,
    value: c.value,
  }));

  return {
    surfaceId: surface.meaningId,
    moduleId: surface.moduleId,
    decisionProgram: "clause-evaluator",
    encoderKind: "direct",
    surfaceBindings: surface.surfaceBindings,
    localRegisters: undefined,
    transforms: undefined,
    modulePrecedence: surface.ranking.modulePrecedence,
    exclusivityGroup: undefined,
    defaultSemanticClassId: surface.semanticClassId,
    defaultPriorityClass: bandToPriorityClass(surface.ranking.recommendationBand),
    inlineClauses: inlineClauses.length > 0 ? inlineClauses : undefined,
    teachingLabel: surface.teachingLabel,
    defaultCall: surface.encoding.defaultCall,
    sourceIntent: surface.sourceIntent,
    intraModuleOrder: surface.ranking.intraModuleOrder,
    specificity: surface.ranking.specificity,
  };
}

/**
 * Batch adapter: maps an array of MeaningSurfaces to DecisionSurfaceIR[].
 */
export function adaptMeaningSurfaces(
  surfaces: readonly MeaningSurface[],
): DecisionSurfaceIR[] {
  return surfaces.map(adaptMeaningSurface);
}
