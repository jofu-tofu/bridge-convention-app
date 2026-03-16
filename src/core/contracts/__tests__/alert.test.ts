import { describe, it, expect } from "vitest";
import { resolveAlert, derivePublicConstraints } from "../alert";
import type { AlertResolvable } from "../alert";
import type { MeaningSurfaceClause } from "../meaning";

function makeSurface(overrides: Partial<AlertResolvable> = {}): AlertResolvable {
  return {
    sourceIntent: { type: "NaturalBid" },
    teachingLabel: "Test bid",
    clauses: [],
    ...overrides,
  };
}

describe("resolveAlert", () => {
  it("returns null for natural surfaces", () => {
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

  it("returns alert for preferredConventional priorityClass", () => {
    const surface = makeSurface({
      priorityClass: "preferredConventional",
      teachingLabel: "Stayman 2C",
      clauses: [
        { clauseId: "hcp-8", factId: "hand.hcp", operator: "gte", value: 8, description: "8+ HCP" },
      ],
    });
    const result = resolveAlert(surface);
    expect(result).toEqual({
      publicConstraints: [{ factId: "hand.hcp", operator: "gte", value: 8 }],
      teachingLabel: "Stayman 2C",
      annotationType: "educational",
    });
  });

  it("returns alert for obligatory priorityClass", () => {
    const surface = makeSurface({
      priorityClass: "obligatory",
      teachingLabel: "Show hearts",
    });
    const result = resolveAlert(surface);
    expect(result).toEqual({
      publicConstraints: [],
      teachingLabel: "Show hearts",
      annotationType: "educational",
    });
  });

  it("returns alert for artificial sourceIntent type", () => {
    const surface = makeSurface({
      sourceIntent: { type: "frontier-step" },
      teachingLabel: "Relay bid",
    });
    const result = resolveAlert(surface);
    expect(result).toEqual({
      publicConstraints: [],
      teachingLabel: "Relay bid",
      annotationType: "alert",
    });
  });

  it("returns announce annotationType for transfer intents", () => {
    const surface = makeSurface({
      priorityClass: "preferredConventional",
      sourceIntent: { type: "TransferToHearts" },
      teachingLabel: "Transfer to hearts",
    });
    const result = resolveAlert(surface);
    expect(result?.annotationType).toBe("announce");
  });
});

describe("derivePublicConstraints", () => {
  it("includes primitive hand.* facts automatically", () => {
    const clauses: MeaningSurfaceClause[] = [
      { clauseId: "hcp-10", factId: "hand.hcp", operator: "gte", value: 10, description: "10+ HCP" },
      { clauseId: "spades-5", factId: "hand.suitLength.spades", operator: "gte", value: 5, description: "5+ spades" },
    ];
    const result = derivePublicConstraints(clauses);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ factId: "hand.hcp", operator: "gte", value: 10 });
    expect(result[1]).toEqual({ factId: "hand.suitLength.spades", operator: "gte", value: 5 });
  });

  it("excludes module-derived and unmarked bridge facts", () => {
    const clauses: MeaningSurfaceClause[] = [
      { clauseId: "hcp-10", factId: "hand.hcp", operator: "gte", value: 10, description: "10+ HCP" },
      { clauseId: "game-values", factId: "module.ntResponse.gameValues", operator: "boolean", value: true, description: "Module routing" },
      { clauseId: "no-5cm", factId: "bridge.hasFiveCardMajor", operator: "boolean", value: false, description: "Routing" },
    ];
    const result = derivePublicConstraints(clauses);
    expect(result).toHaveLength(1);
    expect(result[0]!.factId).toBe("hand.hcp");
  });

  it("includes bridge-derived clauses marked isPublic by the bundle", () => {
    const clauses: MeaningSurfaceClause[] = [
      { clauseId: "hcp-8", factId: "hand.hcp", operator: "gte", value: 8, description: "8+ HCP" },
      { clauseId: "has-4cm", factId: "bridge.hasFourCardMajor", operator: "boolean", value: true, description: "Has 4-card major", isPublic: true },
      { clauseId: "no-5cm", factId: "bridge.hasFiveCardMajor", operator: "boolean", value: false, description: "Routing" },
    ];
    const result = derivePublicConstraints(clauses);
    expect(result).toHaveLength(2);
    expect(result[0]!.factId).toBe("hand.hcp");
    expect(result[1]!.factId).toBe("bridge.hasFourCardMajor");
  });

  it("returns empty for surfaces with only module/routing clauses", () => {
    const clauses: MeaningSurfaceClause[] = [
      { clauseId: "invite", factId: "module.ntResponse.inviteValues", operator: "boolean", value: true, description: "Invite values" },
      { clauseId: "no-4cm", factId: "bridge.hasFourCardMajor", operator: "boolean", value: false, description: "Routing" },
    ];
    const result = derivePublicConstraints(clauses);
    expect(result).toHaveLength(0);
  });
});
