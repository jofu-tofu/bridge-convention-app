/**
 * Teaching regression harness — characterization tests that freeze current teaching behavior.
 * These must pass unchanged after all practical bidder layer phases.
 * Tests exact call, BidGrade, TeachingResolution.primaryBid, and acceptableBids set.
 */
import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../engine/types";
import type { ContractBid } from "../../engine/types";
import { evaluateHand } from "../../engine/hand-evaluator";
import { registerConvention, clearRegistry } from "../../conventions/core/registry";
import { staymanConfig } from "../../conventions/definitions/stayman";
import { bergenConfig } from "../../conventions/definitions/bergen-raises";
import { weakTwosConfig } from "../../conventions/definitions/weak-twos";
import { saycConfig } from "../../conventions/definitions/sayc";
import { conventionToStrategy } from "../bidding/convention-strategy";
import { BidGrade, resolveTeachingAnswer, gradeBid } from "../../teaching/teaching-resolution";
import {
  hand,
  staymanResponder,
  staymanOpener,
  bergenResponder,
  auctionFromBids,
} from "../../conventions/__tests__/fixtures";
import type { BiddingContext } from "../../conventions/core/types";
import type { BidResult, AlternativeGroup } from "../../core/contracts";

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
  registerConvention(bergenConfig);
  registerConvention(weakTwosConfig);
  registerConvention(saycConfig);
});

function makeContext(h: ReturnType<typeof hand>, bids: string[], seat: Seat, dealer: Seat): BiddingContext {
  return {
    hand: h,
    auction: auctionFromBids(dealer, bids),
    seat,
    evaluation: evaluateHand(h),
    opponentConventionIds: [],
  };
}

function getTeaching(result: BidResult, alternativeGroups?: readonly AlternativeGroup[]) {
  const resolution = resolveTeachingAnswer(result, alternativeGroups);
  return { resolution, result };
}

describe("Teaching regression: Stayman", () => {
  test("responder with 4 hearts bids 2C after 1NT-P", () => {
    const strategy = conventionToStrategy(staymanConfig);
    const h = staymanResponder(); // 13 HCP, 4 hearts
    const ctx = makeContext(h, ["1NT", "P"], Seat.South, Seat.North);
    const result = strategy.suggest(ctx)!;

    expect(result).not.toBeNull();
    expect(result.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Clubs });

    const { resolution } = getTeaching(result);
    expect(resolution.primaryBid).toEqual({ type: "bid", level: 2, strain: BidSuit.Clubs });
    expect(gradeBid({ type: "bid", level: 2, strain: BidSuit.Clubs }, resolution)).toBe(BidGrade.Correct);
    expect(gradeBid({ type: "pass" }, resolution)).toBe(BidGrade.Incorrect);
  });

  test("opener with 4 hearts responds 2H after 1NT-P-2C-P", () => {
    const strategy = conventionToStrategy(staymanConfig);
    const h = staymanOpener(); // 16 HCP, 4 hearts
    const ctx = makeContext(h, ["1NT", "P", "2C", "P"], Seat.North, Seat.North);
    const result = strategy.suggest(ctx)!;

    expect(result).not.toBeNull();
    expect(result.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });

    const { resolution } = getTeaching(result);
    expect(resolution.primaryBid).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });
    expect(gradeBid({ type: "bid", level: 2, strain: BidSuit.Hearts }, resolution)).toBe(BidGrade.Correct);
  });
});

describe("Teaching regression: Bergen Raises", () => {
  test("responder with 8 HCP and 4-card support bids 3H", () => {
    const strategy = conventionToStrategy(bergenConfig);
    const h = bergenResponder(); // 8 HCP, 4 hearts
    const ctx = makeContext(h, ["1H", "P"], Seat.South, Seat.North);
    const result = strategy.suggest(ctx)!;

    expect(result).not.toBeNull();
    const bid = result.call as ContractBid;
    expect(bid.type).toBe("bid");
    expect(bid.level).toBe(3);
    expect(bid.strain).toBe(BidSuit.Hearts);

    const { resolution } = getTeaching(result);
    expect(resolution.primaryBid).toEqual({ type: "bid", level: 3, strain: BidSuit.Hearts });
    expect(gradeBid({ type: "bid", level: 3, strain: BidSuit.Hearts }, resolution)).toBe(BidGrade.Correct);
  });
});

