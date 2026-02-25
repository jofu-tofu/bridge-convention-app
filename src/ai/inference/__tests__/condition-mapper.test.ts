import { describe, it, expect } from "vitest";
import { Seat, Suit } from "../../../engine/types";
import type { ConditionInference } from "../../../conventions/types";
import type { HandInference } from "../types";
import {
  conditionToHandInference,
  invertInference,
  resolveDisjunction,
} from "../condition-mapper";

// ─── conditionToHandInference ────────────────────────────────

describe("conditionToHandInference", () => {
  it("maps not-balanced to isBalanced: false", () => {
    const ci: ConditionInference = { type: "not-balanced", params: {} };
    const result = conditionToHandInference(ci, Seat.North, "test");
    expect(result).not.toBeNull();
    expect(result!.isBalanced).toBe(false);
  });

  it("maps balanced to isBalanced: true", () => {
    const ci: ConditionInference = { type: "balanced", params: {} };
    const result = conditionToHandInference(ci, Seat.North, "test");
    expect(result).not.toBeNull();
    expect(result!.isBalanced).toBe(true);
  });
});

// ─── invertInference ─────────────────────────────────────────

describe("invertInference", () => {
  it("inverts hcp-min to hcp-max with N-1", () => {
    const ci: ConditionInference = { type: "hcp-min", params: { min: 12 } };
    const result = invertInference(ci);
    expect(result).toEqual({ type: "hcp-max", params: { max: 11 } });
  });

  it("inverts hcp-max to hcp-min with N+1", () => {
    const ci: ConditionInference = { type: "hcp-max", params: { max: 15 } };
    const result = invertInference(ci);
    expect(result).toEqual({ type: "hcp-min", params: { min: 16 } });
  });

  it("inverts hcp-range to disjunction array", () => {
    const ci: ConditionInference = { type: "hcp-range", params: { min: 10, max: 12 } };
    const result = invertInference(ci);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([
      { type: "hcp-max", params: { max: 9 } },
      { type: "hcp-min", params: { min: 13 } },
    ]);
  });

  it("inverts suit-min to suit-max with N-1", () => {
    const ci: ConditionInference = { type: "suit-min", params: { min: 4, suitIndex: 1 } };
    const result = invertInference(ci);
    expect(result).toEqual({ type: "suit-max", params: { max: 3, suitIndex: 1 } });
  });

  it("inverts suit-max to suit-min with N+1", () => {
    const ci: ConditionInference = { type: "suit-max", params: { max: 3, suitIndex: 0 } };
    const result = invertInference(ci);
    expect(result).toEqual({ type: "suit-min", params: { min: 4, suitIndex: 0 } });
  });

  it("inverts balanced to not-balanced", () => {
    const ci: ConditionInference = { type: "balanced", params: {} };
    const result = invertInference(ci);
    expect(result).toEqual({ type: "not-balanced", params: {} });
  });

  it("inverts not-balanced to balanced", () => {
    const ci: ConditionInference = { type: "not-balanced", params: {} };
    const result = invertInference(ci);
    expect(result).toEqual({ type: "balanced", params: {} });
  });

  it("returns null for ace-count", () => {
    const ci: ConditionInference = { type: "ace-count", params: { count: 2 } };
    expect(invertInference(ci)).toBeNull();
  });

  it("returns null for king-count", () => {
    const ci: ConditionInference = { type: "king-count", params: { count: 1 } };
    expect(invertInference(ci)).toBeNull();
  });

  it("returns null for two-suited", () => {
    const ci: ConditionInference = { type: "two-suited", params: {} };
    expect(invertInference(ci)).toBeNull();
  });

  it("returns null when hcp-min 0 would invert to negative max", () => {
    const ci: ConditionInference = { type: "hcp-min", params: { min: 0 } };
    expect(invertInference(ci)).toBeNull();
  });

  it("returns null when hcp-max 40 would invert to min > domain max", () => {
    const ci: ConditionInference = { type: "hcp-max", params: { max: 40 } };
    expect(invertInference(ci)).toBeNull();
  });

  it("returns null when suit-min 0 would invert to negative max", () => {
    const ci: ConditionInference = { type: "suit-min", params: { min: 0, suitIndex: 1 } };
    expect(invertInference(ci)).toBeNull();
  });

  it("returns null when suit-max 13 would invert to min > domain max", () => {
    const ci: ConditionInference = { type: "suit-max", params: { max: 13, suitIndex: 0 } };
    expect(invertInference(ci)).toBeNull();
  });

  it("filters out-of-range branches from hcp-range disjunction", () => {
    // hcp-range [0, 10] → NOT in [0,10] → only "hcp-min: 11" (below-min branch is -1, dropped)
    const ci: ConditionInference = { type: "hcp-range", params: { min: 0, max: 10 } };
    const result = invertInference(ci);
    expect(result).toEqual({ type: "hcp-min", params: { min: 11 } });
  });
});

