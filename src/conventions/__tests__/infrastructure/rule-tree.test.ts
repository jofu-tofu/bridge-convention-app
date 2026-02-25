import { describe, it, expect } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { decision, bid, fallback } from "../../rule-tree";
import type { RuleNode } from "../../rule-tree";
import { evaluateTree, evaluateTreeFast } from "../../tree-evaluator";
import { hand } from "../../../engine/__tests__/fixtures";
import { buildAuction } from "../../../engine/auction-helpers";
import { hcpMin, anySuitMin, isResponder } from "../../conditions";
import { createBiddingContext } from "../../context-factory";
import type { RuleCondition } from "../../types";
import { alwaysTrue, alwaysFalse, staticBid, makeMinimalContext } from "../tree-test-helpers";

// ─── Basic tree evaluation ───────────────────────────────────

describe("evaluateTree", () => {
  it("matches through a passing decision chain", () => {
    const tree = decision(
      "check-a",
      alwaysTrue("a"),
      decision(
        "check-b",
        alwaysTrue("b"),
        staticBid("bid-1c", 1, BidSuit.Clubs),
        fallback(),
      ),
      fallback(),
    );

    const ctx = makeMinimalContext();
    const result = evaluateTree(tree, ctx);

    expect(result.matched).not.toBeNull();
    expect(result.matched!.name).toBe("bid-1c");
    expect(result.path).toHaveLength(2);
    expect(result.path[0]!.passed).toBe(true);
    expect(result.path[0]!.description).toBe("a passed");
    expect(result.path[1]!.passed).toBe(true);
    expect(result.rejectedDecisions).toHaveLength(0);
    expect(result.visited).toHaveLength(2);
  });

  it("follows no-branch when condition fails", () => {
    const tree = decision(
      "check-a",
      alwaysFalse("a"),
      staticBid("yes-bid", 1, BidSuit.Clubs),
      staticBid("no-bid", 1, BidSuit.Diamonds),
    );

    const ctx = makeMinimalContext();
    const result = evaluateTree(tree, ctx);

    expect(result.matched!.name).toBe("no-bid");
    expect(result.path).toHaveLength(0);
    expect(result.rejectedDecisions).toHaveLength(1);
    expect(result.rejectedDecisions[0]!.passed).toBe(false);
    expect(result.rejectedDecisions[0]!.description).toBe("a failed");
    expect(result.visited).toHaveLength(1);
  });

  it("returns null matched for all-fallback tree", () => {
    const tree = decision(
      "check-a",
      alwaysFalse("a"),
      fallback("yes dead end"),
      decision(
        "check-b",
        alwaysFalse("b"),
        fallback("b-yes dead end"),
        fallback("b-no dead end"),
      ),
    );

    const ctx = makeMinimalContext();
    const result = evaluateTree(tree, ctx);

    expect(result.matched).toBeNull();
    expect(result.rejectedDecisions).toHaveLength(2);
    expect(result.visited).toHaveLength(2);
  });

  it("matches single BidNode root immediately", () => {
    const tree = staticBid("direct-bid", 1, BidSuit.NoTrump);

    const ctx = makeMinimalContext();
    const result = evaluateTree(tree, ctx);

    expect(result.matched!.name).toBe("direct-bid");
    expect(result.path).toHaveLength(0);
    expect(result.rejectedDecisions).toHaveLength(0);
    expect(result.visited).toHaveLength(0);
  });

  it("returns null for FallbackNode root", () => {
    const tree = fallback("nothing applies");

    const ctx = makeMinimalContext();
    const result = evaluateTree(tree, ctx);

    expect(result.matched).toBeNull();
  });

  it("tracks path length matching tree depth", () => {
    // Build a 5-level deep tree where all conditions pass
    let node: RuleNode = staticBid("deep-bid", 7, BidSuit.NoTrump);
    for (let i = 4; i >= 0; i--) {
      node = decision(`level-${i}`, alwaysTrue(`cond-${i}`), node, fallback());
    }

    const ctx = makeMinimalContext();
    const result = evaluateTree(node, ctx);

    expect(result.matched!.name).toBe("deep-bid");
    expect(result.path).toHaveLength(5);
    expect(result.path.map((p) => p.node.name)).toEqual([
      "level-0",
      "level-1",
      "level-2",
      "level-3",
      "level-4",
    ]);
    expect(result.visited).toHaveLength(5);
  });

  it("collects rejectedDecisions from root when root condition fails", () => {
    const tree = decision(
      "root-check",
      alwaysFalse("root"),
      staticBid("unreachable", 1, BidSuit.Clubs),
      fallback("root failed"),
    );

    const ctx = makeMinimalContext();
    const result = evaluateTree(tree, ctx);

    expect(result.matched).toBeNull();
    expect(result.rejectedDecisions).toHaveLength(1);
    expect(result.rejectedDecisions[0]!.node.name).toBe("root-check");
  });

  it("visited preserves traversal order for mixed pass/reject", () => {
    // A passes → B fails (no-branch) → C passes → bid
    const tree = decision(
      "A",
      alwaysTrue("a"),
      decision(
        "B",
        alwaysFalse("b"),
        fallback(),
        decision(
          "C",
          alwaysTrue("c"),
          staticBid("target", 1, BidSuit.Clubs),
          fallback(),
        ),
      ),
      fallback(),
    );

    const ctx = makeMinimalContext();
    const result = evaluateTree(tree, ctx);

    expect(result.matched!.name).toBe("target");
    expect(result.visited).toHaveLength(3);
    expect(result.visited.map((v) => ({ name: v.node.name, passed: v.passed }))).toEqual([
      { name: "A", passed: true },
      { name: "B", passed: false },
      { name: "C", passed: true },
    ]);
    expect(result.path).toHaveLength(2); // A and C
    expect(result.rejectedDecisions).toHaveLength(1); // B
  });
});

