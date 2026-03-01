// Private belief state — narrows partner's public holdings using own hand.

import type { Hand, HandEvaluation, Seat, Suit } from "../engine/types";
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
 * HCP: Pass through partner's public HCP range unchanged (v0).
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

  const partnerSuitLengths = {} as Record<Suit, { readonly min: number; readonly max: number }>;
  for (let i = 0; i < SUIT_ORDER.length; i++) {
    const suit = SUIT_ORDER[i]!;
    const ownLength = evaluation.shape[i]!;
    const pub = partnerBeliefs.suitLengths[suit];
    partnerSuitLengths[suit] = {
      min: Math.max(pub.min, 0),
      max: Math.min(pub.max, 13 - ownLength),
    };
  }

  return {
    seat,
    partnerSeat: partner,
    partnerHcpRange: { ...partnerBeliefs.hcpRange },
    partnerSuitLengths,
  };
}
