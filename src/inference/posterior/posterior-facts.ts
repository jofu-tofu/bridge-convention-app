import type { Hand } from "../../engine/types";
import type { PosteriorFactRequest, PosteriorFactValue } from "../../core/contracts/posterior";
import { Suit } from "../../engine/types";
import { calculateHcpAndShape, isBalanced } from "../../engine/hand-evaluator";
import { HCP_VALUES } from "../../engine/constants";

/** Map suit character to Suit enum. */
const SUIT_CHAR_MAP: Record<string, Suit> = {
  S: Suit.Spades,
  H: Suit.Hearts,
  D: Suit.Diamonds,
  C: Suit.Clubs,
};

/** Count cards of a specific suit in a hand. */
function suitLength(hand: Hand, suit: Suit): number {
  return hand.cards.filter((c) => c.suit === suit).length;
}

/** Calculate HCP for a hand. */
function handHcp(hand: Hand): number {
  return hand.cards.reduce((sum, c) => sum + HCP_VALUES[c.rank], 0);
}

export type PosteriorFactHandler = (
  request: PosteriorFactRequest,
  samples: ReadonlyMap<string, Hand>[],
  ownHand: Hand,
  totalRequested: number,
) => PosteriorFactValue;

/**
 * bridge:partnerHas4{Suit}Likely
 * P(partner has 4+ in suit specified by conditionedOn[0]) over samples.
 * conditionedOn[0] is required: "H" for hearts, "S" for spades, "D" for diamonds, "C" for clubs.
 */
function partnerHas4InSuitLikely(
  request: PosteriorFactRequest,
  samples: ReadonlyMap<string, Hand>[],
  _ownHand: Hand,
  totalRequested: number,
): PosteriorFactValue {
  const suitChar = request.conditionedOn?.[0];
  if (!suitChar || !SUIT_CHAR_MAP[suitChar]) {
    return { factId: request.factId, seatId: request.seatId, expectedValue: 0, confidence: 0 };
  }
  const suit = SUIT_CHAR_MAP[suitChar]!;

  if (samples.length === 0) {
    return { factId: request.factId, seatId: request.seatId, expectedValue: 0, confidence: 0 };
  }

  let count = 0;
  for (const sampleHands of samples) {
    const hand = sampleHands.get(request.seatId);
    if (hand && suitLength(hand, suit) >= 4) {
      count++;
    }
  }

  return {
    factId: request.factId,
    seatId: request.seatId,
    expectedValue: count / samples.length,
    confidence: samples.length / totalRequested,
    conditionedOn: request.conditionedOn,
  };
}

/**
 * bridge:nsHaveEightCardFitLikely
 * P(combined 8+ in hearts or spades) over samples.
 */
function nsHaveEightCardFitLikely(
  request: PosteriorFactRequest,
  samples: ReadonlyMap<string, Hand>[],
  ownHand: Hand,
  totalRequested: number,
): PosteriorFactValue {
  if (samples.length === 0) {
    return { factId: request.factId, seatId: request.seatId, expectedValue: 0, confidence: 0 };
  }

  const ownHearts = suitLength(ownHand, Suit.Hearts);
  const ownSpades = suitLength(ownHand, Suit.Spades);

  let count = 0;
  for (const sampleHands of samples) {
    const partnerHand = sampleHands.get(request.seatId);
    if (!partnerHand) continue;
    const partnerHearts = suitLength(partnerHand, Suit.Hearts);
    const partnerSpades = suitLength(partnerHand, Suit.Spades);
    if (ownHearts + partnerHearts >= 8 || ownSpades + partnerSpades >= 8) {
      count++;
    }
  }

  return {
    factId: request.factId,
    seatId: request.seatId,
    expectedValue: count / samples.length,
    confidence: samples.length / totalRequested,
  };
}

/**
 * bridge:combinedHcpInRangeLikely
 * P(combined HCP in range specified via conditionedOn [min, max]) over samples.
 */
