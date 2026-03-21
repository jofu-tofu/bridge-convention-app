import type { Deal } from "../../../engine/types";
import { Suit } from "../../../engine/types";
import { calculateHcp } from "../../../engine/hand-evaluator";
import type { DealConstraint } from "../../../core/contracts/predicates";

const SUIT_MAP: Record<string, Suit> = {
  S: Suit.Spades,
  H: Suit.Hearts,
  D: Suit.Diamonds,
  C: Suit.Clubs,
};

/**
 * Count cards of a given suit in a hand.
 */
function suitLength(deal: Deal, seat: string, suit: Suit): number {
  const hand = deal.hands[seat as keyof typeof deal.hands];
  return hand.cards.filter((c) => c.suit === suit).length;
}

/**
 * Evaluate a fit-check constraint: combined suit length across seats meets minLength.
 *
 * Required params: suit (string key), seats (string[]), minLength (number).
 */
function evaluateFitCheck(params: Readonly<Record<string, unknown>>, deal: Deal): boolean {
  const suitKey = params.suit as string;
  const seats = params.seats as string[];
  const minLength = params.minLength as number;
  const suit = SUIT_MAP[suitKey];
  if (!suit) {
    throw new Error(`Unknown suit key in fit-check constraint: ${suitKey}`);
  }

  const totalLength = seats.reduce((sum, seat) => sum + suitLength(deal, seat, suit), 0);
  return totalLength >= minLength;
}

/**
 * Evaluate a combined-hcp constraint: sum of HCP across seats falls within [min, max].
 *
 * Required params: seats (string[]), min (number), max (number).
 */
function evaluateCombinedHcp(params: Readonly<Record<string, unknown>>, deal: Deal): boolean {
  const seats = params.seats as string[];
  const min = params.min as number;
  const max = params.max as number;

  const totalHcp = seats.reduce(
    (sum, seat) => sum + calculateHcp(deal.hands[seat as keyof typeof deal.hands]),
    0,
  );
  return totalHcp >= min && totalHcp <= max;
}

/**
 * Evaluate a DealConstraint against a concrete deal.
 *
 * Handles three constraint kinds:
 * - "fit-check": combined suit length across seats meets threshold
 * - "combined-hcp": sum of HCP across seats within range
 * - "custom": stub — logs a warning and returns true
 */
export function evaluateDealConstraint(constraint: DealConstraint, deal: Deal): boolean {
  switch (constraint.kind) {
    case "fit-check":
      return evaluateFitCheck(constraint.params, deal);
    case "combined-hcp":
      return evaluateCombinedHcp(constraint.params, deal);
    case "custom":
      // eslint-disable-next-line no-console -- intentional warning for unimplemented custom constraints
      console.warn(
        `evaluateDealConstraint: custom constraint stubbed to true (params: ${JSON.stringify(constraint.params)})`,
      );
      return true;
    default: {
      const exhaustive: never = constraint.kind;
      throw new Error(`Unknown DealConstraint kind: ${String(exhaustive)}`);
    }
  }
}
