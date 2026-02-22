import type { RuleCondition, ConditionInference } from "../../conventions/types";
import type { HandInference, SuitInference } from "./types";
import type { Suit, Seat } from "../../engine/types";
import { Suit as SuitEnum } from "../../engine/types";

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
    case "ace-count":
      return { seat, suits: {}, source }; // Ace count doesn't map to HCP/suit inference
    case "two-suited":
      return { seat, suits: {}, source }; // Two-suited noted but no specific suit known
    default:
      return null;
  }
}
