import { describe, it, expect } from "vitest";
import { resolveAlert } from "../alert";
import type { AlertResolvable } from "../alert";
import type { MeaningSurfaceClause } from "../meaning-surface";

function makeSurface(overrides: Partial<AlertResolvable> = {}): AlertResolvable {
  return {
    sourceIntent: { type: "NaturalBid" },
    teachingLabel: "Test bid",
    clauses: [],
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
      clauses: [
        {
          clauseId: "hcp-8",
          factId: "hand.hcp",
          operator: "gte",
          value: 8,
          description: "8+ HCP",
        },
      ],
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
      clauses: [
        {
          clauseId: "hearts-5",
          factId: "hand.suitLength.hearts",
          operator: "gte",
          value: 5,
          description: "5+ hearts",
        },
      ],
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

  it("derives publicConstraints from primitive hand fact clauses", () => {
    const surface = makeSurface({
      priorityClass: "preferredConventional",
      teachingLabel: "Convention bid",
      clauses: [
        {
          clauseId: "hcp-10",
          factId: "hand.hcp",
          operator: "gte",
          value: 10,
          description: "10+ HCP",
        },
        {
          clauseId: "spades-5",
          factId: "hand.suitLength.spades",
          operator: "gte",
          value: 5,
          description: "5+ spades",
        },
      ],
    });
    const result = resolveAlert(surface)!;
    expect(result.publicConstraints).toHaveLength(2);
    expect(result.publicConstraints[0]).toEqual({
      factId: "hand.hcp",
      operator: "gte",
      value: 10,
    });
  });

  it("excludes module-derived and non-isPublic bridge clauses from publicConstraints", () => {
    const clauses: MeaningSurfaceClause[] = [
      {
        clauseId: "hcp-10",
        factId: "hand.hcp",
        operator: "gte",
        value: 10,
        description: "10+ HCP",
      },
      {
        clauseId: "game-values",
        factId: "module.ntResponse.gameValues",
        operator: "boolean",
        value: true,
        description: "Game-forcing values (module routing)",
      },
      {
        clauseId: "no-5cm",
        factId: "bridge.hasFiveCardMajor",
        operator: "boolean",
        value: false,
        description: "No 5-card major (routing)",
      },
    ];
    const surface = makeSurface({
      priorityClass: "preferredConventional",
      teachingLabel: "Mixed clauses",
      clauses,
    });
    const result = resolveAlert(surface)!;
    expect(result.publicConstraints).toHaveLength(1);
    expect(result.publicConstraints[0]).toEqual({
      factId: "hand.hcp",
      operator: "gte",
      value: 10,
    });
  });

  it("includes bridge-derived clauses marked isPublic by the bundle", () => {
    const clauses: MeaningSurfaceClause[] = [
      {
        clauseId: "hcp-8",
        factId: "hand.hcp",
        operator: "gte",
        value: 8,
        description: "8+ HCP",
      },
      {
        clauseId: "has-4cm",
        factId: "bridge.hasFourCardMajor",
        operator: "boolean",
        value: true,
        description: "Has 4-card major",
        isPublic: true,
      },
      {
        clauseId: "no-5cm",
        factId: "bridge.hasFiveCardMajor",
        operator: "boolean",
        value: false,
        description: "No 5-card major (routing)",
      },
    ];
    const surface = makeSurface({
      priorityClass: "preferredConventional",
      teachingLabel: "Stayman 2C",
      clauses,
    });
    const result = resolveAlert(surface)!;
    expect(result.publicConstraints).toHaveLength(2);
    expect(result.publicConstraints[0]!.factId).toBe("hand.hcp");
    expect(result.publicConstraints[1]!.factId).toBe("bridge.hasFourCardMajor");
  });
});
