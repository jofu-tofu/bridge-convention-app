// Private belief state — narrows partner's public holdings using own hand.

import type { Hand, HandEvaluation, Seat } from "../engine/types";
import { Suit } from "../engine/types";
import { SUIT_ORDER } from "../engine/constants";
import { partnerSeat } from "../engine/constants";
import type { PublicBeliefState } from "./types";

/** Private belief about partner's holdings, conditioned on own hand. */
export interface PrivateBeliefState {
  readonly seat: Seat;
  readonly partnerSeat: Seat;
  readonly partnerHcpRange: { readonly min: number; readonly max: number };
  readonly partnerSuitLengths: Record<Suit, { readonly min: number; readonly max: number }>;
}

/**
 * Narrow partner's public beliefs using own hand knowledge.
 *
 * HCP: Cap partner's max at 40 - own HCP (conservative bound — ignores opponent HCP).
 * Suit lengths: Cap partner's max at 13 - own suit length.
 */
export function conditionOnOwnHand(
  publicBelief: PublicBeliefState,
  seat: Seat,
  _hand: Hand,
  evaluation: HandEvaluation,
): PrivateBeliefState {
  const partner = partnerSeat(seat);
  const partnerBeliefs = publicBelief.beliefs[partner];

  const partnerSuitLengths: Record<Suit, { readonly min: number; readonly max: number }> = {
    [Suit.Spades]: { min: 0, max: 13 },
    [Suit.Hearts]: { min: 0, max: 13 },
    [Suit.Diamonds]: { min: 0, max: 13 },
    [Suit.Clubs]: { min: 0, max: 13 },
  };
  for (let i = 0; i < SUIT_ORDER.length; i++) {
    const suit = SUIT_ORDER[i]!;
    const ownLength = evaluation.shape[i]!;
    const pub = partnerBeliefs.ranges.suitLengths[suit];
    partnerSuitLengths[suit] = {
      min: Math.max(pub.min, 0),
      max: Math.min(pub.max, 13 - ownLength),
    };
  }

  const pubHcp = partnerBeliefs.ranges.hcp;
  return {
    seat,
    partnerSeat: partner,
    partnerHcpRange: {
      min: Math.max(pubHcp.min, 0),
      max: Math.min(pubHcp.max, 40 - evaluation.hcp),
    },
    partnerSuitLengths,
  };
}
