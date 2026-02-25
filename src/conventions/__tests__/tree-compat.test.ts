import { describe, it, expect } from "vitest";
import { BidSuit } from "../../engine/types";
import { decision, bid, fallback } from "../rule-tree";
import { evaluateTree } from "../tree-evaluator";
import { flattenTree, treeResultToBiddingRuleResult } from "../tree-compat";
import {
  alwaysTrue as condTrue,
  alwaysFalse as condFalse,
  staticBid,
  makeMinimalContext as makeCtx,
} from "./tree-test-helpers";

// ─── flattenTree ─────────────────────────────────────────────

describe("flattenTree", () => {
  it("flattens a simple decision tree into rules", () => {
    const tree = decision(
      "check-a",
      condTrue("a"),
      bid("bid-yes", () => ({ type: "bid", level: 1, strain: BidSuit.Clubs })),
      bid("bid-no", () => ({ type: "bid", level: 1, strain: BidSuit.Diamonds })),
    );

    const rules = flattenTree(tree);

    expect(rules).toHaveLength(2);
    expect(rules[0]!.name).toBe("bid-yes");
    expect(rules[1]!.name).toBe("bid-no");
  });

  it("returns empty array for all-fallback tree", () => {
    const tree = decision(
      "check-a",
      condFalse("a"),
      fallback("yes dead end"),
      fallback("no dead end"),
    );

    const rules = flattenTree(tree);
    expect(rules).toHaveLength(0);
  });

  it("returns single rule for BidNode root", () => {
    const tree = bid("direct", () => ({ type: "bid", level: 1, strain: BidSuit.NoTrump }));

    const rules = flattenTree(tree);

    expect(rules).toHaveLength(1);
    expect(rules[0]!.name).toBe("direct");
  });

  it("returns empty array for FallbackNode root", () => {
    const rules = flattenTree(fallback());
    expect(rules).toHaveLength(0);
  });

  it("accumulates conditions along path", () => {
    const tree = decision(
      "outer",
      condTrue("a"),
      decision(
        "inner",
        condTrue("b"),
        bid("deep-bid", () => ({ type: "bid", level: 2, strain: BidSuit.Hearts })),
        fallback(),
      ),
      fallback(),
    );

    const rules = flattenTree(tree);

    // One rule from yes-yes path
    expect(rules).toHaveLength(1);
    expect(rules[0]!.name).toBe("deep-bid");
    // Should have 2 hand conditions (a + b)
    expect(rules[0]!.handConditions).toHaveLength(2);
  });

  it("negated condition inverts the test result", () => {
    const tree = decision(
      "check",
      condTrue("a"),
      fallback("yes dead end"),
      bid("no-bid", () => ({ type: "bid", level: 1, strain: BidSuit.Diamonds })),
    );

    const rules = flattenTree(tree);
    const noRule = rules.find((r) => r.name === "no-bid");
    expect(noRule).toBeDefined();
    // The negated "always true" condition should test as false
    const ctx = makeCtx();
    expect(noRule!.handConditions[0]!.test(ctx)).toBe(false);
    expect(noRule!.handConditions[0]!.name).toBe("not-a");
  });
});


// ─── treeResultToBiddingRuleResult ───────────────────────────

describe("treeResultToBiddingRuleResult", () => {
  it("returns null when no match", () => {
    const ctx = makeCtx();
    const result = treeResultToBiddingRuleResult(
      { matched: null, path: [], rejectedDecisions: [], visited: [] },
      ctx,
    );
    expect(result).toBeNull();
  });

  it("maps matched BidNode to BiddingRuleResult", () => {
    const tree = decision(
      "check-a",
      condTrue("a"),
      bid("the-bid", () => ({ type: "bid", level: 3, strain: BidSuit.NoTrump })),
      fallback(),
    );

    const ctx = makeCtx();
    const treeResult = evaluateTree(tree, ctx);
    const bridgeResult = treeResultToBiddingRuleResult(treeResult, ctx);

    expect(bridgeResult).not.toBeNull();
    expect(bridgeResult!.rule).toBe("the-bid");
    expect(bridgeResult!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.NoTrump });
    expect(bridgeResult!.conditionResults).toHaveLength(1);
    expect(bridgeResult!.conditionResults![0]!.passed).toBe(true);
    expect(bridgeResult!.explanation).toContain("✓");
  });

  it("includes rejected decisions with ✗ in explanation", () => {
    // A passes → B fails → C passes → bid
    const tree = decision(
      "A",
      condTrue("a"),
      decision(
        "B",
        condFalse("b"),
        fallback(),
        decision(
          "C",
          condTrue("c"),
          bid("target", () => ({ type: "bid", level: 1, strain: BidSuit.Clubs })),
          fallback(),
        ),
      ),
      fallback(),
    );

    const ctx = makeCtx();
    const treeResult = evaluateTree(tree, ctx);
    const bridgeResult = treeResultToBiddingRuleResult(treeResult, ctx);

    expect(bridgeResult).not.toBeNull();
    expect(bridgeResult!.conditionResults).toHaveLength(3);
    expect(bridgeResult!.explanation).toContain("✓ a passed");
    expect(bridgeResult!.explanation).toContain("✗ b failed");
    expect(bridgeResult!.explanation).toContain("✓ c passed");
  });

  it("produces empty explanation for bare BidNode root", () => {
    const tree = staticBid("direct", 1, BidSuit.NoTrump);

    const ctx = makeCtx();
    const treeResult = evaluateTree(tree, ctx);
    const bridgeResult = treeResultToBiddingRuleResult(treeResult, ctx);

    expect(bridgeResult).not.toBeNull();
    expect(bridgeResult!.explanation).toBe("");
    expect(bridgeResult!.conditionResults).toHaveLength(0);
  });

  it("forwards context to call function", () => {
    // Call function that reads ctx to pick strain
    const tree = bid("ctx-bid", (ctx) => ({
      type: "bid" as const,
      level: 1 as const,
      strain: ctx.hand.cards.length > 10 ? BidSuit.NoTrump : BidSuit.Clubs,
    }));

    const ctx = makeCtx(); // 13 cards
    const treeResult = evaluateTree(tree, ctx);
    const bridgeResult = treeResultToBiddingRuleResult(treeResult, ctx);

    expect(bridgeResult).not.toBeNull();
    expect(bridgeResult!.call).toEqual({ type: "bid", level: 1, strain: BidSuit.NoTrump });
  });
});
