import { describe, it, expect } from "vitest";
import {
  defineBooleanFact,
  definePerSuitFacts,
  defineHcpRangeFact,
  buildExtension,
} from "../fact-factory";
import type { FactEntry } from "../fact-factory";
import type { FactValue } from "../../../../core/contracts/fact-catalog";
import { FactLayer } from "../../../../core/contracts/fact-layer";
import { hand } from "../../../../engine/__tests__/fixtures";
import { evaluateHand } from "../../../../engine/hand-evaluator";

// ─── Helpers ────────────────────────────────────────────────

function makeMemo(entries: Record<string, number | boolean | string>): Map<string, FactValue> {
  const m = new Map<string, FactValue>();
  for (const [k, v] of Object.entries(entries)) {
    m.set(k, { factId: k, value: v });
  }
  return m;
}

function evalEntry(entry: FactEntry, memo: Map<string, FactValue>): FactValue {
  const h = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "DA", "DK", "DQ", "CA", "CK", "CQ", "CJ");
  const ev = evaluateHand(h);
  return entry.evaluator[1](h, ev, memo);
}

// ─── defineBooleanFact ──────────────────────────────────────

describe("defineBooleanFact", () => {
  it("creates definition with ModuleDerived layer and boolean valueType", () => {
    const entry = defineBooleanFact({
      id: "test.fact",
      description: "Test fact",
      factId: "hand.hcp",
      operator: "gte",
      value: 10,
      constrainsDimensions: ["pointRange"],
    });

    expect(entry.definition.id).toBe("test.fact");
    expect(entry.definition.layer).toBe(FactLayer.ModuleDerived);
    expect(entry.definition.world).toBe("acting-hand");
    expect(entry.definition.valueType).toBe("boolean");
    expect(entry.definition.constrainsDimensions).toEqual(["pointRange"]);
    expect(entry.definition.derivesFrom).toEqual(["hand.hcp"]);
  });

  it("uses explicit derivesFrom when provided", () => {
    const entry = defineBooleanFact({
      id: "test.fact",
      description: "Test fact",
      factId: "hand.hcp",
      operator: "gte",
      value: 10,
      constrainsDimensions: ["pointRange"],
      derivesFrom: ["hand.hcp", "bridge.isVulnerable"],
    });

    expect(entry.definition.derivesFrom).toEqual(["hand.hcp", "bridge.isVulnerable"]);
  });

  it("evaluator returns true with gte operator when value meets threshold", () => {
    const entry = defineBooleanFact({
      id: "test.gte",
      description: "HCP >= 10",
      factId: "hand.hcp",
      operator: "gte",
      value: 10,
      constrainsDimensions: ["pointRange"],
    });

    const memo = makeMemo({ "hand.hcp": 12 });
    expect(evalEntry(entry, memo).value).toBe(true);
  });

  it("evaluator returns false with gte operator when value is below threshold", () => {
    const entry = defineBooleanFact({
      id: "test.gte",
      description: "HCP >= 10",
      factId: "hand.hcp",
      operator: "gte",
      value: 10,
      constrainsDimensions: ["pointRange"],
    });

    const memo = makeMemo({ "hand.hcp": 8 });
    expect(evalEntry(entry, memo).value).toBe(false);
  });

  it("evaluator handles lte operator correctly", () => {
    const entry = defineBooleanFact({
      id: "test.lte",
      description: "HCP <= 5",
      factId: "hand.hcp",
      operator: "lte",
      value: 5,
      constrainsDimensions: ["pointRange"],
    });

    expect(evalEntry(entry, makeMemo({ "hand.hcp": 3 })).value).toBe(true);
    expect(evalEntry(entry, makeMemo({ "hand.hcp": 5 })).value).toBe(true);
    expect(evalEntry(entry, makeMemo({ "hand.hcp": 6 })).value).toBe(false);
  });

  it("evaluator handles eq operator correctly", () => {
    const entry = defineBooleanFact({
      id: "test.eq",
      description: "HCP == 15",
      factId: "hand.hcp",
      operator: "eq",
      value: 15,
      constrainsDimensions: ["pointRange"],
    });

    expect(evalEntry(entry, makeMemo({ "hand.hcp": 15 })).value).toBe(true);
    expect(evalEntry(entry, makeMemo({ "hand.hcp": 14 })).value).toBe(false);
    expect(evalEntry(entry, makeMemo({ "hand.hcp": 16 })).value).toBe(false);
  });

  it("evaluator tuple has correct fact ID as key", () => {
    const entry = defineBooleanFact({
      id: "module.test.myFact",
      description: "Test",
      factId: "hand.hcp",
      operator: "gte",
      value: 10,
      constrainsDimensions: ["pointRange"],
    });

    expect(entry.evaluator[0]).toBe("module.test.myFact");
  });
});

