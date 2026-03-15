import { describe, it, expect } from "vitest";
import { mergeInferences } from "../merge";
import { Seat, Suit } from "../../engine/types";
import type { HandInference } from "../../core/contracts";

function makeInference(
  overrides: Partial<HandInference> = {},
): HandInference {
  return {
    seat: Seat.South,
    suits: {},
    source: "test",
    ...overrides,
  };
}

describe("mergeInferences", () => {
  it("returns wide-open defaults for empty inferences array", () => {
    const result = mergeInferences(Seat.South, []);
    expect(result.seat).toBe(Seat.South);
    expect(result.hcpRange).toEqual({ min: 0, max: 40 });
    expect(result.suitLengths[Suit.Spades]).toEqual({ min: 0, max: 13 });
    expect(result.suitLengths[Suit.Hearts]).toEqual({ min: 0, max: 13 });
    expect(result.suitLengths[Suit.Diamonds]).toEqual({ min: 0, max: 13 });
    expect(result.suitLengths[Suit.Clubs]).toEqual({ min: 0, max: 13 });
    expect(result.isBalanced).toBeUndefined();
  });

  it("applies a single inference directly", () => {
    const inf = makeInference({
      minHcp: 12,
      maxHcp: 14,
      isBalanced: true,
      suits: {
        [Suit.Spades]: { minLength: 2, maxLength: 5 },
      },
    });
    const result = mergeInferences(Seat.South, [inf]);
    expect(result.hcpRange).toEqual({ min: 12, max: 14 });
    expect(result.isBalanced).toBe(true);
    expect(result.suitLengths[Suit.Spades]).toEqual({ min: 2, max: 5 });
    // Unspecified suits remain wide-open
    expect(result.suitLengths[Suit.Hearts]).toEqual({ min: 0, max: 13 });
  });

  it("intersects ranges across multiple inferences (max of mins, min of maxes)", () => {
    const inf1 = makeInference({ minHcp: 10, maxHcp: 20 });
    const inf2 = makeInference({ minHcp: 12, maxHcp: 16 });
    const result = mergeInferences(Seat.South, [inf1, inf2]);
    expect(result.hcpRange).toEqual({ min: 12, max: 16 });
  });

  it("clamps HCP to last inference values on contradiction (min > max)", () => {
    // First says 15-20, second says 0-10 → intersection gives min=15, max=10 → contradiction
    const inf1 = makeInference({ minHcp: 15, maxHcp: 20 });
    const inf2 = makeInference({ minHcp: 0, maxHcp: 10 });
    const result = mergeInferences(Seat.South, [inf1, inf2]);
    // On contradiction, last inference values used: minHcp=0, maxHcp=10
    expect(result.hcpRange.min).toBe(inf2.minHcp);
    expect(result.hcpRange.max).toBe(inf2.maxHcp);
  });

  it("clamps suit length min to max on contradiction", () => {
    const inf1 = makeInference({
      suits: { [Suit.Hearts]: { minLength: 5 } },
    });
    const inf2 = makeInference({
      suits: { [Suit.Hearts]: { maxLength: 3 } },
    });
    const result = mergeInferences(Seat.South, [inf1, inf2]);
    // min=5 > max=3 → clamped: min=3
    expect(result.suitLengths[Suit.Hearts]).toEqual({ min: 3, max: 3 });
  });

  it("uses overwrite semantics for isBalanced (latest wins)", () => {
    const inf1 = makeInference({ isBalanced: true });
    const inf2 = makeInference({ isBalanced: false });
    const result = mergeInferences(Seat.South, [inf1, inf2]);
    expect(result.isBalanced).toBe(false);
  });

  it("only narrows fields that are defined in partial inferences", () => {
    const inf1 = makeInference({ minHcp: 10 }); // no maxHcp
    const inf2 = makeInference({ maxHcp: 30 }); // no minHcp
    const result = mergeInferences(Seat.South, [inf1, inf2]);
    expect(result.hcpRange).toEqual({ min: 10, max: 30 });
  });

  it("passes seat through to the result", () => {
    const result = mergeInferences(Seat.North, []);
    expect(result.seat).toBe(Seat.North);
  });
});
