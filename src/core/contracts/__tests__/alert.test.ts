import { describe, it, expect } from "vitest";
import { resolveAlert, isAlertable, derivePublicConstraints } from "../alert";
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

describe("isAlertable", () => {
  it("returns false for natural intent types", () => {
    expect(isAlertable("NTInvite")).toBe(false);
    expect(isAlertable("NTGame")).toBe(false);
    expect(isAlertable("NTOpening")).toBe(false);
    expect(isAlertable("TerminalPass")).toBe(false);
    expect(isAlertable("DONTPass")).toBe(false);
    expect(isAlertable("WeakPass")).toBe(false);
    expect(isAlertable("PostOgustPass")).toBe(false);
    expect(isAlertable("DONTAcceptSpadesFallback")).toBe(false);
    expect(isAlertable("PreemptiveRaise")).toBe(false);
  });

  it("returns true for conventional intent types", () => {
    expect(isAlertable("StaymanAsk")).toBe(true);
    expect(isAlertable("DONTBothMajors")).toBe(true);
    expect(isAlertable("Splinter")).toBe(true);
    expect(isAlertable("ConstructiveRaise")).toBe(true);
    expect(isAlertable("TransferToHearts")).toBe(true);
    expect(isAlertable("frontier-step")).toBe(true);
  });
});

describe("resolveAlert", () => {
  it("returns null for natural intent types", () => {
    const surface = makeSurface({ sourceIntent: { type: "NTInvite" } });
    expect(resolveAlert(surface)).toBeNull();
  });

  it("returns null for fallback natural intents", () => {
    const surface = makeSurface({ sourceIntent: { type: "DONTAcceptSpadesFallback" } });
    expect(resolveAlert(surface)).toBeNull();
  });

  it("returns null for preemptive raise (natural)", () => {
    const surface = makeSurface({ sourceIntent: { type: "PreemptiveRaise" } });
    expect(resolveAlert(surface)).toBeNull();
  });

  it("returns alert for conventional intent with clauses", () => {
    const surface = makeSurface({
      sourceIntent: { type: "ConstructiveRaise" },
      teachingLabel: "Constructive raise (3C)",
      clauses: [
        { clauseId: "hcp-8", factId: "hand.hcp", operator: "gte", value: 8, description: "8+ HCP" },
      ],
    });
    const result = resolveAlert(surface);
    expect(result).toEqual({
      publicConstraints: [{ factId: "hand.hcp", operator: "gte", value: 8 }],
      teachingLabel: "Constructive raise (3C)",
      annotationType: "alert",
    });
  });

  it("returns educational for standard conventional intents (e.g., Stayman)", () => {
    const surface = makeSurface({
      sourceIntent: { type: "StaymanAsk" },
      teachingLabel: "Stayman 2♣",
    });
    const result = resolveAlert(surface);
    expect(result?.annotationType).toBe("educational");
  });

  it("returns alert for conventional intent (DONTBothMajors)", () => {
    const surface = makeSurface({
      sourceIntent: { type: "DONTBothMajors" },
      teachingLabel: "2H — both majors",
    });
    const result = resolveAlert(surface);
    expect(result).toEqual({
      publicConstraints: [],
      teachingLabel: "2H — both majors",
      annotationType: "alert",
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
      sourceIntent: { type: "TransferToHearts" },
      teachingLabel: "Transfer to hearts",
    });
    const result = resolveAlert(surface);
    expect(result?.annotationType).toBe("announce");
  });

  it("returns null for TerminalPass", () => {
    const surface = makeSurface({
      sourceIntent: { type: "TerminalPass" },
      teachingLabel: "Pass",
    });
    expect(resolveAlert(surface)).toBeNull();
  });

  it("returns null for WeakPass", () => {
    const surface = makeSurface({
      sourceIntent: { type: "WeakPass" },
      teachingLabel: "Pass",
    });
    expect(resolveAlert(surface)).toBeNull();
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
