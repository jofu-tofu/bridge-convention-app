// Belief converter — converts PublicBeliefState to BeliefData structural type.
// Optional PrivateBeliefState narrows partner's suit lengths.

import { Seat, Suit } from "../engine/types";
import type { PublicBeliefState } from "./types";
import type { PrivateBeliefState } from "./private-belief";
import type { BeliefData } from "./inference-types";

/**
 * Convert PublicBeliefState to BeliefData structural type for convention pipeline.
 * Optional PrivateBeliefState narrows partner's suit lengths.
 */
export function toBeliefData(
  publicBelief: PublicBeliefState,
  privateOverride?: PrivateBeliefState,
): BeliefData {
  type SeatBelief = {
    readonly hcpRange: { readonly min: number; readonly max: number };
    readonly suitLengths: Record<Suit, { readonly min: number; readonly max: number }>;
  };

  function buildSeatBelief(seat: Seat): SeatBelief {
    const pub = publicBelief.beliefs[seat];

    if (privateOverride && seat === privateOverride.partnerSeat) {
      // Use narrowed partner HCP and suit lengths from private belief
      return {
        hcpRange: {
          min: privateOverride.partnerHcpRange.min,
          max: privateOverride.partnerHcpRange.max,
        },
        suitLengths: { ...privateOverride.partnerSuitLengths },
      };
    }

    const suitLengths: Record<Suit, { readonly min: number; readonly max: number }> = {
      [Suit.Spades]: { min: pub.ranges.suitLengths[Suit.Spades].min, max: pub.ranges.suitLengths[Suit.Spades].max },
      [Suit.Hearts]: { min: pub.ranges.suitLengths[Suit.Hearts].min, max: pub.ranges.suitLengths[Suit.Hearts].max },
      [Suit.Diamonds]: { min: pub.ranges.suitLengths[Suit.Diamonds].min, max: pub.ranges.suitLengths[Suit.Diamonds].max },
      [Suit.Clubs]: { min: pub.ranges.suitLengths[Suit.Clubs].min, max: pub.ranges.suitLengths[Suit.Clubs].max },
    };
    return {
      hcpRange: { min: pub.ranges.hcp.min, max: pub.ranges.hcp.max },
      suitLengths,
    };
  }

  const beliefs: Record<Seat, SeatBelief> = {
    [Seat.North]: buildSeatBelief(Seat.North),
    [Seat.East]: buildSeatBelief(Seat.East),
    [Seat.South]: buildSeatBelief(Seat.South),
    [Seat.West]: buildSeatBelief(Seat.West),
  };

  return { beliefs };
}
