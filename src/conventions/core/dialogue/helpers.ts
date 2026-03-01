// Shared helpers for dialogue transition rules.

import type { Seat } from "../../../engine/types";
import { Seat as SeatEnum } from "../../../engine/types";

/** Check if two seats are on the same partnership (N/S or E/W). */
export function areSamePartnership(a: Seat, b: Seat): boolean {
  const nsSeats: Seat[] = [SeatEnum.North, SeatEnum.South];
  return nsSeats.includes(a) === nsSeats.includes(b);
}
