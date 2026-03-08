/**
 * Tests for extractInferencesFromDTO — converts TreeInferenceData DTO to HandInference[].
 * Reuses condition-mapper logic but operates on the DTO form (no tree node references).
 */
import { describe, test, expect } from "vitest";
import { Seat } from "../../engine/types";
import type { TreeInferenceData } from "../../core/contracts";
import { extractInferencesFromDTO } from "../tree-inference-extractor";

describe("extractInferencesFromDTO", () => {
  test("returns empty array for empty data", () => {
    const data: TreeInferenceData = { pathConditions: [], rejectedConditions: [] };
    const result = extractInferencesFromDTO(data, Seat.North, "test-rule");
    expect(result).toEqual([]);
  });

  test("extracts positive HCP inference from path conditions", () => {
    const data: TreeInferenceData = {
      pathConditions: [
        { type: "hcp-min", params: { min: 15 } },
        { type: "hcp-max", params: { max: 17 } },
      ],
      rejectedConditions: [],
    };
    const result = extractInferencesFromDTO(data, Seat.North, "1nt-open");
    expect(result.length).toBe(2);
    expect(result[0]).toEqual(expect.objectContaining({ seat: Seat.North, minHcp: 15, source: "1nt-open" }));
    expect(result[1]).toEqual(expect.objectContaining({ seat: Seat.North, maxHcp: 17, source: "1nt-open" }));
  });

  test("extracts positive suit inference from path conditions", () => {
    const data: TreeInferenceData = {
      pathConditions: [
        { type: "suit-min", params: { min: 4, suitIndex: 1 } }, // hearts min 4
      ],
      rejectedConditions: [],
    };
    const result = extractInferencesFromDTO(data, Seat.South, "stayman-response");
    expect(result.length).toBe(1);
    expect(result[0]!.suits).toHaveProperty("H");
  });

  test("extracts negative inference from rejected conditions (inverted)", () => {
    const data: TreeInferenceData = {
      pathConditions: [],
      rejectedConditions: [
        { type: "suit-min", params: { min: 4, suitIndex: 0 }, negatable: true }, // spades min 4 rejected → max 3
      ],
    };
    const result = extractInferencesFromDTO(data, Seat.North, "stayman-denial");
    expect(result.length).toBe(1);
    // Inverted: suit-min 4 → suit-max 3
    expect(result[0]!.suits).toHaveProperty("S");
    expect(result[0]!.suits.S?.maxLength).toBe(3);
  });

  test("skips non-negatable rejected conditions", () => {
    const data: TreeInferenceData = {
      pathConditions: [],
      rejectedConditions: [
        { type: "balanced", params: {}, negatable: false },
      ],
    };
    const result = extractInferencesFromDTO(data, Seat.North, "test");
    expect(result).toEqual([]);
  });

  test("handles negatable defaulting to true", () => {
    const data: TreeInferenceData = {
      pathConditions: [],
      rejectedConditions: [
        { type: "hcp-min", params: { min: 12 } }, // no negatable field → defaults to true
      ],
    };
    const result = extractInferencesFromDTO(data, Seat.North, "test");
    expect(result.length).toBe(1);
    expect(result[0]).toEqual(expect.objectContaining({ maxHcp: 11 })); // inverted: min 12 → max 11
  });

  test("mixed path + rejected conditions", () => {
    const data: TreeInferenceData = {
      pathConditions: [
        { type: "hcp-min", params: { min: 15 } },
      ],
      rejectedConditions: [
        { type: "suit-min", params: { min: 4, suitIndex: 0 }, negatable: true }, // no 4 spades
        { type: "suit-min", params: { min: 4, suitIndex: 1 }, negatable: true }, // no 4 hearts
      ],
    };
    const result = extractInferencesFromDTO(data, Seat.North, "stayman-2d");
    // 1 positive (hcp-min 15) + 2 negatives (max 3 spades, max 3 hearts)
    expect(result.length).toBe(3);
    expect(result[0]).toEqual(expect.objectContaining({ minHcp: 15 }));
    expect(result[1]!.suits.S?.maxLength).toBe(3);
    expect(result[2]!.suits.H?.maxLength).toBe(3);
  });
});