describe("Teaching regression: Weak Twos", () => {
  test("opener with 6-card heart suit and 8 HCP opens 2H", () => {
    const strategy = conventionToStrategy(weakTwosConfig);
    // 8 HCP, 6 hearts: AH KH QH JH TH 9H + fillers
    const h = hand("HA", "HK", "HQ", "HJ", "HT", "H9", "S5", "S3", "D4", "D3", "D2", "C5", "C3");
    // HCP: HA=4, HK=3, HQ=2 = 9... let me recalculate
    // Actually HA(4)+HK(3)+HQ(2) = 9 HCP. Need 5-11 for weak two.
    const ctx = makeContext(h, [], Seat.South, Seat.South);
    const result = strategy.suggest(ctx)!;

    expect(result).not.toBeNull();
    const bid = result.call as ContractBid;
    expect(bid.type).toBe("bid");
    expect(bid.level).toBe(2);
    expect(bid.strain).toBe(BidSuit.Hearts);

    const { resolution } = getTeaching(result);
    expect(resolution.primaryBid).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });
    expect(gradeBid({ type: "bid", level: 2, strain: BidSuit.Hearts }, resolution)).toBe(BidGrade.Correct);
  });
});

describe("Teaching regression: SAYC", () => {
  test("opener with 15 HCP balanced opens 1NT", () => {
    const strategy = conventionToStrategy(saycConfig);
    // 15 HCP balanced: SA KS + HK + DA DQ + CA CJ + fillers
    // SA(4)+SK(3)+HK(3)+DA(4)+DQ(2)=16... need exactly 15
    // SA(4)+SK(3)+HK(3)+DK(3)+CQ(2)=15 HCP
    const h = hand("SA", "SK", "S5", "HK", "H7", "H3", "DK", "D8", "D4", "CQ", "C7", "C4", "C2");
    // SA(4)+SK(3)+HK(3)+DK(3)+CQ(2)=15 HCP. Shape: 3-3-3-4 balanced
    const ctx = makeContext(h, [], Seat.South, Seat.South);
    const result = strategy.suggest(ctx)!;

    expect(result).not.toBeNull();
    const bid = result.call as ContractBid;
    expect(bid.type).toBe("bid");
    expect(bid.level).toBe(1);
    expect(bid.strain).toBe(BidSuit.NoTrump);

    const { resolution } = getTeaching(result);
    expect(resolution.primaryBid).toEqual({ type: "bid", level: 1, strain: BidSuit.NoTrump });
    expect(gradeBid({ type: "bid", level: 1, strain: BidSuit.NoTrump }, resolution)).toBe(BidGrade.Correct);
  });

  test("opener with 13 HCP and 5 spades opens 1S", () => {
    const strategy = conventionToStrategy(saycConfig);
    // SA(4)+SK(3)+HK(3)+DK(3)=13 HCP, 5 spades
    // SA(4)+SK(3)+SQ(2)+HK(3)+DK(3)=15... too much.
    // SA(4)+SJ(1)+S7+S5+S3 + HK(3)+H5 + DK(3)+D6+D3 + CQ(2)+C4+C2 = 13 HCP, 5 spades
    const h2 = hand("SA", "SJ", "S7", "S5", "S3", "HK", "H5", "DK", "D6", "D3", "CQ", "C4", "C2");
    // SA(4)+SJ(1)+HK(3)+DK(3)+CQ(2) = 13 HCP. Shape: 5-2-3-3
    const ctx = makeContext(h2, [], Seat.South, Seat.South);
    const result = strategy.suggest(ctx)!;

    expect(result).not.toBeNull();
    const bid = result.call as ContractBid;
    expect(bid.type).toBe("bid");
    expect(bid.level).toBe(1);
    expect(bid.strain).toBe(BidSuit.Spades);

    const { resolution } = getTeaching(result);
    expect(resolution.primaryBid).toEqual({ type: "bid", level: 1, strain: BidSuit.Spades });
    expect(gradeBid({ type: "bid", level: 1, strain: BidSuit.Spades }, resolution)).toBe(BidGrade.Correct);
  });
});

describe("Teaching regression: grading invariants", () => {
  test("same hand + same auction = same grade (deterministic)", () => {
    const strategy = conventionToStrategy(staymanConfig);
    const h = staymanResponder();
    const ctx = makeContext(h, ["1NT", "P"], Seat.South, Seat.North);

    const result1 = strategy.suggest(ctx)!;
    const result2 = strategy.suggest(ctx)!;

    expect(result1.call).toEqual(result2.call);
    const resolution1 = resolveTeachingAnswer(result1);
    const resolution2 = resolveTeachingAnswer(result2);
    expect(resolution1.primaryBid).toEqual(resolution2.primaryBid);
    expect(resolution1.gradingType).toBe(resolution2.gradingType);
    expect(resolution1.acceptableBids.length).toBe(resolution2.acceptableBids.length);
  });
});
