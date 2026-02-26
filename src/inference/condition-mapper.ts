import type { RuleCondition, ConditionInference } from "../conventions/core/types";
import type { HandInference } from "./types";
import type { Suit, Seat } from "../engine/types";
import { Suit as SuitEnum } from "../engine/types";

const SUIT_INDEX_TO_SUIT: Record<number, Suit> = {
  0: SuitEnum.Spades,
  1: SuitEnum.Hearts,
  2: SuitEnum.Diamonds,
  3: SuitEnum.Clubs,
};

/**
 * Extract inference data from a RuleCondition.
 * Returns null for conditions without a structured `.inference` field.
 * New conditions should always include `.inference` for inference engine support.
 */
export function extractInference(
  condition: RuleCondition,
): ConditionInference | null {
  return condition.inference ?? null;
}

/** Convert a ConditionInference into a partial HandInference. */
export function conditionToHandInference(
  ci: ConditionInference,
  seat: Seat,
  source: string,
): HandInference | null {
  switch (ci.type) {
    case "hcp-min":
      return {
        seat,
        minHcp: ci.params.min as number,
        suits: {},
        source,
      };
    case "hcp-max":
      return {
        seat,
        maxHcp: ci.params.max as number,
        suits: {},
        source,
      };
    case "hcp-range":
      return {
        seat,
        minHcp: ci.params.min as number,
        maxHcp: ci.params.max as number,
        suits: {},
        source,
      };
    case "suit-min": {
      const suit = SUIT_INDEX_TO_SUIT[ci.params.suitIndex as number];
      if (!suit) return null;
      return {
        seat,
        suits: { [suit]: { minLength: ci.params.min as number } },
        source,
      };
    }
    case "suit-max": {
      const suit = SUIT_INDEX_TO_SUIT[ci.params.suitIndex as number];
      if (!suit) return null;
      return {
        seat,
        suits: { [suit]: { maxLength: ci.params.max as number } },
        source,
      };
    }
    case "balanced":
      return { seat, isBalanced: true, suits: {}, source };
    case "not-balanced":
      return { seat, isBalanced: false, suits: {}, source };
    case "ace-count":
      return { seat, suits: {}, source }; // Ace count doesn't map to HCP/suit inference
    case "king-count":
      return { seat, suits: {}, source }; // King count doesn't map to HCP/suit inference
    case "two-suited":
      return { seat, suits: {}, source }; // Two-suited noted but no specific suit known
  }
}

/**
 * Invert a ConditionInference from a rejected tree decision.
 * Returns a single inverse, an array (disjunction for ranges), or null.
 *
 * For hcp-range: returns [hcp-max, hcp-min] representing "NOT in [min,max]"
 * which means "<min OR >max". Callers should use resolveDisjunction() to
 * pick the non-contradicting branch against cumulative inferences.
 * If both contradict, skip entirely (no false inference).
 */
export function invertInference(
  ci: ConditionInference,
): ConditionInference | ConditionInference[] | null {
  switch (ci.type) {
    case "hcp-min": {
      const max = (ci.params.min as number) - 1;
      return max < 0 ? null : { type: "hcp-max", params: { max } };
    }
    case "hcp-max": {
      const min = (ci.params.max as number) + 1;
      return min > 40 ? null : { type: "hcp-min", params: { min } };
    }
    case "hcp-range": {
      // NOT in [min, max] → below min OR above max
      const belowMax = (ci.params.min as number) - 1;
      const aboveMin = (ci.params.max as number) + 1;
      const branches: ConditionInference[] = [];
      if (belowMax >= 0) branches.push({ type: "hcp-max", params: { max: belowMax } });
      if (aboveMin <= 40) branches.push({ type: "hcp-min", params: { min: aboveMin } });
      return branches.length === 0 ? null : branches.length === 1 ? branches[0]! : branches;
    }
    case "suit-min": {
      const max = (ci.params.min as number) - 1;
      return max < 0 ? null : {
        type: "suit-max",
        params: { max, suitIndex: ci.params.suitIndex as number },
      };
    }
    case "suit-max": {
      const min = (ci.params.max as number) + 1;
      return min > 13 ? null : {
        type: "suit-min",
        params: { min, suitIndex: ci.params.suitIndex as number },
      };
    }
    case "balanced":
      return { type: "not-balanced", params: {} };
    case "not-balanced":
      return { type: "balanced", params: {} };
    case "ace-count":
    case "king-count":
    case "two-suited":
      return null; // No useful inverse
  }
}

/**
 * Resolve a disjunction (OR) of ConditionInference options against cumulative state.
 * Returns the first option that doesn't contradict cumulative, or null if all contradict.
 */
export function resolveDisjunction(
  options: ConditionInference[],
  cumulative: HandInference | null,
): ConditionInference | null {
  if (!cumulative) {
    return options[0] ?? null;
  }

  for (const option of options) {
    if (!contradicts(option, cumulative)) {
      return option;
    }
  }

  return null;
}

/** Check if a ConditionInference contradicts cumulative HandInference. */
function contradicts(ci: ConditionInference, cumulative: HandInference): boolean {
  switch (ci.type) {
    case "hcp-max":
      return cumulative.minHcp !== undefined && (ci.params.max as number) < cumulative.minHcp;
    case "hcp-min":
      return cumulative.maxHcp !== undefined && (ci.params.min as number) > cumulative.maxHcp;
    case "hcp-range":
      // Range contradicts if entirely outside cumulative bounds
      return (
        (cumulative.minHcp !== undefined && (ci.params.max as number) < cumulative.minHcp) ||
        (cumulative.maxHcp !== undefined && (ci.params.min as number) > cumulative.maxHcp)
      );
    case "suit-max": {
      const suit = SUIT_INDEX_TO_SUIT[ci.params.suitIndex as number];
      if (!suit) return false;
      const si = cumulative.suits[suit];
      return si?.minLength !== undefined && (ci.params.max as number) < si.minLength;
    }
    case "suit-min": {
      const suit = SUIT_INDEX_TO_SUIT[ci.params.suitIndex as number];
      if (!suit) return false;
      const si = cumulative.suits[suit];
      return si?.maxLength !== undefined && (ci.params.min as number) > si.maxLength;
    }
    case "balanced":
      return cumulative.isBalanced === false;
    case "not-balanced":
      return cumulative.isBalanced === true;
    case "ace-count":
    case "king-count":
    case "two-suited":
      return false; // No contradiction check available
  }
}