// ─── resolveDisjunction ──────────────────────────────────────

describe("resolveDisjunction", () => {
  it("returns first option when cumulative is null", () => {
    const options: ConditionInference[] = [
      { type: "hcp-max", params: { max: 9 } },
      { type: "hcp-min", params: { min: 13 } },
    ];
    const result = resolveDisjunction(options, null);
    expect(result).toEqual({ type: "hcp-max", params: { max: 9 } });
  });

  it("returns first non-contradicting option", () => {
    const options: ConditionInference[] = [
      { type: "hcp-max", params: { max: 9 } },   // contradicts minHcp: 12
      { type: "hcp-min", params: { min: 13 } },   // doesn't contradict
    ];
    const cumulative: HandInference = {
      seat: Seat.North,
      minHcp: 12,
      suits: {},
      source: "test",
    };
    const result = resolveDisjunction(options, cumulative);
    expect(result).toEqual({ type: "hcp-min", params: { min: 13 } });
  });

  it("returns null when all branches contradict cumulative", () => {
    const options: ConditionInference[] = [
      { type: "hcp-max", params: { max: 11 } },   // contradicts minHcp: 16
      { type: "hcp-min", params: { min: 25 } },   // contradicts maxHcp: 20
    ];
    const cumulative: HandInference = {
      seat: Seat.North,
      minHcp: 16,
      maxHcp: 20,
      suits: {},
      source: "test",
    };
    const result = resolveDisjunction(options, cumulative);
    expect(result).toBeNull();
  });

  it("handles suit-max contradiction with cumulative suit minLength", () => {
    const options: ConditionInference[] = [
      { type: "suit-max", params: { max: 3, suitIndex: 1 } },  // contradicts minLength: 5
    ];
    const cumulative: HandInference = {
      seat: Seat.North,
      suits: { [Suit.Hearts]: { minLength: 5 } },
      source: "test",
    };
    const result = resolveDisjunction(options, cumulative);
    expect(result).toBeNull();
  });

  it("returns empty array option as null", () => {
    const result = resolveDisjunction([], null);
    expect(result).toBeNull();
  });

  it("detects balanced/not-balanced contradiction", () => {
    const options: ConditionInference[] = [
      { type: "balanced", params: {} },
    ];
    const cumulative: HandInference = {
      seat: Seat.North,
      isBalanced: false,
      suits: {},
      source: "test",
    };
    const result = resolveDisjunction(options, cumulative);
    expect(result).toBeNull();
  });

  it("detects not-balanced vs balanced contradiction", () => {
    const options: ConditionInference[] = [
      { type: "not-balanced", params: {} },
    ];
    const cumulative: HandInference = {
      seat: Seat.North,
      isBalanced: true,
      suits: {},
      source: "test",
    };
    const result = resolveDisjunction(options, cumulative);
    expect(result).toBeNull();
  });
});
