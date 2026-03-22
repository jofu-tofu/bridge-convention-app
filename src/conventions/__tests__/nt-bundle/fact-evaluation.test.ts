/**
 * NT-bundle-specific fact evaluation tests.
 * Moved from pipeline/__tests__/fact-evaluator.test.ts to separate
 * convention-specific tests from core infrastructure tests.
 */
import { describe, it, expect } from "vitest";
import { hand } from "../../../engine/__tests__/fixtures";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { evaluateFacts } from "../../pipeline/fact-evaluator";
import { createSharedFactCatalog } from "../../pipeline/shared-fact-catalog";
import { createFactCatalog } from "../../../core/contracts/fact-catalog";
import { createStaymanFacts } from "../../definitions/modules/stayman";
import { createTransferFacts } from "../../definitions/modules/jacoby-transfers";
import { createSystemFactCatalog } from "../../pipeline/system-fact-catalog";
import { SAYC_SYSTEM_CONFIG } from "../../../core/contracts/system-config";

const staymanFacts = createStaymanFacts(SAYC_SYSTEM_CONFIG);
const transferFacts = createTransferFacts(SAYC_SYSTEM_CONFIG);

/** Create a full catalog with shared + system + module facts. */
function fullCatalog() {
  const systemFacts = createSystemFactCatalog(SAYC_SYSTEM_CONFIG);
  return createFactCatalog(createSharedFactCatalog(), systemFacts, staymanFacts, transferFacts);
}

function factsFor(...notations: string[]) {
  const h = hand(...notations);
  const ev = evaluateHand(h);
  return evaluateFacts(h, ev, fullCatalog());
}

function val(result: ReturnType<typeof factsFor>, id: string) {
  return result.facts.get(id)?.value;
}

describe("NT bundle fact evaluation", () => {
  it("evaluates all facts with full catalog (shared + system + module extensions)", () => {
    const result = factsFor(
      "SA", "SK", "S5", "S2",
      "HQ", "HJ", "H9", "H3",
      "D8", "D6", "D4",
      "C7", "C3",
    );
    expect(result.facts.size).toBe(26);
    expect(result.world).toBe("acting-hand");
  });

  it("10 HCP, 4S 4H → stayman eligible, transfer ineligible", () => {
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

  it("value brackets: invite 8-9, game 10+, slam 15+", () => {
    // 7 HCP — below invite
    const low = factsFor(
      "SA", "S5", "S4", "S2",
      "HQ", "H9", "H7", "H3",
      "D6", "D4", "D3",
      "C8", "C3",
    );
    expect(val(low, "system.responder.inviteValues")).toBe(false);
    expect(val(low, "system.responder.gameValues")).toBe(false);
    expect(val(low, "system.responder.slamValues")).toBe(false);

    // 9 HCP — invite
    const invite = factsFor(
      "SA", "SK", "S5", "S2",
      "HQ", "H9", "H7", "H3",
      "D6", "D4", "D3",
      "C8", "C3",
    );
    expect(val(invite, "system.responder.inviteValues")).toBe(true);
    expect(val(invite, "system.responder.gameValues")).toBe(false);

    // 10 HCP — game
    const game = factsFor(
      "SA", "SK", "S5", "S2",
      "HQ", "HJ", "H9", "H3",
      "D6", "D4", "D3",
      "C8", "C3",
    );
    expect(val(game, "system.responder.inviteValues")).toBe(false);
    expect(val(game, "system.responder.gameValues")).toBe(true);
    expect(val(game, "system.responder.slamValues")).toBe(false);

    // 15 HCP — slam
    const slam = factsFor(
      "SA", "SK", "SQ", "S2",
      "HA", "HK", "H9", "H3",
      "D6", "D4", "D3",
      "C8", "C3",
    );
    expect(val(slam, "system.responder.slamValues")).toBe(true);
    expect(val(slam, "system.responder.gameValues")).toBe(true);
  });

  it("respects dependency order — module facts computed after bridge-derived", () => {
    const result = factsFor(
      "SA", "SK", "S5", "S4", "S2",
      "HQ", "HJ", "H9", "H3",
      "D6", "D4",
      "C8", "C3",
    );
    expect(val(result, "module.stayman.eligible")).toBe(true);
    expect(val(result, "module.transfer.eligible")).toBe(true);
    expect(val(result, "module.transfer.preferred")).toBe(true);
  });

  it("accepts a FactCatalog object", () => {
    const h = hand("SA", "SK", "S5", "S2", "HQ", "HJ", "H9", "H3", "D6", "D4", "D3", "C8", "C3");
    const ev = evaluateHand(h);
    const catalog = fullCatalog();
    const result = evaluateFacts(h, ev, catalog);
    expect(result.facts.size).toBe(26);
    expect(result.facts.has("module.stayman.eligible")).toBe(true);
  });
});
