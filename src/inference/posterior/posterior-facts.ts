import type { Hand } from "../../engine/types";
import type { PosteriorFactRequest, PosteriorFactValue } from "./posterior-types";
import { Suit } from "../../engine/types";
import { calculateHcp, calculateHcpAndShape, isBalanced, suitLengthOf } from "../../engine/hand-evaluator";

/** Map suit character to Suit enum. */
const SUIT_CHAR_MAP: Record<string, Suit> = {
  S: Suit.Spades,
  H: Suit.Hearts,
  D: Suit.Diamonds,
  C: Suit.Clubs,
};

export type PosteriorFactHandler = (
  request: PosteriorFactRequest,
  samples: ReadonlyMap<string, Hand>[],
  ownHand: Hand,
  totalRequested: number,
) => PosteriorFactValue;

// ── Sampling helpers ────────────────────────────────────────

/** Zero-result when samples are empty. */
function emptyResult(request: PosteriorFactRequest): PosteriorFactValue {
  return { factId: request.factId, seatId: request.seatId, expectedValue: 0, confidence: 0 };
}

/**
 * Higher-order factory: given a predicate over (sampleHands, request, ownHand),
 * returns a PosteriorFactHandler that counts matching samples.
 */
function countingSampler(
  predicate: (
    sampleHands: ReadonlyMap<string, Hand>,
    request: PosteriorFactRequest,
    ownHand: Hand,
  ) => boolean,
  extras?: (request: PosteriorFactRequest) => Partial<PosteriorFactValue>,
): PosteriorFactHandler {
  return (request, samples, ownHand, totalRequested) => {
    if (samples.length === 0) return emptyResult(request);

    let count = 0;
    for (const sampleHands of samples) {
      if (predicate(sampleHands, request, ownHand)) count++;
    }

    return {
      factId: request.factId,
      seatId: request.seatId,
      expectedValue: count / samples.length,
      confidence: samples.length / totalRequested,
      ...extras?.(request),
    };
  };
}

// ── Fact handlers ───────────────────────────────────────────

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
    return emptyResult(request);
  }
  const suit = SUIT_CHAR_MAP[suitChar];

  if (samples.length === 0) return emptyResult(request);

  let count = 0;
  for (const sampleHands of samples) {
    const hand = sampleHands.get(request.seatId);
    if (hand && suitLengthOf(hand, suit) >= 4) {
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
 * module.stayman:nsHaveEightCardFitLikely
 * P(combined 8+ in hearts or spades) over samples.
 */
const nsHaveEightCardFitLikely: PosteriorFactHandler = countingSampler(
  (sampleHands, request, ownHand) => {
    const partnerHand = sampleHands.get(request.seatId);
    if (!partnerHand) return false;
    const ownHearts = suitLengthOf(ownHand, Suit.Hearts);
    const ownSpades = suitLengthOf(ownHand, Suit.Spades);
    const partnerHearts = suitLengthOf(partnerHand, Suit.Hearts);
    const partnerSpades = suitLengthOf(partnerHand, Suit.Spades);
    return ownHearts + partnerHearts >= 8 || ownSpades + partnerSpades >= 8;
  },
);

/**
 * bridge:combinedHcpInRangeLikely
 * P(combined HCP in range specified via conditionedOn [min, max]) over samples.
 */
const combinedHcpInRangeLikely: PosteriorFactHandler = countingSampler(
  (sampleHands, request, ownHand) => {
    const minHcp = Number(request.conditionedOn?.[0] ?? 0);
    const maxHcp = Number(request.conditionedOn?.[1] ?? 40);
    const ownHcp = calculateHcp(ownHand);
    const partnerHand = sampleHands.get(request.seatId);
    if (!partnerHand) return false;
    const combined = ownHcp + calculateHcp(partnerHand);
    return combined >= minHcp && combined <= maxHcp;
  },
  (request) => ({ conditionedOn: request.conditionedOn }),
);

/**
 * module.stayman:openerStillBalancedLikely
 * P(opener has balanced shape) over samples.
 */
const openerStillBalancedLikely: PosteriorFactHandler = countingSampler(
  (sampleHands, request) => {
    const hand = sampleHands.get(request.seatId);
    if (!hand) return false;
    const { shape } = calculateHcpAndShape(hand);
    return isBalanced(shape);
  },
);

/**
 * module.stayman:openerHasSecondMajorLikely
 * P(opener has a second 4-card major) over samples.
 * "Second major" means 4+ in both hearts AND spades.
 */
const openerHasSecondMajorLikely: PosteriorFactHandler = countingSampler(
  (sampleHands, request) => {
    const hand = sampleHands.get(request.seatId);
    if (!hand) return false;
    return suitLengthOf(hand, Suit.Hearts) >= 4 && suitLengthOf(hand, Suit.Spades) >= 4;
  },
);

/** Registry of posterior fact handlers. */
export const POSTERIOR_FACT_HANDLERS: ReadonlyMap<string, PosteriorFactHandler> = new Map([
  ["bridge.partnerHas4HeartsLikely", partnerHas4InSuitLikely],
  ["bridge.partnerHas4SpadesLikely", partnerHas4InSuitLikely],
  ["bridge.partnerHas4DiamondsLikely", partnerHas4InSuitLikely],
  ["bridge.partnerHas4ClubsLikely", partnerHas4InSuitLikely],
  ["module.stayman.nsHaveEightCardFitLikely", nsHaveEightCardFitLikely],
  ["bridge.combinedHcpInRangeLikely", combinedHcpInRangeLikely],
  ["module.stayman.openerStillBalancedLikely", openerStillBalancedLikely],
  ["module.stayman.openerHasSecondMajorLikely", openerHasSecondMajorLikely],
]);
