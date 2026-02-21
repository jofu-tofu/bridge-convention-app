// Sources consulted:
// - bridgebum.com/bergen_raises.php [bridgebum/bergen]
// - ACBL Standard American Yellow Card [SAYC]

import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit, Vulnerability } from "../../engine/types";
import type { ContractBid, Hand, Deal } from "../../engine/types";
import { calculateHcp, getSuitLength, evaluateHand } from "../../engine/hand-evaluator";
import { checkConstraints, generateDeal } from "../../engine/deal-generator";
import {
  registerConvention,
  clearRegistry,
  evaluateBiddingRules,
} from "../registry";
import { bergenConfig, bergenDealConstraints } from "../bergen-raises";
import type { BiddingContext } from "../types";
import { hand, auctionFromBids } from "./fixtures";

beforeEach(() => {
  clearRegistry();
  registerConvention(bergenConfig);
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
  };
}

function callFromRules(
  h: Hand,
  seat: Seat,
  bids: string[],
  dealer: Seat = Seat.North,
) {
  const context = makeBiddingContext(h, seat, bids, dealer);
  return evaluateBiddingRules(bergenConfig.biddingRules, context);
}

// HCP reference: A=4, K=3, Q=2, J=1

// ─── Deal Constraints ───────────────────────────────────────

describe("Bergen Raises deal constraints", () => {
  test("[bridgebum/bergen] opener 12-21 HCP with 5+ major", () => {
    for (let i = 0; i < 20; i++) {
      const result = generateDeal(bergenDealConstraints);
      const openerHand = result.deal.hands[Seat.North];
      const hcp = calculateHcp(openerHand);
      const shape = getSuitLength(openerHand);

      expect(hcp).toBeGreaterThanOrEqual(12);
      expect(hcp).toBeLessThanOrEqual(21);
      // At least one major is 5+
      const hasSpades = shape[0]! >= 5;
      const hasHearts = shape[1]! >= 5;
      expect(hasSpades || hasHearts).toBe(true);
    }
  });

  test("[bridgebum/bergen] responder 6-12 HCP with 4+ major", () => {
    for (let i = 0; i < 20; i++) {
      const result = generateDeal(bergenDealConstraints);
      const responderHand = result.deal.hands[Seat.South];
      const hcp = calculateHcp(responderHand);
      const shape = getSuitLength(responderHand);

      expect(hcp).toBeGreaterThanOrEqual(6);
      expect(hcp).toBeLessThanOrEqual(12);
      const hasSpades = shape[0]! >= 4;
      const hasHearts = shape[1]! >= 4;
      expect(hasSpades || hasHearts).toBe(true);
    }
  });

  test("[bridgebum/bergen] rejects opener with only 4-card major", () => {
    // 16 HCP but only 4 hearts — needs 5+
    // SK(3) SQ(2) S3 = 5, HK(3) HQ(2) HJ(1) H2 = 6, DK(3) D5 D3 = 3, C7 C5 C2 = 0 => 14
    // Need a hand with 4H max and no 5+ spades: 3-4-3-3
    const fourCardMajor = hand(
      "SA", "SK", "S3",           // 7 HCP (3 spades)
      "HK", "HQ", "HJ", "H2",   // 6 HCP (4 hearts)
      "DK", "D5", "D3",          // 3 HCP (3 diamonds)
      "C7", "C5", "C2",          // 0 HCP (3 clubs)
    ); // total 16 HCP
    const shape = getSuitLength(fourCardMajor);
    expect(shape[0]).toBeLessThan(5); // spades < 5
    expect(shape[1]).toBe(4);         // hearts = 4
    const satisfied = checkConstraints(
      {
        hands: {
          [Seat.North]: fourCardMajor,
          [Seat.East]: hand("S4", "S5", "S6", "H4", "H5", "H6", "H7", "D2", "D4", "D6", "C3", "C4", "C6"),
          [Seat.South]: hand("S7", "S8", "SQ", "HT", "H8", "H3", "H9", "DQ", "DJ", "D7", "CK", "CQ", "CJ"),
          [Seat.West]: hand("S9", "ST", "SJ", "S2", "HA", "DA", "DT", "D9", "D8", "CA", "CT", "C9", "C8"),
        },
        dealer: Seat.North,
        vulnerability: Vulnerability.None,
      },
      bergenDealConstraints,
    );
    expect(satisfied).toBe(false);
  });

  test("[bridgebum/bergen] rejects responder with 5 HCP", () => {
    // HK(3) + HJ(1) + CJ(1) = 5 HCP, 4 hearts
    const weakResponder = hand(
      "S8", "S5", "S2",
      "HK", "HJ", "H6", "H2",
      "DT", "D7", "D3",
      "CJ", "C5", "C2",
    );
    expect(calculateHcp(weakResponder)).toBe(5);
    const satisfied = checkConstraints(
      {
        hands: {
          [Seat.North]: hand("SA", "SK", "S3", "HA", "HQ", "H7", "H3", "H9", "DK", "D5", "C7", "C4", "C3"),
          [Seat.East]: hand("S4", "S6", "S7", "H4", "H5", "HT", "D2", "D4", "D6", "D8", "C6", "C8", "C9"),
          [Seat.South]: weakResponder,
          [Seat.West]: hand("S9", "ST", "SJ", "SQ", "H8", "DA", "DQ", "DJ", "D9", "CA", "CK", "CQ", "CT"),
        },
        dealer: Seat.North,
        vulnerability: Vulnerability.None,
      },
      bergenDealConstraints,
    );
    expect(satisfied).toBe(false);
  });

  test("[bridgebum/bergen] accepts responder with exactly 6 HCP", () => {
    // HK(3) + HQ(2) + CJ(1) = 6 HCP, 4 hearts
    const minResponder = hand(
      "S8", "S5", "S2",
      "HK", "HQ", "H6", "H2",
      "DT", "D7", "D3",
      "CJ", "C5", "C2",
    );
    expect(calculateHcp(minResponder)).toBe(6);
    const satisfied = checkConstraints(
      {
        hands: {
          [Seat.North]: hand("SA", "SK", "S3", "HA", "HJ", "H7", "H3", "H9", "DK", "D5", "C7", "C4", "C3"),
          [Seat.East]: hand("S4", "S6", "S7", "H4", "H5", "HT", "D2", "D4", "D6", "D8", "C6", "C8", "C9"),
          [Seat.South]: minResponder,
          [Seat.West]: hand("S9", "ST", "SJ", "SQ", "H8", "DA", "DQ", "DJ", "D9", "CA", "CK", "CQ", "CT"),
        },
        dealer: Seat.North,
        vulnerability: Vulnerability.None,
      },
      bergenDealConstraints,
    );
    expect(satisfied).toBe(true);
  });
});

