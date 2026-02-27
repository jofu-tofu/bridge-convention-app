import { describe, it, expect, beforeEach } from "vitest";
import { BidSuit, Seat } from "../../../engine/types";
import { decision, bid, fallback } from "../../core/rule-tree";
import type { TreeConventionConfig } from "../../core/rule-tree";
import { ConventionCategory } from "../../core/types";
import {
  evaluateBiddingRules,
  evaluateAllBiddingRules,
  isTreeConvention,
  clearRegistry,
} from "../../core/registry";
import { buildAuction } from "../../../engine/auction-helpers";
import { alwaysTrue, alwaysFalse, makeMinimalContext } from "../tree-test-helpers";

// ─── Helpers ────────────────────────────────────────────────

beforeEach(() => {
  clearRegistry();
});

function makeTreeConfig(
  ruleTree: import("../../core/rule-tree").RuleNode,
): TreeConventionConfig {
  return {
    id: "test-tree",
    name: "Test Tree Convention",
    description: "Test",
    category: ConventionCategory.Asking,
    dealConstraints: { seats: [] },
    biddingRules: [],
    examples: [],
    ruleTree,
  };
}

// ─── isTreeConvention ────────────────────────────────────────

describe("isTreeConvention", () => {
  it("returns true for a TreeConventionConfig", () => {
    const config = makeTreeConfig(fallback("test"));
    expect(isTreeConvention(config)).toBe(true);
  });

  it("returns false for a plain ConventionConfig", () => {
    const config = {
      id: "flat-test",
      name: "Flat Test",
      description: "Test",
      category: ConventionCategory.Asking,
      dealConstraints: { seats: [] },
      biddingRules: [],
      examples: [],
    };
    expect(isTreeConvention(config)).toBe(false);
  });

  it("returns false when ruleTree is explicitly undefined", () => {
    const config = {
      id: "undef-test",
      name: "Undef Test",
      description: "Test",
      category: ConventionCategory.Asking,
      dealConstraints: { seats: [] },
      biddingRules: [],
      examples: [],
      ruleTree: undefined,
    };
    expect(isTreeConvention(config)).toBe(false);
  });
});

// ─── evaluateBiddingRules tree dispatch ──────────────────────

describe("evaluateBiddingRules tree dispatch", () => {
  it("dispatches to tree evaluator when config has ruleTree", () => {
    const tree = decision(
      "check",
      alwaysTrue("a"),
      bid("tree-bid", "Test: tree-bid", () => ({ type: "bid", level: 1, strain: BidSuit.NoTrump })),
      fallback(),
    );
    const config = makeTreeConfig(tree);
    const ctx = makeMinimalContext();

    const result = evaluateBiddingRules(ctx, config);

    expect(result).not.toBeNull();
    expect(result!.rule).toBe("tree-bid");
    expect(result!.call).toEqual({ type: "bid", level: 1, strain: BidSuit.NoTrump });
  });

  it("returns null when tree reaches fallback", () => {
    const tree = decision(
      "check",
      alwaysFalse("a"),
      bid("unreachable", "Test: unreachable", () => ({ type: "bid", level: 1, strain: BidSuit.Clubs })),
      fallback("nope"),
    );
    const config = makeTreeConfig(tree);
    const ctx = makeMinimalContext();

    const result = evaluateBiddingRules(ctx, config);
    expect(result).toBeNull();
  });

  it("returns null when tree bid is illegal (e.g., insufficient bid)", () => {
    // Tree produces a 1C bid, but auction already has a 1NT — 1C is insufficient
    const tree = bid("low-bid", "Test: low-bid", () => ({ type: "bid", level: 1, strain: BidSuit.Clubs }));
    const config = makeTreeConfig(tree);

    const auction = buildAuction(Seat.North, ["1NT", "P", "P"]);
    const baseCtx = makeMinimalContext();
    const ctx = { ...baseCtx, auction, seat: Seat.West };

    const result = evaluateBiddingRules(ctx, config);
    expect(result).toBeNull();
  });

});

// ─── evaluateAllBiddingRules tree dispatch ───────────────────

describe("evaluateAllBiddingRules tree dispatch", () => {
  it("flattens tree and evaluates all paths", () => {
    const tree = decision(
      "check",
      alwaysTrue("a"),
      bid("yes-bid", "Test: yes-bid", () => ({ type: "bid", level: 2, strain: BidSuit.Hearts })),
      bid("no-bid", "Test: no-bid", () => ({ type: "bid", level: 1, strain: BidSuit.Diamonds })),
    );
    const config = makeTreeConfig(tree);
    const ctx = makeMinimalContext();

    const results = evaluateAllBiddingRules(ctx, config);

    // Two paths: yes (condition passes) and no (negated condition fails)
    expect(results.length).toBe(2);
    expect(results[0]!.ruleName).toBe("yes-bid");
    expect(results[0]!.matched).toBe(true);
    expect(results[0]!.isLegal).toBe(true);
    expect(results[0]!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });

    // Losing path: negated always-true = always-false → no match
    expect(results[1]!.ruleName).toBe("no-bid");
    expect(results[1]!.matched).toBe(false);
    expect(results[1]!.isLegal).toBe(false);
  });
});