// ─── definePerSuitFacts ─────────────────────────────────────

describe("definePerSuitFacts", () => {
  it("produces one entry per suit", () => {
    const entries = definePerSuitFacts({
      idPrefix: "module.test.count",
      suits: ["hearts", "spades", "diamonds"],
      description: (suit) => `Count in ${suit}`,
      evaluator: (_h, suit, _m) => ({ factId: `module.test.count.${suit}`, value: 3 }),
      valueType: "number",
      constrainsDimensions: ["suitIdentity", "suitQuality"],
    });

    expect(entries).toHaveLength(3);
    expect(entries[0]!.definition.id).toBe("module.test.count.hearts");
    expect(entries[1]!.definition.id).toBe("module.test.count.spades");
    expect(entries[2]!.definition.id).toBe("module.test.count.diamonds");
  });

  it("generates correct descriptions per suit", () => {
    const entries = definePerSuitFacts({
      idPrefix: "module.test.x",
      suits: ["hearts", "clubs"],
      description: (suit) => `All three top honors in ${suit}`,
      evaluator: (_h, _s, _m) => ({ factId: "x", value: true }),
      valueType: "boolean",
      constrainsDimensions: ["suitQuality"],
    });

    expect(entries[0]!.definition.description).toBe("All three top honors in hearts");
    expect(entries[1]!.definition.description).toBe("All three top honors in clubs");
  });

  it("uses static derivesFrom array when provided", () => {
    const entries = definePerSuitFacts({
      idPrefix: "module.test.x",
      suits: ["hearts"],
      description: () => "desc",
      evaluator: (_h, _s, _m) => ({ factId: "x", value: 0 }),
      valueType: "number",
      constrainsDimensions: [],
      derivesFrom: ["hand.hcp"],
    });

    expect(entries[0]!.definition.derivesFrom).toEqual(["hand.hcp"]);
  });

  it("uses derivesFrom function for per-suit dependencies", () => {
    const entries = definePerSuitFacts({
      idPrefix: "module.test.solid",
      suits: ["hearts", "spades"],
      description: (suit) => `Solid ${suit}`,
      evaluator: (_h, _s, _m) => ({ factId: "x", value: true }),
      valueType: "boolean",
      constrainsDimensions: ["suitQuality"],
      derivesFrom: (suit) => [`module.test.topHonors.${suit}`],
    });

    expect(entries[0]!.definition.derivesFrom).toEqual(["module.test.topHonors.hearts"]);
    expect(entries[1]!.definition.derivesFrom).toEqual(["module.test.topHonors.spades"]);
  });

  it("evaluator receives correct suit argument", () => {
    const receivedSuits: string[] = [];
    const entries = definePerSuitFacts({
      idPrefix: "module.test.x",
      suits: ["hearts", "spades"],
      description: () => "desc",
      evaluator: (_h, suit, _m) => {
        receivedSuits.push(suit);
        return { factId: `module.test.x.${suit}`, value: 0 };
      },
      valueType: "number",
      constrainsDimensions: [],
    });

    const h = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "DA", "DK", "DQ", "CA", "CK", "CQ", "CJ");
    const ev = evaluateHand(h);
    const memo = new Map<string, FactValue>();

    entries[0]!.evaluator[1](h, ev, memo);
    entries[1]!.evaluator[1](h, ev, memo);

    expect(receivedSuits).toEqual(["hearts", "spades"]);
  });

  it("all entries have ModuleDerived layer", () => {
    const entries = definePerSuitFacts({
      idPrefix: "module.test.x",
      suits: ["hearts", "spades", "diamonds", "clubs"],
      description: () => "desc",
      evaluator: (_h, _s, _m) => ({ factId: "x", value: true }),
      valueType: "boolean",
      constrainsDimensions: [],
    });

    for (const e of entries) {
      expect(e.definition.layer).toBe(FactLayer.ModuleDerived);
      expect(e.definition.world).toBe("acting-hand");
    }
  });
});

// ─── defineHcpRangeFact ─────────────────────────────────────