function combinedHcpInRangeLikely(
  request: PosteriorFactRequest,
  samples: ReadonlyMap<string, Hand>[],
  ownHand: Hand,
  totalRequested: number,
): PosteriorFactValue {
  const minHcp = Number(request.conditionedOn?.[0] ?? 0);
  const maxHcp = Number(request.conditionedOn?.[1] ?? 40);
  const ownHcp = handHcp(ownHand);

  if (samples.length === 0) {
    return { factId: request.factId, seatId: request.seatId, expectedValue: 0, confidence: 0 };
  }

  let count = 0;
  for (const sampleHands of samples) {
    const partnerHand = sampleHands.get(request.seatId);
    if (!partnerHand) continue;
    const combined = ownHcp + handHcp(partnerHand);
    if (combined >= minHcp && combined <= maxHcp) {
      count++;
    }
  }

  return {
    factId: request.factId,
    seatId: request.seatId,
    expectedValue: count / samples.length,
    confidence: samples.length / totalRequested,
    conditionedOn: request.conditionedOn,
  };
}

/**
 * bridge:openerStillBalancedLikely
 * P(opener has balanced shape) over samples.
 */
function openerStillBalancedLikely(
  request: PosteriorFactRequest,
  samples: ReadonlyMap<string, Hand>[],
  _ownHand: Hand,
  totalRequested: number,
): PosteriorFactValue {
  if (samples.length === 0) {
    return { factId: request.factId, seatId: request.seatId, expectedValue: 0, confidence: 0 };
  }

  let count = 0;
  for (const sampleHands of samples) {
    const hand = sampleHands.get(request.seatId);
    if (!hand) continue;
    const { shape } = calculateHcpAndShape(hand);
    if (isBalanced(shape)) {
      count++;
    }
  }

  return {
    factId: request.factId,
    seatId: request.seatId,
    expectedValue: count / samples.length,
    confidence: samples.length / totalRequested,
  };
}

/**
 * bridge:openerHasSecondMajorLikely
 * P(opener has a second 4-card major) over samples.
 * "Second major" means 4+ in both hearts AND spades.
 */
function openerHasSecondMajorLikely(
  request: PosteriorFactRequest,
  samples: ReadonlyMap<string, Hand>[],
  _ownHand: Hand,
  totalRequested: number,
): PosteriorFactValue {
  if (samples.length === 0) {
    return { factId: request.factId, seatId: request.seatId, expectedValue: 0, confidence: 0 };
  }

  let count = 0;
  for (const sampleHands of samples) {
    const hand = sampleHands.get(request.seatId);
    if (!hand) continue;
    const hearts = suitLength(hand, Suit.Hearts);
    const spades = suitLength(hand, Suit.Spades);
    if (hearts >= 4 && spades >= 4) {
      count++;
    }
  }

  return {
    factId: request.factId,
    seatId: request.seatId,
    expectedValue: count / samples.length,
    confidence: samples.length / totalRequested,
  };
}

/** Registry of posterior fact handlers. */
export const POSTERIOR_FACT_HANDLERS: ReadonlyMap<string, PosteriorFactHandler> = new Map([
  ["bridge.partnerHas4HeartsLikely", partnerHas4InSuitLikely],
  ["bridge.partnerHas4SpadesLikely", partnerHas4InSuitLikely],
  ["bridge.partnerHas4DiamondsLikely", partnerHas4InSuitLikely],
  ["bridge.partnerHas4ClubsLikely", partnerHas4InSuitLikely],
  ["bridge.nsHaveEightCardFitLikely", nsHaveEightCardFitLikely],
  ["bridge.combinedHcpInRangeLikely", combinedHcpInRangeLikely],
  ["bridge.openerStillBalancedLikely", openerStillBalancedLikely],
  ["bridge.openerHasSecondMajorLikely", openerHasSecondMajorLikely],
]);
