import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { Hand } from "../../../engine/types";
import {
  registerConvention,
  clearRegistry,
} from "../../core/registry";
import { staymanConfig } from "../../definitions/stayman";
import { staymanProtocol } from "../../definitions/stayman/tree";
import type { BiddingContext } from "../../core/types";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { evaluateProtocol } from "../../core/protocol-evaluator";
import { hand, auctionFromBids } from "../fixtures";
import { conventionToStrategy } from "../../../strategy/bidding/convention-strategy";

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
});

// ─── Helpers ────────────────────────────────────────────────

function makeBiddingContext(
  h: Hand,
  seat: Seat,
  bids: string[],
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

function suggestCall(
  h: Hand,
  seat: Seat,
  bids: string[],
  dealer: Seat = Seat.North,
) {
  const ctx = makeBiddingContext(h, seat, bids, dealer);
  const strategy = conventionToStrategy(staymanConfig);
  return strategy.suggest(ctx);
}

// ─── Test hands ─────────────────────────────────────────────
// All hands verified with explicit HCP calculation

// S:KJ84 H:AQ93 D:K5 C:J72 → K=3 + J=1 + A=4 + Q=2 + K=3 + J=1 = 14 HCP, 4S+4H
const strongHand = () =>
  hand("SK", "SJ", "S8", "S4", "HA", "HQ", "H9", "H3", "DK", "D5", "CJ", "C7", "C2");

// S:KQ42 H:J853 D:92 C:K63 → K=3 + Q=2 + J=1 + K=3 = 9 HCP, 4S+4H (corrected: 9 not 8)
// Need 8 HCP + 4-card major for Stayman after double. Use this for Stayman.
const mediumHand = () =>
  hand("SK", "SQ", "S4", "S2", "HJ", "H8", "H5", "H3", "D9", "D2", "CK", "C6", "C3");

// S:97 H:J86532 D:84 C:952 → J=1 = 1 HCP, 6H (corrected: 1 not 2)
// Weak hand with 6+ hearts → escape to 2H after double
const weakEscapeHand = () =>
  hand("S9", "S7", "HJ", "H8", "H6", "H5", "H3", "H2", "D8", "D4", "C9", "C5", "C2");

// S:97 H:J865 D:843 C:9752 → J=1 = 1 HCP, no 5+ suit
// Weak hand with no escape suit → pass after double
const weakNoEscapeHand = () =>
  hand("S9", "S7", "HJ", "H8", "H6", "H5", "D8", "D4", "D3", "C9", "C7", "C5", "C2");

// ─── Tests ──────────────────────────────────────────────────

describe("Stayman interference", () => {
  describe("after 1NT-X (opponent doubles)", () => {
    test("strong hand (14 HCP) redoubles for penalty", () => {
      const result = suggestCall(strongHand(), Seat.South, ["1NT", "X"]);
      expect(result).not.toBeNull();
      expect(result!.call.type).toBe("redouble");
    });

    test("medium hand (9 HCP, 4-4 majors) bids 2C Stayman", () => {
      const result = suggestCall(mediumHand(), Seat.South, ["1NT", "X"]);
      expect(result).not.toBeNull();
      expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Clubs });
    });

    test("weak hand with 6+ hearts escapes to 2H", () => {
      const result = suggestCall(weakEscapeHand(), Seat.South, ["1NT", "X"]);
      expect(result).not.toBeNull();
      expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });
    });

    test("weak hand with no 5+ suit passes", () => {
      const result = suggestCall(weakNoEscapeHand(), Seat.South, ["1NT", "X"]);
      expect(result).not.toBeNull();
      expect(result!.call.type).toBe("pass");
    });
  });

  describe("after 1NT-2H (opponent overcalls)", () => {
    test("convention not active — no Stayman result", () => {
      // After overcall, system is off. Stayman should not apply.
      const result = suggestCall(mediumHand(), Seat.South, ["1NT", "2H"]);
      // Either null (convention doesn't match) or falls through to fallback
      if (result) {
        // If something matches, it must NOT be a conventional 2C bid
        const call = result.call;
        if (call.type === "bid") {
          const bid = call;
          expect(bid.strain).not.toBe(BidSuit.Clubs);
        }
      }
    });
  });

  describe("negative tests (mutation-resistant)", () => {
    test("after 1NT-2H, strategy NEVER returns 2C for any hand", () => {
      const hands = [
        strongHand(),
        mediumHand(),
        weakEscapeHand(),
        weakNoEscapeHand(),
      ];
      for (const h of hands) {
        const result = suggestCall(h, Seat.South, ["1NT", "2H"]);
        if (result && result.call.type === "bid") {
          const bid = result.call;
          // 2C Stayman must never appear after an overcall
          if (bid.level === 2) {
            expect(bid.strain).not.toBe(BidSuit.Clubs);
          }
        }
      }
    });
  });

  describe("opponent opens 1NT (not partner)", () => {
    test("Stayman does NOT fire when opponent opens 1NT", () => {
      // East opens 1NT. South evaluates. North is partner, not East.
      // seatFilter (isResponder) rejects — North didn't open.
      const result = suggestCall(mediumHand(), Seat.South, ["1NT", "P"], Seat.East);
      expect(result).toBeNull();
    });

    test("trigger matches but seatFilter blocks when opponent opens 1NT", () => {
      // Triggers are seat-agnostic milestones (bidMade) — they fire on any player's bid.
      // seatFilter (isResponder) provides the partnership check.
      const ctx = makeBiddingContext(mediumHand(), Seat.South, ["1NT", "P"], Seat.East);
      const protoResult = evaluateProtocol(staymanProtocol, ctx);
      // Trigger matched (1NT was bid), but no activeRound (seatFilter blocked it)
      expect(protoResult.matchedRounds).toHaveLength(1);
      expect(protoResult.activeRound).toBeNull();
    });
  });

  describe("uncontested regression", () => {
    test("medium hand still bids 2C Stayman in uncontested auction", () => {
      const result = suggestCall(mediumHand(), Seat.South, ["1NT", "P"]);
      expect(result).not.toBeNull();
      expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Clubs });
    });

    test("strong hand still bids 2C Stayman in uncontested auction", () => {
      const result = suggestCall(strongHand(), Seat.South, ["1NT", "P"]);
      expect(result).not.toBeNull();
      expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Clubs });
    });
  });
});