describe("defineHcpRangeFact", () => {
  it("creates definition with pointRange dimension by default", () => {
    const entry = defineHcpRangeFact({
      id: "module.test.range",
      description: "HCP 10-12",
      range: { min: 10, max: 12 },
    });

    expect(entry.definition.constrainsDimensions).toEqual(["pointRange"]);
    expect(entry.definition.derivesFrom).toEqual(["hand.hcp"]);
    expect(entry.definition.valueType).toBe("boolean");
  });

  it("allows overriding constrainsDimensions", () => {
    const entry = defineHcpRangeFact({
      id: "module.test.range",
      description: "HCP 10-12",
      range: { min: 10, max: 12 },
      constrainsDimensions: ["pointRange", "shapeClass"],
    });

    expect(entry.definition.constrainsDimensions).toEqual(["pointRange", "shapeClass"]);
  });

  it("evaluator returns true when HCP is within range (inclusive)", () => {
    const entry = defineHcpRangeFact({
      id: "module.test.range",
      description: "HCP 9-11",
      range: { min: 9, max: 11 },
    });

    expect(evalEntry(entry, makeMemo({ "hand.hcp": 9 })).value).toBe(true);
    expect(evalEntry(entry, makeMemo({ "hand.hcp": 10 })).value).toBe(true);
    expect(evalEntry(entry, makeMemo({ "hand.hcp": 11 })).value).toBe(true);
  });

  it("evaluator returns false when HCP is outside range", () => {
    const entry = defineHcpRangeFact({
      id: "module.test.range",
      description: "HCP 9-11",
      range: { min: 9, max: 11 },
    });

    expect(evalEntry(entry, makeMemo({ "hand.hcp": 8 })).value).toBe(false);
    expect(evalEntry(entry, makeMemo({ "hand.hcp": 12 })).value).toBe(false);
  });

  it("evaluator returns FactValue with correct factId", () => {
    const entry = defineHcpRangeFact({
      id: "module.test.maxRange",
      description: "HCP 15-17",
      range: { min: 15, max: 17 },
    });

    const result = evalEntry(entry, makeMemo({ "hand.hcp": 16 }));
    expect(result.factId).toBe("module.test.maxRange");
  });
});

// ─── buildExtension ─────────────────────────────────────────

describe("buildExtension", () => {
  it("composes a single FactEntry into definitions + evaluators", () => {
    const entry = defineBooleanFact({
      id: "module.test.simple",
      description: "Test",
      factId: "hand.hcp",
      operator: "gte",
      value: 10,
      constrainsDimensions: ["pointRange"],
    });

    const ext = buildExtension([entry]);
    expect(ext.definitions).toHaveLength(1);
    expect(ext.evaluators.size).toBe(1);
    expect(ext.definitions[0]!.id).toBe("module.test.simple");
    expect(ext.evaluators.has("module.test.simple")).toBe(true);
  });

  it("composes mixed FactEntry and FactEntry[] (flattened) correctly", () => {
    const boolEntry = defineBooleanFact({
      id: "module.test.bool",
      description: "Boolean test",
      factId: "hand.hcp",
      operator: "gte",
      value: 10,
      constrainsDimensions: ["pointRange"],
    });

    const suitEntries = definePerSuitFacts({
      idPrefix: "module.test.perSuit",
      suits: ["hearts", "spades"],
      description: (s) => `Per-suit ${s}`,
      evaluator: (_h, suit, _m) => ({ factId: `module.test.perSuit.${suit}`, value: 0 }),
      valueType: "number",
      constrainsDimensions: ["suitIdentity"],
    });

    const hcpEntry = defineHcpRangeFact({
      id: "module.test.range",
      description: "HCP range",
      range: { min: 5, max: 11 },
    });

    const ext = buildExtension([boolEntry, ...suitEntries, hcpEntry]);
    expect(ext.definitions).toHaveLength(4);
    expect(ext.evaluators.size).toBe(4);

    const ids = ext.definitions.map((d) => d.id);
    expect(ids).toContain("module.test.bool");
    expect(ids).toContain("module.test.perSuit.hearts");
    expect(ids).toContain("module.test.perSuit.spades");
    expect(ids).toContain("module.test.range");
  });

  it("returns empty collections for empty input", () => {
    const ext = buildExtension([]);
    expect(ext.definitions).toHaveLength(0);
    expect(ext.evaluators.size).toBe(0);
  });

  it("produced extension is compatible with FactCatalogExtension shape", () => {
    const entry = defineBooleanFact({
      id: "module.test.compat",
      description: "Compat test",
      factId: "hand.hcp",
      operator: "eq",
      value: 15,
      constrainsDimensions: ["pointRange"],
    });

    const ext = buildExtension([entry]);

    // Verify structural compatibility with FactCatalogExtension
    expect(Array.isArray(ext.definitions)).toBe(true);
    expect(ext.evaluators instanceof Map).toBe(true);
    expect(typeof ext.evaluators.get("module.test.compat")).toBe("function");
  });
});
