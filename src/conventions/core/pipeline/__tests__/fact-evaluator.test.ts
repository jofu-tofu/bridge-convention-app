import { describe, it, expect } from "vitest";
import { hand } from "../../../../engine/__tests__/fixtures";
import { evaluateHand } from "../../../../engine/hand-evaluator";
import { evaluateFacts, createSharedFactCatalog } from "../fact-evaluator";
import { SHARED_FACTS, createFactCatalog } from "../../../../core/contracts/fact-catalog";
import type { PublicConstraint } from "../../../../core/contracts/agreement-module";
import type { RelationalFactContext } from "../fact-evaluator";
import { staymanFacts, transferFacts, ntResponseFacts } from "../../../definitions/nt-bundle/facts";

/** Create a full catalog with shared + module facts (reproduces SHARED_FACTS behavior). */
function fullCatalog() {
  return createFactCatalog(createSharedFactCatalog(), staymanFacts, transferFacts, ntResponseFacts);
}

function factsFor(...notations: string[]) {
  const h = hand(...notations);
  const ev = evaluateHand(h);
  return evaluateFacts(h, ev, fullCatalog());
}

function val(result: ReturnType<typeof factsFor>, id: string) {
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

  it("evaluates all 18 facts with full catalog (shared + module extensions)", () => {
    const result = factsFor(
      "SA", "SK", "S5", "S2",
      "HQ", "HJ", "H9", "H3",
      "D8", "D6", "D4",
      "C7", "C3",
    );
    expect(result.facts.size).toBe(18);
    expect(result.world).toBe("acting-hand");
  });

  it("10 HCP, 4S 4H → stayman eligible, transfer ineligible", () => {
    // 4S, 4H, 3D, 2C — 10 HCP (AK spades = 7, QJ hearts = 3)
    const result = factsFor(
      "SA", "SK", "S5", "S2",
      "HQ", "HJ", "H9", "H3",
      "D8", "D6", "D4",
      "C7", "C3",
    );
    expect(val(result, "hand.hcp")).toBe(10);
    expect(val(result, "hand.suitLength.spades")).toBe(4);
    expect(val(result, "hand.suitLength.hearts")).toBe(4);
    expect(val(result, "bridge.hasFourCardMajor")).toBe(true);
    expect(val(result, "bridge.hasFiveCardMajor")).toBe(false);
    expect(val(result, "module.stayman.eligible")).toBe(true);
    expect(val(result, "module.stayman.preferred")).toBe(true);
    expect(val(result, "module.transfer.eligible")).toBe(false);
    expect(val(result, "module.transfer.targetSuit")).toBe("none");
  });

  it("9 HCP, 5H 2S → transfer eligible for hearts, stayman eligible but not preferred", () => {
    // 5H, 2S, 3D, 3C — 9 HCP (AK hearts = 7, Q diamonds = 2)
    // 5H counts as 4+ card major, so stayman.eligible is true,
    // but stayman.preferred is false because of the 5-card major.
    const result = factsFor(
      "S5", "S2",
      "HA", "HK", "H9", "H7", "H3",
      "DQ", "D6", "D4",
      "C8", "C5", "C3",
    );
    expect(val(result, "hand.hcp")).toBe(9);
    expect(val(result, "hand.suitLength.hearts")).toBe(5);
    expect(val(result, "hand.suitLength.spades")).toBe(2);
    expect(val(result, "module.transfer.eligible")).toBe(true);
    expect(val(result, "module.transfer.targetSuit")).toBe("hearts");
    expect(val(result, "module.stayman.eligible")).toBe(true);
    expect(val(result, "module.stayman.preferred")).toBe(false);
  });

  it("5H 4S, 10 HCP → both stayman and transfer eligible, target hearts", () => {
    // 5H, 4S, 2D, 2C — 10 HCP
    const result = factsFor(
      "SA", "SK", "S5", "S2",
      "HQ", "HJ", "H9", "H7", "H3",
      "D6", "D4",
      "C8", "C3",
    );
    expect(val(result, "hand.hcp")).toBe(10);
    expect(val(result, "module.stayman.eligible")).toBe(true);
    expect(val(result, "module.stayman.preferred")).toBe(false);
    expect(val(result, "module.transfer.eligible")).toBe(true);
    expect(val(result, "module.transfer.targetSuit")).toBe("hearts");
  });

  it("5-5 majors → transfer target is spades (higher suit first)", () => {
    // 5S, 5H, 2D, 1C — 10 HCP
    const result = factsFor(
      "SA", "SK", "S5", "S4", "S2",
      "HQ", "HJ", "H9", "H7", "H3",
      "D6", "D4",
      "C3",
    );
    expect(val(result, "module.transfer.targetSuit")).toBe("spades");
    expect(val(result, "bridge.majorPattern")).toBe("five-five");
  });

  it("8 HCP, no major (3-3-3-4) → stayman ineligible, no four-card major", () => {
    // 3S, 3H, 3D, 4C — 8 HCP (AK clubs = 7, J diamonds = 1)
    const result = factsFor(
      "S5", "S4", "S2",
      "H9", "H7", "H3",
      "DJ", "D6", "D4",
      "CA", "CK", "C8", "C3",
    );
    expect(val(result, "hand.hcp")).toBe(8);
    expect(val(result, "bridge.hasFourCardMajor")).toBe(false);
    expect(val(result, "module.stayman.eligible")).toBe(false);
    expect(val(result, "module.transfer.eligible")).toBe(false);
  });

  it("classifies bridge.majorPattern correctly", () => {
    // none: 3S, 3H
    const none = factsFor(
      "S5", "S4", "S2",
      "H9", "H7", "H3",
      "DJ", "D6", "D4",
      "CA", "CK", "C8", "C3",
    );
    expect(val(none, "bridge.majorPattern")).toBe("none");

    // one-four: 4S, 3H
    const oneFour = factsFor(
      "SA", "SK", "S5", "S2",
      "H9", "H7", "H3",
      "D6", "D4",
      "CQ", "CJ", "C8", "C3",
    );
    expect(val(oneFour, "bridge.majorPattern")).toBe("one-four");

    // both-four: 4S, 4H
    const bothFour = factsFor(
      "SA", "SK", "S5", "S2",
      "HQ", "HJ", "H9", "H3",
      "D6", "D4",
      "C8", "C7", "C3",
    );
    expect(val(bothFour, "bridge.majorPattern")).toBe("both-four");

    // one-five: 5S, 3H
    const oneFive = factsFor(
      "SA", "SK", "S5", "S4", "S2",
      "H9", "H7", "H3",
      "D6", "D4",
      "CQ", "C8", "C3",
    );
    expect(val(oneFive, "bridge.majorPattern")).toBe("one-five");

    // five-four: 5S, 4H
    const fiveFour = factsFor(
      "SA", "SK", "S5", "S4", "S2",
      "HQ", "HJ", "H9", "H3",
      "D6", "D4",
      "C8", "C3",
    );
    expect(val(fiveFour, "bridge.majorPattern")).toBe("five-four");
  });

  it("value brackets: invite 8-9, game 10+, slam 15+", () => {
    // 7 HCP — below invite
    const low = factsFor(
      "SA", "S5", "S4", "S2",
      "HQ", "H9", "H7", "H3",
      "D6", "D4", "D3",
      "C8", "C3",
    );
    expect(val(low, "module.ntResponse.inviteValues")).toBe(false);
    expect(val(low, "module.ntResponse.gameValues")).toBe(false);
    expect(val(low, "module.ntResponse.slamValues")).toBe(false);

    // 9 HCP — invite
    const invite = factsFor(
      "SA", "SK", "S5", "S2",
      "HQ", "H9", "H7", "H3",
      "D6", "D4", "D3",
      "C8", "C3",
    );
    expect(val(invite, "module.ntResponse.inviteValues")).toBe(true);
    expect(val(invite, "module.ntResponse.gameValues")).toBe(false);

    // 10 HCP — game
    const game = factsFor(
      "SA", "SK", "S5", "S2",
      "HQ", "HJ", "H9", "H3",
      "D6", "D4", "D3",
      "C8", "C3",
    );
    expect(val(game, "module.ntResponse.inviteValues")).toBe(false);
    expect(val(game, "module.ntResponse.gameValues")).toBe(true);
    expect(val(game, "module.ntResponse.slamValues")).toBe(false);

    // 15 HCP — slam
    const slam = factsFor(
      "SA", "SK", "SQ", "S2",
      "HA", "HK", "H9", "H3",
      "D6", "D4", "D3",
      "C8", "C3",
    );
    expect(val(slam, "module.ntResponse.slamValues")).toBe(true);
    expect(val(slam, "module.ntResponse.gameValues")).toBe(true);
  });

  it("respects dependency order — module facts computed after bridge-derived", () => {
    // Verify that evaluation succeeds (would throw if order was wrong)
    const result = factsFor(
      "SA", "SK", "S5", "S4", "S2",
      "HQ", "HJ", "H9", "H3",
      "D6", "D4",
      "C8", "C3",
    );
    // Module facts depend on bridge-derived facts
    expect(val(result, "module.stayman.eligible")).toBe(true);
    expect(val(result, "module.transfer.eligible")).toBe(true);
    expect(val(result, "module.transfer.preferred")).toBe(true);
  });

  it("accepts a custom catalog subset (backward compat with FactDefinition[])", () => {
    const h = hand("SA", "SK", "S5", "S2", "HQ", "HJ", "H9", "H3", "D6", "D4", "D3", "C8", "C3");
    const ev = evaluateHand(h);
    const subset = SHARED_FACTS.filter((f) => f.layer === "primitive");
    const result = evaluateFacts(h, ev, subset);
    expect(result.facts.size).toBe(6);
    expect(result.facts.has("bridge.hasFourCardMajor")).toBe(false);
  });

  it("accepts a FactCatalog object", () => {
    const h = hand("SA", "SK", "S5", "S2", "HQ", "HJ", "H9", "H3", "D6", "D4", "D3", "C8", "C3");
    const ev = evaluateHand(h);
    const catalog = fullCatalog();
    const result = evaluateFacts(h, ev, catalog);
    expect(result.facts.size).toBe(18);
    expect(result.facts.has("module.stayman.eligible")).toBe(true);
  });

  it("skips facts with missing evaluators (fail-closed)", () => {
    const h = hand("SA", "SK", "S5", "S2", "HQ", "HJ", "H9", "H3", "D6", "D4", "D3", "C8", "C3");
    const ev = evaluateHand(h);
    // Create a catalog with a definition but no evaluator
    const catalog = createFactCatalog(createSharedFactCatalog(), {
      definitions: [{
        id: "module.test.noEvaluator",
        layer: "module-derived",
        world: "acting-hand",
        description: "Has no evaluator",
        valueType: "boolean",
        derivesFrom: [],
      }],
      evaluators: new Map(),
    });
    const result = evaluateFacts(h, ev, catalog);
    // The 10 standard shared facts evaluate (no relational context), but the new one is skipped
    expect(result.facts.size).toBe(10);
    expect(result.facts.has("module.test.noEvaluator")).toBe(false);
  });
});

describe("relational facts", () => {
  function relationalFactsFor(
    cards: string[],
    relationalContext: RelationalFactContext,
  ) {
    const h = hand(...cards);
    const ev = evaluateHand(h);
    return evaluateFacts(h, ev, undefined, relationalContext);
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
    const withRelational = evaluateFacts(h, ev, undefined, { bindings: { suit: "hearts" } });

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
