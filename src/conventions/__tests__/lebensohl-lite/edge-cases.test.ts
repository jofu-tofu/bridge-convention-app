import { beforeEach, describe, expect, test } from "vitest";
import { BidSuit, Seat } from "../../../engine/types";
import type { Hand } from "../../../engine/types";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { clearRegistry, evaluateBiddingRules, registerConvention } from "../../core/registry";
import type { BiddingContext } from "../../core/types";
import { lebensohlLiteConfig } from "../../definitions/lebensohl-lite";
import { auctionFromBids, hand } from "../fixtures";
import { refDescribe, policyDescribe } from "../../../test-support/tiers";

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

refDescribe("[ref:bridgebum/lebensohl]", "Lebensohl Lite edge cases", () => {
  describe("different overcall suits produce correct bids", () => {
    test("overcall 2D: penalty double with 4 diamonds", () => {
      const h = hand(
        "SA", "S7", "S4",
        "HK", "H7", "H3",
        "DQ", "DJ", "D7", "D4",
        "C8", "C6", "C2",
      ); // 10 HCP, 4 diamonds
      const result = evaluateBiddingRules(
        makeBiddingContext(h, ["1NT", "2D"]),
        lebensohlLiteConfig,
      );
      expect(result).not.toBeNull();
      expect(result!.call).toEqual({ type: "double" });
    });

    test("overcall 2H: penalty double with 4 hearts", () => {
      const h = hand(
        "SA", "S7", "S4",
        "HK", "HQ", "H7", "H3",
        "D8", "D6", "D2",
        "CJ", "C6", "C2",
      ); // 11 HCP, 4 hearts
      const result = evaluateBiddingRules(
        makeBiddingContext(h, ["1NT", "2H"]),
        lebensohlLiteConfig,
      );
      expect(result).not.toBeNull();
      expect(result!.call).toEqual({ type: "double" });
    });

    test("overcall 2S: penalty double with 4 spades", () => {
      const h = hand(
        "SA", "SK", "S7", "S4",
        "HK", "H7", "H3",
        "D8", "D6", "D2",
        "C6", "C4", "C2",
      ); // 10 HCP, 4 spades
      const result = evaluateBiddingRules(
        makeBiddingContext(h, ["1NT", "2S"]),
        lebensohlLiteConfig,
      );
      expect(result).not.toBeNull();
      expect(result!.call).toEqual({ type: "double" });
    });
  });

  describe("relay completion: opener must bid 3C", () => {
    test("opener bids 3C after 2NT relay regardless of hand", () => {
      const h = hand(
        "SA", "SK", "S7",
        "HQ", "H8", "H4",
        "DK", "D8", "D4",
        "CQ", "C8", "C5", "C2",
      ); // 16 HCP, balanced
      const result = evaluateBiddingRules(
        makeBiddingContext(h, ["1NT", "2H", "2NT", "P"], Seat.North),
        lebensohlLiteConfig,
      );
      expect(result).not.toBeNull();
      expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Clubs });
      expect(result!.rule).toBe("lebensohl-relay-accept");
    });
  });

  describe("slow shows vs fast denies 3NT", () => {
    test("direct 3NT = fast denies (no stopper)", () => {
      // 10+ HCP, no 5-card suit, no stopper in overcalled suit (diamonds)
      const h = hand(
        "SA", "SK", "S7",
        "HK", "H8", "H4",
        "D8", "D6", "D2",
        "CQ", "C5", "C3", "C2",
      ); // 12 HCP, no diamond stopper (no top honor)
      const result = evaluateBiddingRules(
        makeBiddingContext(h, ["1NT", "2D"]),
        lebensohlLiteConfig,
      );
      expect(result).not.toBeNull();
      expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.NoTrump });
      expect(result!.rule).toBe("lebensohl-direct-3nt");
      expect(result!.meaning).toContain("denying");
    });

    test("relay then 3NT = slow shows (has stopper)", () => {
      // 10+ HCP, diamond stopper, went through relay
      const h = hand(
        "SA", "SK", "S7",
        "HK", "H8", "H4",
        "DA", "D6", "D2",
        "C5", "C4", "C3", "C2",
      ); // 13 HCP, diamond stopper (Ace)
      const result = evaluateBiddingRules(
        makeBiddingContext(h, ["1NT", "2D", "2NT", "P", "3C", "P"]),
        lebensohlLiteConfig,
      );
      expect(result).not.toBeNull();
      expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.NoTrump });
      expect(result!.rule).toBe("lebensohl-slow-3nt");
      expect(result!.meaning).toContain("slow shows");
    });

    test("with stopper in round 1, uses 2NT relay (not direct 3NT)", () => {
      // 10+ HCP, stopper in overcalled suit, no 5+ suit → should use relay
      const h = hand(
        "SA", "SK", "S7",
        "HK", "H8", "H4",
        "DA", "D6", "D2",
        "C5", "C4", "C3", "C2",
      ); // 13 HCP, diamond stopper
      const result = evaluateBiddingRules(
        makeBiddingContext(h, ["1NT", "2D"]),
        lebensohlLiteConfig,
      );
      expect(result).not.toBeNull();
      expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.NoTrump });
      expect(result!.rule).toBe("lebensohl-relay-with-stopper");
    });
  });

  describe("penalty double requirements", () => {
    test("requires 10+ HCP for penalty double", () => {
      // 9 HCP with 4 diamonds — not enough for penalty double
      const h = hand(
        "SK", "S7", "S4",
        "HK", "H7", "H3",
        "DQ", "DJ", "D7", "D4",
        "C8", "C6", "C2",
      ); // 9 HCP, 4 diamonds
      const result = evaluateBiddingRules(
        makeBiddingContext(h, ["1NT", "2D"]),
        lebensohlLiteConfig,
      );
      expect(result).not.toBeNull();
      // Should not double — weak hand goes to relay or pass
      expect(result!.call.type).not.toBe("double");
    });

    test("requires 4+ cards in overcalled suit for penalty double", () => {
      // 10+ HCP with only 3 diamonds — should bid GF suit or 3NT, not double
      const h = hand(
        "SA", "SK", "S7", "S4", "S3",
        "HK", "H7", "H3",
        "DQ", "D7", "D4",
        "C8", "C2",
      ); // 11 HCP, 5 spades, 3 diamonds
      const result = evaluateBiddingRules(
        makeBiddingContext(h, ["1NT", "2D"]),
        lebensohlLiteConfig,
      );
      expect(result).not.toBeNull();
      expect(result!.call.type).not.toBe("double");
      // Should bid 3S (direct GF)
      expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Spades });
    });
  });

  describe("weak hand relay signoffs", () => {
    test("weak hand with 5+ clubs uses relay then passes 3C", () => {
      const h = hand(
        "S9", "S7", "S4",
        "H7", "H4",
        "D8", "D6", "D2",
        "CJ", "C9", "C7", "C4", "C2",
      ); // 1 HCP, 5 clubs
      const result = evaluateBiddingRules(
        makeBiddingContext(h, ["1NT", "2D"]),
        lebensohlLiteConfig,
      );
      expect(result).not.toBeNull();
      // Should use 2NT relay
      expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.NoTrump });
    });

    test("weak with 5 clubs passes 3C after relay completion", () => {
      const h = hand(
        "S9", "S7", "S4",
        "H7", "H4",
        "D8", "D6", "D2",
        "CJ", "C9", "C7", "C4", "C2",
      ); // 1 HCP, 5 clubs
      const result = evaluateBiddingRules(
        makeBiddingContext(h, ["1NT", "2D", "2NT", "P", "3C", "P"]),
        lebensohlLiteConfig,
      );
      expect(result).not.toBeNull();
      expect(result!.call).toEqual({ type: "pass" });
      expect(result!.rule).toBe("lebensohl-relay-pass-clubs");
    });
  });
});
