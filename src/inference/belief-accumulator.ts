import type { Seat } from "../engine/types";
import { Seat as SeatEnum } from "../engine/types";
import type { PublicBeliefs } from "./inference-types";
import type { BidAnnotation, PublicBeliefState } from "./types";
import { derivePublicBeliefs } from "./derive-beliefs";

function createLooseBeliefs(seat: Seat): PublicBeliefs {
  return derivePublicBeliefs(seat, []);
}

/** Create a maximally loose public belief state — no information known about any seat. */
export function createInitialBeliefState(): PublicBeliefState {
  const beliefs: Record<Seat, PublicBeliefs> = {
    [SeatEnum.North]: createLooseBeliefs(SeatEnum.North),
    [SeatEnum.East]: createLooseBeliefs(SeatEnum.East),
    [SeatEnum.South]: createLooseBeliefs(SeatEnum.South),
    [SeatEnum.West]: createLooseBeliefs(SeatEnum.West),
  };
  return { beliefs, annotations: [] };
}

/**
 * Apply a bid annotation to the public belief state.
 * Appends the annotation's constraints to the seat's accumulated constraints
 * and re-derives ranges + qualitative labels.
 * Returns a new state (immutable).
 */
export function applyAnnotation(
  state: PublicBeliefState,
  annotation: BidAnnotation,
): PublicBeliefState {
  const seat = annotation.seat;
  const existing = state.beliefs[seat];

  // Accumulate constraints and re-derive
  const allConstraints = [...existing.constraints, ...annotation.constraints];
  const updated = derivePublicBeliefs(seat, allConstraints);

  return {
    beliefs: { ...state.beliefs, [seat]: updated },
    annotations: [...state.annotations, annotation],
  };
}
