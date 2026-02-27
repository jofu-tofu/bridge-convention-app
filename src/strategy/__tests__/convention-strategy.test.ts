import { describe, test, expect } from "vitest";
import { Seat, BidSuit } from "../../engine/types";
import type { ContractBid } from "../../engine/types";
import { staymanConfig } from "../../conventions/definitions/stayman";
import {
  staymanResponder,
  staymanOpener,
  noMajorHand,
  auctionFromBids,
} from "../../conventions/__tests__/fixtures";
import { evaluateHand } from "../../engine/hand-evaluator";
import type { BiddingContext, ConditionResult } from "../../conventions/core/types";
import { conventionToStrategy, extractForkPoint, mapVisitedWithStructure, mapConditionResult } from "../bidding/convention-strategy";
import type { TreePathEntry } from "../../shared/types";
import type { DecisionNode } from "../../conventions/core/rule-tree";
import { decision, bid, fallback } from "../../conventions/core/rule-tree";
import type { PathEntry } from "../../conventions/core/tree-evaluator";

describe("conventionToStrategy", () => {
  test("returns BiddingStrategy with convention-prefixed id and name", () => {
    const strategy = conventionToStrategy(staymanConfig);
    expect(strategy.id).toBe("convention:stayman");
    expect(strategy.name).toBe("Stayman");
  });

  test("suggest returns BidResult for Stayman ask context", () => {
    const strategy = conventionToStrategy(staymanConfig);
    const h = staymanResponder();
    const auction = auctionFromBids(Seat.North, ["1NT", "P"]);
    const context: BiddingContext = {
      hand: h,
      auction,
      seat: Seat.South,
      evaluation: evaluateHand(h),
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("bid");
    const bid = result!.call as ContractBid;
    expect(bid.level).toBe(2);
    expect(bid.strain).toBe(BidSuit.Clubs);
    expect(result!.ruleName).toBe("stayman-ask");
    expect(result!.explanation).toBeTruthy();
  });

  test("suggest returns null when no rule matches", () => {
    const strategy = conventionToStrategy(staymanConfig);
    const h = noMajorHand();
    const auction = auctionFromBids(Seat.North, ["1NT", "P"]);
    const context: BiddingContext = {
      hand: h,
      auction,
      seat: Seat.South,
      evaluation: evaluateHand(h),
    };

    const result = strategy.suggest(context);
    expect(result).toBeNull();
  });

  test("suggest includes treePath with forkPoint when tree matches", () => {
    const strategy = conventionToStrategy(staymanConfig);
    const h = staymanResponder();
    const auction = auctionFromBids(Seat.North, ["1NT", "P"]);
    const context: BiddingContext = {
      hand: h,
      auction,
      seat: Seat.South,
      evaluation: evaluateHand(h),
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.treePath).toBeDefined();
    expect(result!.treePath!.matchedNodeName).toBe("stayman-ask");
    expect(result!.treePath!.path.length).toBeGreaterThan(0);
    expect(result!.treePath!.visited.length).toBeGreaterThan(0);
    // Every visited entry has depth and parentNodeName
    for (const entry of result!.treePath!.visited) {
      expect(typeof entry.depth).toBe("number");
      expect(entry.depth).toBeGreaterThanOrEqual(0);
    }
  });

  test("suggest includes siblings in treePath for opener response", () => {
    const strategy = conventionToStrategy(staymanConfig);
    const opener = staymanOpener();
    const auction = auctionFromBids(Seat.North, ["1NT", "P", "2C", "P"]);
    const context: BiddingContext = {
      hand: opener,
      auction,
      seat: Seat.North,
      evaluation: evaluateHand(opener),
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.treePath).toBeDefined();
    expect(result!.treePath!.siblings).toBeDefined();
    expect(result!.treePath!.siblings!.length).toBeGreaterThan(0);

    // Each sibling has valid shape
    for (const sibling of result!.treePath!.siblings!) {
      expect(sibling.bidName).toBeTruthy();
      expect(sibling.meaning).toBeTruthy();
      expect(sibling.call).toBeDefined();
      expect(Array.isArray(sibling.failedConditions)).toBe(true);
    }
  });

  test("suggest preserves rule metadata from evaluateBiddingRules", () => {
    const strategy = conventionToStrategy(staymanConfig);
    const opener = staymanOpener();
    const auction = auctionFromBids(Seat.North, ["1NT", "P", "2C", "P"]);
    const context: BiddingContext = {
      hand: opener,
      auction,
      seat: Seat.North,
      evaluation: evaluateHand(opener),
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.ruleName).toBe("stayman-response-hearts");
    expect(result!.explanation).toContain("heart");
  });
});

describe("extractForkPoint", () => {
  function entry(
    nodeName: string,
    passed: boolean,
    parentNodeName: string | null,
    depth = 0,
  ): TreePathEntry {
    return { nodeName, passed, description: `${nodeName} desc`, depth, parentNodeName };
  }

  test("finds last adjacent pass/fail pair with same parent", () => {
    const entries: TreePathEntry[] = [
      entry("a", true, null, 0),
      entry("b", true, "a", 1),
      entry("c", false, "b", 2),   // rejected sibling
      entry("d", true, "b", 2),    // matched sibling
    ];
    const fork = extractForkPoint(entries);
    expect(fork).toBeDefined();
    expect(fork!.matched.nodeName).toBe("d");
    expect(fork!.rejected.nodeName).toBe("c");
  });

  test("returns undefined when all entries pass", () => {
    const entries: TreePathEntry[] = [
      entry("a", true, null, 0),
      entry("b", true, "a", 1),
    ];
    expect(extractForkPoint(entries)).toBeUndefined();
  });

  test("returns undefined for empty array", () => {
    expect(extractForkPoint([])).toBeUndefined();
  });

  test("ignores adjacent pass/fail from different parents", () => {
    const entries: TreePathEntry[] = [
      entry("a", true, null, 0),
      entry("b", false, "a", 1),  // parent is "a"
      entry("c", true, "x", 1),   // parent is "x" — different parent, not siblings
    ];
    // Only a/b are adjacent with different pass values, and they share parent null/a
    // b has parent "a", c has parent "x" — not siblings
    const fork = extractForkPoint(entries);
    // a(true, null) and b(false, "a") — different parents, not siblings
    expect(fork).toBeUndefined();
  });
});

// ─── Task 2: bestBranch marking when all branches fail ──────

describe("mapConditionResult — bestBranch marking", () => {
  function makeCond(name: string) {
    return { name, label: name, category: "hand" as const, test: () => false, describe: () => "desc" };
  }

  test("no branch marked as best when all branches have 0 passing conditions", () => {
    const cr: ConditionResult = {
      condition: makeCond("or-test"),
      passed: false,
      description: "all branches fail",
      branches: [
        {
          passed: false,
          results: [
            { condition: makeCond("c1"), passed: false, description: "c1 fail" },
          ],
        },
        {
          passed: false,
          results: [
            { condition: makeCond("c2"), passed: false, description: "c2 fail" },
          ],
        },
      ],
    };

    const detail = mapConditionResult(cr);
    // When all branches score 0, no branch should be marked as best
    for (const child of detail.children ?? []) {
      expect(child.isBestBranch).toBe(false);
    }
  });

  test("best branch marked correctly when one branch has passing conditions", () => {
    const cr: ConditionResult = {
      condition: makeCond("or-test"),
      passed: true,
      description: "one branch passes",
      branches: [
        {
          passed: false,
          results: [
            { condition: makeCond("c1"), passed: false, description: "c1 fail" },
          ],
        },
        {
          passed: true,
          results: [
            { condition: makeCond("c2"), passed: true, description: "c2 pass" },
          ],
        },
      ],
    };

    const detail = mapConditionResult(cr);
    expect(detail.children![0]!.isBestBranch).toBe(false);
    expect(detail.children![1]!.isBestBranch).toBe(true);
  });
});

// ─── Task 3: buildNodeInfo duplicate name handling ──────────

describe("mapVisitedWithStructure — duplicate DecisionNode names", () => {
  const alwaysTrue = { name: "always", label: "always", category: "hand" as const, test: () => true, describe: () => "yes" };
  const alwaysFalse = { name: "never", label: "never", category: "hand" as const, test: () => false, describe: () => "no" };

  test("two DecisionNodes sharing the same name get correct depth and parent info", () => {
    // Build tree with duplicate "check-suit" names at different depths:
    //   root (depth 0)
    //     YES -> middle (depth 1)
    //              YES -> "check-suit" at depth 2, parent "middle"
    //              NO  -> fallback
    //     NO  -> "check-suit" at depth 1, parent "root"
    //
    // DFS visits YES branch first: root -> middle -> checkSuitDeep (depth 2, parent "middle")
    // Then NO branch: checkSuitShallow (depth 1, parent "root")
    //
    // With name-keyed map, checkSuitShallow (visited second in DFS) overwrites checkSuitDeep.
    // If visited entries reference checkSuitDeep, lookup by name returns depth=1/parent="root"
    // instead of depth=2/parent="middle".
    const checkSuitDeep: DecisionNode = decision(
      "check-suit", alwaysTrue,
      bid("bid-deep", "Test: bid-deep", () => ({ type: "pass" as const })),
      fallback("no match"),
    );
    const middle: DecisionNode = decision(
      "middle", alwaysTrue,
      checkSuitDeep,
      fallback("no match"),
    );
    const checkSuitShallow: DecisionNode = decision(
      "check-suit", alwaysFalse,
      bid("bid-shallow", "Test: bid-shallow", () => ({ type: "pass" as const })),
      fallback("no match"),
    );
    const root: DecisionNode = decision(
      "root", alwaysTrue,
      middle,
      checkSuitShallow,
    );

    // Simulate visited: root(pass) -> middle(pass) -> checkSuitDeep(pass)
    // This is the YES path through the tree
    const visited: PathEntry[] = [
      { node: root, passed: true, description: "root passed" },
      { node: middle, passed: true, description: "middle passed" },
      { node: checkSuitDeep, passed: true, description: "check-suit passed" },
    ];

    const result = mapVisitedWithStructure(visited, root);

    // root: depth 0, parent null
    expect(result[0]!.depth).toBe(0);
    expect(result[0]!.parentNodeName).toBeNull();

    // middle: depth 1, parent "root"
    expect(result[1]!.depth).toBe(1);
    expect(result[1]!.parentNodeName).toBe("root");

    // checkSuitDeep: should be depth 2, parent "middle"
    // Bug: name-keyed map overwrites with checkSuitShallow (depth 1, parent "root")
    expect(result[2]!.depth).toBe(2);
    expect(result[2]!.parentNodeName).toBe("middle");
  });
});
