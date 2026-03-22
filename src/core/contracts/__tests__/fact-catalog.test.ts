import { describe, it, expect } from "vitest";
import {
  getFactValue,
  createFactCatalog,
  type EvaluatedFacts,
  type FactValue,
  type FactDefinition,
  type FactCatalog,
  type FactCatalogExtension,
  type FactEvaluatorFn,
} from "../fact-catalog";
import { SHARED_FACTS, PRIMITIVE_FACTS, BRIDGE_DERIVED_FACTS } from "../shared-facts";
// Integration test: exercises fact-catalog DTOs through the convention pipeline
import { evaluateFacts } from "../../../conventions/core/pipeline/fact-evaluator";
import { createSharedFactCatalog } from "../../../conventions/core/pipeline/shared-fact-catalog";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { hand } from "../../../engine/__tests__/fixtures";
import { FactLayer } from "../fact-layer";

describe("SHARED_FACTS", () => {
  it("has 20 shared facts (6 primitive + 9 bridge-derived + 5 posterior-derived)", () => {
    expect(SHARED_FACTS).toHaveLength(20);
  });

  it("PRIMITIVE_FACTS has 6 entries", () => {
    expect(PRIMITIVE_FACTS).toHaveLength(6);
  });

  it("BRIDGE_DERIVED_FACTS has 9 entries", () => {
    expect(BRIDGE_DERIVED_FACTS).toHaveLength(9);
  });

  it("every fact has required fields", () => {
    for (const fact of SHARED_FACTS) {
      expect(fact.id).toBeTypeOf("string");
      expect(fact.id.length).toBeGreaterThan(0);
      expect(fact.layer).toBeTypeOf("string");
      expect(fact.world).toBeTypeOf("string");
      expect(fact.description).toBeTypeOf("string");
      expect(fact.valueType).toBeTypeOf("string");
    }
  });

  it("every non-posterior fact has a derivesFrom array", () => {
    const posteriorIds = new Set([
      "bridge.partnerHas4HeartsLikely",
      "bridge.partnerHas4SpadesLikely",
      "bridge.partnerHas4DiamondsLikely",
      "bridge.partnerHas4ClubsLikely",
      "bridge.combinedHcpInRangeLikely",
    ]);
    for (const fact of SHARED_FACTS) {
      if (posteriorIds.has(fact.id)) continue; // posterior facts derive from sampling, not catalog deps
      expect(
        fact.derivesFrom,
        `expected ${fact.id} to have derivesFrom`,
      ).toBeDefined();
      expect(Array.isArray(fact.derivesFrom)).toBe(true);
    }
  });

  it("primitive facts use primitive layer and have empty derivesFrom", () => {
    const primitiveIds = [
      "hand.hcp",
      "hand.suitLength.spades",
      "hand.suitLength.hearts",
      "hand.suitLength.diamonds",
      "hand.suitLength.clubs",
      "hand.isBalanced",
    ];
    for (const id of primitiveIds) {
      const fact = SHARED_FACTS.find((f) => f.id === id);
      expect(fact, `expected ${id} to exist`).toBeDefined();
      expect(fact!.layer).toBe(FactLayer.Primitive);
      expect(fact!.derivesFrom).toEqual([]);
    }
  });

  it("bridge-derived facts use bridge-derived layer", () => {
    const bridgeIds = [
      "bridge.hasFourCardMajor",
      "bridge.hasFiveCardMajor",
      "bridge.majorPattern",
    ];
    for (const id of bridgeIds) {
      const fact = SHARED_FACTS.find((f) => f.id === id);
      expect(fact, `expected ${id} to exist`).toBeDefined();
      expect(fact!.layer).toBe(FactLayer.BridgeDerived);
    }
  });

  it("bridge-derived facts have non-empty derivesFrom referencing primitives", () => {
    const fact = SHARED_FACTS.find((f) => f.id === "bridge.hasFourCardMajor");
    expect(fact!.derivesFrom).toEqual([
      "hand.suitLength.spades",
      "hand.suitLength.hearts",
    ]);
  });

  it("shared facts do not include module-derived facts", () => {
    const moduleFacts = SHARED_FACTS.filter((f) => f.layer === FactLayer.ModuleDerived);
    expect(moduleFacts).toHaveLength(0);
  });

  it("all derivesFrom references point to existing fact IDs", () => {
    const allIds = new Set(SHARED_FACTS.map((f) => f.id));
    for (const fact of SHARED_FACTS) {
      for (const dep of fact.derivesFrom ?? []) {
        expect(
          allIds.has(dep),
          `${fact.id} references unknown fact: ${dep}`,
        ).toBe(true);
      }
    }
  });

  it("all shared facts are acting-hand world", () => {
    for (const fact of SHARED_FACTS) {
      expect(fact.world).toBe("acting-hand");
    }
  });

  it("has no duplicate IDs", () => {
    const ids = SHARED_FACTS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("createFactCatalog", () => {
  const baseCatalog: FactCatalog = {
    definitions: SHARED_FACTS,
    evaluators: new Map<string, FactEvaluatorFn>([
      ["hand.hcp", (_h, ev) => ({ factId: "hand.hcp", value: ev.hcp })],
    ]),
  };

  it("returns base catalog when no extensions provided", () => {
    const result = createFactCatalog(baseCatalog);
    expect(result.definitions).toEqual(baseCatalog.definitions);
    expect(result.evaluators.size).toBe(1);
    expect(result.evaluators.get("hand.hcp")).toBeDefined();
  });

  it("concatenates definitions from extensions", () => {
    const ext: FactCatalogExtension = {
      definitions: [
        {
          id: "module.test.fact",
          layer: FactLayer.ModuleDerived,
          world: "acting-hand",
          description: "Test fact",
          valueType: "boolean",
          derivesFrom: ["hand.hcp"],
          constrainsDimensions: [],
        },
      ],
      evaluators: new Map(),
    };
    const result = createFactCatalog(baseCatalog, ext);
    expect(result.definitions).toHaveLength(SHARED_FACTS.length + 1);
    const lastDef = result.definitions[result.definitions.length - 1];
    expect(lastDef).toBeDefined();
    expect(lastDef!.id).toBe("module.test.fact");
  });

  it("merges evaluator maps — extensions override base on conflict", () => {
    const overrideFn: FactEvaluatorFn = (_h, _ev) => ({ factId: "hand.hcp", value: 999 });
    const ext: FactCatalogExtension = {
      definitions: [],
      evaluators: new Map([["hand.hcp", overrideFn]]),
    };
    const result = createFactCatalog(baseCatalog, ext);
    expect(result.evaluators.get("hand.hcp")).toBe(overrideFn);
  });

  it("adds new evaluators from extensions", () => {
    const newFn: FactEvaluatorFn = (_h, _ev, m) => ({
      factId: "module.test.fact",
      value: (m.get("hand.hcp")?.value as number) > 10,
    });
    const ext: FactCatalogExtension = {
      definitions: [],
      evaluators: new Map([["module.test.fact", newFn]]),
    };
    const result = createFactCatalog(baseCatalog, ext);
    expect(result.evaluators.size).toBe(2);
    expect(result.evaluators.get("module.test.fact")).toBe(newFn);
  });

  it("merges multiple extensions in order", () => {
    const ext1: FactCatalogExtension = {
      definitions: [{
        id: "ext1.fact",
        layer: FactLayer.ModuleDerived,
        world: "acting-hand",
        description: "ext1",
        valueType: "boolean",
        derivesFrom: [],
        constrainsDimensions: [],
      }],
      evaluators: new Map([["ext1.fact", (_h, _ev) => ({ factId: "ext1.fact", value: true })]]),
    };
    const ext2: FactCatalogExtension = {
      definitions: [{
        id: "ext2.fact",
        layer: FactLayer.ModuleDerived,
        world: "acting-hand",
        description: "ext2",
        valueType: "number",
        derivesFrom: [],
        constrainsDimensions: [],
      }],
      evaluators: new Map([["ext2.fact", (_h, _ev) => ({ factId: "ext2.fact", value: 42 })]]),
    };
    const result = createFactCatalog(baseCatalog, ext1, ext2);
    expect(result.definitions).toHaveLength(SHARED_FACTS.length + 2);
    expect(result.evaluators.size).toBe(3);
  });

  it("does not mutate the base catalog", () => {
    const ext: FactCatalogExtension = {
      definitions: [{
        id: "module.test.fact",
        layer: FactLayer.ModuleDerived,
        world: "acting-hand",
        description: "Test",
        valueType: "boolean",
        derivesFrom: [],
        constrainsDimensions: [],
      }],
      evaluators: new Map([["module.test.fact", (_h, _ev) => ({ factId: "module.test.fact", value: true })]]),
    };
    createFactCatalog(baseCatalog, ext);
    expect(baseCatalog.definitions).toHaveLength(SHARED_FACTS.length);
    expect(baseCatalog.evaluators.size).toBe(1);
  });
});

describe("getFactValue", () => {
  const facts = new Map<string, FactValue>([
    ["hand.hcp", { factId: "hand.hcp", value: 15 }],
    ["hand.isBalanced", { factId: "hand.isBalanced", value: true }],
  ]);
  const evaluated: EvaluatedFacts = { world: "acting-hand", facts };

  it("returns the fact value for an existing factId", () => {
    const result = getFactValue(evaluated, "hand.hcp");
    expect(result).toBeDefined();
    expect(result!.value).toBe(15);
  });

  it("returns undefined for a missing factId", () => {
    const result = getFactValue(evaluated, "hand.nonexistent");
    expect(result).toBeUndefined();
  });
});

describe("topological evaluation order", () => {
  it("module facts evaluated after bridge-derived (topo sort)", () => {
    const moduleFactDef: FactDefinition = {
      id: "module.test.derived",
      layer: FactLayer.ModuleDerived,
      world: "acting-hand",
      description: "Derives from bridge.hasFourCardMajor",
      valueType: "boolean",
      derivesFrom: ["bridge.hasFourCardMajor"],
      constrainsDimensions: [],
    };

    // Module evaluator that reads bridge.hasFourCardMajor — only works if evaluated after
    const moduleEvaluator: FactEvaluatorFn = (_h, _ev, m) => ({
      factId: "module.test.derived",
      value: m.get("bridge.hasFourCardMajor")?.value === true,
    });

    const ext = {
      definitions: [moduleFactDef],
      evaluators: new Map([["module.test.derived", moduleEvaluator]]),
    };

    const catalog = createFactCatalog(
      createSharedFactCatalog(),
      ext,
    );

    const h = hand("SK", "SQ", "S8", "S3", "HJ", "H7", "H4", "H2", "DA", "D5", "C8", "C3", "C2");
    const facts = evaluateFacts(h, evaluateHand(h), catalog);

    // Module fact should be properly evaluated (true, because hand has 4 spades + 4 hearts)
    expect(facts.facts.get("module.test.derived")?.value).toBe(true);
  });

  it("missing evaluator → fact skipped (fail-closed)", () => {
    // Add a fact definition with no corresponding evaluator
    const orphanDef: FactDefinition = {
      id: "module.orphan.noEvaluator",
      layer: FactLayer.ModuleDerived,
      world: "acting-hand",
      description: "Has no evaluator registered",
      valueType: "boolean",
      derivesFrom: [],
      constrainsDimensions: [],
    };

    const catalogWithOrphan = createFactCatalog(createSharedFactCatalog(), {
      definitions: [orphanDef],
      evaluators: new Map(), // no evaluator for orphan
    });

    const h = hand("SK", "SQ", "S8", "S3", "HJ", "H7", "H4", "H2", "DA", "D5", "C8", "C3", "C2");
    const facts = evaluateFacts(h, evaluateHand(h), catalogWithOrphan);

    // Orphan fact should not be in the result
    expect(facts.facts.has("module.orphan.noEvaluator")).toBe(false);
    // But shared facts should still be present
    expect(facts.facts.has("hand.hcp")).toBe(true);
  });
});

describe("EvaluatedFacts", () => {
  it("can be constructed with a world and a facts map", () => {
    const facts = new Map<string, FactValue>([
      ["hand.hcp", { factId: "hand.hcp", value: 12 }],
    ]);
    const evaluated: EvaluatedFacts = { world: "full-deal", facts };

    expect(evaluated.world).toBe("full-deal");
    expect(evaluated.facts.size).toBe(1);
    expect(evaluated.facts.get("hand.hcp")?.value).toBe(12);
  });
});
