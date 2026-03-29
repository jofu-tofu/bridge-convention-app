/**
 * Pure functions for computing prompt-related values.
 *
 * No Svelte runes, no reactive state -- these take plain arguments and return
 * plain values. Extracted from game.svelte.ts to keep the coordinator lean.
 */

import type { Seat, Contract } from "../service";
import { partnerSeat, PromptMode } from "../service";

/** Determine the current prompt mode from game state. */
export function computePromptMode(
  phase: string,
  contract: Contract | null,
  userSeat: Seat | null,
): PromptMode | null {
  if (phase !== "DECLARER_PROMPT" || !contract || !userSeat) return null;
  if (contract.declarer !== userSeat && partnerSeat(contract.declarer) !== userSeat) return PromptMode.Defender;
  if (contract.declarer === userSeat) return PromptMode.SouthDeclarer;
  return PromptMode.DeclarerSwap;
}

/** Compute which seats should be shown face-up. */
export function computeFaceUpSeats(
  effectiveUserSeat: Seat | null,
  userSeat: Seat | null,
  phase: string,
  contract: Contract | null,
): ReadonlySet<Seat> {
  const seat = effectiveUserSeat ?? userSeat;
  if (!seat) return new Set();

  const seats = new Set<Seat>([seat]);

  if (phase === "DECLARER_PROMPT" && contract) {
    const mode = computePromptMode(phase, contract, userSeat);
    if (mode === PromptMode.SouthDeclarer) {
      seats.add(partnerSeat(contract.declarer));
    } else if (mode === PromptMode.DeclarerSwap) {
      seats.add(contract.declarer);
    }
  }

  if (phase === "PLAYING" && contract) {
    // Dummy is always visible to all players in bridge
    seats.add(partnerSeat(contract.declarer));
  }

  return seats;
}
