import { describe, it, expect } from "vitest";
import { hand } from "../../../engine/__tests__/fixtures";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { evaluateFacts } from "../fact-evaluator";
import { createSharedFactCatalog } from "../shared-fact-catalog";
import { createFactCatalog } from "../../core/fact-catalog";
import { SHARED_FACTS } from "../../core/shared-facts";
import type { PublicConstraint } from "../../core/agreement-module";
import type { RelationalFactContext } from "../fact-evaluator";
import { FactLayer } from "../../core/fact-layer";

function sharedFactsFor(...notations: string[]) {
  const h = hand(...notations);
  const ev = evaluateHand(h);
  return evaluateFacts(h, ev);
}

function val(result: ReturnType<typeof sharedFactsFor>, id: string) {
  return result.facts.get(id)?.value;
}

describe("evaluateFacts", () => {
  it("evaluates all 10 standard shared facts when called without catalog (no relational context)", () => {
    const h = hand(
      "SA", "SK", "S5", "S2",
      "HQ", "HJ", "H9", "H3",
      "D8", "D6", "D4",
      "C7", "C3",
    );
    const ev = evaluateHand(h);
    const result = evaluateFacts(h, ev);
    // Without relational context, only the 10 standard facts are evaluated
    // (6 primitive + 4 bridge-derived; relational facts require a RelationalFactContext;
    //  1NT-specific value facts moved to module.ntResponse.*)
    expect(result.facts.size).toBe(10);
    expect(result.world).toBe("acting-hand");
  });

  it("classifies bridge.majorPattern correctly", () => {
    // none: 3S, 3H
    const none = sharedFactsFor(
      "S5", "S4", "S2",
      "H9", "H7", "H3",
      "DJ", "D6", "D4",
      "CA", "CK", "C8", "C3",
    );
    expect(val(none, "bridge.majorPattern")).toBe("none");

    // one-four: 4S, 3H
    const oneFour = sharedFactsFor(
      "SA", "SK", "S5", "S2",
      "H9", "H7", "H3",
      "D6", "D4",
      "CQ", "CJ", "C8", "C3",
    );
    expect(val(oneFour, "bridge.majorPattern")).toBe("one-four");

    // both-four: 4S, 4H
    const bothFour = sharedFactsFor(
      "SA", "SK", "S5", "S2",
      "HQ", "HJ", "H9", "H3",
      "D6", "D4",
      "C8", "C7", "C3",
    );
    expect(val(bothFour, "bridge.majorPattern")).toBe("both-four");

    // one-five: 5S, 3H
    const oneFive = sharedFactsFor(
      "SA", "SK", "S5", "S4", "S2",
      "H9", "H7", "H3",
      "D6", "D4",
      "CQ", "C8", "C3",
    );
    expect(val(oneFive, "bridge.majorPattern")).toBe("one-five");

    // five-four: 5S, 4H
    const fiveFour = sharedFactsFor(
      "SA", "SK", "S5", "S4", "S2",
      "HQ", "HJ", "H9", "H3",
      "D6", "D4",
      "C8", "C3",
    );
    expect(val(fiveFour, "bridge.majorPattern")).toBe("five-four");
  });

  it("accepts a custom catalog subset (backward compat with FactDefinition[])", () => {
    const h = hand("SA", "SK", "S5", "S2", "HQ", "HJ", "H9", "H3", "D6", "D4", "D3", "C8", "C3");
    const ev = evaluateHand(h);
    const subset = SHARED_FACTS.filter((f) => f.layer === FactLayer.Primitive);
    const result = evaluateFacts(h, ev, subset);
    expect(result.facts.size).toBe(6);
    expect(result.facts.has("bridge.hasFourCardMajor")).toBe(false);
  });

  it("accepts a FactCatalog object with extensions", () => {
    const h = hand("SA", "SK", "S5", "S2", "HQ", "HJ", "H9", "H3", "D6", "D4", "D3", "C8", "C3");
    const ev = evaluateHand(h);
    const extension = {
      definitions: [{
        id: "synth.test",
        layer: FactLayer.ModuleDerived as const,
        world: "acting-hand" as const,
        description: "Synthetic test fact",
        valueType: "boolean" as const,
        derivesFrom: ["bridge.hasFourCardMajor"],
        constrainsDimensions: [],
      }],
      evaluators: new Map([
        ["synth.test", (_h: unknown, _ev: unknown, evaluated: ReadonlyMap<string, { value: unknown }>) => ({
          factId: "synth.test",
          value: evaluated.get("bridge.hasFourCardMajor")?.value === true,
        })],
      ]),
    };
    const catalog = createFactCatalog(createSharedFactCatalog(), extension);
    const result = evaluateFacts(h, ev, catalog);
    // 10 shared + 1 synthetic = 11
    expect(result.facts.size).toBe(11);
    expect(result.facts.has("synth.test")).toBe(true);
    expect(result.facts.get("synth.test")?.value).toBe(true);
  });

  it("skips facts with missing evaluators (fail-closed)", () => {
    const h = hand("SA", "SK", "S5", "S2", "HQ", "HJ", "H9", "H3", "D6", "D4", "D3", "C8", "C3");
    const ev = evaluateHand(h);
    // Create a catalog with a definition but no evaluator
    const catalog = createFactCatalog(createSharedFactCatalog(), {
      definitions: [{
        id: "module.test.noEvaluator",
        layer: FactLayer.ModuleDerived,
        world: "acting-hand",
        description: "Has no evaluator",
        valueType: "boolean",
        derivesFrom: [],
        constrainsDimensions: [],
      }],
      evaluators: new Map(),
    });
    const result = evaluateFacts(h, ev, catalog);
    // The 10 standard shared facts evaluate (no relational context), but the new one is skipped
    expect(result.facts.size).toBe(10);
    expect(result.facts.has("module.test.noEvaluator")).toBe(false);
  });

  it("respects dependency order — derived facts computed after their dependencies", () => {
    const result = sharedFactsFor(
      "SA", "SK", "S5", "S4", "S2",
      "HQ", "HJ", "H9", "H3",
      "D6", "D4",
      "C8", "C3",
    );
    // bridge-derived facts depend on primitive facts (suit lengths → hasFourCardMajor)
    expect(val(result, "hand.suitLength.spades")).toBe(5);
    expect(val(result, "bridge.hasFourCardMajor")).toBe(true);
    expect(val(result, "bridge.hasFiveCardMajor")).toBe(true);
  });

  it("pre-seeds bridge.isVulnerable when isVulnerable param is provided", () => {
    const h = hand("SA", "SK", "S5", "S2", "HQ", "HJ", "H9", "H3", "D6", "D4", "D3", "C8", "C3");
    const ev = evaluateHand(h);
    const vulResult = evaluateFacts(h, ev, undefined, { isVulnerable: true });
    expect(vulResult.facts.get("bridge.isVulnerable")?.value).toBe(true);
    // 10 standard + 1 pre-seeded = 11
    expect(vulResult.facts.size).toBe(11);

    const nvResult = evaluateFacts(h, ev, undefined, { isVulnerable: false });
    expect(nvResult.facts.get("bridge.isVulnerable")?.value).toBe(false);
    expect(nvResult.facts.size).toBe(11);
  });

  it("does not include bridge.isVulnerable when isVulnerable param is omitted", () => {
    const h = hand("SA", "SK", "S5", "S2", "HQ", "HJ", "H9", "H3", "D6", "D4", "D3", "C8", "C3");
    const ev = evaluateHand(h);
    const result = evaluateFacts(h, ev);
    expect(result.facts.has("bridge.isVulnerable")).toBe(false);
    expect(result.facts.size).toBe(10);
  });
});

