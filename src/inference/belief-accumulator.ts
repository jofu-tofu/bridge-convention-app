import type { Seat } from "../engine/types";
import { Seat as SeatEnum } from "../engine/types";
import type { InferredHoldings } from "../contracts";
import type { BidAnnotation, PublicBeliefState } from "./types";
import { mergeInferences } from "./merge";

const ALL_SEATS: Seat[] = [SeatEnum.North, SeatEnum.East, SeatEnum.South, SeatEnum.West];

function createLooseHoldings(seat: Seat): InferredHoldings {
  return mergeInferences(seat, []);
}

/** Create a maximally loose public belief state — no information known about any seat. */
export function createInitialBeliefState(): PublicBeliefState {
  const beliefs = {} as Record<Seat, InferredHoldings>;
  for (const seat of ALL_SEATS) {
    beliefs[seat] = createLooseHoldings(seat);
  }
  return { beliefs, annotations: [] };
}

/**
 * Apply a bid annotation to the public belief state.
 * Merges the annotation's inferences into the annotated seat's beliefs.
 * Returns a new state (immutable).
 */
export function applyAnnotation(
  state: PublicBeliefState,
  annotation: BidAnnotation,
): PublicBeliefState {
  const seat = annotation.seat;
  const existing = state.beliefs[seat];

  // Merge all existing inferences + new inferences
  const allInferences = [...existing.inferences, ...annotation.inferences];
  const updated = mergeInferences(seat, allInferences);

  return {
    beliefs: { ...state.beliefs, [seat]: updated },
    annotations: [...state.annotations, annotation],
  };
}
