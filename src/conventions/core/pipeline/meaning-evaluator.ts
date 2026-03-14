import type {
  MeaningSurface,
  MeaningSurfaceClause,
} from "../../../core/contracts/meaning-surface";
import type {
  MeaningProposal,
  MeaningClause,
  EvidenceBundle,
  RankingMetadata,
  RecommendationBand,
} from "../../../core/contracts/meaning";
import type {
  EvaluatedFacts,
  FactValue,
} from "../../../core/contracts/fact-catalog";
import { getFactValue } from "../../../core/contracts/fact-catalog";
import type { DecisionSurfaceIR, PriorityClass } from "../../../core/contracts/agreement-module";

/**
 * Resolve $-prefixed binding references in factId before fact lookup.
 * Binding resolution lives in the meaning evaluator (not the fact evaluator)
 * because it transforms surface-level references into concrete fact IDs
 * before any fact catalog lookup occurs. This means no changes to
 * fact-evaluator.ts or the FactCatalog — existing primitive facts
 * (hand.suitLength.hearts, etc.) are reused directly.
 */
function resolveFactId(
  factId: string,
  bindings?: Readonly<Record<string, string>>,
): string {
  if (!bindings) return factId;
  return factId.replace(/\$(\w+)/g, (_, key: string) => {
    const value = bindings[key];
    return value !== undefined ? value : `$${key}`;
  });
}

function evaluateClause(
  clause: MeaningSurfaceClause,
  facts: EvaluatedFacts,
  bindings?: Readonly<Record<string, string>>,
): MeaningClause {
  const resolvedFactId = resolveFactId(clause.factId, bindings);
  const factEntry: FactValue | undefined = getFactValue(facts, resolvedFactId);

  if (!factEntry) {
    // Fail-closed: missing fact → not satisfied, observedValue undefined
    return {
      factId: resolvedFactId,
      operator: clause.operator === "in" ? "eq" : clause.operator,
      value: clause.operator === "in" ? false : (clause.value as MeaningClause["value"]),
      satisfied: false,
      description: clause.description,
    };
  }

  const factValue = factEntry.value;
  let satisfied = false;

  switch (clause.operator) {
    case "boolean":
      satisfied = factValue === clause.value;
      break;
    case "gte":
      satisfied =
        typeof factValue === "number" &&
        typeof clause.value === "number" &&
        factValue >= clause.value;
      break;
    case "lte":
      satisfied =
        typeof factValue === "number" &&
        typeof clause.value === "number" &&
        factValue <= clause.value;
      break;
    case "eq":
      satisfied = factValue === clause.value;
      break;
    case "range": {
      const range = clause.value as { min: number; max: number };
      satisfied =
        typeof factValue === "number" &&
        factValue >= range.min &&
        factValue <= range.max;
      break;
    }
    case "in": {
      const allowed = clause.value as readonly string[];
      satisfied =
        typeof factValue === "string" && allowed.includes(factValue);
      break;
    }
  }

  // Map "in" operator to "eq" in the output MeaningClause
  const outputOperator: MeaningClause["operator"] =
    clause.operator === "in" ? "eq" : clause.operator;

  // For "in" operator, store the matched value (or false placeholder) since
  // MeaningClause.value doesn't support string arrays
  const outputValue: MeaningClause["value"] =
    clause.operator === "in"
      ? (satisfied ? factValue : false) as MeaningClause["value"]
      : (clause.value as MeaningClause["value"]);

  return {
    factId: resolvedFactId,
    operator: outputOperator,
    value: outputValue,
    satisfied,
    description: clause.description,
    observedValue: factValue,
  };
}

export function evaluateMeaningSurface(
  surface: MeaningSurface,
  facts: EvaluatedFacts,
): MeaningProposal {
  const bindings = surface.surfaceBindings;
  const evaluatedClauses: MeaningClause[] = surface.clauses.map((clause) =>
    evaluateClause(clause, facts, bindings),
  );

  const factDependencies: string[] = [
    ...new Set(
      surface.clauses.map((c) => resolveFactId(c.factId, bindings)),
    ),
  ];

  const evidence: EvidenceBundle = {
    factDependencies,
    evaluatedConditions: evaluatedClauses.map((clause, i) => {
      const sourceClause = surface.clauses[i];
      return {
        name: sourceClause?.clauseId ?? clause.factId,
        passed: clause.satisfied,
        description: clause.description,
        conditionRole: "semantic" as const,
      };
    }),
    provenance: {
      moduleId: surface.moduleId,
      nodeName: surface.meaningId,
      origin: "tree" as const,
    },
  };

  return {
    meaningId: surface.meaningId,
    semanticClassId: surface.semanticClassId,
    moduleId: surface.moduleId,
    clauses: evaluatedClauses,
    ranking: surface.ranking,
    evidence,
    sourceIntent: surface.sourceIntent,
    teachingLabel: surface.teachingLabel,
  };
}

