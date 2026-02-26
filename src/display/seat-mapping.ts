import { Seat } from "../engine/types";

/**
 * Maps a logical seat to its visual screen position.
 *
 * When rotated=false: identity (South at bottom).
 * When rotated=true: 180° rotation (North at bottom, South at top, E↔W swap).
 *
 * This is a pure remapping — NOT a CSS transform. CSS rotation would flip
 * text and card pips upside-down. This function is self-inverse:
 * viewSeat(viewSeat(seat, true), true) === seat.
 *
 * Design decision: chosen over CSS rotate(180deg) which flips ALL content
 * upside-down, and over per-component conditional rendering which duplicates
 * rotation logic. Single pure function imported by BridgeTable and TrickArea.
 */
export function viewSeat(logicalSeat: Seat, rotated: boolean): Seat {
  if (!rotated) return logicalSeat;
  const swap: Record<Seat, Seat> = {
    [Seat.North]: Seat.South,
    [Seat.South]: Seat.North,
    [Seat.East]: Seat.West,
    [Seat.West]: Seat.East,
  };
  return swap[logicalSeat];
}
