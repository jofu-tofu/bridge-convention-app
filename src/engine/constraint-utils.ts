import type { SeatConstraint, DealConstraints } from "./types";

/** Strip non-serializable fields from seat constraints. */
export function cleanSeatConstraint(
  sc: SeatConstraint,
): Omit<SeatConstraint, "customCheck"> {
  const { customCheck: _, ...rest } = sc;
  return rest;
}

export type CleanDealConstraints = Omit<DealConstraints, "rng"> & {
  readonly seats: readonly Omit<SeatConstraint, "customCheck">[];
};

/** Strip non-serializable fields (rng, customCheck) from constraints before
 *  serialization to WASM or IPC. Preserves `seed` for Rust-side deterministic generation. */
export function cleanConstraints(constraints: DealConstraints): CleanDealConstraints {
  const { rng: _, ...rest } = constraints;
  return {
    ...rest,
    seats: rest.seats.map(cleanSeatConstraint),
  };
}
