// Tests for CandidateBid builder and findCandidateBids.

import { describe, test, expect } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import type { RuleCondition } from "../../core/types";
import type { RuleNode } from "../../core/rule-tree";
import { decision, fallback } from "../../core/rule-tree";
import { intentBid } from "../../core/intent/intent-node";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import type { SiblingBid } from "../../../core/contracts";
import { toCandidateBid } from "../../core/candidate-builder";
import { findCandidateBids } from "../../core/sibling-finder";
import { evaluateTree } from "../../core/tree-evaluator";
import { makeMinimalContext } from "../tree-test-helpers";
import { createBiddingContext } from "../../core/context-factory";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { evaluateBiddingRules, registerConvention, clearRegistry } from "../../core/registry";
import { hand } from "../../../engine/__tests__/fixtures";
import { auctionFromBids } from "../fixtures";
import { staymanConfig } from "../../definitions/stayman/config";
import { buildEffectiveContext } from "../../core/effective-context";
import { generateCandidates, throwingOverlayErrorHandler } from "../../core/candidate-generator";

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

describe("toCandidateBid", () => {
  test("produces CandidateBid with correct shape", () => {
    const node = intentBid(
      "test-bid",
      "Test meaning",
      { type: SemanticIntentType.AskForMajor, params: {} },
      makeCall(2, BidSuit.Clubs),
    );

    const ctx = makeMinimalContext();
    const result = toCandidateBid(node, ctx, "stayman", "round-1", []);

    expect(result).not.toBeNull();
    expect(result!.bidName).toBe("test-bid");
    expect(result!.meaning).toBe("Test meaning");
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Clubs });
    expect(result!.intent.type).toBe(SemanticIntentType.AskForMajor);
    expect(result!.intent.params).toEqual({});
    expect(result!.source.conventionId).toBe("stayman");
    expect(result!.source.roundName).toBe("round-1");
    expect(result!.source.nodeName).toBe("test-bid");
  });

  test("returns null when defaultCall throws", () => {
    const node = intentBid(
      "bad-bid",
      "Will throw",
      { type: SemanticIntentType.NaturalBid, params: {} },
      () => { throw new Error("boom"); },
    );

    const ctx = makeMinimalContext();
    const result = toCandidateBid(node, ctx, "test", undefined, []);
    expect(result).toBeNull();
  });

  test("CandidateBid is assignable to SiblingBid", () => {
    const node = intentBid(
      "test-bid",
      "Test meaning",
      { type: SemanticIntentType.NaturalBid, params: {} },
      makeCall(1, BidSuit.Clubs),
    );

    const ctx = makeMinimalContext();
    const candidate = toCandidateBid(node, ctx, "test", undefined, [])!;

    // CandidateBid extends SiblingBid — this should compile and work
    const sibling: SiblingBid = candidate;
    expect(sibling.bidName).toBe("test-bid");
    expect(sibling.meaning).toBe("Test meaning");
    expect(sibling.call).toEqual({ type: "bid", level: 1, strain: BidSuit.Clubs });
  });

  test("carries intent params through", () => {
    const node = intentBid(
      "show-hearts",
      "Shows hearts",
      { type: SemanticIntentType.ShowHeldSuit, params: { suit: "hearts" } },
      makeCall(2, BidSuit.Hearts),
    );

    const ctx = makeMinimalContext();
    const result = toCandidateBid(node, ctx, "stayman", "response", [])!;
    expect(result.intent.params).toEqual({ suit: "hearts" });
  });
});

describe("findCandidateBids", () => {
  test("returns CandidateBids with intent + source populated", () => {
    const tree: RuleNode = decision(
      "auction-check", auctionCondition("auction", true),
      decision(
        "has-4-hearts", handCondition("has-4-hearts", true),
        intentBid("response-hearts", "Shows 4+ hearts",
          { type: SemanticIntentType.ShowHeldSuit, params: { suit: "hearts" } },
          makeCall(2, BidSuit.Hearts)),
        intentBid("response-denial", "Denies a 4-card major",
          { type: SemanticIntentType.DenyHeldSuit, params: {} },
          makeCall(2, BidSuit.Diamonds)),
      ),
      fallback("no match"),
    );

    const ctx = makeMinimalContext();
    const result = evaluateTree(tree, ctx);
    expect(result.matched).not.toBeNull();

    const candidates = findCandidateBids(tree, result.matched!, ctx, "stayman", "round-2");
    expect(candidates).toHaveLength(1);

    const denial = candidates[0]!;
    expect(denial.bidName).toBe("response-denial");
    expect(denial.intent.type).toBe(SemanticIntentType.DenyHeldSuit);
    expect(denial.source.conventionId).toBe("stayman");
    expect(denial.source.roundName).toBe("round-2");
    expect(denial.source.nodeName).toBe("response-denial");
    expect(denial.failedConditions.length).toBeGreaterThan(0);
  });

  test("empty when no hand conditions present", () => {
    const tree: RuleNode = decision(
      "auction-check", auctionCondition("auction", true),
      intentBid("direct-bid", "Direct", { type: SemanticIntentType.NaturalBid, params: {} }, makeCall(1, BidSuit.Clubs)),
      fallback("no match"),
    );

    const ctx = makeMinimalContext();
    const result = evaluateTree(tree, ctx);
    const candidates = findCandidateBids(tree, result.matched!, ctx, "test");
    expect(candidates).toHaveLength(0);
  });

  test("integration: Stayman round 2 produces CandidateBids", () => {
    clearRegistry();
    registerConvention(staymanConfig);

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

    const handRoot = result!.treeRoot!;
    const candidates = findCandidateBids(
      handRoot,
      result!.treeEvalResult!.matched!,
      ctx,
      "stayman",
      "opener-response",
    );

    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(c.intent).toBeDefined();
      expect(c.intent.type).toBeTruthy();
      expect(c.source.conventionId).toBe("stayman");
      expect(c.source.roundName).toBe("opener-response");
    }
  });
});

describe("overlay error handling", () => {
  test("throwingOverlayErrorHandler causes generateCandidates to throw", () => {
    clearRegistry();

    const throwingConfig = {
      ...staymanConfig,
      id: "stayman-throwing-overlay",
      name: "Stayman Throwing Overlay",
      overlays: [
        {
          id: "throwing-overlay",
          roundName: "nt-opening",
          matches: () => true,
          suppressIntent: () => {
            throw new Error("boom");
          },
        },
      ],
    };
    registerConvention(throwingConfig);

    const h = hand("SK", "S5", "S2", "HA", "HK", "HQ", "H3", "D5", "D3", "D2", "C5", "C3", "C2");
    const auction = auctionFromBids(Seat.North, ["1NT", "P"]);
    const ctx = createBiddingContext({
      hand: h,
      auction,
      seat: Seat.South,
      evaluation: evaluateHand(h),
    });

    const evaluated = evaluateBiddingRules(ctx, throwingConfig);
    expect(evaluated).not.toBeNull();

    const effective = buildEffectiveContext(ctx, throwingConfig, evaluated!.protocolResult!);
    expect(() => generateCandidates(
      evaluated!.treeRoot!,
      evaluated!.treeEvalResult!,
      effective,
      throwingOverlayErrorHandler,
    )).toThrow('Overlay "throwing-overlay" suppressIntent error: boom');
  });
});
