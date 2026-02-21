import { Suit } from "./types";
import type {
  Card,
  Hand,
  HandEvaluation,
  DistributionPoints,
  SuitLength,
  HandEvaluationStrategy,
} from "./types";
import { HCP_VALUES } from "./constants";

export function calculateHcp(hand: Hand): number {
  return hand.cards.reduce((sum, card) => sum + HCP_VALUES[card.rank], 0);
}

export function getSuitLength(hand: Hand): SuitLength {
  let spades = 0;
  let hearts = 0;
  let diamonds = 0;
  let clubs = 0;
  for (const card of hand.cards) {
    switch (card.suit) {
      case Suit.Spades:
        spades++;
        break;
      case Suit.Hearts:
        hearts++;
        break;
      case Suit.Diamonds:
        diamonds++;
        break;
      case Suit.Clubs:
        clubs++;
        break;
    }
  }
  return [spades, hearts, diamonds, clubs] as const;
}

export function isBalanced(shape: SuitLength): boolean {
  // Sorting network for 4 elements — zero allocation, 5 conditional swaps
  let a = shape[0]!,
    b = shape[1]!,
    c = shape[2]!,
    d = shape[3]!;
  if (a < b) {
    const t = a;
    a = b;
    b = t;
  }
  if (c < d) {
    const t = c;
    c = d;
    d = t;
  }
  if (a < c) {
    const t = a;
    a = c;
    c = t;
  }
  if (b < d) {
    const t = b;
    b = d;
    d = t;
  }
  if (b < c) {
    const t = b;
    b = c;
    c = t;
  }
  // a >= b >= c >= d, a+b+c+d = 13
  // 4-3-3-3, 4-4-3-2, 5-3-3-2
  if (a === 4 && b === 3 && c === 3 && d === 3) return true;
  if (a === 4 && b === 4 && c === 3 && d === 2) return true;
  if (a === 5 && b === 3 && c === 3 && d === 2) return true;
  return false;
}

/** Single-pass HCP + suit length calculation — avoids double iteration over hand.cards */
export function calculateHcpAndShape(
  hand: Hand,
): { hcp: number; shape: SuitLength } {
  let hcp = 0;
  let spades = 0;
  let hearts = 0;
  let diamonds = 0;
  let clubs = 0;
  for (const card of hand.cards) {
    hcp += HCP_VALUES[card.rank];
    switch (card.suit) {
      case Suit.Spades:
        spades++;
        break;
      case Suit.Hearts:
        hearts++;
        break;
      case Suit.Diamonds:
        diamonds++;
        break;
      case Suit.Clubs:
        clubs++;
        break;
    }
  }
  return { hcp, shape: [spades, hearts, diamonds, clubs] as const };
}

export function calculateDistributionPoints(
  shape: SuitLength,
): DistributionPoints {
  let shortness = 0;
  let length = 0;
  for (const count of shape) {
    if (count === 0) shortness += 3;
    else if (count === 1) shortness += 2;
    else if (count === 2) shortness += 1;
    if (count > 4) length += count - 4;
  }
  return { shortness, length, total: shortness + length };
}

export function getCardsInSuit(hand: Hand, suit: Suit): Card[] {
  return hand.cards.filter((c) => c.suit === suit);
}

export const hcpStrategy: HandEvaluationStrategy = {
  name: "HCP",
  evaluate(hand: Hand): HandEvaluation {
    const hcp = calculateHcp(hand);
    const shape = getSuitLength(hand);
    const distribution = calculateDistributionPoints(shape);
    return {
      hcp,
      distribution,
      shape,
      totalPoints: hcp + distribution.total,
      strategy: "HCP",
    };
  },
};

export function evaluateHand(
  hand: Hand,
  strategy: HandEvaluationStrategy = hcpStrategy,
): HandEvaluation {
  return strategy.evaluate(hand);
}
