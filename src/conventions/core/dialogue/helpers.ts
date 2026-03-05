// Shared helpers for dialogue transition rules.

import type { Seat } from "../../../engine/types";
import { Seat as SeatEnum } from "../../../engine/types";
import type { DialogueState } from "./dialogue-state";

/** Check if two seats are on the same partnership (N/S or E/W). */
export function areSamePartnership(a: Seat, b: Seat): boolean {
  const nsSeats: Seat[] = [SeatEnum.North, SeatEnum.South];
  return nsSeats.includes(a) === nsSeats.includes(b);
}

/** Returns true if `seat` is partner of the opener stored in dialogue state.
 *  Returns false (with dev warning) if openerSeat is missing. */
export function partnerOfOpener(state: DialogueState, seat: Seat): boolean {
  const opener = state.conventionData["openerSeat"] as Seat | undefined;
  if (opener === undefined) {
    if (import.meta.env?.DEV) {
      // eslint-disable-next-line no-console -- dev-only warning for missing openerSeat
      console.warn("partnerOfOpener: openerSeat missing from conventionData");
    }
    return false;
  }
  return areSamePartnership(seat, opener);
}

/** Returns true if `seat` IS the opener stored in dialogue state.
 *  Returns false (with dev warning) if openerSeat is missing. */
export function isOpenerSeat(state: DialogueState, seat: Seat): boolean {
  const opener = state.conventionData["openerSeat"] as Seat | undefined;
  if (opener === undefined) {
    if (import.meta.env?.DEV) {
      // eslint-disable-next-line no-console -- dev-only warning for missing openerSeat
      console.warn("isOpenerSeat: openerSeat missing from conventionData");
    }
    return false;
  }
  return seat === opener;
}