/** Input type for evaluateAllSurfaces: either MeaningSurface[] or DecisionSurfaceIR[]. */
type EvaluableSurface = MeaningSurface | DecisionSurfaceIR;

/**
 * Type guard: distinguishes MeaningSurface from DecisionSurfaceIR.
 * MeaningSurface has `meaningId`; DecisionSurfaceIR has `surfaceId` + `decisionProgram`.
 */
function isMeaningSurface(
  surface: EvaluableSurface,
): surface is MeaningSurface {
  return "meaningId" in surface && !("decisionProgram" in surface);
}

/**
 * Map PriorityClass back to RecommendationBand for building RankingMetadata
 * from a DecisionSurfaceIR.
 */
function priorityClassToBand(pc: PriorityClass | undefined): RecommendationBand {
  switch (pc) {
    case "obligatory":
      return "must";
    case "preferredConventional":
    case "preferredNatural":
      return "should";
    case "neutralCorrect":
      return "may";
    case "fallbackCorrect":
      return "avoid";
    default:
      return "should";
  }
}

/**
 * Evaluate a DecisionSurfaceIR against facts.
 *
 * When the surface has `inlineClauses` and `decisionProgram === "clause-evaluator"`,
 * evaluates them against facts using the same clause evaluation logic as MeaningSurface.
 * For other decision programs or when no inlineClauses are present, produces
 * empty clauses (all-pass) as a fallback.
 */
function evaluateDecisionSurface(
  surface: DecisionSurfaceIR,
  facts: EvaluatedFacts,
): MeaningProposal {
  const ranking: RankingMetadata = {
    recommendationBand: priorityClassToBand(surface.defaultPriorityClass),
    specificity: surface.specificity ?? 1,
    modulePrecedence: surface.modulePrecedence,
    intraModuleOrder: surface.intraModuleOrder ?? 0,
  };

  const bindings = surface.surfaceBindings
    ? Object.fromEntries(
        Object.entries(surface.surfaceBindings).filter(
          (e): e is [string, string] => typeof e[1] === "string",
        ),
      )
    : undefined;

  // Evaluate inline clauses when available (clause-evaluator program)
  let clauses: MeaningClause[] = [];
  if (surface.decisionProgram === "clause-evaluator" && surface.inlineClauses && surface.inlineClauses.length > 0) {
    clauses = surface.inlineClauses.map((ic) => {
      // Convert FactConstraintIR to MeaningSurfaceClause for reuse of evaluateClause
      const asSurfaceClause: MeaningSurfaceClause = {
        clauseId: ic.factId,
        factId: ic.factId,
        operator: ic.operator,
        value: ic.value,
        description: ic.factId,
      };
      return evaluateClause(asSurfaceClause, facts, bindings);
    });
  }

  const evidence: EvidenceBundle = {
    factDependencies: clauses.map((c) => c.factId),
    evaluatedConditions: clauses.map((c) => ({
      name: c.factId,
      passed: c.satisfied,
      description: c.description,
    })),
    provenance: {
      moduleId: surface.moduleId,
      nodeName: surface.surfaceId,
      origin: "tree" as const,
    },
  };

  return {
    meaningId: surface.surfaceId,
    semanticClassId: surface.defaultSemanticClassId,
    moduleId: surface.moduleId,
    clauses,
    ranking,
    evidence,
    sourceIntent: surface.sourceIntent ?? { type: "decision-surface-ir", params: {} },
    teachingLabel: surface.teachingLabel,
  };
}

/**
 * Evaluate all surfaces against facts. Accepts both MeaningSurface[] and
 * DecisionSurfaceIR[] (dual-path). Detects which type is passed by inspecting
 * the first element: if all elements are the same type, uses the appropriate
 * evaluation path.
 */
export function evaluateAllSurfaces(
  surfaces: readonly MeaningSurface[] | readonly DecisionSurfaceIR[],
  facts: EvaluatedFacts,
): readonly MeaningProposal[] {
  if (surfaces.length === 0) return [];

  const first = surfaces[0]!;
  if (isMeaningSurface(first)) {
    // MeaningSurface path: existing behavior unchanged
    return (surfaces as readonly MeaningSurface[]).map((surface) =>
      evaluateMeaningSurface(surface, facts),
    );
  }

  // DecisionSurfaceIR path
  return (surfaces as readonly DecisionSurfaceIR[]).map((surface) =>
    evaluateDecisionSurface(surface, facts),
  );
}
