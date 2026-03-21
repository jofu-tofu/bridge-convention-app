import { describe, it, expect } from "vitest";
import { Seat, Suit } from "../../engine/types";
import type { FactConstraint } from "../../core/contracts/agreement-module";
import type { BidAnnotation } from "../types";
import {
  createInitialBeliefState,
  applyAnnotation,
} from "../belief-accumulator";

function makeAnnotation(
  seat: Seat,
  constraints: readonly FactConstraint[],
): BidAnnotation {
  return {
    call: { type: "pass" },
    seat,
    conventionId: null,
    meaning: "Test",
    constraints,
  };
}

function hcpConstraints(min?: number, max?: number): FactConstraint[] {
  const result: FactConstraint[] = [];
  if (min !== undefined) result.push({ factId: "hand.hcp", operator: "gte", value: min });
  if (max !== undefined) result.push({ factId: "hand.hcp", operator: "lte", value: max });
  return result;
}

function suitConstraint(suit: string, min?: number, max?: number): FactConstraint[] {
  const result: FactConstraint[] = [];
  if (min !== undefined) result.push({ factId: `hand.suitLength.${suit}`, operator: "gte", value: min });
  if (max !== undefined) result.push({ factId: `hand.suitLength.${suit}`, operator: "lte", value: max });
  return result;
}

describe("createInitialBeliefState", () => {
  it("all 4 seats: hcp [0, 40], suit lengths [0, 13], isBalanced undefined", () => {
    const state = createInitialBeliefState();

    for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
      const beliefs = state.beliefs[seat];
      expect(beliefs.seat).toBe(seat);
      expect(beliefs.ranges.hcp).toEqual({ min: 0, max: 40 });
      expect(beliefs.ranges.isBalanced).toBeUndefined();
      expect(beliefs.constraints).toEqual([]);
      expect(beliefs.qualitative).toEqual([]);

      for (const suit of [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs]) {
        expect(beliefs.ranges.suitLengths[suit]).toEqual({ min: 0, max: 13 });
      }
    }
  });

  it("annotations array is empty", () => {
    const state = createInitialBeliefState();
    expect(state.annotations).toEqual([]);
  });
});

describe("applyAnnotation", () => {
  it("narrows HCP from positive constraint", () => {
    const state = createInitialBeliefState();
    const annotation = makeAnnotation(Seat.South, hcpConstraints(15, 17));

    const result = applyAnnotation(state, annotation);

    expect(result.beliefs[Seat.South].ranges.hcp).toEqual({ min: 15, max: 17 });
  });

  it("narrows suit length", () => {
    const state = createInitialBeliefState();
    const annotation = makeAnnotation(Seat.South, suitConstraint("spades", 5));

    const result = applyAnnotation(state, annotation);

    expect(result.beliefs[Seat.South].ranges.suitLengths[Suit.Spades].min).toBe(5);
  });

  it("multiple annotations monotonically constrain", () => {
    let state = createInitialBeliefState();

    state = applyAnnotation(state, makeAnnotation(Seat.South, hcpConstraints(12)));
    state = applyAnnotation(state, makeAnnotation(Seat.South, hcpConstraints(15)));

    // min should be 15 (tighter), not 12
    expect(state.beliefs[Seat.South].ranges.hcp.min).toBe(15);
  });

  it("empty constraints: annotation recorded, beliefs unchanged", () => {
    const state = createInitialBeliefState();
    const annotation = makeAnnotation(Seat.South, []);

    const result = applyAnnotation(state, annotation);

    expect(result.annotations).toHaveLength(1);
    expect(result.beliefs[Seat.South].ranges.hcp).toEqual({ min: 0, max: 40 });
  });

  it("only affects annotated seat (other 3 seats unchanged)", () => {
    const state = createInitialBeliefState();
    const annotation = makeAnnotation(Seat.South, hcpConstraints(15, 17));

    const result = applyAnnotation(state, annotation);

    expect(result.beliefs[Seat.North].ranges.hcp).toEqual({ min: 0, max: 40 });
    expect(result.beliefs[Seat.East].ranges.hcp).toEqual({ min: 0, max: 40 });
    expect(result.beliefs[Seat.West].ranges.hcp).toEqual({ min: 0, max: 40 });
  });

  it("contradiction clamping: inconsistent constraints clamp", () => {
    let state = createInitialBeliefState();

    // First: min 15
    state = applyAnnotation(state, makeAnnotation(Seat.South, hcpConstraints(15)));
    // Then: max 10 — contradicts min 15. deriveRanges clamps.
    state = applyAnnotation(state, makeAnnotation(Seat.South, hcpConstraints(undefined, 10)));

    // Should not crash. The exact clamping behavior is defined by deriveRanges.
    const hcp = state.beliefs[Seat.South].ranges.hcp;
    expect(hcp.min).toBeDefined();
    expect(hcp.max).toBeDefined();
  });

  it("constraints are accumulated losslessly", () => {
    let state = createInitialBeliefState();
    state = applyAnnotation(state, makeAnnotation(Seat.South, hcpConstraints(12)));
    state = applyAnnotation(state, makeAnnotation(Seat.South, suitConstraint("hearts", 5)));

    expect(state.beliefs[Seat.South].constraints).toEqual([
      { factId: "hand.hcp", operator: "gte", value: 12 },
      { factId: "hand.suitLength.hearts", operator: "gte", value: 5 },
    ]);
  });

  it("balanced constraint derives qualitative and min suit lengths", () => {
    let state = createInitialBeliefState();
    state = applyAnnotation(state, makeAnnotation(Seat.South, [
      { factId: "hand.isBalanced", operator: "boolean", value: true },
    ]));

    expect(state.beliefs[Seat.South].ranges.isBalanced).toBe(true);
    for (const suit of [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs]) {
      expect(state.beliefs[Seat.South].ranges.suitLengths[suit].min).toBe(2);
    }
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
      state = applyAnnotation(state, makeAnnotation(seat, hcpConstraints(min, max)));

      const beliefs = state.beliefs[seat];
      expect(beliefs.ranges.hcp.min).toBeGreaterThanOrEqual(prevMin);
      expect(beliefs.ranges.hcp.max).toBeLessThanOrEqual(prevMax);

      prevMin = beliefs.ranges.hcp.min;
      prevMax = beliefs.ranges.hcp.max;
    }
  });
});
