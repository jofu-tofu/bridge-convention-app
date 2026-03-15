import { describe, it, expect } from "vitest";
import { resolveAlert } from "../alert";
import type { AlertResolvable } from "../alert";

function makeSurface(overrides: Partial<AlertResolvable> = {}): AlertResolvable {
  return {
    sourceIntent: { type: "NaturalBid" },
    teachingLabel: "Test bid",
    ...overrides,
  };
}

describe("resolveAlert", () => {
  it("returns null for natural surfaces with no alert field", () => {
    const surface = makeSurface({ priorityClass: "neutralCorrect" });
    expect(resolveAlert(surface)).toBeNull();
  });

  it("returns null for fallbackCorrect surfaces", () => {
    const surface = makeSurface({ priorityClass: "fallbackCorrect" });
    expect(resolveAlert(surface)).toBeNull();
  });

  it("returns null for preferredNatural surfaces", () => {
    const surface = makeSurface({ priorityClass: "preferredNatural" });
    expect(resolveAlert(surface)).toBeNull();
  });

  it("derives alert from preferredConventional priorityClass", () => {
    const surface = makeSurface({
      priorityClass: "preferredConventional",
      teachingLabel: "Stayman 2C",
      publicConsequences: {
        promises: [{ factId: "hand.hcp", operator: "gte", value: 8 }],
      },
    });
    const result = resolveAlert(surface);
    expect(result).toEqual({
      kind: "alert",
      publicConstraints: [{ factId: "hand.hcp", operator: "gte", value: 8 }],
      teachingLabel: "Stayman 2C",
    });
  });

  it("derives alert from obligatory priorityClass", () => {
    const surface = makeSurface({
      priorityClass: "obligatory",
      teachingLabel: "Show hearts",
    });
    const result = resolveAlert(surface);
    expect(result).toEqual({
      kind: "alert",
      publicConstraints: [],
      teachingLabel: "Show hearts",
    });
  });

  it("derives alert from artificial sourceIntent type", () => {
    const surface = makeSurface({
      sourceIntent: { type: "frontier-step" },
      teachingLabel: "Relay bid",
    });
    const result = resolveAlert(surface);
    expect(result).toEqual({
      kind: "alert",
      publicConstraints: [],
      teachingLabel: "Relay bid",
    });
  });

  it("explicit alert field overrides derivation", () => {
    const surface = makeSurface({
      alert: "announce",
      priorityClass: "preferredConventional",
      teachingLabel: "Transfer to hearts",
      publicConsequences: {
        promises: [
          { factId: "hand.suitLength.hearts", operator: "gte", value: 5 },
        ],
      },
    });
    const result = resolveAlert(surface);
    expect(result).toEqual({
      kind: "announce",
      publicConstraints: [
        { factId: "hand.suitLength.hearts", operator: "gte", value: 5 },
      ],
      teachingLabel: "Transfer to hearts",
    });
  });

  it("explicit alert 'alert' works even without derivation triggers", () => {
    const surface = makeSurface({
      alert: "alert",
      priorityClass: "neutralCorrect",
      teachingLabel: "Unusual bid",
    });
    const result = resolveAlert(surface);
    expect(result).toEqual({
      kind: "alert",
      publicConstraints: [],
      teachingLabel: "Unusual bid",
    });
  });

  it("includes publicConsequences promises in publicConstraints", () => {
    const surface = makeSurface({
      priorityClass: "preferredConventional",
      teachingLabel: "Convention bid",
      publicConsequences: {
        promises: [
          { factId: "hand.hcp", operator: "gte", value: 10 },
          { factId: "hand.suitLength.spades", operator: "gte", value: 5 },
        ],
      },
    });
    const result = resolveAlert(surface)!;
    expect(result.publicConstraints).toHaveLength(2);
    expect(result.publicConstraints[0]).toEqual({
      factId: "hand.hcp",
      operator: "gte",
      value: 10,
    });
  });
});
