// Shared helpers for dialogue transition rules.

import type { Seat } from "../../../engine/types";
import { Seat as SeatEnum } from "../../../engine/types";
import type { DialogueState } from "./dialogue-state";
import { CaptainRole, ObligationKind } from "./dialogue-state";

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

// ─── Local role derivation ──────────────────────────────────

export type LocalRole = "captain" | "obligated-bidder" | "frame-owner" | "waiting" | "participant";

/** Derive all active local semantic roles from DialogueState + seat.
 *  Returns a non-empty array of roles (at least ["participant"]).
 *  Purely computed — no new state, just readable labels for what
 *  the seat is doing in the current dialogue position. */
export function getLocalRoles(state: DialogueState, seat: Seat): readonly LocalRole[] {
  const roles: LocalRole[] = [];

  // Captain check
  if (
    (state.captain === CaptainRole.Opener && isOpenerSeat(state, seat)) ||
    (state.captain === CaptainRole.Responder && partnerOfOpener(state, seat))
  ) {
    roles.push("captain");
  }

  // Frame owner (multi-step convention, e.g. Lebensohl relay)
  const topFrame = state.frames?.[state.frames.length - 1];
  if (topFrame) {
    const isOwner =
      (topFrame.owner === "opener" && isOpenerSeat(state, seat)) ||
      (topFrame.owner === "responder" && partnerOfOpener(state, seat));
    if (isOwner) roles.push("frame-owner");
  }

  // Obligation check
  if (state.obligation.kind !== ObligationKind.None) {
    const { obligatedSide } = state.obligation;
    const isObligated =
      (obligatedSide === "opener" && isOpenerSeat(state, seat)) ||
      (obligatedSide === "responder" && partnerOfOpener(state, seat));
    roles.push(isObligated ? "obligated-bidder" : "waiting");
  }

  return roles.length > 0 ? roles : ["participant"];
}