// ─── Bidding Rule Matching ──────────────────────────────────

describe("Bergen Raises bidding rules — constructive raise", () => {
  // 8 HCP: HK(3) + DK(3) + DQ(2) = 8, 4 hearts
  const constructiveHand = () => hand(
    "S8", "S5", "S2",
    "HK", "HT", "H6", "H2",
    "DK", "DQ", "D3",
    "C5", "C3", "C2",
  );

  test("[bridgebum/bergen] bergen-constructive-raise matches 7-9 HCP 4+ support after 1H-P", () => {
    const responder = constructiveHand();
    expect(calculateHcp(responder)).toBe(8);
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-constructive-raise");
  });

  test("[bridgebum/bergen] bergen-constructive-raise produces 3C bid", () => {
    const responder = constructiveHand();
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("[bridgebum/bergen] constructive raise also works after 1S-P", () => {
    // 8 HCP: SK(3) + DK(3) + DQ(2) = 8, 4 spades
    const responder = hand(
      "SK", "ST", "S6", "S2",
      "H8", "H5", "H2",
      "DK", "DQ", "D3",
      "C5", "C3", "C2",
    );
    expect(calculateHcp(responder)).toBe(8);
    const result = callFromRules(responder, Seat.South, ["1S", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-constructive-raise");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Clubs);
  });
});

describe("Bergen Raises bidding rules — limit raise", () => {
  // 11 HCP: SA(4) + HK(3) + HJ(1) + DQ(2) + CJ(1) = 11, 4 hearts
  const limitHand = () => hand(
    "SA", "S5", "S2",
    "HK", "HJ", "H6", "H2",
    "DQ", "D7", "D3",
    "CJ", "C3", "C2",
  );

  test("[bridgebum/bergen] bergen-limit-raise matches 10-12 HCP 4+ support after 1H-P", () => {
    const responder = limitHand();
    expect(calculateHcp(responder)).toBe(11);
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-limit-raise");
  });

  test("[bridgebum/bergen] bergen-limit-raise produces 3D bid", () => {
    const responder = limitHand();
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Diamonds);
  });
});

describe("Bergen Raises bidding rules — game raise", () => {
  // 14 HCP: SA(4) + SK(3) + HQ(2) + DK(3) + DQ(2) = 14, 4 hearts
  const gameHand = () => hand(
    "SA", "SK", "S2",
    "HQ", "HT", "H6", "H2",
    "DK", "DQ", "D3",
    "C5", "C3", "C2",
  );

  test("[bridgebum/bergen] bergen-game-raise matches 13+ HCP 4+ support after 1H-P", () => {
    const responder = gameHand();
    expect(calculateHcp(responder)).toBe(14);
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-game-raise");
  });

  test("[bridgebum/bergen] bergen-game-raise produces 4H after 1H opening", () => {
    const responder = gameHand();
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("[bridgebum/bergen] bergen-game-raise produces 4S after 1S opening", () => {
    // 14 HCP: SK(3) + SQ(2) + HA(4) + DK(3) + DQ(2) = 14, 4 spades
    const responder = hand(
      "SK", "SQ", "S6", "S2",
      "HA", "H5", "H2",
      "DK", "DQ", "D3",
      "C5", "C3", "C2",
    );
    expect(calculateHcp(responder)).toBe(14);
    const result = callFromRules(responder, Seat.South, ["1S", "P"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Spades);
  });
});

describe("Bergen Raises bidding rules — preemptive raise", () => {
  // 5 HCP: HK(3) + HQ(2) = 5, 4 hearts
  const preemptiveHand = () => hand(
    "S8", "S5", "S2",
    "HK", "HQ", "H6", "H2",
    "DT", "D7", "D3",
    "C5", "C3", "C2",
  );

  test("[bridgebum/bergen] bergen-preemptive-raise matches 0-6 HCP 4+ support", () => {
    const responder = preemptiveHand();
    expect(calculateHcp(responder)).toBe(5);
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-preemptive-raise");
  });

  test("[bridgebum/bergen] bergen-preemptive-raise produces 3H after 1H opening", () => {
    const responder = preemptiveHand();
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("[bridgebum/bergen] bergen-preemptive-raise produces 3S after 1S opening", () => {
    // 4 HCP: SQ(2) + SJ(1) + DJ(1) = 4, 4 spades
    const responder = hand(
      "SQ", "SJ", "S6", "S2",
      "H8", "H5", "H2",
      "DJ", "D7", "D3",
      "C5", "C3", "C2",
    );
    expect(calculateHcp(responder)).toBe(4);
    const result = callFromRules(responder, Seat.South, ["1S", "P"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Spades);
  });
});

describe("Bergen Raises bidding rules — rejection cases", () => {
  test("[bridgebum/bergen] rejects responder with 4 spades after 1H (wrong major)", () => {
    // 11 HCP: SK(3) + SQ(2) + DK(3) + DQ(2) + DJ(1) = 11, 4 spades but only 2 hearts
    const responder = hand(
      "SK", "SQ", "S6", "S2",
      "H5", "H2",
      "DK", "DQ", "DJ", "D3",
      "C5", "C3", "C2",
    );
    expect(calculateHcp(responder)).toBe(11);
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).toBeNull();
  });

  test("[bridgebum/bergen] rejects responder without 4+ support", () => {
    // 8 HCP: HK(3) + DK(3) + DQ(2) = 8, only 3 hearts
    const responder = hand(
      "S8", "S5", "S2",
      "HK", "HT", "H6",
      "DK", "DQ", "D7", "D3",
      "C5", "C3", "C2",
    );
    expect(calculateHcp(responder)).toBe(8);
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).toBeNull();
  });

  test("[bridgebum/bergen] rejects when auction is not 1H-P or 1S-P", () => {
    // Valid Bergen hand but wrong auction (1NT-P)
    const responder = hand(
      "S8", "S5", "S2",
      "HK", "HT", "H6", "H2",
      "DK", "DQ", "D3",
      "C5", "C3", "C2",
    );
    const result = callFromRules(responder, Seat.South, ["1NT", "P"]);
    expect(result).toBeNull();
  });

  test("[bridgebum/bergen] rejects after 1D-P auction", () => {
    const responder = hand(
      "S8", "S5", "S2",
      "HK", "HT", "H6", "H2",
      "DK", "DQ", "D3",
      "C5", "C3", "C2",
    );
    const result = callFromRules(responder, Seat.South, ["1D", "P"]);
    expect(result).toBeNull();
  });
});

// ─── Boundary HCP Tests ─────────────────────────────────────

describe("Bergen Raises HCP boundary tests", () => {
  test("exactly 6 HCP matches preemptive (0-6)", () => {
    // HK(3) + HQ(2) + CJ(1) = 6 HCP, 4 hearts
    const responder = hand(
      "S8", "S5", "S2",
      "HK", "HQ", "H6", "H2",
      "DT", "D7", "D3",
      "CJ", "C5", "C2",
    );
    expect(calculateHcp(responder)).toBe(6);
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-preemptive-raise");
  });

  test("exactly 7 HCP matches constructive (7-9)", () => {
    // HK(3) + HQ(2) + DJ(1) + CJ(1) = 7 HCP, 4 hearts
    const responder = hand(
      "S8", "S5", "S2",
      "HK", "HQ", "H6", "H2",
      "DJ", "D7", "D3",
      "CJ", "C5", "C2",
    );
    expect(calculateHcp(responder)).toBe(7);
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-constructive-raise");
  });

  test("exactly 9 HCP matches constructive (7-9)", () => {
    // HK(3) + HQ(2) + DK(3) + CJ(1) = 9 HCP, 4 hearts
    const responder = hand(
      "S8", "S5", "S2",
      "HK", "HQ", "H6", "H2",
      "DK", "D7", "D3",
      "CJ", "C5", "C2",
    );
    expect(calculateHcp(responder)).toBe(9);
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-constructive-raise");
  });

  test("exactly 10 HCP matches limit (10-12)", () => {
    // HK(3) + HQ(2) + DK(3) + DQ(2) = 10 HCP, 4 hearts
    const responder = hand(
      "S8", "S5", "S2",
      "HK", "HQ", "H6", "H2",
      "DK", "DQ", "D3",
      "C5", "C3", "C2",
    );
    expect(calculateHcp(responder)).toBe(10);
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-limit-raise");
  });

  test("exactly 12 HCP matches limit (10-12)", () => {
    // SA(4) + HK(3) + HQ(2) + DK(3) = 12 HCP, 4 hearts
    const responder = hand(
      "SA", "S5", "S2",
      "HK", "HQ", "H6", "H2",
      "DK", "D7", "D3",
      "C5", "C3", "C2",
    );
    expect(calculateHcp(responder)).toBe(12);
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-limit-raise");
  });

  test("exactly 13 HCP matches game raise (13+)", () => {
    // SA(4) + HK(3) + HQ(2) + DK(3) + CJ(1) = 13 HCP, 4 hearts
    const responder = hand(
      "SA", "S5", "S2",
      "HK", "HQ", "H6", "H2",
      "DK", "D7", "D3",
      "CJ", "C3", "C2",
    );
    expect(calculateHcp(responder)).toBe(13);
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-game-raise");
  });
});

// ─── Edge Cases ────────────────────────────────────────────

describe("Bergen Raises edge cases", () => {
  test("responder with 4H + 4S after 1H bids hearts (Bergen fires for opened major)", () => {
    // 8 HCP: HK(3) + DK(3) + DQ(2) = 8, 4H + 4S
    const responderBoth = hand(
      "SK", "ST", "S6", "S2",       // 3 HCP (4 spades)
      "HK", "HT", "H6", "H2",      // 3 HCP (4 hearts)
      "DQ", "D3",                    // 2 HCP (2 diamonds)
      "C5", "C3", "C2",             // 0 HCP (3 clubs)
    );
    expect(calculateHcp(responderBoth)).toBe(8);
    const result = callFromRules(responderBoth, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-constructive-raise");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("responder with exactly 0 HCP and 4+ support fires preemptive", () => {
    // 0 HCP, 4 hearts — preemptive range (0-6)
    const zeroHcp = hand(
      "S8", "S5", "S2",
      "H9", "H7", "H6", "H2",
      "DT", "D7", "D3",
      "C5", "C3", "C2",
    );
    expect(calculateHcp(zeroHcp)).toBe(0);
    const result = callFromRules(zeroHcp, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-preemptive-raise");
  });

  test("responder with 13 HCP but only 3-card support returns null", () => {
    // SA(4)+SK(3)+HK(3)+DK(3) = 13 HCP, only 3 hearts
    const noFit = hand(
      "SA", "SK", "S5", "S2",
      "HK", "H5", "H2",
      "DK", "D7", "D3",
      "C5", "C3", "C2",
    );
    expect(calculateHcp(noFit)).toBe(13);
    const result = callFromRules(noFit, Seat.South, ["1H", "P"]);
    expect(result).toBeNull();
  });
});

// ─── Full Sequence Integration ──────────────────────────────

describe("Bergen Raises full sequences", () => {
  test("1H-P-3C (constructive raise with 8 HCP, 4 hearts)", () => {
    // HK(3) + DK(3) + DQ(2) = 8 HCP, 4 hearts
    const responder = hand(
      "S8", "S5", "S2",
      "HK", "HT", "H6", "H2",
      "DK", "DQ", "D3",
      "C5", "C3", "C2",
    );
    expect(calculateHcp(responder)).toBe(8);
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-constructive-raise");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("1S-P-3D (limit raise with 11 HCP, 4 spades)", () => {
    // SK(3) + SQ(2) + HA(4) + DQ(2) = 11 HCP, 4 spades
    const responder = hand(
      "SK", "SQ", "S6", "S2",
      "HA", "H5", "H2",
      "DQ", "D7", "D3",
      "C5", "C3", "C2",
    );
    expect(calculateHcp(responder)).toBe(11);
    const result = callFromRules(responder, Seat.South, ["1S", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-limit-raise");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Diamonds);
  });

  test("1H-P-4H (game raise with 14 HCP, 4 hearts)", () => {
    // SA(4) + SK(3) + HQ(2) + DK(3) + DQ(2) = 14 HCP, 4 hearts
    const responder = hand(
      "SA", "SK", "S2",
      "HQ", "HT", "H6", "H2",
      "DK", "DQ", "D3",
      "C5", "C3", "C2",
    );
    expect(calculateHcp(responder)).toBe(14);
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-game-raise");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("1S-P-3S (preemptive with 5 HCP, 4 spades)", () => {
    // SK(3) + SQ(2) = 5 HCP, 4 spades
    const responder = hand(
      "SK", "SQ", "S6", "S2",
      "H8", "H5", "H2",
      "DT", "D7", "D3",
      "C5", "C3", "C2",
    );
    expect(calculateHcp(responder)).toBe(5);
    const result = callFromRules(responder, Seat.South, ["1S", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-preemptive-raise");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("1H-P-4H via game raise with 15 HCP, 5 hearts", () => {
    // SA(4) + SK(3) + HK(3) + HQ(2) + DK(3) = 15 HCP, 5 hearts
    const responder = hand(
      "SA", "SK", "S2",
      "HK", "HQ", "HT", "H6", "H2",
      "DK", "D3",
      "C5", "C3", "C2",
    );
    expect(calculateHcp(responder)).toBe(15);
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-game-raise");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });
});

// ─── Reference Hand Tests ───────────────────────────────────

describe("Bergen Raises reference hands", () => {
  test("[bridgebum/bergen] classic constructive: 7 HCP, 4H support", () => {
    // SJ(1) + HK(3) + DQ(2) + DJ(1) = 7 HCP, 4 hearts
    const responder = hand(
      "SJ", "S5", "S2",
      "HK", "H7", "H6", "H2",
      "DQ", "DJ", "D3",
      "C8", "C5", "C2",
    );
    expect(calculateHcp(responder)).toBe(7);
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-constructive-raise");
  });

  test("[bridgebum/bergen] limit raise with 10 HCP 4-card support", () => {
    // HK(3) + HQ(2) + DK(3) + DQ(2) = 10 HCP, 4 hearts
    const responder = hand(
      "S8", "S5", "S2",
      "HK", "HQ", "H6", "H2",
      "DK", "DQ", "D3",
      "C5", "C3", "C2",
    );
    expect(calculateHcp(responder)).toBe(10);
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-limit-raise");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Diamonds);
  });

  test("[bridgebum/bergen] game raise with strong hand and 4-card support", () => {
    // SA(4) + SK(3) + HQ(2) + DK(3) + DQ(2) = 14 HCP, 4 hearts
    const responder = hand(
      "SA", "SK", "S2",
      "HQ", "H7", "H6", "H2",
      "DK", "DQ", "D3",
      "C5", "C3", "C2",
    );
    expect(calculateHcp(responder)).toBe(14);
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-game-raise");
  });
});

// ─── Property-Based Invariants ──────────────────────────────

describe("Bergen Raises property-based invariants", () => {
  test("[bridgebum/bergen invariant] 50 random deals all produce a Bergen rule match", () => {
    for (let i = 0; i < 50; i++) {
      const result = generateDeal(bergenDealConstraints);
      const deal = result.deal;
      const responderHand = deal.hands[Seat.South];

      // Determine what opener bid based on opener's shape
      const openerShape = getSuitLength(deal.hands[Seat.North]);
      const spades = openerShape[0]!;
      const hearts = openerShape[1]!;
      const openMajor = (spades >= 5 && spades >= hearts) ? "1S" : "1H";

      const ctx = makeBiddingContext(responderHand, Seat.South, [openMajor, "P"]);
      const ruleResult = evaluateBiddingRules(bergenConfig.biddingRules, ctx);

      // The responder has 6-12 HCP and 4+ in at least one major, but
      // they may not have 4+ in the SPECIFIC major that was opened.
      // So we only assert a match when responder has support for the opened major.
      const responderShape = getSuitLength(responderHand);
      const hasSupportForOpened = openMajor === "1H"
        ? responderShape[1]! >= 4
        : responderShape[0]! >= 4;

      if (hasSupportForOpened) {
        expect(ruleResult).not.toBeNull();
        expect(ruleResult!.rule).toMatch(/^bergen-/);
      }
    }
  });

  test("[bridgebum/bergen invariant] defaultAuction returns correct opening based on deal", () => {
    // 5 hearts, 3 spades -> opens 1H
    const opener1H = hand(
      "SK", "S5", "S2",
      "HA", "HK", "HQ", "H7", "H3",
      "D5", "D3",
      "C5", "C3", "C2",
    );
    const filler1 = hand("S3", "S4", "S6", "H4", "H5", "H6", "D2", "D4", "D6", "D7", "C4", "C6", "C7");
    const filler2 = hand("S7", "S8", "S9", "HJ", "HT", "H9", "DK", "DQ", "DJ", "D8", "CK", "CQ", "CJ");
    const filler3 = hand("SA", "SQ", "ST", "SJ", "H8", "H2", "DA", "D9", "CA", "CT", "C9", "C8", "C3");

    const deal1H: Deal = {
      hands: {
        [Seat.North]: opener1H,
        [Seat.East]: filler1,
        [Seat.South]: filler2,
        [Seat.West]: filler3,
      },
      dealer: Seat.North,
      vulnerability: Vulnerability.None,
    };
    const auction1H = bergenConfig.defaultAuction!(Seat.South, deal1H);
    expect(auction1H).toBeDefined();
    expect(auction1H!.entries[0]!.call).toEqual({ type: "bid", level: 1, strain: BidSuit.Hearts });

    // 5 spades, 4 hearts -> opens 1S
    const opener1S = hand(
      "SA", "SK", "SQ", "S7", "S3",
      "HK", "HQ", "H7", "H3",
      "D5", "D3",
      "C5", "C2",
    );
    const deal1S: Deal = {
      hands: {
        [Seat.North]: opener1S,
        [Seat.East]: hand("S2", "S4", "S6", "H4", "H5", "H6", "D2", "D4", "D6", "D7", "C4", "C6", "C7"),
        [Seat.South]: hand("S8", "S9", "ST", "HJ", "HT", "H9", "DK", "DQ", "DJ", "D8", "CK", "CQ", "CJ"),
        [Seat.West]: hand("SJ", "S5", "H8", "H2", "DA", "DT", "D9", "CA", "CT", "C9", "C8", "C3", "HA"),
      },
      dealer: Seat.North,
      vulnerability: Vulnerability.None,
    };
    const auction1S = bergenConfig.defaultAuction!(Seat.South, deal1S);
    expect(auction1S).toBeDefined();
    expect(auction1S!.entries[0]!.call).toEqual({ type: "bid", level: 1, strain: BidSuit.Spades });

    // 5 hearts, 5 spades -> opens 1S (higher ranking)
    const opener55 = hand(
      "SA", "SK", "SQ", "S7", "S3",
      "HK", "HQ", "H7", "H6", "H3",
      "D5",
      "C5", "C2",
    );
    const deal55: Deal = {
      hands: {
        [Seat.North]: opener55,
        [Seat.East]: hand("S2", "S4", "S6", "H4", "H5", "D2", "D4", "D6", "D7", "D3", "C4", "C6", "C7"),
        [Seat.South]: hand("S8", "S9", "ST", "HJ", "HT", "H9", "DK", "DQ", "DJ", "D8", "CK", "CQ", "CJ"),
        [Seat.West]: hand("SJ", "S5", "H8", "H2", "DA", "DT", "D9", "CA", "CT", "C9", "C8", "C3", "HA"),
      },
      dealer: Seat.North,
      vulnerability: Vulnerability.None,
    };
    const auction55 = bergenConfig.defaultAuction!(Seat.South, deal55);
    expect(auction55).toBeDefined();
    expect(auction55!.entries[0]!.call).toEqual({ type: "bid", level: 1, strain: BidSuit.Spades });

    // 6 hearts, 5 spades -> opens 1H (longer)
    const opener65 = hand(
      "SA", "SK", "SQ", "S7", "S3",
      "HK", "HQ", "H7", "H6", "H3", "H2",
      "D5",
      "C2",
    );
    const deal65: Deal = {
      hands: {
        [Seat.North]: opener65,
        [Seat.East]: hand("S2", "S4", "S6", "H4", "H5", "D2", "D4", "D6", "D7", "D3", "C4", "C6", "C7"),
        [Seat.South]: hand("S8", "S9", "ST", "HJ", "HT", "H9", "DK", "DQ", "DJ", "D8", "CK", "CQ", "CJ"),
        [Seat.West]: hand("SJ", "S5", "H8", "DA", "DT", "D9", "CA", "CT", "C9", "C8", "C5", "C3", "HA"),
      },
      dealer: Seat.North,
      vulnerability: Vulnerability.None,
    };
    const auction65 = bergenConfig.defaultAuction!(Seat.South, deal65);
    expect(auction65).toBeDefined();
    expect(auction65!.entries[0]!.call).toEqual({ type: "bid", level: 1, strain: BidSuit.Hearts });
  });

  test("[bridgebum/bergen invariant] defaultAuction returns undefined for non-South seat", () => {
    expect(bergenConfig.defaultAuction!(Seat.North)).toBeUndefined();
    expect(bergenConfig.defaultAuction!(Seat.East)).toBeUndefined();
    expect(bergenConfig.defaultAuction!(Seat.West)).toBeUndefined();
  });

  test("[bridgebum/bergen invariant] defaultAuction without deal defaults to 1H-P", () => {
    const auction = bergenConfig.defaultAuction!(Seat.South);
    expect(auction).toBeDefined();
    expect(auction!.entries).toHaveLength(2);
    expect(auction!.entries[0]!.call).toEqual({ type: "bid", level: 1, strain: BidSuit.Hearts });
    expect(auction!.entries[1]!.call).toEqual({ type: "pass" });
  });

  test("[bridgebum/bergen invariant] all four rules produce distinct bids", () => {
    const rules = bergenConfig.biddingRules;
    expect(rules).toHaveLength(4);
    const names = rules.map(r => r.name);
    expect(new Set(names).size).toBe(4);
    expect(names).toContain("bergen-game-raise");
    expect(names).toContain("bergen-limit-raise");
    expect(names).toContain("bergen-constructive-raise");
    expect(names).toContain("bergen-preemptive-raise");
  });
});
