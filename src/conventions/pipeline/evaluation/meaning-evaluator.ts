import type {
  BidMeaning,
  BidMeaningClause,
} from "./meaning";
import type {
  MeaningProposal,
  MeaningClause,
  EvaluationEvidence,
  RankingMetadata,
} from "./meaning";
import type {
  EvaluatedFacts,
  FactValue,
  FactCatalogExtension,
} from "../../core/fact-catalog";
import { getFactValue } from "../../core/fact-catalog";
import { resolveAlert } from "./alert";
import { resolveFactId } from "./binding-resolver";
import type { ConstraintDimension } from "./meaning";
import { deriveSpecificity } from "./specificity-deriver";
import { fillClauseDefaults, deriveClauseDescription } from "./clause-derivation";

function evaluateClause(
  clause: BidMeaningClause,
  facts: EvaluatedFacts,
  bindings?: Readonly<Record<string, string>>,
): MeaningClause {
  const resolvedFactId = resolveFactId(clause.factId, bindings);
  const factEntry: FactValue | undefined = getFactValue(facts, resolvedFactId);

  if (!factEntry) {
    // Fail-closed: missing fact → not satisfied, observedValue undefined
    const derived = deriveClauseDescription(clause.factId, clause.operator, clause.value);
    const desc = clause.rationale ? `${derived} (${clause.rationale})` : derived;
    return {
      factId: resolvedFactId,
      operator: clause.operator === "in" ? "eq" : clause.operator,
      value: clause.operator === "in" ? false : (clause.value as MeaningClause["value"]),
      satisfied: false,
      description: desc,
      ...(clause.isPublic ? { isPublic: true } : {}),
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

  const derived = deriveClauseDescription(clause.factId, clause.operator, clause.value);
  const desc = clause.rationale ? `${derived} (${clause.rationale})` : derived;

  return {
    factId: resolvedFactId,
    operator: outputOperator,
    value: outputValue,
    satisfied,
    description: desc,
    ...(clause.isPublic ? { isPublic: true } : {}),
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
        description: clause.description,
        conditionRole: "semantic" as const,
      };
    }),
    provenance: {
      moduleId: surface.moduleId ?? "unknown",
      nodeName: surface.teachingLabel.name,
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

  // Resolve alertability from disclosure field (derived, not hand-authored)
  const resolved = resolveAlert(surface);

  return {
    meaningId: surface.meaningId,
    semanticClassId: surface.semanticClassId,
    moduleId: surface.moduleId ?? "unknown",
    clauses: evaluatedClauses,
    ranking: resolvedRanking,
    evidence,
    sourceIntent: surface.sourceIntent,
    teachingLabel: surface.teachingLabel,
    ...(resolved ? { isAlertable: true, annotationType: resolved.annotationType } : {}),
  };
}

/**
 * Evaluate all BidMeaning surfaces against facts.
 */
export function evaluateAllBidMeanings(
  surfaces: readonly BidMeaning[],
  facts: EvaluatedFacts,
  _profileMapping?: undefined,
  factExtensions?: readonly FactCatalogExtension[],
  inheritedDimsLookup?: ReadonlyMap<string, readonly ConstraintDimension[]>,
): readonly MeaningProposal[] {
  if (surfaces.length === 0) return [];

  return surfaces.map((surface) =>
    evaluateBidMeaning(
      surface, facts, factExtensions,
      inheritedDimsLookup?.get(surface.meaningId),
    ),
  );
}