// ─── Fast/full equivalence ───────────────────────────────────

describe("evaluateTreeFast", () => {
  const trees: [string, RuleNode][] = [
    [
      "passing chain",
      decision(
        "a",
        alwaysTrue("a"),
        decision(
          "b",
          alwaysTrue("b"),
          staticBid("match", 1, BidSuit.Clubs),
          fallback(),
        ),
        fallback(),
      ),
    ],
    ["single bid", staticBid("direct", 2, BidSuit.Hearts)],
    ["fallback root", fallback("nothing")],
    [
      "failing root",
      decision(
        "fail",
        alwaysFalse("x"),
        staticBid("y", 1, BidSuit.Clubs),
        fallback(),
      ),
    ],
    [
      "mixed path",
      decision(
        "a",
        alwaysFalse("a"),
        staticBid("a-yes", 1, BidSuit.Clubs),
        decision(
          "b",
          alwaysTrue("b"),
          staticBid("b-yes", 2, BidSuit.Diamonds),
          fallback(),
        ),
      ),
    ],
  ];

  it.each(trees)(
    "fast matches full for tree: %s",
    (_name, tree) => {
      const ctx = makeMinimalContext();
      const full = evaluateTree(tree, ctx);
      const fast = evaluateTreeFast(tree, ctx);

      if (full.matched === null) {
        expect(fast).toBeNull();
      } else {
        expect(fast).not.toBeNull();
        expect(fast!.name).toBe(full.matched.name);
      }
    },
  );

  it("does not invoke describe() on conditions", () => {
    let describeCallCount = 0;
    const spyCondition: RuleCondition = {
      name: "spy",
      label: "spy",
      test: () => true,
      describe: () => { describeCallCount++; return "spy passed"; },
    };
    const tree = decision("d", spyCondition, staticBid("b", 1, BidSuit.Clubs), fallback());
    evaluateTreeFast(tree, makeMinimalContext());
    expect(describeCallCount).toBe(0);
  });
});

// ─── Negative inference POC (Stayman-like tree) ──────────────

function makeStaymanTree() {
  const hasFourCardMajor: RuleCondition = anySuitMin(
    [
      { index: 0, name: "spades" },
      { index: 1, name: "hearts" },
    ],
    4,
  );

  return decision(
    "is-responder",
    isResponder(),
    decision(
      "has-4-card-major",
      hasFourCardMajor,
      decision(
        "has-enough-hcp",
        hcpMin(8),
        bid("stayman-ask", () => ({ type: "bid", level: 2, strain: BidSuit.Clubs })),
        fallback("too weak"),
      ),
      fallback("no major"),
    ),
    fallback("not responder"),
  );
}

describe("negative inference POC", () => {
  it("rejectedDecisions contains hasMajor condition when hand has no 4-card major", () => {
    const tree = makeStaymanTree();

    // Hand with no 4-card major: 3 spades, 3 hearts, 4 diamonds, 3 clubs, 13 HCP
    const h = hand("SA", "SK", "S5", "HA", "H5", "H2", "DK", "DQ", "D7", "D4", "C5", "C3", "C2");
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const ctx = createBiddingContext({
      hand: h,
      auction,
      seat: Seat.South,
      evaluation: evaluateHand(h),
    });

    const result = evaluateTree(tree, ctx);

    // Should NOT match (no 4-card major)
    expect(result.matched).toBeNull();

    // isResponder passes (path), hasFourCardMajor fails (rejectedDecisions)
    expect(result.path).toHaveLength(1);
    expect(result.path[0]!.node.name).toBe("is-responder");
    expect(result.path[0]!.passed).toBe(true);

    expect(result.rejectedDecisions).toHaveLength(1);
    expect(result.rejectedDecisions[0]!.node.name).toBe("has-4-card-major");
    expect(result.rejectedDecisions[0]!.passed).toBe(false);
  });

  it("matched path includes all passing decisions for a valid Stayman hand", () => {
    const tree = makeStaymanTree();

    // Hand with 4 hearts, 13 HCP
    const h = hand("SK", "S5", "S2", "HA", "HK", "HQ", "H3", "D5", "D3", "D2", "C5", "C3", "C2");
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const ctx = createBiddingContext({
      hand: h,
      auction,
      seat: Seat.South,
      evaluation: evaluateHand(h),
    });

    const result = evaluateTree(tree, ctx);

    expect(result.matched).not.toBeNull();
    expect(result.matched!.name).toBe("stayman-ask");
    expect(result.path).toHaveLength(3);
    expect(result.path.map((p) => p.node.name)).toEqual([
      "is-responder",
      "has-4-card-major",
      "has-enough-hcp",
    ]);
    expect(result.rejectedDecisions).toHaveLength(0);
  });
});
