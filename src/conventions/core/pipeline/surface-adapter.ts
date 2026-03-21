import type { BidMeaning } from "../../../core/contracts/meaning";
import type {
  DecisionSurface,
  FactConstraint,
} from "../../../core/contracts/agreement-module";
import { bandToPriorityClass } from "./priority-mapping";

/**
 * Adapt a BidMeaning to a DecisionSurface.
 *
 * This enables the pipeline to consume both types via a dual-path adapter.
 * Fields present on BidMeaning are mapped directly; fields only on
 * DecisionSurface (encoderScope, localRegisters, decisionProgram) get
 * appropriate defaults.
 */
export function adaptMeaningSurface(surface: BidMeaning): DecisionSurface {
  // Convert BidMeaningClause[] to FactConstraint[] for inline evaluation
  const inlineClauses: FactConstraint[] = surface.clauses.map((c) => ({
    factId: c.factId,
    operator: c.operator,
    value: c.value,
  }));

  return {
    surfaceId: surface.meaningId,
    moduleId: surface.moduleId ?? "unknown",
    decisionProgram: "clause-evaluator",
    encoderKind: "direct",
    surfaceBindings: surface.surfaceBindings,
    localRegisters: undefined,
    transforms: undefined,
    modulePrecedence: surface.ranking.modulePrecedence ?? 0,
    exclusivityGroup: undefined,
    defaultSemanticClassId: surface.semanticClassId,
    defaultPriorityClass: bandToPriorityClass(surface.ranking.recommendationBand),
    inlineClauses: inlineClauses.length > 0 ? inlineClauses : undefined,
    teachingLabel: surface.teachingLabel,
    defaultCall: surface.encoding.defaultCall,
    sourceIntent: surface.sourceIntent,
    intraModuleOrder: surface.ranking.intraModuleOrder,
    specificity: undefined,
  };
}

/**
 * Batch adapter: maps an array of MeaningSurfaces to DecisionSurface[].
 */
export function adaptMeaningSurfaces(
  surfaces: readonly BidMeaning[],
): DecisionSurface[] {
  return surfaces.map(adaptMeaningSurface);
}
