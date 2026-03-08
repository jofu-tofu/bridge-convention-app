/**
 * Contested-default safety tests.
 * Verifies that contested auctions never produce illegal or conventional-artificial calls.
 */
import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { Hand } from "../../../engine/types";
import {
  registerConvention,
  clearRegistry,
} from "../../core/registry";
import { staymanConfig } from "../../definitions/stayman";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { buildAuction } from "../../../engine/auction-helpers";
import { isLegalCall } from "../../../engine/auction";
import { conventionToStrategy } from "../../../strategy/bidding/convention-strategy";
import { hand } from "../fixtures";

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
});

// ─── Test hands ─────────────────────────────────────────────

const hands: Record<string, () => Hand> = {
  // 14 HCP, 4S+4H
  strong: () => hand("SK", "SJ", "S8", "S4", "HA", "HQ", "H9", "H3", "DK", "D5", "CJ", "C7", "C2"),
  // 9 HCP, 4S+4H
  medium: () => hand("SK", "SQ", "S4", "S2", "HJ", "H8", "H5", "H3", "D9", "D2", "CK", "C6", "C3"),
  // 1 HCP, 6H
  weakEscape: () => hand("S9", "S7", "HJ", "H8", "H6", "H5", "H3", "H2", "D8", "D4", "C9", "C5", "C2"),
  // 1 HCP, no 5+ suit
  weakNoEscape: () => hand("S9", "S7", "HJ", "H8", "H6", "H5", "D8", "D4", "D3", "C9", "C7", "C5", "C2"),
};

function suggest(h: Hand, bids: string[]) {
  const auction = buildAuction(Seat.North, bids);
  const ctx = {
    hand: h,
    auction,
    seat: Seat.South,
    evaluation: evaluateHand(h),
    opponentConventionIds: [],
  };
  const strategy = conventionToStrategy(staymanConfig);
  return { result: strategy.suggest(ctx), auction };
}

// ─── Tests ──────────────────────────────────────────────────

describe("contested auction safety", () => {
  describe("1NT-X (doubled)", () => {
    test("all calls from strategy are legal", () => {
      for (const [name, handFn] of Object.entries(hands)) {
        const { result, auction } = suggest(handFn(), ["1NT", "X"]);
        if (result) {
          const legal = isLegalCall(auction, result.call, Seat.South);
          expect(legal, `${name}: call ${JSON.stringify(result.call)} should be legal`).toBe(true);
        }
      }
    });
  });

  describe("1NT-2H (overcalled)", () => {
    test("all calls from strategy are legal", () => {
      for (const [name, handFn] of Object.entries(hands)) {
        const { result, auction } = suggest(handFn(), ["1NT", "2H"]);
        if (result) {
          const legal = isLegalCall(auction, result.call, Seat.South);
          expect(legal, `${name}: call ${JSON.stringify(result.call)} should be legal`).toBe(true);
        }
      }
    });

    test("no artificial conventional bid (2C) returned when system off", () => {
      for (const [name, handFn] of Object.entries(hands)) {
        const { result } = suggest(handFn(), ["1NT", "2H"]);
        if (result && result.call.type === "bid") {
          const bid = result.call;
          expect(
            bid.level === 2 && bid.strain === BidSuit.Clubs,
            `${name}: 2C Stayman must not appear after overcall`,
          ).toBe(false);
        }
      }
    });
  });

  describe("1NT-2D (overcalled with diamonds)", () => {
    test("no artificial conventional bid returned when system off", () => {
      for (const [name, handFn] of Object.entries(hands)) {
        const { result } = suggest(handFn(), ["1NT", "2D"]);
        if (result && result.call.type === "bid") {
          const bid = result.call;
          expect(
            bid.level === 2 && bid.strain === BidSuit.Clubs,
            `${name}: 2C Stayman must not appear after overcall`,
          ).toBe(false);
        }
      }
    });
  });
});
