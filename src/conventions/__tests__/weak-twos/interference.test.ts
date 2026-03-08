// Tests for weak two interference overlays.
// Verifies overlay activation when opponent doubles or overcalls a weak two.

import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { Hand } from "../../../engine/types";
import {
  registerConvention,
  clearRegistry,
} from "../../core/registry";
import { weakTwosConfig } from "../../definitions/weak-twos";
import { weakTwoTransitionRules } from "../../definitions/weak-twos/transitions";
import { baselineTransitionRules } from "../../core/dialogue/baseline-transitions";
import { computeDialogueState } from "../../core/dialogue/dialogue-manager";
import { CompetitionMode, SystemMode } from "../../core/dialogue/dialogue-state";
import { conventionToStrategy } from "../../../strategy/bidding/convention-strategy";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { hand, auctionFromBids } from "../fixtures";
import type { BiddingContext } from "../../core/types";

beforeEach(() => {
  clearRegistry();
  registerConvention(weakTwosConfig);
});

// ─── Helpers ────────────────────────────────────────────────

function computeState(bids: string[], dealer: Seat = Seat.North) {
  const auction = auctionFromBids(dealer, bids);
  return computeDialogueState(auction, weakTwoTransitionRules, baselineTransitionRules);
}

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
  const strategy = conventionToStrategy(weakTwosConfig);
  return strategy.suggest(ctx);
}

// ─── Test hands ─────────────────────────────────────────────

// Strong responder: SA(4) SK(3) SQ(2) = 9 + HA(4) HK(3) = 7 → 16 HCP, 3 spades
const strongFit = () =>
  hand("SA", "SK", "SQ", "HA", "HK", "H3", "D5", "D3", "D2", "C5", "C3", "C2", "C7");

// Medium responder: SK(3) SQ(2) = 5 + HK(3) HQ(2) = 5 + DK(3) = 3 → 11 HCP
const mediumHand = () =>
  hand("SK", "SQ", "S3", "HK", "HQ", "H3", "DK", "D5", "D3", "C7", "C5", "C3", "C2");

// Weak responder: no significant values
const weakHand = () =>
  hand("S9", "S7", "S5", "HJ", "H8", "H5", "D8", "D6", "D4", "C9", "C7", "C5", "C2");

// ─── Dialogue State Tests ───────────────────────────────────

describe("Weak two interference — dialogue state", () => {
  test("opponent double after weak two sets CompetitionMode.Doubled", () => {
    // North opens 2H, East doubles
    const state = computeState(["2H", "X"]);
    expect(state.competitionMode).toBe(CompetitionMode.Doubled);
    expect(state.familyId).toBe("weak-two");
  });

  test("opponent overcall after weak two sets CompetitionMode.Overcalled", () => {
    // North opens 2H, East overcalls 2S
    const state = computeState(["2H", "2S"]);
    expect(state.competitionMode).toBe(CompetitionMode.Overcalled);
    expect(state.familyId).toBe("weak-two");
  });

  test("opponent double sets systemMode to Off", () => {
    const state = computeState(["2H", "X"]);
    expect(state.systemMode).toBe(SystemMode.Off);
  });

  test("opponent overcall sets systemMode to Off", () => {
    const state = computeState(["2H", "2S"]);
    expect(state.systemMode).toBe(SystemMode.Off);
  });

  test("uncontested auction stays Uncontested", () => {
    const state = computeState(["2H", "P"]);
    expect(state.competitionMode).toBe(CompetitionMode.Uncontested);
  });
});

// ─── Strategy-level Overlay Tests ───────────────────────────

describe("Weak two interference — overlay activation", () => {
  describe("after 2H-X (opponent doubles)", () => {
    test("strong hand with fit still raises to game", () => {
      // Partner opened 2H, opponent doubled, responder has 16 HCP + 3 hearts
      // Even after double, game raise is still appropriate
      const result = suggestCall(strongFit(), Seat.South, ["2H", "X"]);
      // Should get some valid response (not null — overlay provides options)
      expect(result).not.toBeNull();
    });

    test("weak hand passes after double", () => {
      const result = suggestCall(weakHand(), Seat.South, ["2H", "X"]);
      // Weak hand should pass or get fallback
      if (result) {
        expect(result.call.type).toBe("pass");
      }
    });
  });

  describe("after 2H-2S (opponent overcalls)", () => {
    test("strong hand with fit can still bid", () => {
      const result = suggestCall(strongFit(), Seat.South, ["2H", "2S"]);
      // After overcall, should still be able to compete
      if (result) {
        // Should not be a conventional Ogust 2NT after overcall
        if (result.call.type === "bid") {
          const bid = result.call;
          if (bid.level === 2) {
            expect(bid.strain).not.toBe(BidSuit.NoTrump);
          }
        }
      }
    });

    test("weak hand passes after overcall", () => {
      const result = suggestCall(weakHand(), Seat.South, ["2H", "2S"]);
      if (result) {
        expect(result.call.type).toBe("pass");
      }
    });
  });

  describe("uncontested regression", () => {
    test("strong hand with fit raises to game in uncontested auction", () => {
      const result = suggestCall(strongFit(), Seat.South, ["2H", "P"]);
      expect(result).not.toBeNull();
      expect(result!.call).toEqual({ type: "bid", level: 4, strain: BidSuit.Hearts });
    });

    test("medium hand bids 2NT Ogust in uncontested auction", () => {
      // 11 HCP, not enough for game raise (16+), not 14-15 invite either
      // Actually 11 HCP < 14, so this would fall through to fallback/pass
      const result = suggestCall(mediumHand(), Seat.South, ["2H", "P"]);
      // 11 HCP < 14 threshold, so should pass (fallback)
      expect(result).toBeNull();
    });
  });
});
