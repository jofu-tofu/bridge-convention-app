import { describe, test, expect, vi } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import type { RuleCondition } from "../../core/types";
import { decision, fallback } from "../../core/rule-tree";
import type { RuleNode } from "../../core/rule-tree";
import { intentBid } from "../../core/intent/intent-node";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import { findSiblingBids, findCandidateBids } from "../../core/sibling-finder";
import { makeMinimalContext } from "../tree-test-helpers";
import { staymanConfig } from "../../definitions/stayman";
import { bergenConfig } from "../../definitions/bergen-raises";
import { evaluateBiddingRules } from "../../core/registry";
import { evaluateTree } from "../../core/tree-evaluator";
import { createBiddingContext } from "../../core/context-factory";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { hand } from "../../../engine/__tests__/fixtures";
import { auctionFromBids } from "../fixtures";

// ─── Helper factories ────────────────────────────────────────

function auctionCondition(name: string, passes: boolean): RuleCondition {
  return {
    name,
    label: name,
    category: "auction",
    test: () => passes,
    describe: () => `${name} ${passes ? "matched" : "not matched"}`,
  };
}

function handCondition(name: string, passes: boolean): RuleCondition {
  return {
    name,
    label: name,
    category: "hand",
    test: () => passes,
    describe: () => `${name} ${passes ? "passed" : "failed"}`,
  };
}

const makeCall = (level: 1 | 2 | 3 | 4 | 5 | 6 | 7, strain: BidSuit): (() => Call) =>
  () => ({ type: "bid", level, strain });

// ─── Unit tests (synthetic trees) ────────────────────────────

