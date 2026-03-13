// Sources consulted:
// - bridgebum.com/weak_two_bids.php [bridgebum/weak-twos]
// - bridgebum.com/ogust.php [bridgebum/ogust]
// - ACBL Standard American Yellow Card [SAYC]

import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { ContractBid, Deal, Hand } from "../../../engine/types";
import {
  calculateHcp,
  getSuitLength,
  evaluateHand,
} from "../../../engine/hand-evaluator";
import { checkConstraints, generateDeal } from "../../../engine/deal-generator";
import {
  registerConvention,
  clearRegistry,
  evaluateBiddingRules,
} from "../../core/registry";
import { weakTwosConfig, weakTwosDealConstraints } from "../../definitions/weak-twos";
import type { BiddingContext } from "../../core/types";
import { hand, auctionFromBids } from "../fixtures";
import { refDescribe } from "../../../test-support/tiers";

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

// ─── Deal Constraints ───────────────────────────────────────

refDescribe("[ref:bridgebum/weak-twos]", "Weak Two Bids deal constraints", () => {
  test("[bridgebum/weak-twos] opener 5-11 HCP with 6+ in a major or diamonds", () => {
    for (let i = 0; i < 20; i++) {
      const result = generateDeal(weakTwosDealConstraints);
      const openerHand = result.deal.hands[Seat.North];
      const hcp = calculateHcp(openerHand);
      const shape = getSuitLength(openerHand);

      expect(hcp).toBeGreaterThanOrEqual(5);
      expect(hcp).toBeLessThanOrEqual(11);
      // At least one suit is 6+
      const hasHearts = shape[1] >= 6;
      const hasSpades = shape[0] >= 6;
      const hasDiamonds = shape[2] >= 6;
      expect(hasHearts || hasSpades || hasDiamonds).toBe(true);
    }
  });

  test("[bridgebum/weak-twos] responder 10+ HCP", () => {
    for (let i = 0; i < 20; i++) {
      const result = generateDeal(weakTwosDealConstraints);
      const responderHand = result.deal.hands[Seat.South];
      const hcp = calculateHcp(responderHand);
      expect(hcp).toBeGreaterThanOrEqual(10);
    }
  });

  test("[bridgebum/weak-twos] rejects opener with 12+ HCP", () => {
    // SA(4) SK(3) SQ(2) S7 S5 S3 = 9 HCP in 6 spades
    // HA(4) = 4 HCP => 13 total (over 11 max)
    const tooStrong = hand(
      "SA", "SK", "SQ", "S7", "S5", "S3", // 9 HCP, 6 spades
      "HA",                                 // 4 HCP => 13 total
      "D5", "D3", "D2",
      "C5", "C3", "C2",
    );
    // checkConstraints takes a Deal-like object with .hands property
    const result = checkConstraints(
      { hands: { [Seat.North]: tooStrong } } as Deal,
      weakTwosDealConstraints,
    );
    expect(result).toBe(false);
  });
});

// ─── Round 1: Opening ───────────────────────────────────────

