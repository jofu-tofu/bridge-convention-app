import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import { getSuitLength } from "../../../engine/hand-evaluator";
import type { BiddingContext } from "../../core/types";

/** Find advancer's longest suit with 6+ cards and return a 2-level bid. */
export function advanceLongSuitCall(ctx: BiddingContext): Call {
  const shape = getSuitLength(ctx.hand);
  const strains = [BidSuit.Spades, BidSuit.Hearts, BidSuit.Diamonds, BidSuit.Clubs];
  let bestIdx = -1;
  let bestLen = 0;
  for (let i = 0; i < 4; i++) {
    if (shape[i]! >= 6 && shape[i]! > bestLen) {
      bestLen = shape[i]!;
      bestIdx = i;
    }
  }
  if (bestIdx === -1) return { type: "pass" };
  return { type: "bid", level: 2, strain: strains[bestIdx]! };
}

/** Find advancer's longest suit with 6+ cards and return a 3-level bid.
 *  Only considers suits in the provided index list (to exclude partner's shown suits). */
export function advance3LevelLongSuitCall(
  allowedSuitIndices: number[],
): (ctx: BiddingContext) => Call {
  return (ctx: BiddingContext): Call => {
    const shape = getSuitLength(ctx.hand);
    const strains = [BidSuit.Spades, BidSuit.Hearts, BidSuit.Diamonds, BidSuit.Clubs];
    let bestIdx = -1;
    let bestLen = 0;
    for (const i of allowedSuitIndices) {
      if (shape[i]! >= 6 && shape[i]! > bestLen) {
        bestLen = shape[i]!;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) return { type: "pass" };
    return { type: "bid", level: 3, strain: strains[bestIdx]! };
  };
}

/** Overcaller reveals their single long suit after partner's 2C relay. */
export function revealSuitCall(ctx: BiddingContext): Call {
  const shape = getSuitLength(ctx.hand);
  const strains = [BidSuit.Spades, BidSuit.Hearts, BidSuit.Diamonds, BidSuit.Clubs];
  let bestIdx = -1;
  let bestLen = 0;
  for (let i = 0; i < 4; i++) {
    if (shape[i]! >= 6 && shape[i]! > bestLen) {
      bestLen = shape[i]!;
      bestIdx = i;
    }
  }
  // Clubs = pass (stay in 2C), other suits = bid at 2-level
  if (bestIdx === -1 || bestIdx === 3) return { type: "pass" };
  return { type: "bid", level: 2, strain: strains[bestIdx]! };
}

// ─── 2NT Inquiry rebid helpers ──────────────────────────────

/**
 * After 2C (clubs + higher) and 2NT inquiry, overcaller rebids:
 * 3C = minimum, equal/shorter second suit
 * 3D = maximum, second suit is diamonds
 * 3H = maximum, second suit is hearts
 * 3S = maximum, second suit is spades
 */
export function rebidAfter2C2NT(ctx: BiddingContext): Call {
  const shape = getSuitLength(ctx.hand);
  const hcp = ctx.evaluation.hcp;
  const isMax = hcp >= 11;

  // Second suit = the higher-ranking non-club suit with 4+
  // Priority: spades > hearts > diamonds (highest first)
  const secondSuitIdx = [0, 1, 2].find((i) => shape[i]! >= 4);

  if (isMax && secondSuitIdx !== undefined) {
    const strains = [BidSuit.Spades, BidSuit.Hearts, BidSuit.Diamonds];
    return { type: "bid", level: 3, strain: strains[secondSuitIdx]! };
  }
  // Minimum or can't determine second suit → 3C
  return { type: "bid", level: 3, strain: BidSuit.Clubs };
}

/**
 * After 2D (diamonds + major) and 2NT inquiry, overcaller rebids:
 * 3C = minimum, equal/shorter major
 * 3D = minimum, longer major (diamonds is the anchor, so longer major means major > diamonds)
 * 3H = maximum, second suit is hearts
 * 3S = maximum, second suit is spades
 */
export function rebidAfter2D2NT(ctx: BiddingContext): Call {
  const shape = getSuitLength(ctx.hand);
  const hcp = ctx.evaluation.hcp;
  const isMax = hcp >= 11;

  // Which major is the second suit?
  const heartsLen = shape[1]!;
  const spadesLen = shape[0]!;
  const diamondsLen = shape[2]!;

  if (isMax) {
    // Show the major at 3-level
    if (heartsLen >= 4) return { type: "bid", level: 3, strain: BidSuit.Hearts };
    if (spadesLen >= 4) return { type: "bid", level: 3, strain: BidSuit.Spades };
  }

  // Minimum: 3C if major is equal/shorter than diamonds, 3D if longer
  const majorLen = Math.max(heartsLen, spadesLen);
  if (majorLen > diamondsLen) {
    return { type: "bid", level: 3, strain: BidSuit.Diamonds };
  }
  return { type: "bid", level: 3, strain: BidSuit.Clubs };
}

/**
 * After 2H (both majors) and 2NT inquiry, overcaller rebids:
 * 3C = minimum, equal/shorter spades (hearts >= spades)
 * 3D = minimum, longer spades (spades > hearts)
 * 3H = maximum, equal/shorter spades (hearts >= spades)
 * 3S = maximum, longer spades (spades > hearts)
 */
export function rebidAfter2H2NT(ctx: BiddingContext): Call {
  const shape = getSuitLength(ctx.hand);
  const hcp = ctx.evaluation.hcp;
  const isMax = hcp >= 11;
  const spadesLonger = shape[0]! > shape[1]!;

  if (isMax) {
    return spadesLonger
      ? { type: "bid", level: 3, strain: BidSuit.Spades }
      : { type: "bid", level: 3, strain: BidSuit.Hearts };
  }
  return spadesLonger
    ? { type: "bid", level: 3, strain: BidSuit.Diamonds }
    : { type: "bid", level: 3, strain: BidSuit.Clubs };
}