describe("findSiblingBids", () => {
  test("3-way hand split returns 2 siblings with correct failedConditions", () => {
    // auction → hand-hearts? YES→bid-hearts, NO→hand-spades? YES→bid-spades, NO→bid-denial
    const tree: RuleNode = decision(
      "auction-check", auctionCondition("auction", true),
      decision(
        "has-4-hearts", handCondition("has-4-hearts", true),
        intentBid("response-hearts", "Shows 4+ hearts", { type: SemanticIntentType.NaturalBid, params: {} }, makeCall(2, BidSuit.Hearts)),
        decision(
          "has-4-spades", handCondition("has-4-spades", false),
          intentBid("response-spades", "Shows 4+ spades", { type: SemanticIntentType.NaturalBid, params: {} }, makeCall(2, BidSuit.Spades)),
          intentBid("response-denial", "Denies a 4-card major", { type: SemanticIntentType.NaturalBid, params: {} }, makeCall(2, BidSuit.Diamonds)),
        ),
      ),
      fallback("no match"),
    );

    // Use the actual BidNode from the tree
    const ctx = makeMinimalContext();
    const result = evaluateTree(tree, ctx);
    expect(result.matched).not.toBeNull();

    const siblings = findSiblingBids(tree, result.matched!, ctx);
    expect(siblings).toHaveLength(2);

    const spadesSibling = siblings.find(s => s.bidName === "response-spades");
    const denialSibling = siblings.find(s => s.bidName === "response-denial");

    expect(spadesSibling).toBeDefined();
    expect(spadesSibling!.meaning).toBe("Shows 4+ spades");
    // Path to spades: has-4-hearts(NO), has-4-spades(YES)
    // has-4-hearts: actual=true, required=false → MISMATCH → failed
    // has-4-spades: actual=false, required=true → MISMATCH → failed
    expect(spadesSibling!.failedConditions).toHaveLength(2);
    expect(spadesSibling!.failedConditions.map(c => c.name).sort()).toEqual(["has-4-hearts", "has-4-spades"]);

    expect(denialSibling).toBeDefined();
    expect(denialSibling!.meaning).toBe("Denies a 4-card major");
    // Path to denial: has-4-hearts(NO), has-4-spades(NO)
    // has-4-hearts: actual=true, required=false → MISMATCH → failed
    // has-4-spades: actual=false, required=false → MATCH → not failed
    expect(denialSibling!.failedConditions).toHaveLength(1);
    expect(denialSibling!.failedConditions[0]!.name).toBe("has-4-hearts");
  });

  test("matched at first hand decision: full NO-branch subtree explored", () => {
    const tree: RuleNode = decision(
      "auction-check", auctionCondition("auction", true),
      decision(
        "is-strong", handCondition("is-strong", true),
        intentBid("strong-bid", "Shows strong hand", { type: SemanticIntentType.NaturalBid, params: {} }, makeCall(2, BidSuit.Clubs)),
        intentBid("weak-bid", "Shows weak hand", { type: SemanticIntentType.NaturalBid, params: {} }, makeCall(1, BidSuit.Clubs)),
      ),
      fallback("no match"),
    );

    const ctx = makeMinimalContext();
    const result = evaluateTree(tree, ctx);
    expect(result.matched!.name).toBe("strong-bid");

    const siblings = findSiblingBids(tree, result.matched!, ctx);
    expect(siblings).toHaveLength(1);
    expect(siblings[0]!.bidName).toBe("weak-bid");
    expect(siblings[0]!.meaning).toBe("Shows weak hand");
    // Path to weak-bid: is-strong(NO)
    // is-strong: actual=true, required=false → MISMATCH → failed
    // The hand IS strong, so the weak path is blocked by the is-strong condition
    expect(siblings[0]!.failedConditions).toHaveLength(1);
    expect(siblings[0]!.failedConditions[0]!.name).toBe("is-strong");
  });

  test("nested hand decisions: all deep BidNodes found", () => {
    const tree: RuleNode = decision(
      "auction-check", auctionCondition("auction", true),
      decision(
        "check-a", handCondition("check-a", false),
        decision(
          "check-b", handCondition("check-b", false),
          intentBid("bid-ab", "Both A and B", { type: SemanticIntentType.NaturalBid, params: {} }, makeCall(3, BidSuit.Clubs)),
          intentBid("bid-a-not-b", "A but not B", { type: SemanticIntentType.NaturalBid, params: {} }, makeCall(2, BidSuit.Clubs)),
        ),
        decision(
          "check-c", handCondition("check-c", true),
          intentBid("bid-c", "Has C", { type: SemanticIntentType.NaturalBid, params: {} }, makeCall(2, BidSuit.Hearts)),
          intentBid("bid-none", "Default bid", { type: SemanticIntentType.NaturalBid, params: {} }, makeCall(1, BidSuit.Clubs)),
        ),
      ),
      fallback("no match"),
    );

    const ctx = makeMinimalContext();
    const result = evaluateTree(tree, ctx);
    // check-a fails → NO → check-c passes → YES → bid-c matched
    expect(result.matched!.name).toBe("bid-c");

    const siblings = findSiblingBids(tree, result.matched!, ctx);
    // Should find: bid-ab, bid-a-not-b, bid-none (3 siblings)
    expect(siblings).toHaveLength(3);
    const names = siblings.map(s => s.bidName).sort();
    expect(names).toEqual(["bid-a-not-b", "bid-ab", "bid-none"]);

    // bid-ab: path check-a(YES), check-b(YES). Both actual=false, required=true → both failed
    const bidAb = siblings.find(s => s.bidName === "bid-ab")!;
    expect(bidAb.failedConditions).toHaveLength(2);
    expect(bidAb.failedConditions.map(c => c.name).sort()).toEqual(["check-a", "check-b"]);

    // bid-none: path check-a(NO), check-c(NO)
    // check-a: actual=false, required=false → MATCH → not failed
    // check-c: actual=true, required=false → MISMATCH → failed
    const bidNone = siblings.find(s => s.bidName === "bid-none")!;
    expect(bidNone.failedConditions).toHaveLength(1);
    expect(bidNone.failedConditions[0]!.name).toBe("check-c");
  });

  test("no hand conditions (bid directly after auction) returns empty array", () => {
    const tree: RuleNode = decision(
      "auction-check", auctionCondition("auction", true),
      intentBid("direct-bid", "Direct bid", { type: SemanticIntentType.NaturalBid, params: {} }, makeCall(1, BidSuit.Clubs)),
      fallback("no match"),
    );

    const ctx = makeMinimalContext();
    const result = evaluateTree(tree, ctx);
    expect(result.matched!.name).toBe("direct-bid");

    const siblings = findSiblingBids(tree, result.matched!, ctx);
    expect(siblings).toHaveLength(0);
  });

  test("FallbackNode in subtree is excluded from siblings", () => {
    const tree: RuleNode = decision(
      "auction-check", auctionCondition("auction", true),
      decision(
        "check-hand", handCondition("check-hand", true),
        intentBid("good-bid", "Good hand", { type: SemanticIntentType.NaturalBid, params: {} }, makeCall(2, BidSuit.Clubs)),
        fallback("not applicable"),
      ),
      fallback("no match"),
    );

    const ctx = makeMinimalContext();
    const result = evaluateTree(tree, ctx);
    expect(result.matched!.name).toBe("good-bid");

    const siblings = findSiblingBids(tree, result.matched!, ctx);
    expect(siblings).toHaveLength(0);
  });

  test("interleaved auction condition after hand condition throws error", () => {
    const tree: RuleNode = decision(
      "auction-check-1", auctionCondition("auction-1", true),
      decision(
        "hand-check", handCondition("hand-check", true),
        decision(
          "auction-check-2", auctionCondition("auction-2", true),
          intentBid("bad-bid", "Bad structure", { type: SemanticIntentType.NaturalBid, params: {} }, makeCall(1, BidSuit.Clubs)),
          fallback("no match"),
        ),
        fallback("no match"),
      ),
      fallback("no match"),
    );

    const ctx = makeMinimalContext();
    const result = evaluateTree(tree, ctx);
    expect(result.matched!.name).toBe("bad-bid");

    expect(() => findSiblingBids(tree, result.matched!, ctx)).toThrow();
  });

  test("BidNode.call() throwing skips that sibling, others still returned", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const tree: RuleNode = decision(
      "auction-check", auctionCondition("auction", true),
      decision(
        "check-hand", handCondition("check-hand", true),
        intentBid("good-bid", "Good hand", { type: SemanticIntentType.NaturalBid, params: {} }, makeCall(2, BidSuit.Clubs)),
        decision(
          "check-other", handCondition("check-other", false),
          intentBid("error-bid", "Errors out", { type: SemanticIntentType.NaturalBid, params: {} }, () => { throw new Error("boom"); }),
          intentBid("fallback-bid", "Fallback", { type: SemanticIntentType.NaturalBid, params: {} }, makeCall(1, BidSuit.Clubs)),
        ),
      ),
      fallback("no match"),
    );

    const ctx = makeMinimalContext();
    const result = evaluateTree(tree, ctx);
    expect(result.matched!.name).toBe("good-bid");

    const siblings = findSiblingBids(tree, result.matched!, ctx);
    // error-bid skipped, fallback-bid included
    expect(siblings).toHaveLength(1);
    expect(siblings[0]!.bidName).toBe("fallback-bid");
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  test("and()/or() compound conditions treated as hand condition boundary", () => {
    // Compound conditions (and/or) have category "hand"
    const compoundCondition: RuleCondition = {
      name: "compound-check",
      label: "Compound check",
      category: "hand",
      test: () => true,
      describe: () => "compound check passed",
    };

    const tree: RuleNode = decision(
      "auction-check", auctionCondition("auction", true),
      decision(
        "compound-node", compoundCondition,
        intentBid("after-compound", "After compound", { type: SemanticIntentType.NaturalBid, params: {} }, makeCall(2, BidSuit.Clubs)),
        intentBid("not-compound", "Not compound", { type: SemanticIntentType.NaturalBid, params: {} }, makeCall(1, BidSuit.Clubs)),
      ),
      fallback("no match"),
    );

    const ctx = makeMinimalContext();
    const result = evaluateTree(tree, ctx);
    expect(result.matched!.name).toBe("after-compound");

    // compound-node is treated as hand condition (category undefined), so subtree root starts there
    const siblings = findSiblingBids(tree, result.matched!, ctx);
    expect(siblings).toHaveLength(1);
    expect(siblings[0]!.bidName).toBe("not-compound");
  });
});

// ─── Integration tests (real convention trees) ───────────────

describe("findSiblingBids — integration with real conventions", () => {
  test("Stayman round 2 opener response has expected sibling names", () => {
    // Opener with 4 hearts — should match stayman-response-hearts
    // Siblings: stayman-response-spades, stayman-response-denial
    const h = hand("HA", "HK", "HQ", "H5", "SA", "SK", "S3", "DA", "DK", "D5", "CA", "C5", "C2");
    const auction = auctionFromBids(Seat.North, ["1NT", "P", "2C", "P"]);
    const ctx = createBiddingContext({
      hand: h,
      auction,
      seat: Seat.North,
      evaluation: evaluateHand(h),
    });

    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-response-hearts");

    // findSiblingBids works on the hand subtree
    const handRoot = result!.treeRoot!;
    const siblings = findSiblingBids(handRoot, result!.treeEvalResult!.matched!, ctx);
    expect(siblings.length).toBeGreaterThan(0);
    const siblingNames = siblings.map(s => s.bidName);
    expect(siblingNames).toContain("stayman-response-spades");
    expect(siblingNames).toContain("stayman-response-denial");
    // Every sibling should have valid shape
    for (const s of siblings) {
      expect(s.meaning).toBeTruthy();
      expect(s.call).toBeDefined();
      expect(s.call.type).toBe("bid");
    }
  });

  test("Bergen Raises responder has expected alternative bid names", () => {
    // Responder with constructive raise hand: 7-10 HCP, 3+ card major support
    // After 1H opening
    const h = hand("SA", "S5", "S3", "HA", "H9", "H7", "DA", "D8", "D5", "D3", "C9", "C5", "C2");
    const auction = auctionFromBids(Seat.North, ["1H", "P"]);
    const ctx = createBiddingContext({
      hand: h,
      auction,
      seat: Seat.South,
      evaluation: evaluateHand(h),
    });

    const result = evaluateBiddingRules(ctx, bergenConfig);
    // Should match some Bergen response
    if (result) {
      const handRoot = result.treeRoot!;
      const matched = result.treeEvalResult!.matched!;
      const siblings = findSiblingBids(handRoot, matched, ctx);
      // Structural assertion: siblings exist and have valid shape
      for (const s of siblings) {
        expect(s.bidName).toBeTruthy();
        expect(s.meaning).toBeTruthy();
        expect(s.call).toBeDefined();
        expect(Array.isArray(s.failedConditions)).toBe(true);
      }
    }
  });
});

// ─── Duplicate name keying fix ─────────────────────────────────

describe("findCandidateBids — duplicate IntentNode names", () => {
  test("three IntentNodes sharing a name: all non-matched siblings get correct metadata", () => {
    // Three IntentNodes share name "raise-to-game" but differ in nodeId/params.
    // With name-based keying, later entries overwrite earlier ones in the Map,
    // so sibling lookup returns wrong intent metadata for earlier entries.
    const tree: RuleNode = decision(
      "auction-check", auctionCondition("auction", true),
      decision(
        "check-a", handCondition("check-a", false),
        decision(
          "check-b", handCondition("check-b", false),
          // Matched: check-a YES → check-b YES → hearts (but both fail, so not matched)
          intentBid("raise-to-game", "Raises to hearts game", { type: SemanticIntentType.RaiseToGame, params: { suit: "hearts" } }, makeCall(4, BidSuit.Hearts)),
          // check-a YES → check-b NO → spades
          intentBid("raise-to-game", "Raises to spades game", { type: SemanticIntentType.RaiseToGame, params: { suit: "spades" } }, makeCall(4, BidSuit.Spades)),
        ),
        decision(
          "check-c", handCondition("check-c", true),
          // check-a NO → check-c YES → diamonds (this is the matched node)
          intentBid("raise-to-game", "Raises to diamond game", { type: SemanticIntentType.RaiseToGame, params: { suit: "diamonds" } }, makeCall(5, BidSuit.Diamonds)),
          fallback("no match inner"),
        ),
      ),
      fallback("no match"),
    );

    const ctx = makeMinimalContext();
    const result = evaluateTree(tree, ctx);
    // check-a(false) → NO → check-c(true) → YES → diamonds matched
    expect(result.matched).not.toBeNull();
    expect(result.matched!.name).toBe("raise-to-game");
    expect((result.matched!).intent.params).toEqual({ suit: "diamonds" });

    const candidates = findCandidateBids(tree, result.matched!, ctx, "test-convention");

    // Both non-matched siblings (hearts and spades) should appear
    expect(candidates).toHaveLength(2);
    const paramSuits = candidates.map(c => c.intent.params["suit"]).sort();
    expect(paramSuits).toEqual(["hearts", "spades"]);
  });
});

// ─── Gap 4: nodeId matching in sibling finder ────────────────

describe("sibling-finder nodeId matching", () => {
  test("skips matched node by nodeId, not reference identity", () => {
    const passCall: Call = { type: "pass" };
    const node1 = intentBid("bid-a", "Bid A",
      { type: SemanticIntentType.NaturalBid, params: {} },
      () => passCall);
    const node2 = intentBid("bid-b", "Bid B",
      { type: SemanticIntentType.NaturalBid, params: {} },
      () => passCall);

    const tree: RuleNode = decision(
      "hand-check", handCondition("check", true),
      node1, node2,
    );

    const ctx = makeMinimalContext();
    const result = evaluateTree(tree, ctx);
    expect(result.matched).toBe(node1);

    // Spread-copy the matched node: different reference, same nodeId
    const copy = { ...node1 };
    expect(copy).not.toBe(node1);
    expect(copy.nodeId).toBe(node1.nodeId);

    // findSiblingBids should skip the matched node by nodeId even with a copy
    const siblings = findSiblingBids(tree, copy, ctx);
    expect(siblings).toHaveLength(1);
    expect(siblings[0]!.bidName).toBe("bid-b");
  });
});
