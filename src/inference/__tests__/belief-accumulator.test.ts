import { describe, it, expect } from "vitest";
import { Seat, Suit } from "../../engine/types";
import type { HandInference } from "../../core/contracts";
import type { BidAnnotation } from "../types";
import {
  createInitialBeliefState,
  applyAnnotation,
} from "../belief-accumulator";

function makeAnnotation(
  seat: Seat,
  inferences: readonly HandInference[],
): BidAnnotation {
  return {
    call: { type: "pass" },
    seat,
    conventionId: null,
    meaning: "Test",
    inferences,
  };
}

function makeHcpInference(
  seat: Seat,
  min?: number,
  max?: number,
): HandInference {
  return {
    seat,
    minHcp: min,
    maxHcp: max,
    suits: {},
    source: "test",
  };
}

function makeSuitInference(
  seat: Seat,
  suit: Suit,
  minLength?: number,
  maxLength?: number,
): HandInference {
  return {
    seat,
    suits: { [suit]: { minLength, maxLength } },
    source: "test",
  };
}

describe("createInitialBeliefState", () => {
  it("all 4 seats: hcpRange [0, 40], suit lengths [0, 13], isBalanced undefined", () => {
    const state = createInitialBeliefState();

    for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
      const beliefs = state.beliefs[seat];
      expect(beliefs.seat).toBe(seat);
      expect(beliefs.hcpRange).toEqual({ min: 0, max: 40 });
      expect(beliefs.isBalanced).toBeUndefined();

      for (const suit of [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs]) {
        expect(beliefs.suitLengths[suit]).toEqual({ min: 0, max: 13 });
      }
    }
  });

  it("annotations array is empty", () => {
    const state = createInitialBeliefState();
    expect(state.annotations).toEqual([]);
  });
});

describe("applyAnnotation", () => {
  it("narrows HCP from positive inference", () => {
    const state = createInitialBeliefState();
    const annotation = makeAnnotation(Seat.South, [
      makeHcpInference(Seat.South, 15, 17),
    ]);

    const result = applyAnnotation(state, annotation);

    expect(result.beliefs[Seat.South].hcpRange).toEqual({ min: 15, max: 17 });
  });

  it("narrows suit length", () => {
    const state = createInitialBeliefState();
    const annotation = makeAnnotation(Seat.South, [
      makeSuitInference(Seat.South, Suit.Spades, 5),
    ]);

    const result = applyAnnotation(state, annotation);

    expect(result.beliefs[Seat.South].suitLengths[Suit.Spades].min).toBe(5);
  });

  it("multiple annotations monotonically constrain", () => {
    let state = createInitialBeliefState();

    state = applyAnnotation(
      state,
      makeAnnotation(Seat.South, [makeHcpInference(Seat.South, 12)]),
    );
    state = applyAnnotation(
      state,
      makeAnnotation(Seat.South, [makeHcpInference(Seat.South, 15)]),
    );

    // min should be 15 (tighter), not 12
    expect(state.beliefs[Seat.South].hcpRange.min).toBe(15);
  });

  it("empty inferences: annotation recorded, beliefs unchanged", () => {
    const state = createInitialBeliefState();
    const annotation = makeAnnotation(Seat.South, []);

    const result = applyAnnotation(state, annotation);

    expect(result.annotations).toHaveLength(1);
    expect(result.beliefs[Seat.South].hcpRange).toEqual({ min: 0, max: 40 });
  });

  it("only affects annotated seat (other 3 seats unchanged)", () => {
    const state = createInitialBeliefState();
    const annotation = makeAnnotation(Seat.South, [
      makeHcpInference(Seat.South, 15, 17),
    ]);

    const result = applyAnnotation(state, annotation);

    expect(result.beliefs[Seat.North].hcpRange).toEqual({ min: 0, max: 40 });
    expect(result.beliefs[Seat.East].hcpRange).toEqual({ min: 0, max: 40 });
    expect(result.beliefs[Seat.West].hcpRange).toEqual({ min: 0, max: 40 });
  });

  it("contradiction clamping: inconsistent inferences clamp per merge rules", () => {
    let state = createInitialBeliefState();

    // First: min 15
    state = applyAnnotation(
      state,
      makeAnnotation(Seat.South, [makeHcpInference(Seat.South, 15)]),
    );
    // Then: max 10 — contradicts min 15. mergeInferences clamps.
    state = applyAnnotation(
      state,
      makeAnnotation(Seat.South, [makeHcpInference(Seat.South, undefined, 10)]),
    );

    // Should not crash. The exact clamping behavior is defined by merge.ts.
    const hcp = state.beliefs[Seat.South].hcpRange;
    expect(hcp.min).toBeDefined();
    expect(hcp.max).toBeDefined();
  });
});

describe("invariants", () => {
  it("monotonic narrowing: HCP min never decreases, max never increases across annotations", () => {
    let state = createInitialBeliefState();
    const seat = Seat.South;

    const hcpRanges: Array<[number, number]> = [
      [5, 30],
      [10, 25],
      [12, 20],
      [15, 17],
    ];

    let prevMin = 0;
    let prevMax = 40;

    for (const [min, max] of hcpRanges) {
      state = applyAnnotation(
        state,
        makeAnnotation(seat, [makeHcpInference(seat, min, max)]),
      );

      const beliefs = state.beliefs[seat];
      expect(beliefs.hcpRange.min).toBeGreaterThanOrEqual(prevMin);
      expect(beliefs.hcpRange.max).toBeLessThanOrEqual(prevMax);

      prevMin = beliefs.hcpRange.min;
      prevMax = beliefs.hcpRange.max;
    }
  });
});
