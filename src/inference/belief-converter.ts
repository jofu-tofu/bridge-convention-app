// Belief converter — converts PublicBeliefState to BeliefData structural type.
// Optional PrivateBeliefState narrows partner's suit lengths.

import type { Seat, Suit } from "../engine/types";
import { SEATS, SUIT_ORDER } from "../engine/constants";
import type { PublicBeliefState } from "./types";
import type { PrivateBeliefState } from "./private-belief";
import type { BeliefData } from "../core/contracts";

/**
 * Convert PublicBeliefState to BeliefData structural type for convention pipeline.
 * Optional PrivateBeliefState narrows partner's suit lengths.
 */
export function toBeliefData(
  publicBelief: PublicBeliefState,
  privateOverride?: PrivateBeliefState,
): BeliefData {
  const beliefs = {} as Record<Seat, {
    readonly hcpRange: { readonly min: number; readonly max: number };
    readonly suitLengths: Record<Suit, { readonly min: number; readonly max: number }>;
  }>;

  for (const seat of SEATS) {
    const pub = publicBelief.beliefs[seat];

    if (privateOverride && seat === privateOverride.partnerSeat) {
      // Use narrowed partner HCP and suit lengths from private belief
      beliefs[seat] = {
        hcpRange: {
          min: privateOverride.partnerHcpRange.min,
          max: privateOverride.partnerHcpRange.max,
        },
        suitLengths: { ...privateOverride.partnerSuitLengths },
      };
    } else {
      const suitLengths = {} as Record<Suit, { readonly min: number; readonly max: number }>;
      for (const s of SUIT_ORDER) {
        suitLengths[s] = {
          min: pub.suitLengths[s].min,
          max: pub.suitLengths[s].max,
        };
      }
      beliefs[seat] = {
        hcpRange: { min: pub.hcpRange.min, max: pub.hcpRange.max },
        suitLengths,
      };
    }
  }

  return { beliefs };
}
