import { describe, it, expect } from "vitest";
import { cleanSeatConstraint, cleanConstraints } from "../constraint-utils";
import { Seat, Suit } from "../types";
import type { SeatConstraint, DealConstraints, Hand } from "../types";

describe("cleanSeatConstraint", () => {
  it("strips customCheck from seat constraints", () => {
    const sc: SeatConstraint = {
      seat: Seat.South,
      minHcp: 12,
      customCheck: (_hand: Hand) => true,
    };
    const cleaned = cleanSeatConstraint(sc);
    expect(cleaned).toEqual({ seat: Seat.South, minHcp: 12 });
    expect("customCheck" in cleaned).toBe(false);
  });

  it("preserves all other fields", () => {
    const sc: SeatConstraint = {
      seat: Seat.North,
      minHcp: 10,
      maxHcp: 15,
      balanced: true,
      minLength: { [Suit.Spades]: 4 },
      maxLength: { [Suit.Hearts]: 3 },
      minLengthAny: { [Suit.Diamonds]: 5, [Suit.Clubs]: 5 },
    };
    const cleaned = cleanSeatConstraint(sc);
    expect(cleaned).toEqual(sc);
  });
});

describe("cleanConstraints", () => {
  it("strips rng function from top-level constraints", () => {
    const constraints: DealConstraints = {
      seats: [],
      rng: () => 0.5,
      seed: 42,
    };
    const cleaned = cleanConstraints(constraints);
    expect(cleaned).toEqual({ seats: [], seed: 42 });
    expect("rng" in cleaned).toBe(false);
  });

  it("strips customCheck from each seat constraint", () => {
    const constraints: DealConstraints = {
      seats: [
        { seat: Seat.South, minHcp: 12, customCheck: () => true },
        { seat: Seat.North, maxHcp: 10 },
      ],
    };
    const cleaned = cleanConstraints(constraints);
    expect(cleaned).toEqual({
      seats: [
        { seat: Seat.South, minHcp: 12 },
        { seat: Seat.North, maxHcp: 10 },
      ],
    });
  });

  it("handles empty seats array", () => {
    const constraints: DealConstraints = { seats: [] };
    const cleaned = cleanConstraints(constraints);
    expect(cleaned).toEqual({ seats: [] });
  });
});
