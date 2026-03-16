import { describe, it, expect } from "vitest";
import { cleanConstraints } from "../constraint-utils";
import { Seat, Suit } from "../types";
import type { DealConstraints } from "../types";

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
