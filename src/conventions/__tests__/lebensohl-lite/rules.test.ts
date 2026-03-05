import { beforeEach, describe, expect, test } from "vitest";
import { BidSuit, Seat } from "../../../engine/types";
import type { ContractBid, Hand } from "../../../engine/types";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { clearRegistry, evaluateBiddingRules, registerConvention } from "../../core/registry";
import type { BiddingContext } from "../../core/types";
import { lebensohlLiteConfig } from "../../definitions/lebensohl-lite";
import { auctionFromBids, hand } from "../fixtures";

beforeEach(() => {
  clearRegistry();
  registerConvention(lebensohlLiteConfig);
});

function makeBiddingContext(
  h: Hand,
  bids: string[],
  seat: Seat = Seat.South,
  dealer: Seat = Seat.North,
): BiddingContext {
  return {
    hand: h,
    auction: auctionFromBids(dealer, bids),
    seat,
    evaluation: evaluateHand(h),
    opponentConventionIds: [],
  };
}

describe("Lebensohl Lite", () => {
  test("round 1: strong hand with overcall suit support doubles for penalty", () => {
    const h = hand(
      "SA", "S7", "S4",
      "HK", "H7", "H3",
      "DQ", "DJ", "D7", "D4",
      "C8", "C6", "C2",
    ); // 10 HCP, 4 diamonds
    const context = makeBiddingContext(h, ["1NT", "2D"]);

    const result = evaluateBiddingRules(context, lebensohlLiteConfig);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "double" });
    expect(result!.rule).toBe("lebensohl-penalty-double");
    expect(result!.protocolResult?.activeRound?.name).toBe("overcall");
  });

  test("round 1: direct 3-level suit bid is game-forcing", () => {
    const h = hand(
      "SA", "S8", "S4",
      "HK", "HQ", "H7", "H4", "H3",
      "D8", "D6", "D2",
      "CJ", "C3",
    ); // 10 HCP, 5 hearts, fewer than 4 diamonds
    const context = makeBiddingContext(h, ["1NT", "2D"]);

    const result = evaluateBiddingRules(context, lebensohlLiteConfig);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Hearts });
    expect(result!.rule).toBe("lebensohl-direct-gf-hearts");
    expect(result!.meaning).toContain("game-forcing");
    expect(result!.protocolResult?.activeRound?.name).toBe("overcall");
  });

  test("round 2: opener accepts relay with forced 3C", () => {
    const h = hand(
      "SA", "SK", "S7",
      "HQ", "H8", "H4",
      "DK", "D8", "D4",
      "CQ", "C8", "C5", "C2",
    );
    const context = makeBiddingContext(h, ["1NT", "2H", "2NT", "P"], Seat.North);

    const result = evaluateBiddingRules(context, lebensohlLiteConfig);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Clubs });
    expect(result!.rule).toBe("lebensohl-relay-accept");
    expect(result!.protocolResult?.activeRound?.name).toBe("relay-completion");
  });

  test("round 3: responder signs off in own suit after 2NT-3C relay", () => {
    const h = hand(
      "SK", "S9", "S7", "S5", "S3",
      "HQ", "H7", "H4",
      "D8", "D6",
      "CJ", "C7", "C4",
    ); // 5 HCP, 5 spades
    const context = makeBiddingContext(h, ["1NT", "2H", "2NT", "P", "3C", "P"]);

    const result = evaluateBiddingRules(context, lebensohlLiteConfig);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Spades });
    expect(result!.rule).toBe("lebensohl-relay-signoff-spades");
    expect(result!.meaning).toContain("signs off");
    expect(result!.protocolResult?.activeRound?.name).toBe("continuation");
  });

  test("direct 3H and relayed 3H have different meanings", () => {
    const directHand = hand(
      "SA", "S8", "S4",
      "HK", "HQ", "H7", "H4", "H3",
      "D8", "D6", "D2",
      "CJ", "C3",
    );
    const relayHand = hand(
      "SJ", "S8", "S4",
      "HQ", "H9", "H7", "H5", "H3",
      "D8", "D6",
      "CJ", "C7", "C4",
    );

    const directResult = evaluateBiddingRules(
      makeBiddingContext(directHand, ["1NT", "2D"]),
      lebensohlLiteConfig,
    );
    const relayResult = evaluateBiddingRules(
      makeBiddingContext(relayHand, ["1NT", "2D", "2NT", "P", "3C", "P"]),
      lebensohlLiteConfig,
    );

    expect(directResult).not.toBeNull();
    expect(relayResult).not.toBeNull();
    expect(directResult!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Hearts });
    expect(relayResult!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Hearts });
    expect(directResult!.rule).toBe("lebensohl-direct-gf-hearts");
    expect(relayResult!.rule).toBe("lebensohl-relay-signoff-hearts");
    expect(directResult!.meaning).not.toEqual(relayResult!.meaning);
  });

  test("does not apply without opponent two-level overcall", () => {
    const h = hand(
      "SA", "S7", "S4",
      "HK", "H7", "H3",
      "DQ", "DJ", "D7", "D4",
      "C8", "C6", "C2",
    );
    const context = makeBiddingContext(h, ["1NT", "P"]);

    const result = evaluateBiddingRules(context, lebensohlLiteConfig);
    expect(result).toBeNull();
  });

  test("full pipeline output includes protocol + tree trace for continuation round", () => {
    const h = hand(
      "SK", "S9", "S7", "S5", "S3",
      "HQ", "H7", "H4",
      "D8", "D6",
      "CJ", "C7", "C4",
    );
    const context = makeBiddingContext(h, ["1NT", "2H", "2NT", "P", "3C", "P"]);

    const result = evaluateBiddingRules(context, lebensohlLiteConfig);
    expect(result).not.toBeNull();
    expect(result!.protocolResult).toBeDefined();
    expect(result!.treeEvalResult).toBeDefined();
    expect(result!.protocolResult?.activeRound?.name).toBe("continuation");
    expect(result!.treeEvalResult?.matched).not.toBeNull();
    expect((result!.call as ContractBid).level).toBe(3);
  });
});
