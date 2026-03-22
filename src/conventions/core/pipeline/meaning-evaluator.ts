import type {
  BidMeaning,
  BidMeaningClause,
} from "../../../core/contracts/meaning";
import type {
  MeaningProposal,
  MeaningClause,
  EvaluationEvidence,
  RankingMetadata,
  RecommendationBand,
} from "../../../core/contracts/meaning";
import type {
  EvaluatedFacts,
  FactValue,
  FactCatalogExtension,
} from "../../../core/contracts/fact-catalog";
import { getFactValue } from "../../../core/contracts/fact-catalog";
import type { DecisionSurface, PriorityClass } from "../../../core/contracts/agreement-module";
import { resolveAlert, derivePublicConstraints } from "../../../core/contracts/alert";
import { resolveFactId, resolveClause } from "./binding-resolver";
import { priorityClassToBand } from "./priority-mapping";
import type { ConstraintDimension } from "../../../core/contracts/meaning";
import { deriveSpecificity } from "./specificity-deriver";
import { fillClauseDefaults } from "./clause-derivation";

function evaluateClause(
  clause: BidMeaningClause,
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
      description: clause.description ?? clause.factId,
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
    description: clause.description ?? clause.factId,
    observedValue: factValue,
  };
}

export function evaluateBidMeaning(
  surface: BidMeaning,
  facts: EvaluatedFacts,
  factExtensions?: readonly FactCatalogExtension[],
  inheritedDimensions?: readonly ConstraintDimension[],
): MeaningProposal {
  const bindings = surface.surfaceBindings;
  // Fill in missing clauseId/description before evaluation (safety net for hand-authored surfaces)
  const filledClauses = surface.clauses.map(fillClauseDefaults);
  const evaluatedClauses: MeaningClause[] = filledClauses.map((clause) =>
    evaluateClause(clause, facts, bindings),
  );

  const factDependencies: string[] = [
    ...new Set(
      filledClauses.map((c) => resolveFactId(c.factId, bindings)),
    ),
  ];

  const evidence: EvaluationEvidence = {
    factDependencies,
    evaluatedConditions: evaluatedClauses.map((clause, i) => {
      const sourceClause = filledClauses[i];
      return {
        conditionId: sourceClause?.clauseId ?? clause.factId,
        satisfied: clause.satisfied,
        description: clause.description ?? clause.factId,
        conditionRole: "semantic" as const,
      };
    }),
    provenance: {
      moduleId: surface.moduleId ?? "unknown",
      nodeName: surface.meaningId,
      origin: "meaning-pipeline" as const,
    },
  };

  // recommendationBand is authored directly on ranking — no priority resolution needed
  const resolvedBand = surface.ranking.recommendationBand;

  // Derive specificity from clause dimensions (source of truth)
  const derivation = factExtensions
    ? deriveSpecificity(surface, factExtensions, inheritedDimensions)
    : undefined;

  const resolvedRanking: RankingMetadata = {
    recommendationBand: resolvedBand,
    specificity: derivation?.advisorySpecificity ?? 0,
    modulePrecedence: surface.ranking.modulePrecedence ?? 0,
    declarationOrder: surface.ranking.declarationOrder,
    ...(derivation ? { specificityBasis: derivation.basis } : {}),
  };

  // Resolve alertability from sourceIntent.type (derived, not hand-authored)
  const resolved = resolveAlert(surface);

  // Auto-derive public constraints from primitive/bridge-observable clauses
  // Resolve $-bindings before deriving constraints so factIds are concrete
  const resolvedClauses = bindings
    ? surface.clauses.map(c => resolveClause(c, bindings))
    : surface.clauses;
  const publicConstraints = derivePublicConstraints(resolvedClauses);

  return {
    meaningId: surface.meaningId,
    semanticClassId: surface.semanticClassId,
    moduleId: surface.moduleId ?? "unknown",
    clauses: evaluatedClauses,
    ranking: resolvedRanking,
    evidence,
    sourceIntent: surface.sourceIntent,
    teachingLabel: surface.teachingLabel,
    ...(resolved ? { isAlertable: true } : {}),
    ...(publicConstraints.length > 0 ? { publicConstraints } : {}),
  };
}

/** Input type for evaluateAllBidMeanings: either BidMeaning[] or DecisionSurface[]. */
type EvaluableSurface = BidMeaning | DecisionSurface;

/**
 * Type guard: distinguishes BidMeaning from DecisionSurface.
 * BidMeaning has `meaningId`; DecisionSurface has `surfaceId` + `decisionProgram`.
 */
function isMeaningSurface(
  surface: EvaluableSurface,
): surface is BidMeaning {
  return "meaningId" in surface && !("decisionProgram" in surface);
}

/**
 * Evaluate a DecisionSurface against facts.
 *
 * When the surface has `inlineClauses` and `decisionProgram === "clause-evaluator"`,
 * evaluates them against facts using the same clause evaluation logic as BidMeaning.
 * For other decision programs or when no inlineClauses are present, produces
 * empty clauses (all-pass) as a fallback.
 */
function evaluateDecisionSurface(
  surface: DecisionSurface,
  facts: EvaluatedFacts,
): MeaningProposal {
  const ranking: RankingMetadata = {
    recommendationBand: priorityClassToBand(surface.defaultPriorityClass),
    specificity: surface.specificity ?? 1,
    modulePrecedence: surface.modulePrecedence,
    declarationOrder: surface.declarationOrder ?? 0,
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
      // Convert FactConstraint to BidMeaningClause for reuse of evaluateClause
      const asSurfaceClause: BidMeaningClause = {
        clauseId: ic.factId,
        factId: ic.factId,
        operator: ic.operator,
        value: ic.value,
        description: ic.factId,
      };
      return evaluateClause(asSurfaceClause, facts, bindings);
    });
  }

  const evidence: EvaluationEvidence = {
    factDependencies: clauses.map((c) => c.factId),
    evaluatedConditions: clauses.map((c) => ({
      conditionId: c.factId,
      satisfied: c.satisfied,
      description: c.description,
    })),
    provenance: {
      moduleId: surface.moduleId,
      nodeName: surface.surfaceId,
      origin: "meaning-pipeline" as const,
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
 * Evaluate all surfaces against facts. Accepts both BidMeaning[] and
 * DecisionSurface[] (dual-path). Detects which type is passed by inspecting
 * the first element: if all elements are the same type, uses the appropriate
 * evaluation path.
 */
export function evaluateAllBidMeanings(
  surfaces: readonly BidMeaning[] | readonly DecisionSurface[],
  facts: EvaluatedFacts,
  profileMapping?: Readonly<Record<PriorityClass, RecommendationBand>>,
  factExtensions?: readonly FactCatalogExtension[],
  inheritedDimsLookup?: ReadonlyMap<string, readonly ConstraintDimension[]>,
): readonly MeaningProposal[] {
  if (surfaces.length === 0) return [];

  const first = surfaces[0]!;
  if (isMeaningSurface(first)) {
    // BidMeaning path: recommendationBand comes from authored ranking directly
    return (surfaces as readonly BidMeaning[]).map((surface) =>
      evaluateBidMeaning(
        surface, facts, factExtensions,
        inheritedDimsLookup?.get(surface.meaningId),
      ),
    );
  }

  // DecisionSurface path
  return (surfaces as readonly DecisionSurface[]).map((surface) =>
    evaluateDecisionSurface(surface, facts),
  );
}
