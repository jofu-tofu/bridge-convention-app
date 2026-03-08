import type { RuleCondition, BiddingContext, ConventionExplanations } from "../conventions/core";

const INFERENCE_TYPE_DEFAULTS: Record<string, string> = {
  "hcp-min": "Checks minimum high-card points",
  "hcp-max": "Checks maximum high-card points",
  "hcp-range": "Checks high-card point range",
  "suit-min": "Checks minimum suit length",
  "suit-max": "Checks maximum suit length",
  "balanced": "Checks for balanced hand shape",
  "not-balanced": "Checks for unbalanced hand shape",
  "two-suited": "Checks for two-suited hand shape",
};

const SUIT_TO_SHAPE_INDEX: Record<string, number> = {
  spades: 0,
  hearts: 1,
  diamonds: 2,
  clubs: 3,
};

/**
 * Get the priority-resolved explanation source for a condition.
 * Priority: convention override > teachingNote > inference > null.
 */
function resolveExplanationSource(
  condition: RuleCondition,
  conventionExplanations?: ConventionExplanations,
): { source: "convention"; text: string } | { source: "teachingNote"; text: string } | { source: "inference" } | null {
  const conventionOverride =
    conventionExplanations?.conditions?.[condition.name];
  if (conventionOverride) return { source: "convention", text: conventionOverride };

  if (condition.teachingNote) return { source: "teachingNote", text: condition.teachingNote };

  if (condition.inference) return { source: "inference" };

  return null;
}

/**
 * Get a static explanation for a condition.
 * Priority: convention override > teachingNote > inference-type default > null.
 */
export function getConditionExplanation(
  condition: RuleCondition,
  conventionExplanations?: ConventionExplanations,
): string | null {
  const resolved = resolveExplanationSource(condition, conventionExplanations);
  if (!resolved) return null;
  if (resolved.source !== "inference") return resolved.text;
  return INFERENCE_TYPE_DEFAULTS[condition.inference!.type] ?? null;
}

/**
 * Get a parameterized explanation for a condition, interpolating threshold values.
 * Priority: convention override > teachingNote > parameterized inference explanation > null.
 */
export function getConditionExplanationWithParams(
  condition: RuleCondition,
  conventionExplanations?: ConventionExplanations,
): string | null {
  const resolved = resolveExplanationSource(condition, conventionExplanations);
  if (!resolved) return null;
  if (resolved.source !== "inference") return resolved.text;

  const { type, params } = condition.inference!;

  switch (type) {
    case "hcp-min":
      return `Requires at least ${params.min} HCP`;
    case "hcp-max":
      return `Requires at most ${params.max} HCP`;
    case "hcp-range":
      return `Requires ${params.min}-${params.max} HCP`;
    case "suit-min":
      return `Requires ${params.min}+ ${params.suit}`;
    case "suit-max":
      return `Requires at most ${params.max} ${params.suit}`;
    case "balanced":
      return "Requires a balanced hand shape";
    case "not-balanced":
      return "Requires an unbalanced hand shape";
    case "two-suited":
      return "Requires a two-suited hand";
    default: {
      return null;
    }
  }
}

/**
 * Get a failure explanation showing distance from the threshold.
 * Returns null if the condition passes or the inference type doesn't support distance.
 */
export function getFailureExplanation(
  condition: RuleCondition,
  context: BiddingContext,
): string | null {
  if (!condition.inference) return null;

  const { type, params } = condition.inference;

  switch (type) {
    case "hcp-min": {
      const shortfall = (params.min as number) - context.evaluation.hcp;
      if (shortfall <= 0) return null;
      return `${shortfall} HCP short of the ${params.min} needed`;
    }
    case "hcp-max": {
      const excess = context.evaluation.hcp - (params.max as number);
      if (excess <= 0) return null;
      return `${excess} HCP over the maximum of ${params.max}`;
    }
    case "suit-min": {
      const suitIndex = SUIT_TO_SHAPE_INDEX[params.suit as string];
      if (suitIndex === undefined) return null;
      const have = context.evaluation.shape[suitIndex]!;
      const shortfall = (params.min as number) - have;
      if (shortfall <= 0) return null;
      return `${shortfall} cards short of ${params.min} needed in ${params.suit}`;
    }
    default:
      return null;
  }
}
