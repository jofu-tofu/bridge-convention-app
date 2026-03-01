// Edge case tests for Weak Two Bids + Ogust convention.
// Sources:
// - bridgebum.com/weak_two_bids.php [bridgebum/weak-twos]
// - bridgebum.com/ogust.php [bridgebum/ogust]

import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { ContractBid, Hand } from "../../../engine/types";
import { evaluateHand } from "../../../engine/hand-evaluator";
import {
  registerConvention,
  clearRegistry,
  evaluateBiddingRules,
} from "../../core/registry";
import { weakTwosConfig } from "../../definitions/weak-twos";
import type { BiddingContext } from "../../core/types";
import { hand, auctionFromBids } from "../fixtures";

beforeEach(() => {
  clearRegistry();
  registerConvention(weakTwosConfig);
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

function callFromRules(
  h: Hand,
  seat: Seat,
  bids: string[],
  dealer: Seat = Seat.North,
) {
  const context = makeBiddingContext(h, seat, bids, dealer);
  return evaluateBiddingRules(context, weakTwosConfig);
}

// HCP reference: A=4, K=3, Q=2, J=1

// ─── Opening edge cases ─────────────────────────────────────

describe("Weak Two opening edge cases", () => {
  test("no 6-card suit does not open", () => {
    // 5-4-2-2 shape with 8 HCP
    // SK(3) SQ(2) S9 S7 S5 = 5 HCP in 5 spades
    // HK(3) H9 H7 H5 = 3 HCP in 4 hearts => 8 total
    const noLongSuit = hand(
      "SK", "SQ", "S9", "S7", "S5",        // 5 HCP, 5 spades
      "HK", "H9", "H7", "H5",              // 3 HCP, 4 hearts => 8 total
      "D5", "D3",                            // 2 diamonds
      "C5", "C3",                            // 2 clubs, 13 cards
    );
    const result = callFromRules(noLongSuit, Seat.North, [], Seat.North);
    expect(result).toBeNull();
  });

  test("6+ clubs does not open weak two (clubs not included)", () => {
    // CK(3) CQ(2) CJ(1) C9 C7 C5 = 6 HCP in 6 clubs + DQ(2) = 8 total
    const longClubs = hand(
      "S5", "S3",                            // 2 spades
      "H5", "H3",                            // 2 hearts
      "DQ", "D3", "D2",                     // 2 HCP, 3 diamonds
      "CK", "CQ", "CJ", "C9", "C7", "C5", // 6 HCP, 6 clubs => 8 total, 13 cards
    );
    const result = callFromRules(longClubs, Seat.North, [], Seat.North);
    expect(result).toBeNull();
  });

  test("exactly 5 HCP boundary opens weak two", () => {
    // SQ(2) S9 S7 S6 S5 S3 = 2 HCP in 6 spades + DK(3) = 5 total (minimum)
    const minHcp = hand(
      "SQ", "S9", "S7", "S6", "S5", "S3", // 2 HCP, 6 spades
      "H5", "H3", "H2",                    // 0 HCP
      "DK",                                 // 3 HCP => 5 total
      "C5", "C3", "C2",                    // 13 cards
    );
    const result = callFromRules(minHcp, Seat.North, [], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("exactly 11 HCP boundary opens weak two", () => {
    // SA(4) SK(3) S9 S7 S5 S3 = 7 HCP in 6 spades + HA(4) = 11 total (maximum)
    const maxHcp = hand(
      "SA", "SK", "S9", "S7", "S5", "S3", // 7 HCP, 6 spades
      "HA",                                 // 4 HCP => 11 total
      "D5", "D3", "D2",                    // 0 HCP
      "C5", "C3", "C2",                    // 13 cards
    );
    const result = callFromRules(maxHcp, Seat.North, [], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("hearts are checked before spades (priority)", () => {
    // Hand with both 6+ hearts and 6+ spades (7-6 shape)
    // HK(3) HQ(2) H9 H7 H6 H5 H3 = 5 HCP in 7 hearts
    // SQ(2) S9 S7 S6 S5 S3 = 2 HCP in 6 spades => 7 total
    const bothLong = hand(
      "SQ", "S9", "S7", "S6", "S5", "S3", // 2 HCP, 6 spades
      "HK", "HQ", "H9", "H7", "H6", "H5", "H3", // 5 HCP, 7 hearts => 7 total
    );
    const result = callFromRules(bothLong, Seat.North, [], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Hearts); // hearts first in tree
  });
});

// ─── Response edge cases ────────────────────────────────────

describe("Weak Two response edge cases", () => {
  test("exactly 14 HCP with 3+ support makes invite, not game", () => {
    // SA(4) SQ(2) S9 = 6 HCP in 3 spades
    // HA(4) HQ(2) = 6 HCP; DQ(2) = 2 HCP => 14 total
    const inviteBoundary = hand(
      "SA", "SQ", "S9",                     // 6 HCP, 3 spades
      "HA", "HQ", "H3",                     // 6 HCP, 3 hearts
      "DQ", "D5", "D3",                     // 2 HCP => 14 total
      "C5", "C3", "C2", "C7",              // 0 HCP, 13 cards
    );
    const result = callFromRules(inviteBoundary, Seat.South, ["2S", "P"], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("15 HCP with 3+ support makes invite (not game)", () => {
    // SA(4) SK(3) S9 = 7 HCP in 3 spades
    // HK(3) HQ(2) = 5 HCP; DK(3) = 3 HCP => 15 total
    const fifteenWithFit = hand(
      "SA", "SK", "S9",                     // 7 HCP, 3 spades
      "HK", "HQ", "H3",                     // 5 HCP, 3 hearts
      "DK", "D5", "D3",                     // 3 HCP => 15 total
      "C5", "C3", "C2", "C7",              // 0 HCP, 13 cards
    );
    const result = callFromRules(fifteenWithFit, Seat.South, ["2S", "P"], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("16 HCP with exactly 2 in partner's suit bids 2NT (Ogust)", () => {
    // SK(3) S9 = 3 HCP in 2 spades; partner opened 2S
    // HA(4) HK(3) HQ(2) = 9 HCP; DA(4) = 4 HCP => 16 total
    const noFitStrong = hand(
      "SK", "S9",                            // 3 HCP, 2 spades
      "HA", "HK", "HQ", "H3",              // 9 HCP, 4 hearts
      "DA", "D5", "D3",                     // 4 HCP => 16 total
      "C5", "C3", "C2", "C7",              // 0 HCP, 13 cards
    );
    const result = callFromRules(noFitStrong, Seat.South, ["2S", "P"], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test("convention does not apply to non-responder seats", () => {
    // East should not respond to North's 2S opening
    const eastHand = hand(
      "SA", "SK", "SQ",                     // 9 HCP
      "HA", "HK", "HQ",                     // 9 HCP => 18 total
      "D5", "D3", "D2",                     // 0 HCP
      "C5", "C3", "C2", "C7",              // 0 HCP, 13 cards
    );
    const result = callFromRules(eastHand, Seat.East, ["2S", "P"], Seat.North);
    expect(result).toBeNull();
  });
});

// ─── Ogust edge cases ───────────────────────────────────────

describe("Ogust edge cases", () => {
  test("boundary: 8 HCP is still min range", () => {
    // HK(3) HQ(2) H9 H7 H5 H3 = 5 HCP, 6 hearts, 2 top honors (K, Q)
    // SK(3) = 3 HCP => 8 total (min range 5-8)
    const eightHcp = hand(
      "SK", "S3", "S2",                     // 3 HCP, 3 spades
      "HK", "HQ", "H9", "H7", "H5", "H3", // 5 HCP, 2 top honors => 8 total
      "D5", "D3",                            // 0 HCP
      "C5", "C3",                            // 0 HCP, 13 cards
    );
    const result = callFromRules(eightHcp, Seat.North, ["2H", "P", "2NT", "P"], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Diamonds); // min + good suit => 3D
  });

  test("boundary: 9 HCP is max range", () => {
    // HK(3) HQ(2) H9 H7 H5 H3 = 5 HCP, 6 hearts, 2 top honors (K, Q)
    // SA(4) = 4 HCP => 9 total (max range 9-11)
    const nineHcp = hand(
      "SA", "S5", "S3",                     // 4 HCP, 3 spades
      "HK", "HQ", "H9", "H7", "H5", "H3", // 5 HCP, 2 top honors => 9 total
      "D5", "D3",                            // 0 HCP
      "C5", "C3",                            // 0 HCP, 13 cards
    );
    const result = callFromRules(nineHcp, Seat.North, ["2H", "P", "2NT", "P"], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Spades); // max + good suit => 3S
  });

  test("exactly 1 top honor is bad suit", () => {
    // HA(4) H9 H7 H6 H5 H3 = 4 HCP, 6 hearts, 1 top honor (A only)
    // SK(3) DQ(2) = 5 HCP => 9 total (max range)
    const oneHonor = hand(
      "SK", "S3", "S2",                     // 3 HCP, 3 spades
      "HA", "H9", "H7", "H6", "H5", "H3", // 4 HCP, 1 top honor
      "DQ", "D3",                            // 2 HCP => 9 total
      "C5", "C3",                            // 0 HCP, 13 cards
    );
    const result = callFromRules(oneHonor, Seat.North, ["2H", "P", "2NT", "P"], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts); // max + bad suit => 3H
  });

  test("suitQuality checks the opened suit, not other suits", () => {
    // Hand opened 2H but has AKQ in spades (should not count for hearts)
    // H9 H7 H6 H5 H3 H2 = 0 HCP, 6 hearts, 0 top honors in hearts
    // SA(4) SK(3) SQ(2) = 9 HCP in spades => 9 total (max range)
    const wrongSuitHonors = hand(
      "SA", "SK", "SQ",                     // 9 HCP in spades, 3 top honors in wrong suit
      "H9", "H7", "H6", "H5", "H3", "H2", // 0 HCP, 6 hearts, 0 top honors
      "D5", "D3",                            // 0 HCP
      "C5", "C3",                            // 0 HCP, 13 cards
    );
    const result = callFromRules(wrongSuitHonors, Seat.North, ["2H", "P", "2NT", "P"], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    // Max HCP + bad suit (no top honors in hearts) => 3H
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });
});
