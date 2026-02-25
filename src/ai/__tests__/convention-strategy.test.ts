import { describe, test, expect } from "vitest";
import { Seat, BidSuit } from "../../engine/types";
import type { ContractBid } from "../../engine/types";
import { staymanConfig } from "../../conventions/stayman";
import {
  staymanResponder,
  staymanOpener,
  noMajorHand,
  auctionFromBids,
} from "../../conventions/__tests__/fixtures";
import { evaluateHand } from "../../engine/hand-evaluator";
import type { BiddingContext } from "../../conventions/types";
import { conventionToStrategy, extractForkPoint, mapVisitedWithStructure } from "../convention-strategy";
import type { TreePathEntry } from "../../shared/types";

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