describe("relational facts", () => {
  function relationalFactsFor(
    cards: string[],
    relationalContext: RelationalFactContext,
  ) {
    const h = hand(...cards);
    const ev = evaluateHand(h);
    return evaluateFacts(h, ev, undefined, { relationalContext });
  }

  it("bridge.supportForBoundSuit returns heart length when suit=hearts", () => {
    // 4S, 5H, 2D, 2C — binding asks for hearts
    const result = relationalFactsFor(
      ["SA", "SK", "S5", "S2", "HQ", "HJ", "H9", "H7", "H3", "D6", "D4", "C8", "C3"],
      { bindings: { suit: "hearts" } },
    );
    expect(result.facts.get("bridge.supportForBoundSuit")?.value).toBe(5);
  });

  it("bridge.fitWithBoundSuit returns true when own 4 + partner promised 5+ = 9", () => {
    // 4H — we have 4 hearts; partner promised >= 5
    const commitment: PublicConstraint = {
      subject: "partner",
      constraint: {
        factId: "hand.suitLength.hearts",
        operator: "gte",
        value: 5,
      },
      origin: "call-meaning",
      strength: "hard",
      sourceCall: "1H",
      sourceMeaning: "natural:hearts",
    };
    const result = relationalFactsFor(
      ["SA", "SK", "S5", "S2", "HQ", "HJ", "H9", "H3", "D6", "D4", "D3", "C8", "C3"],
      { bindings: { suit: "hearts" }, publicCommitments: [commitment] },
    );
    // Own 4 + partner min 5 = 9 >= 8 → fit
    expect(result.facts.get("bridge.fitWithBoundSuit")?.value).toBe(true);
  });

  it("bridge.shortageInSuit returns true for singleton club", () => {
    // 4S, 4H, 4D, 1C — singleton club
    const result = relationalFactsFor(
      ["SA", "SK", "S5", "S2", "HQ", "HJ", "H9", "H3", "D8", "D6", "D4", "D3", "C3"],
      { bindings: { suit: "clubs" } },
    );
    expect(result.facts.get("bridge.shortageInSuit")?.value).toBe(true);
  });

  it("bridge.totalPointsForRaise computes HCP + shortage points", () => {
    // Hand: SA SK S5 S2 HQ HJ H9 H3 D8 D6 D4 C8 C3
    // 4S, 4H, 3D, 2C — HCP = 10 (A+K spades=7, Q+J hearts=3)
    // Raising hearts: shortage points for non-trump suits:
    //   spades=4 (no shortage=0), diamonds=3 (no shortage=0), clubs=2 (doubleton=1)
    // Total = 10 + 1 = 11
    const result = relationalFactsFor(
      ["SA", "SK", "S5", "S2", "HQ", "HJ", "H9", "H3", "D8", "D6", "D4", "C8", "C3"],
      { bindings: { suit: "hearts" } },
    );
    expect(result.facts.get("bridge.totalPointsForRaise")?.value).toBe(11);
  });

  it("without bindings, relational facts evaluate to safe defaults (fail-closed)", () => {
    // No bindings at all
    const result = relationalFactsFor(
      ["SA", "SK", "S5", "S2", "HQ", "HJ", "H9", "H3", "D8", "D6", "D4", "C8", "C3"],
      {},
    );
    expect(result.facts.get("bridge.supportForBoundSuit")?.value).toBe(0);
    expect(result.facts.get("bridge.fitWithBoundSuit")?.value).toBe(false);
    expect(result.facts.get("bridge.shortageInSuit")?.value).toBe(false);
    expect(result.facts.get("bridge.totalPointsForRaise")?.value).toBe(0);
  });

  it("standard facts unaffected by relational context (backward compat)", () => {
    // Same hand with and without relational context should produce identical standard facts
    const cards = ["SA", "SK", "S5", "S2", "HQ", "HJ", "H9", "H3", "D8", "D6", "D4", "C8", "C3"];
    const h = hand(...cards);
    const ev = evaluateHand(h);

    const withoutRelational = evaluateFacts(h, ev);
    const withRelational = evaluateFacts(h, ev, undefined, { relationalContext: { bindings: { suit: "hearts" } } });

    // Standard facts should be identical
    expect(withoutRelational.facts.get("hand.hcp")?.value).toBe(
      withRelational.facts.get("hand.hcp")?.value,
    );
    expect(withoutRelational.facts.get("bridge.hasFourCardMajor")?.value).toBe(
      withRelational.facts.get("bridge.hasFourCardMajor")?.value,
    );
    // But relational facts only present in the relational version
    expect(withoutRelational.facts.has("bridge.supportForBoundSuit")).toBe(false);
    expect(withRelational.facts.has("bridge.supportForBoundSuit")).toBe(true);
  });
});