refDescribe("[ref:bridgebum/weak-twos]", "Weak Two opening bids", () => {
  test("[bridgebum/weak-twos] 6+ hearts with 8 HCP opens 2H", () => {
    // HK(3) HQ(2) H9 H7 H5 H3 = 5 HCP in 6 hearts + DK(3) = 8 total
    const weakHearts = hand(
      "S5", "S3", "S2",                     // 0 HCP, 3 spades
      "HK", "HQ", "H9", "H7", "H5", "H3", // 5 HCP, 6 hearts
      "DK",                                  // 3 HCP => 8 total
      "C5", "C3", "C2",
    );
    const result = callFromRules(weakHearts, Seat.North, [], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("[bridgebum/weak-twos] 6+ spades with 7 HCP opens 2S", () => {
    // SK(3) SQ(2) S9 S7 S5 S3 = 5 HCP in 6 spades + DQ(2) = 7 total
    const weakSpades = hand(
      "SK", "SQ", "S9", "S7", "S5", "S3", // 5 HCP, 6 spades
      "H5", "H3", "H2",                    // 0 HCP, 3 hearts
      "DQ",                                 // 2 HCP => 7 total
      "C5", "C3", "C2",
    );
    const result = callFromRules(weakSpades, Seat.North, [], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("[bridgebum/weak-twos] 6+ diamonds with 9 HCP opens 2D", () => {
    // DK(3) DQ(2) DJ(1) D7 D5 D3 = 6 HCP in 6 diamonds + SK(3) = 9 total
    const weakDiamonds = hand(
      "SK",                                  // 3 HCP
      "H5", "H3", "H2",                     // 0 HCP
      "DK", "DQ", "DJ", "D7", "D5", "D3",  // 6 HCP, 6 diamonds
      "C5", "C3", "C2",                     // 0 HCP => 9 total, 13 cards
    );
    const result = callFromRules(weakDiamonds, Seat.North, [], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Diamonds);
  });

  test("[bridgebum/weak-twos] 5-card suit does not open", () => {
    // SK(3) SQ(2) S9 S7 S5 = 5 HCP in 5 spades + DK(3) = 8 total
    const fiveCardSuit = hand(
      "SK", "SQ", "S9", "S7", "S5",        // 5 HCP, 5 spades
      "H5", "H3", "H2",                     // 0 HCP
      "DK",                                  // 3 HCP => 8 total
      "C9", "C5", "C3", "C2",              // 0 HCP, 13 cards
    );
    const result = callFromRules(fiveCardSuit, Seat.North, [], Seat.North);
    expect(result).toBeNull();
  });

  test("[bridgebum/weak-twos] 12+ HCP does not open weak two", () => {
    // SA(4) SK(3) SQ(2) SJ(1) S7 S5 = 10 HCP in 6 spades + DK(3) = 13 total
    const tooStrong = hand(
      "SA", "SK", "SQ", "SJ", "S7", "S5", // 10 HCP, 6 spades
      "H5", "H3", "H2",                    // 0 HCP
      "DK",                                 // 3 HCP => 13 total
      "C5", "C3", "C2",                    // 13 cards
    );
    const result = callFromRules(tooStrong, Seat.North, [], Seat.North);
    expect(result).toBeNull();
  });

  test("[bridgebum/weak-twos] 4 HCP does not open weak two", () => {
    // SQ(2) S9 S7 S6 S5 S3 = 2 HCP in 6 spades + DQ(2) = 4 total
    const tooWeak = hand(
      "SQ", "S9", "S7", "S6", "S5", "S3", // 2 HCP, 6 spades
      "H5", "H3", "H2",                    // 0 HCP
      "DQ",                                 // 2 HCP => 4 total
      "C5", "C3", "C2",                    // 13 cards
    );
    const result = callFromRules(tooWeak, Seat.North, [], Seat.North);
    expect(result).toBeNull();
  });
});

// ─── Round 2: Response ──────────────────────────────────────

refDescribe("[ref:bridgebum/weak-twos]", "Weak Two responses", () => {
  test("[bridgebum/weak-twos] 16+ HCP with 3+ support raises to 4M", () => {
    // SA(4) SK(3) SQ(2) = 9 HCP in 3 spades
    // HA(4) HK(3) = 7 HCP => 16 total
    const strongFit = hand(
      "SA", "SK", "SQ",                     // 9 HCP, 3 spades
      "HA", "HK", "H3",                     // 7 HCP => 16 total, 3 hearts
      "D5", "D3", "D2",                     // 0 HCP
      "C5", "C3", "C2", "C7",              // 0 HCP, 13 cards
    );
    const result = callFromRules(strongFit, Seat.South, ["2S", "P"], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("[bridgebum/ogust] 16+ HCP without support bids 2NT (Ogust)", () => {
    // SA(4) SK(3) = 7 HCP in 2 spades; partner opened 2H
    // HA(4) HK(3) = 7 HCP, 2 hearts (no 3+ support)
    // DK(3) = 3 HCP => 17 total
    const strongNoFit = hand(
      "SA", "SK",                            // 7 HCP, 2 spades
      "HA", "HK",                            // 7 HCP, 2 hearts
      "DK", "D5", "D3",                     // 3 HCP => 17 total
      "C8", "C7", "C5", "C3", "C2", "C6",  // 0 HCP, 13 cards
    );
    const result = callFromRules(strongNoFit, Seat.South, ["2H", "P"], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test("[bridgebum/weak-twos] 14-15 HCP with 3+ support makes invitational raise", () => {
    // SA(4) SK(3) SQ(2) = 9 HCP in 3 spades; partner opened 2S
    // HK(3) HQ(2) = 5 HCP => 14 total
    const inviteFit = hand(
      "SA", "SK", "SQ",                     // 9 HCP, 3 spades
      "HK", "HQ", "H3",                     // 5 HCP => 14 total, 3 hearts
      "D5", "D3", "D2",                     // 0 HCP
      "C5", "C3", "C2", "C7",              // 0 HCP, 13 cards
    );
    const result = callFromRules(inviteFit, Seat.South, ["2S", "P"], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("[bridgebum/weak-twos] weak responder passes", () => {
    // SK(3) SQ(2) = 5 HCP, 2 spades (no 3+ support)
    // HK(3) HQ(2) = 5 HCP => 10 total (under 14, no 3+ support)
    const weakHand = hand(
      "SK", "SQ",                            // 5 HCP, 2 spades
      "HK", "HQ",                            // 5 HCP => 10 total
      "D7", "D5", "D3", "D2",              // 0 HCP
      "C7", "C6", "C5", "C3", "C2",        // 0 HCP, 13 cards
    );
    const result = callFromRules(weakHand, Seat.South, ["2S", "P"], Seat.North);
    expect(result).toBeNull();
  });

  test("[bridgebum/weak-twos] 16+ HCP with 3+ diamond support raises to 5D (minor game)", () => {
    // DA(4) DK(3) DQ(2) = 9 HCP in 3 diamonds; partner opened 2D
    // SA(4) SK(3) = 7 HCP => 16 total
    const strongDiamondFit = hand(
      "SA", "SK", "S3",                      // 7 HCP, 3 spades
      "H5", "H3", "H2",                      // 0 HCP, 3 hearts
      "DA", "DK", "DQ",                      // 9 HCP, 3 diamonds => 16 total
      "C5", "C3", "C2", "C7",               // 0 HCP, 13 cards
    );
    const result = callFromRules(strongDiamondFit, Seat.South, ["2D", "P"], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(5);
    expect(call.strain).toBe(BidSuit.Diamonds);
  });

  test("[bridgebum/weak-twos] 16+ HCP with 3+ hearts support raises to 4H", () => {
    // HA(4) HK(3) HQ(2) = 9 HCP in 3 hearts; partner opened 2H
    // SA(4) SK(3) = 7 HCP => 16 total
    const strongHeartFit = hand(
      "SA", "SK", "S3",                      // 7 HCP, 3 spades
      "HA", "HK", "HQ",                     // 9 HCP, 3 hearts => 16 total
      "D5", "D3", "D2",                     // 0 HCP
      "C5", "C3", "C2", "C7",              // 0 HCP, 13 cards
    );
    const result = callFromRules(strongHeartFit, Seat.South, ["2H", "P"], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });
});

// ─── Round 3: Ogust Rebid ───────────────────────────────────

refDescribe("[ref:bridgebum/ogust]", "Ogust rebids", () => {
  test("[bridgebum/ogust] min HCP + bad suit => 3C", () => {
    // Opener opened 2H with 6 HCP and bad suit (0 top honors in hearts)
    // HJ(1) H9 H7 H6 H5 H3 = 1 HCP, 6 hearts, 0 top honors (J is not AKQ)
    // SK(3) DQ(2) = 5 HCP => 6 total
    const minBadSuit = hand(
      "SK", "S3",                            // 3 HCP, 2 spades
      "HJ", "H9", "H7", "H6", "H5", "H3", // 1 HCP, 6 hearts
      "DQ", "D3",                            // 2 HCP => 6 total
      "C5", "C3", "C2",                     // 13 cards
    );
    // North opened 2H, East passed, South bid 2NT (Ogust), West passed
    const result = callFromRules(minBadSuit, Seat.North, ["2H", "P", "2NT", "P"], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("[bridgebum/ogust] min HCP + good suit => 3D", () => {
    // Opener opened 2H with 7 HCP and good suit (2 top honors: K, Q)
    // HK(3) HQ(2) H9 H7 H5 H3 = 5 HCP, 6 hearts, 2 top honors
    // DQ(2) = 2 HCP => 7 total
    const minGoodSuit = hand(
      "S5", "S3", "S2",                     // 0 HCP, 3 spades
      "HK", "HQ", "H9", "H7", "H5", "H3", // 5 HCP, 6 hearts, 2 top honors
      "DQ",                                  // 2 HCP => 7 total
      "C5", "C3", "C2",                     // 13 cards
    );
    const result = callFromRules(minGoodSuit, Seat.North, ["2H", "P", "2NT", "P"], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Diamonds);
  });

  test("[bridgebum/ogust] max HCP + bad suit => 3H", () => {
    // Opener opened 2H with 10 HCP and bad suit (J only = 0 top honors)
    // HJ(1) H9 H7 H6 H5 H3 = 1 HCP, 6 hearts, 0 top honors
    // SA(4) SK(3) DQ(2) = 9 HCP => 10 total
    const maxBadSuit = hand(
      "SA", "SK", "S3",                     // 7 HCP, 3 spades
      "HJ", "H9", "H7", "H6", "H5", "H3", // 1 HCP, 6 hearts
      "DQ",                                  // 2 HCP => 10 total
      "C5", "C3", "C2",                     // 13 cards
    );
    const result = callFromRules(maxBadSuit, Seat.North, ["2H", "P", "2NT", "P"], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("[bridgebum/ogust] max HCP + good suit => 3S", () => {
    // Opener opened 2H with 10 HCP and good suit (A, K = 2 top honors)
    // HA(4) HK(3) H9 H7 H5 H3 = 7 HCP, 6 hearts, 2 top honors
    // DK(3) = 3 HCP => 10 total
    const maxGoodSuit = hand(
      "S5", "S3", "S2",                     // 0 HCP, 3 spades
      "HA", "HK", "H9", "H7", "H5", "H3", // 7 HCP, 6 hearts, 2 top honors
      "DK",                                  // 3 HCP => 10 total
      "C5", "C3", "C2",                     // 13 cards
    );
    const result = callFromRules(maxGoodSuit, Seat.North, ["2H", "P", "2NT", "P"], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("[bridgebum/ogust] solid suit (AKQ) => 3NT", () => {
    // Opener opened 2H with 11 HCP and solid suit (AKQ = 3 top honors)
    // HA(4) HK(3) HQ(2) H7 H5 H3 = 9 HCP, 6 hearts, 3 top honors
    // DQ(2) = 2 HCP => 11 total
    const solidSuit = hand(
      "S5", "S3", "S2",                     // 0 HCP, 3 spades
      "HA", "HK", "HQ", "H7", "H5", "H3", // 9 HCP, 6 hearts, 3 top honors
      "DQ",                                  // 2 HCP => 11 total
      "C5", "C3", "C2",                     // 13 cards
    );
    const result = callFromRules(solidSuit, Seat.North, ["2H", "P", "2NT", "P"], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test("[bridgebum/ogust] Ogust works for spade openings too", () => {
    // Opener opened 2S with 9 HCP and good suit (A, K = 2 top honors)
    // SA(4) SK(3) S9 S7 S5 S3 = 7 HCP, 6 spades, 2 top honors
    // HQ(2) = 2 HCP => 9 total
    const spadeMaxGood = hand(
      "SA", "SK", "S9", "S7", "S5", "S3", // 7 HCP, 6 spades
      "HQ",                                 // 2 HCP => 9 total
      "D5", "D3", "D2",                    // 0 HCP
      "C5", "C3", "C2",                    // 13 cards
    );
    const result = callFromRules(spadeMaxGood, Seat.North, ["2S", "P", "2NT", "P"], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Spades); // max HCP + good suit
  });

  test("[bridgebum/ogust] Ogust works for diamond openings too", () => {
    // Opener opened 2D with 7 HCP and good suit (A, K = 2 top honors)
    // DA(4) DK(3) D9 D7 D5 D3 = 7 HCP, 6 diamonds, 2 top honors
    const diamondMinGood = hand(
      "S5", "S3", "S2",                     // 0 HCP, 3 spades
      "H5", "H3",                            // 0 HCP, 2 hearts
      "DA", "DK", "D9", "D7", "D5", "D3",  // 7 HCP, 6 diamonds
      "C5", "C2",                            // 0 HCP, 13 cards
    );
    const result = callFromRules(diamondMinGood, Seat.North, ["2D", "P", "2NT", "P"], Seat.North);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Diamonds); // min HCP + good suit
  });
});
