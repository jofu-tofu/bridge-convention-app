import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { ContractBid, Hand } from "../../../engine/types";
import {
  calculateHcp,
  getSuitLength,
  isBalanced,
} from "../../../engine/hand-evaluator";
import { checkConstraints, generateDeal } from "../../../engine/deal-generator";
import {
  registerConvention,
  clearRegistry,
  evaluateBiddingRules,
} from "../../core/registry";
import { staymanConfig, staymanDealConstraints } from "../../definitions/stayman";
import type { BiddingContext } from "../../core/types";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { hand, auctionFromBids } from "../fixtures";

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
  };
}

function callFromRules(
  h: Hand,
  seat: Seat,
  bids: string[],
  dealer: Seat = Seat.North,
) {
  const context = makeBiddingContext(h, seat, bids, dealer);
  return evaluateBiddingRules(context, staymanConfig);
}

// ─── Deal Constraints ───────────────────────────────────────

describe("Stayman deal constraints", () => {
  test("opener 15-17 HCP, balanced, no 5-card major", () => {
    for (let i = 0; i < 20; i++) {
      const result = generateDeal(staymanDealConstraints);
      const openerHand = result.deal.hands[Seat.North];
      const hcp = calculateHcp(openerHand);
      const shape = getSuitLength(openerHand);

      expect(hcp).toBeGreaterThanOrEqual(15);
      expect(hcp).toBeLessThanOrEqual(17);
      expect(isBalanced(shape)).toBe(true);
      // SUIT_ORDER: [Spades, Hearts, Diamonds, Clubs]
      expect(shape[0]).toBeLessThanOrEqual(4); // spades
      expect(shape[1]).toBeLessThanOrEqual(4); // hearts
    }
  });

  test("responder 8+ HCP, at least one 4-card major", () => {
    for (let i = 0; i < 20; i++) {
      const result = generateDeal(staymanDealConstraints);
      const responderHand = result.deal.hands[Seat.South];
      const hcp = calculateHcp(responderHand);
      const shape = getSuitLength(responderHand);

      expect(hcp).toBeGreaterThanOrEqual(8);
      // At least one major is 4+
      const hasSpades = shape[0]! >= 4;
      const hasHearts = shape[1]! >= 4;
      expect(hasSpades || hasHearts).toBe(true);
    }
  });

  test("rejects: opener 14 HCP", () => {
    // 14 HCP balanced hand — should not satisfy opener constraints
    const lowHcpOpener = hand(
      "SA",
      "SK",
      "SQ",
      "S2", // 9 HCP in spades (4 cards)
      "HK",
      "H5",
      "H4", // 3 HCP in hearts (3 cards)
      "DJ",
      "D8",
      "D3", // 1 HCP in diamonds (3 cards)
      "CJ",
      "C7",
      "C2", // 1 HCP in clubs (3 cards)
    );
    const hcp = calculateHcp(lowHcpOpener);
    expect(hcp).toBe(14);
    const satisfied = checkConstraints(
      {
        hands: {
          [Seat.North]: lowHcpOpener,
          [Seat.East]: hand(
            "S3",
            "S4",
            "S5",
            "H2",
            "H3",
            "H6",
            "H7",
            "D2",
            "D4",
            "D5",
            "C3",
            "C4",
            "C5",
          ),
          [Seat.South]: hand(
            "S6",
            "S7",
            "S8",
            "HQ",
            "HJ",
            "HT",
            "H8",
            "DK",
            "DQ",
            "D6",
            "CK",
            "CQ",
            "CJ",
          ),
          [Seat.West]: hand(
            "S9",
            "ST",
            "SJ",
            "H9",
            "HA",
            "DA",
            "D7",
            "D9",
            "DT",
            "CA",
            "C6",
            "C8",
            "CT",
          ),
        },
        dealer: Seat.North,
        vulnerability:
          "None" as unknown as import("../../../engine/types").Vulnerability, // cast: test convenience
      },
      staymanDealConstraints,
    );
    expect(satisfied).toBe(false);
  });

  test("rejects: opener 18 HCP", () => {
    // 18 HCP balanced — too high for 1NT (15-17)
    const highHcpOpener = hand(
      "SA",
      "SK",
      "SQ",
      "S2", // 9 HCP (4 cards)
      "HA",
      "HK",
      "H3", // 7 HCP (3 cards)
      "DQ",
      "D8",
      "D3", // 2 HCP (3 cards)
      "C9",
      "C7",
      "C2", // 0 HCP (3 cards)
    );
    expect(calculateHcp(highHcpOpener)).toBe(18);
    const satisfied = checkConstraints(
      {
        hands: {
          [Seat.North]: highHcpOpener,
          [Seat.East]: hand(
            "S3",
            "S4",
            "S5",
            "H2",
            "H4",
            "H5",
            "H6",
            "D2",
            "D4",
            "D5",
            "C3",
            "C4",
            "C5",
          ),
          [Seat.South]: hand(
            "S6",
            "S7",
            "S8",
            "HQ",
            "HJ",
            "HT",
            "H8",
            "DK",
            "DJ",
            "D6",
            "CK",
            "CQ",
            "CJ",
          ),
          [Seat.West]: hand(
            "S9",
            "ST",
            "SJ",
            "H9",
            "H7",
            "DA",
            "D7",
            "D9",
            "DT",
            "CA",
            "C6",
            "C8",
            "CT",
          ),
        },
        dealer: Seat.North,
        vulnerability:
          "None" as unknown as import("../../../engine/types").Vulnerability,
      },
      staymanDealConstraints,
    );
    expect(satisfied).toBe(false);
  });

  test("rejects: unbalanced opener", () => {
    // 17 HCP but 5-4-3-1 — unbalanced
    const unbalOpener = hand(
      "SA",
      "SK",
      "SQ",
      "SJ",
      "S2", // 10 HCP (5 spades)
      "HA",
      "HK",
      "H3",
      "H2", // 7 HCP (4 hearts)
      "D8",
      "D3",
      "D2", // 0 HCP (3 diamonds)
      "C2", // 0 HCP (1 club)
    );
    const shape = getSuitLength(unbalOpener);
    expect(isBalanced(shape)).toBe(false);
    const satisfied = checkConstraints(
      {
        hands: {
          [Seat.North]: unbalOpener,
          [Seat.East]: hand(
            "S3",
            "S4",
            "S5",
            "H4",
            "H5",
            "H6",
            "H7",
            "D4",
            "D5",
            "D6",
            "C3",
            "C4",
            "C5",
          ),
          [Seat.South]: hand(
            "S6",
            "S7",
            "S8",
            "HQ",
            "HJ",
            "HT",
            "H8",
            "DK",
            "DQ",
            "DJ",
            "CK",
            "CQ",
            "CJ",
          ),
          [Seat.West]: hand(
            "ST",
            "S9",
            "H9",
            "DA",
            "DT",
            "D9",
            "D7",
            "CA",
            "CT",
            "C9",
            "C8",
            "C7",
            "C6",
          ),
        },
        dealer: Seat.North,
        vulnerability:
          "None" as unknown as import("../../../engine/types").Vulnerability,
      },
      staymanDealConstraints,
    );
    expect(satisfied).toBe(false);
  });

  test("rejects: opener with 5-card major", () => {
    // 15 HCP, 5-3-3-2 with 5 spades — maxLength[Spades]=4 rejects this
    const fiveCardMajor = hand(
      "SA",
      "SK",
      "SQ",
      "S5",
      "S2", // 9 HCP (5 spades)
      "HK",
      "H5",
      "H4", // 3 HCP (3 hearts)
      "DK",
      "D8",
      "D3", // 3 HCP (3 diamonds)
      "C7",
      "C2", // 0 HCP (2 clubs)
    );
    const shape = getSuitLength(fiveCardMajor);
    expect(shape[0]).toBe(5); // 5 spades
    const satisfied = checkConstraints(
      {
        hands: {
          [Seat.North]: fiveCardMajor,
          [Seat.East]: hand(
            "S3",
            "S4",
            "S6",
            "H2",
            "H3",
            "H6",
            "H7",
            "D2",
            "D4",
            "D5",
            "C3",
            "C4",
            "C5",
          ),
          [Seat.South]: hand(
            "S7",
            "S8",
            "SJ",
            "HQ",
            "HJ",
            "HT",
            "H8",
            "DQ",
            "DJ",
            "D6",
            "CK",
            "CQ",
            "CJ",
          ),
          [Seat.West]: hand(
            "S9",
            "ST",
            "HA",
            "H9",
            "DA",
            "DT",
            "D9",
            "D7",
            "CA",
            "CT",
            "C9",
            "C8",
            "C6",
          ),
        },
        dealer: Seat.North,
        vulnerability:
          "None" as unknown as import("../../../engine/types").Vulnerability,
      },
      staymanDealConstraints,
    );
    expect(satisfied).toBe(false);
  });

  test("rejects: responder 7 HCP", () => {
    // 7 HCP with 4 spades — too few HCP for Stayman
    const lowResponder = hand(
      "SK",
      "SQ",
      "S8",
      "S3", // 5 HCP (4 spades)
      "HJ",
      "H8",
      "H5", // 1 HCP (3 hearts)
      "DT",
      "D9",
      "D4", // 0 HCP (3 diamonds)
      "CJ",
      "C5",
      "C2", // 1 HCP (3 clubs)
    );
    expect(calculateHcp(lowResponder)).toBe(7);
    // Opener is valid 16 HCP balanced — rejection is due to responder
    const satisfied = checkConstraints(
      {
        hands: {
          [Seat.North]: hand(
            "SA",
            "S5",
            "S2",
            "HA",
            "HQ",
            "H3",
            "DK",
            "D8",
            "D3",
            "CK",
            "C7",
            "C4",
            "C3",
          ),
          [Seat.East]: hand(
            "SJ",
            "S6",
            "S4",
            "HK",
            "HT",
            "H7",
            "DA",
            "DQ",
            "D5",
            "D2",
            "CA",
            "CQ",
            "C6",
          ),
          [Seat.South]: lowResponder,
          [Seat.West]: hand(
            "ST",
            "S9",
            "S7",
            "H9",
            "H6",
            "H4",
            "H2",
            "DJ",
            "D7",
            "D6",
            "CT",
            "C9",
            "C8",
          ),
        },
        dealer: Seat.North,
        vulnerability:
          "None" as unknown as import("../../../engine/types").Vulnerability,
      },
      staymanDealConstraints,
    );
    expect(satisfied).toBe(false);
  });

  test("rejects: responder with no 4-card major", () => {
    // 13 HCP but only 3 spades and 3 hearts — no 4-card major
    const noMajor = hand(
      "SA",
      "S5",
      "S2", // 4 HCP (3 spades)
      "HK",
      "H8",
      "H3", // 3 HCP (3 hearts)
      "DA",
      "DQ",
      "D7",
      "D4", // 6 HCP (4 diamonds)
      "C5",
      "C3",
      "C2", // 0 HCP (3 clubs)
    );
    const shape = getSuitLength(noMajor);
    expect(shape[0]).toBeLessThan(4); // spades < 4
    expect(shape[1]).toBeLessThan(4); // hearts < 4
    // Opener is valid 15 HCP balanced — rejection is due to responder
    const satisfied = checkConstraints(
      {
        hands: {
          [Seat.North]: hand(
            "SK",
            "SQ",
            "S9",
            "HQ",
            "HJ",
            "H7",
            "DK",
            "DJ",
            "D3",
            "CK",
            "C9",
            "C7",
            "C4",
          ),
          [Seat.East]: hand(
            "SJ",
            "S8",
            "S4",
            "HA",
            "HT",
            "H5",
            "H2",
            "DT",
            "D9",
            "D5",
            "CA",
            "CQ",
            "CT",
          ),
          [Seat.South]: noMajor,
          [Seat.West]: hand(
            "ST",
            "S7",
            "S6",
            "S3",
            "H9",
            "H6",
            "H4",
            "D8",
            "D6",
            "D2",
            "CJ",
            "C8",
            "C6",
          ),
        },
        dealer: Seat.North,
        vulnerability:
          "None" as unknown as import("../../../engine/types").Vulnerability,
      },
      staymanDealConstraints,
    );
    expect(satisfied).toBe(false);
  });
});

// ─── Bidding Rule Matching ──────────────────────────────────

describe("Stayman bidding rules — ask", () => {
  // Responder with 4+ hearts, 8+ HCP
  const responderWithHearts = hand(
    "SK",
    "S5",
    "S2", // 3 HCP (3 spades)
    "HA",
    "HK",
    "HQ",
    "H3", // 10 HCP (4 hearts)
    "D5",
    "D3",
    "D2", // 0 HCP (3 diamonds)
    "C5",
    "C3",
    "C2", // 0 HCP (3 clubs)
  );

  // Responder with 4+ spades, 8+ HCP
  const responderWithSpades = hand(
    "SA",
    "SK",
    "SQ",
    "S3", // 10 HCP (4 spades)
    "H5",
    "H3",
    "H2", // 0 HCP (3 hearts)
    "DK",
    "D5",
    "D3", // 3 HCP (3 diamonds)
    "C5",
    "C3",
    "C2", // 0 HCP (3 clubs)
  );

  test("2C matches with 4+ hearts 8+ HCP", () => {
    // Auction: North opens 1NT, East passes. South to bid.
    const result = callFromRules(responderWithHearts, Seat.South, ["1NT", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-ask");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("2C matches with 4+ spades 8+ HCP", () => {
    const result = callFromRules(responderWithSpades, Seat.South, ["1NT", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-ask");
  });

  test("2C does not match <8 HCP", () => {
    const weakResponder = hand(
      "SK",
      "S8",
      "S5",
      "S3", // 3 HCP (4 spades)
      "H5",
      "H3",
      "H2", // 0 HCP (3 hearts)
      "DQ",
      "D5",
      "D3", // 2 HCP (3 diamonds)
      "C5",
      "C3",
      "C2", // 0 HCP (3 clubs)
    );
    expect(calculateHcp(weakResponder)).toBeLessThan(8);
    const result = callFromRules(weakResponder, Seat.South, ["1NT", "P"]);
    // Should not match stayman-ask (may return null or different rule)
    if (result !== null) {
      expect(result.rule).not.toBe("stayman-ask");
    }
  });

  test("2C does not match without 4-card major", () => {
    const noMajor = hand(
      "SA",
      "S5",
      "S2", // 4 HCP (3 spades)
      "HK",
      "H8",
      "H3", // 3 HCP (3 hearts)
      "DA",
      "DQ",
      "D7",
      "D4", // 6 HCP (4 diamonds)
      "C5",
      "C3",
      "C2", // 0 HCP (3 clubs)
    );
    expect(calculateHcp(noMajor)).toBeGreaterThanOrEqual(8);
    const shape = getSuitLength(noMajor);
    expect(shape[0]).toBeLessThan(4);
    expect(shape[1]).toBeLessThan(4);
    const result = callFromRules(noMajor, Seat.South, ["1NT", "P"]);
    if (result !== null) {
      expect(result.rule).not.toBe("stayman-ask");
    }
  });
});

describe("Stayman bidding rules — opener response", () => {
  // Opener with 4 hearts (and not 4 spades)
  const openerWithHearts = hand(
    "SA",
    "SK",
    "S3", // 7 HCP (3 spades)
    "HK",
    "HQ",
    "HJ",
    "H2", // 6 HCP (4 hearts)
    "DA",
    "D5",
    "D3", // 4 HCP (3 diamonds)
    "C7",
    "C5",
    "C2", // 0 HCP (3 clubs)
  );

  // Opener with 4 spades (and not 4 hearts)
  const openerWithSpades = hand(
    "SA",
    "SK",
    "SQ",
    "S2", // 10 HCP (4 spades)
    "HK",
    "H5",
    "H3", // 3 HCP (3 hearts)
    "DK",
    "D5",
    "D3", // 3 HCP (3 diamonds)
    "C7",
    "C5",
    "C2", // 0 HCP (3 clubs)
  );

  // Opener with both 4-card majors
  const openerWithBoth = hand(
    "SA",
    "SK",
    "SQ",
    "S2", // 10 HCP (4 spades)
    "HK",
    "HQ",
    "H5",
    "H2", // 5 HCP (4 hearts)
    "D5",
    "D3", // 0 HCP (2 diamonds)
    "CK",
    "C5",
    "C2", // 3 HCP (3 clubs)
  );

  // Opener with no 4-card major
  const openerNoMajor = hand(
    "SA",
    "SK",
    "S2", // 7 HCP (3 spades)
    "HK",
    "H5",
    "H3", // 3 HCP (3 hearts)
    "DA",
    "DK",
    "D5",
    "D3", // 7 HCP (4 diamonds)
    "C5",
    "C3",
    "C2", // 0 HCP (3 clubs)
  );

  test("opener bids 2H with 4 hearts", () => {
    // Auction: 1NT - P - 2C - P (opener North to respond)
    const result = callFromRules(openerWithHearts, Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-response-hearts");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("opener bids 2S with 4 spades (not 4 hearts)", () => {
    const result = callFromRules(openerWithSpades, Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-response-spades");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("opener bids 2D with no 4-card major", () => {
    const result = callFromRules(openerNoMajor, Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-response-denial");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Diamonds);
  });

  test("opener bids 2H (not 2S) when holding both 4-card majors", () => {
    const result = callFromRules(openerWithBoth, Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-response-hearts");
    const call = result!.call as ContractBid;
    expect(call.strain).toBe(BidSuit.Hearts);
  });
});

describe("Stayman bidding rules — responder rebid", () => {
  // Responder with 4 hearts
  const responderHearts = hand(
    "SK",
    "S5",
    "S2", // 3 HCP (3 spades)
    "HA",
    "HK",
    "HQ",
    "H3", // 10 HCP (4 hearts)
    "D5",
    "D3",
    "D2", // 0 HCP (3 diamonds)
    "C5",
    "C3",
    "C2", // 0 HCP (3 clubs)
  );

  // Responder with 4 spades
  const responderSpades = hand(
    "SA",
    "SK",
    "SQ",
    "S3", // 10 HCP (4 spades)
    "H5",
    "H3",
    "H2", // 0 HCP (3 hearts)
    "DK",
    "D5",
    "D3", // 3 HCP (3 diamonds)
    "C5",
    "C3",
    "C2", // 0 HCP (3 clubs)
  );

  test("responder bids 4H after opener shows 2H with heart fit", () => {
    // 1NT - P - 2C - P - 2H - P (responder to rebid)
    const result = callFromRules(responderHearts, Seat.South, [
      "1NT",
      "P",
      "2C",
      "P",
      "2H",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-major-fit");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("responder bids 4S after opener shows 2S with spade fit", () => {
    // 1NT - P - 2C - P - 2S - P (responder to rebid)
    const result = callFromRules(responderSpades, Seat.South, [
      "1NT",
      "P",
      "2C",
      "P",
      "2S",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-major-fit");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("responder bids 3NT after 2D denial", () => {
    // 1NT - P - 2C - P - 2D - P (responder: no fit found)
    const result = callFromRules(responderHearts, Seat.South, [
      "1NT",
      "P",
      "2C",
      "P",
      "2D",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-no-fit");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test("responder bids 3NT after 2H with no heart fit (has spades only)", () => {
    // Responder has spades, opener shows hearts — no fit
    const result = callFromRules(responderSpades, Seat.South, [
      "1NT",
      "P",
      "2C",
      "P",
      "2H",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-no-fit");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });
});

// ─── Full Sequence Integration ──────────────────────────────

describe("Stayman full sequences", () => {
  // North opens 1NT, South responds with Stayman
  // We test the entire sequence by feeding each step through the rules

  test("1NT-P-2C-P-2H-P-4H (heart fit found)", () => {
    // Opener: 16 HCP balanced, 4 hearts
    const opener = hand(
      "SA",
      "SK",
      "S3", // 7 HCP (3 spades)
      "HK",
      "HQ",
      "HJ",
      "H2", // 6 HCP (4 hearts)
      "DK",
      "D5",
      "D3", // 3 HCP (3 diamonds)
      "C7",
      "C5",
      "C2", // 0 HCP (3 clubs)
    );
    // Responder: 10 HCP, 4 hearts
    const responder = hand(
      "SQ",
      "S5",
      "S2", // 2 HCP (3 spades)
      "HA",
      "HK",
      "H5",
      "H3", // 7 HCP (4 hearts)
      "DA",
      "D8",
      "D4", // 4 HCP (3 diamonds)
      "C9",
      "C3",
      "C6", // 0 HCP (3 clubs) — wait, that's 13
    );

    // Step 1: South bids 2C (Stayman ask)
    const ask = callFromRules(responder, Seat.South, ["1NT", "P"]);
    expect(ask).not.toBeNull();
    expect((ask!.call as ContractBid).strain).toBe(BidSuit.Clubs);

    // Step 2: North responds 2H (has 4 hearts)
    const response = callFromRules(opener, Seat.North, ["1NT", "P", "2C", "P"]);
    expect(response).not.toBeNull();
    expect((response!.call as ContractBid).strain).toBe(BidSuit.Hearts);

    // Step 3: South bids 4H (heart fit)
    const rebid = callFromRules(responder, Seat.South, [
      "1NT",
      "P",
      "2C",
      "P",
      "2H",
      "P",
    ]);
    expect(rebid).not.toBeNull();
    expect((rebid!.call as ContractBid).level).toBe(4);
    expect((rebid!.call as ContractBid).strain).toBe(BidSuit.Hearts);
  });

  test("1NT-P-2C-P-2S-P-4S (spade fit found)", () => {
    // Opener: 4 spades, not 4 hearts
    const opener = hand(
      "SA",
      "SK",
      "SQ",
      "S2", // 10 HCP (4 spades)
      "HK",
      "H5",
      "H3", // 3 HCP (3 hearts)
      "DK",
      "D5",
      "D3", // 3 HCP (3 diamonds)
      "C7",
      "C5",
      "C2", // 0 HCP (3 clubs)
    );
    // Responder: 4 spades
    const responder = hand(
      "SJ",
      "ST",
      "S9",
      "S3", // 1 HCP (4 spades)
      "HA",
      "HQ",
      "H2", // 6 HCP (3 hearts)
      "DA",
      "DQ",
      "D4", // 6 HCP (3 diamonds)
      "C9",
      "C3",
      "C6", // 0 HCP (3 clubs)
    );

    const ask = callFromRules(responder, Seat.South, ["1NT", "P"]);
    expect(ask).not.toBeNull();

    const response = callFromRules(opener, Seat.North, ["1NT", "P", "2C", "P"]);
    expect(response).not.toBeNull();
    expect((response!.call as ContractBid).strain).toBe(BidSuit.Spades);

    const rebid = callFromRules(responder, Seat.South, [
      "1NT",
      "P",
      "2C",
      "P",
      "2S",
      "P",
    ]);
    expect(rebid).not.toBeNull();
    expect((rebid!.call as ContractBid).level).toBe(4);
    expect((rebid!.call as ContractBid).strain).toBe(BidSuit.Spades);
  });

  test("1NT-P-2C-P-2D-P-3NT (no major fit)", () => {
    // Opener: no 4-card major
    const opener = hand(
      "SA",
      "SK",
      "S2", // 7 HCP (3 spades)
      "HK",
      "H5",
      "H3", // 3 HCP (3 hearts)
      "DA",
      "DK",
      "D5",
      "D3", // 7 HCP (4 diamonds)
      "C5",
      "C3",
      "C2", // 0 HCP (3 clubs)
    );
    // Responder: 4 hearts
    const responder = hand(
      "SQ",
      "S5",
      "S3", // 2 HCP (3 spades)
      "HA",
      "HQ",
      "HJ",
      "H2", // 8 HCP (4 hearts)
      "DQ",
      "D8",
      "D4", // 2 HCP (3 diamonds)
      "C9",
      "C3",
      "C6", // 0 HCP (3 clubs)
    );

    const ask = callFromRules(responder, Seat.South, ["1NT", "P"]);
    expect(ask).not.toBeNull();

    const response = callFromRules(opener, Seat.North, ["1NT", "P", "2C", "P"]);
    expect(response).not.toBeNull();
    expect((response!.call as ContractBid).strain).toBe(BidSuit.Diamonds);

    const rebid = callFromRules(responder, Seat.South, [
      "1NT",
      "P",
      "2C",
      "P",
      "2D",
      "P",
    ]);
    expect(rebid).not.toBeNull();
    expect((rebid!.call as ContractBid).level).toBe(3);
    expect((rebid!.call as ContractBid).strain).toBe(BidSuit.NoTrump);
  });

  test("both majors, opener shows hearts -> 4H", () => {
    // Opener: both 4-card majors (shows hearts per priority)
    const opener = hand(
      "SA",
      "SK",
      "SQ",
      "S2", // 10 HCP (4 spades)
      "HK",
      "HQ",
      "H5",
      "H2", // 5 HCP (4 hearts)
      "D5",
      "D3", // 0 HCP (2 diamonds)
      "CK",
      "C5",
      "C2", // 3 HCP (3 clubs)
    );
    // Responder: 4 hearts and 4 spades
    const responder = hand(
      "SJ",
      "ST",
      "S9",
      "S3", // 1 HCP (4 spades)
      "HA",
      "HJ",
      "H9",
      "H3", // 5 HCP (4 hearts)
      "DA",
      "D4", // 4 HCP (2 diamonds)
      "CQ",
      "C9",
      "C3", // 2 HCP (3 clubs)
    );

    const response = callFromRules(opener, Seat.North, ["1NT", "P", "2C", "P"]);
    expect(response).not.toBeNull();
    expect((response!.call as ContractBid).strain).toBe(BidSuit.Hearts);

    const rebid = callFromRules(responder, Seat.South, [
      "1NT",
      "P",
      "2C",
      "P",
      "2H",
      "P",
    ]);
    expect(rebid).not.toBeNull();
    expect(rebid!.rule).toBe("stayman-rebid-major-fit");
    expect((rebid!.call as ContractBid).strain).toBe(BidSuit.Hearts);
  });

  test("both majors, opener shows spades (no hearts) -> 4S", () => {
    // Opener: 4 spades, 3 hearts
    const opener = hand(
      "SA",
      "SK",
      "SQ",
      "S2", // 10 HCP (4 spades)
      "HK",
      "H5",
      "H3", // 3 HCP (3 hearts)
      "DK",
      "D5",
      "D3", // 3 HCP (3 diamonds)
      "C7",
      "C5",
      "C2", // 0 HCP (3 clubs)
    );
    // Responder: both 4-card majors
    const responder = hand(
      "SJ",
      "ST",
      "S9",
      "S3", // 1 HCP (4 spades)
      "HA",
      "HQ",
      "H9",
      "H3", // 6 HCP (4 hearts)
      "DA",
      "D4", // 4 HCP (2 diamonds)
      "CQ",
      "C9",
      "C3", // 2 HCP (3 clubs)
    );

    const response = callFromRules(opener, Seat.North, ["1NT", "P", "2C", "P"]);
    expect(response).not.toBeNull();
    expect((response!.call as ContractBid).strain).toBe(BidSuit.Spades);

    const rebid = callFromRules(responder, Seat.South, [
      "1NT",
      "P",
      "2C",
      "P",
      "2S",
      "P",
    ]);
    expect(rebid).not.toBeNull();
    expect(rebid!.rule).toBe("stayman-rebid-major-fit");
    expect((rebid!.call as ContractBid).strain).toBe(BidSuit.Spades);
  });

  test("responder only hearts, opener denies -> 3NT", () => {
    const opener = hand(
      "SA",
      "SK",
      "S2", // 7 HCP (3 spades)
      "HK",
      "H5",
      "H3", // 3 HCP (3 hearts)
      "DA",
      "DK",
      "D5",
      "D3", // 7 HCP (4 diamonds)
      "C5",
      "C3",
      "C2", // 0 HCP (3 clubs)
    );
    const responder = hand(
      "SQ",
      "S5",
      "S3", // 2 HCP (3 spades)
      "HA",
      "HQ",
      "HJ",
      "H2", // 8 HCP (4 hearts)
      "DQ",
      "D8",
      "D4", // 2 HCP (3 diamonds)
      "C9",
      "C3",
      "C6", // 0 HCP (3 clubs)
    );

    const response = callFromRules(opener, Seat.North, ["1NT", "P", "2C", "P"]);
    expect((response!.call as ContractBid).strain).toBe(BidSuit.Diamonds);

    const rebid = callFromRules(responder, Seat.South, [
      "1NT",
      "P",
      "2C",
      "P",
      "2D",
      "P",
    ]);
    expect(rebid!.rule).toBe("stayman-rebid-no-fit");
    expect((rebid!.call as ContractBid).strain).toBe(BidSuit.NoTrump);
  });
});

// ─── Edge Cases ─────────────────────────────────────────────

describe("Stayman edge cases", () => {
  test("minimum HCP responder (exactly 8)", () => {
    const minResponder = hand(
      "SK",
      "SQ",
      "S8",
      "S3", // 5 HCP (4 spades)
      "HJ",
      "H8",
      "H5", // 1 HCP (3 hearts)
      "DT",
      "D9",
      "D4", // 0 HCP (3 diamonds)
      "CQ",
      "C5",
      "C2", // 2 HCP (3 clubs)
    );
    expect(calculateHcp(minResponder)).toBe(8);
    const result = callFromRules(minResponder, Seat.South, ["1NT", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-ask");
  });

  test("minimum HCP opener (exactly 15)", () => {
    // 15 HCP, balanced, 4 hearts
    const minOpener = hand(
      "SA",
      "SK",
      "S2", // 7 HCP (3 spades)
      "HK",
      "HQ",
      "H5",
      "H2", // 5 HCP (4 hearts)
      "DK",
      "D5",
      "D3", // 3 HCP (3 diamonds)
      "C5",
      "C3",
      "C2", // 0 HCP (3 clubs)
    );
    expect(calculateHcp(minOpener)).toBe(15);
    // Should still respond to Stayman ask
    const result = callFromRules(minOpener, Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-response-hearts");
  });

  test("maximum HCP opener (exactly 17)", () => {
    const maxOpener2 = hand(
      "SA",
      "SK",
      "S2", // 7 HCP (3 spades)
      "HA",
      "HQ",
      "H5",
      "H2", // 6 HCP (4 hearts)
      "DK",
      "D5",
      "D3", // 3 HCP (3 diamonds)
      "CJ",
      "C3",
      "C2", // 1 HCP (3 clubs)
    );
    expect(calculateHcp(maxOpener2)).toBe(17);
    const result = callFromRules(maxOpener2, Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
    ]);
    expect(result).not.toBeNull();
  });

  test("4-3-3-3 opener shape", () => {
    // Valid 1NT opener with 4-3-3-3
    const opener433 = hand(
      "SA",
      "SK",
      "S2", // 7 HCP (3 spades)
      "HK",
      "HQ",
      "HJ", // 6 HCP (3 hearts)
      "DK",
      "D5",
      "D3", // 3 HCP (3 diamonds)
      "CA",
      "C5",
      "C3",
      "C2", // 4 HCP (4 clubs)
    );
    // That's 4-3-3-3 (clubs, spades, hearts, diamonds)
    const shape = getSuitLength(opener433);
    expect(isBalanced(shape)).toBe(true);
    // No 4-card major in this hand: 3 spades, 3 hearts
    const result = callFromRules(opener433, Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-response-denial");
  });

  test("4-4-3-2 opener shape", () => {
    // Valid 1NT opener with 4-4-3-2
    const opener442 = hand(
      "SA",
      "SK",
      "SQ",
      "S2", // 10 HCP (4 spades)
      "HK",
      "HQ",
      "H5",
      "H2", // 5 HCP (4 hearts)
      "D5",
      "D3", // 0 HCP (2 diamonds)
      "CK",
      "C5",
      "C2", // 3 HCP (3 clubs)
    );
    const shape = getSuitLength(opener442);
    expect(isBalanced(shape)).toBe(true);
    // Both majors — should show hearts first
    const result = callFromRules(opener442, Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
    ]);
    expect(result!.rule).toBe("stayman-response-hearts");
  });

  test("5-3-3-2 opener (5-card minor OK)", () => {
    // Valid 1NT: 5 diamonds (minor is fine), 3-3-2 in others
    const opener532v2 = hand(
      "SA",
      "SK",
      "S2", // 7 HCP (3 spades)
      "HK",
      "H5", // 3 HCP (2 hearts)
      "DQ",
      "DJ",
      "D8",
      "D5",
      "D3", // 3 HCP (5 diamonds)
      "CQ",
      "C5",
      "C2", // 2 HCP (3 clubs)
    );
    expect(calculateHcp(opener532v2)).toBe(15);
    const shape = getSuitLength(opener532v2);
    expect(isBalanced(shape)).toBe(true);
    // No 4-card major
    const result = callFromRules(opener532v2, Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-response-denial");
  });

  test("3 cards in both majors does NOT trigger Stayman", () => {
    // 18 HCP, 3-3-4-3 shape — no 4-card major despite high HCP
    const noMajor = hand(
      "SA",
      "SK",
      "SQ", // 9 HCP (3 spades)
      "HA",
      "HK",
      "H5", // 7 HCP (3 hearts)
      "DQ",
      "D7",
      "D5",
      "D3", // 2 HCP (4 diamonds)
      "C5",
      "C3",
      "C2", // 0 HCP (3 clubs)
    );
    expect(calculateHcp(noMajor)).toBe(18);
    const shape = getSuitLength(noMajor);
    expect(shape[0]).toBe(3); // spades
    expect(shape[1]).toBe(3); // hearts
    const result = callFromRules(noMajor, Seat.South, ["1NT", "P"]);
    if (result !== null) {
      expect(result.rule).not.toBe("stayman-ask");
    }
  });

  test("both majors with 2S response: responder bids 4S (spade fit)", () => {
    // Responder has 4H + 4S, opener shows 2S → fit in spades
    const responderBothMajors = hand(
      "SJ",
      "ST",
      "S9",
      "S3", // 1 HCP (4 spades)
      "HA",
      "HQ",
      "H9",
      "H3", // 6 HCP (4 hearts)
      "DA",
      "D4", // 4 HCP (2 diamonds)
      "CQ",
      "C9",
      "C3", // 2 HCP (3 clubs)
    );
    const result = callFromRules(responderBothMajors, Seat.South, [
      "1NT",
      "P",
      "2C",
      "P",
      "2S",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-major-fit");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("responder bids 3H (invite) after opener shows 2H with 8-9 HCP heart fit", () => {
    // 9 HCP, 4 hearts — invitational, not game-forcing
    const inviteResponder = hand(
      "SK",
      "S5",
      "S2", // 3 HCP (3 spades)
      "HQ",
      "HJ",
      "HT",
      "H3", // 3 HCP (4 hearts)
      "DK",
      "D5",
      "D3", // 3 HCP (3 diamonds)
      "C5",
      "C3",
      "C2", // 0 HCP (3 clubs)
    );
    expect(calculateHcp(inviteResponder)).toBe(9);
    const result = callFromRules(inviteResponder, Seat.South, [
      "1NT",
      "P",
      "2C",
      "P",
      "2H",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-major-fit-invite");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("responder bids 3S (invite) after opener shows 2S with 8 HCP spade fit", () => {
    // 8 HCP, 4 spades — invitational
    const inviteResponder = hand(
      "SQ",
      "SJ",
      "ST",
      "S3", // 3 HCP (4 spades)
      "HK",
      "H5",
      "H2", // 3 HCP (3 hearts)
      "DQ",
      "D5",
      "D3", // 2 HCP (3 diamonds)
      "C5",
      "C3",
      "C2", // 0 HCP (3 clubs)
    );
    expect(calculateHcp(inviteResponder)).toBe(8);
    const result = callFromRules(inviteResponder, Seat.South, [
      "1NT",
      "P",
      "2C",
      "P",
      "2S",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-major-fit-invite");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("responder bids 2NT (invite) after 2D denial with 8-9 HCP", () => {
    // 9 HCP, 4 hearts — invitational after denial
    const inviteResponder = hand(
      "SK",
      "S5",
      "S2", // 3 HCP (3 spades)
      "HQ",
      "HJ",
      "HT",
      "H3", // 3 HCP (4 hearts)
      "DK",
      "D5",
      "D3", // 3 HCP (3 diamonds)
      "C5",
      "C3",
      "C2", // 0 HCP (3 clubs)
    );
    expect(calculateHcp(inviteResponder)).toBe(9);
    const result = callFromRules(inviteResponder, Seat.South, [
      "1NT",
      "P",
      "2C",
      "P",
      "2D",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-no-fit-invite");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test("responder bids 2NT (invite) after 2H with no heart fit and 9 HCP", () => {
    // 9 HCP, 4 spades no hearts — invitational after 2H shows no heart fit
    const inviteResponder = hand(
      "SQ",
      "SJ",
      "ST",
      "S3", // 3 HCP (4 spades)
      "H5",
      "H3",
      "H2", // 0 HCP (3 hearts)
      "DK",
      "DJ",
      "D3", // 4 HCP (3 diamonds)
      "CQ",
      "C4",
      "C2", // 2 HCP (3 clubs)
    );
    expect(calculateHcp(inviteResponder)).toBe(9);
    const result = callFromRules(inviteResponder, Seat.South, [
      "1NT",
      "P",
      "2C",
      "P",
      "2H",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-no-fit-invite");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test("full denial sequence: 1NT-P-2C-P-2D-P-3NT completes", () => {
    // Responder with 4 hearts asks Stayman, opener denies, responder bids 3NT
    const responder = hand(
      "SQ",
      "S5",
      "S3", // 2 HCP (3 spades)
      "HA",
      "HQ",
      "HJ",
      "H2", // 8 HCP (4 hearts)
      "DQ",
      "D8",
      "D4", // 2 HCP (3 diamonds)
      "C9",
      "C3",
      "C6", // 0 HCP (3 clubs)
    );
    // Step 1: Ask
    const ask = callFromRules(responder, Seat.South, ["1NT", "P"]);
    expect(ask).not.toBeNull();
    expect(ask!.rule).toBe("stayman-ask");

    // Step 2: Denial already tested — just verify rebid
    const rebid = callFromRules(responder, Seat.South, [
      "1NT",
      "P",
      "2C",
      "P",
      "2D",
      "P",
    ]);
    expect(rebid).not.toBeNull();
    expect(rebid!.rule).toBe("stayman-rebid-no-fit");
    const call = rebid!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test("non-trigger: responder with no 4-card major does not invoke Stayman", () => {
    // Responder with 10 HCP but no 4-card major should not trigger stayman-ask
    const noMajorResponder = hand(
      "SA",
      "S5",
      "S2", // 4 HCP (3 spades)
      "HK",
      "H8",
      "H3", // 3 HCP (3 hearts)
      "DA",
      "DQ",
      "D7",
      "D4", // 6 HCP (4 diamonds)
      "C5",
      "C3",
      "C2", // 0 HCP (3 clubs)
    );
    expect(calculateHcp(noMajorResponder)).toBe(13);
    const result = callFromRules(noMajorResponder, Seat.South, ["1NT", "P"]);
    // Should return null (no matching Stayman rule) since no 4-card major
    if (result !== null) {
      expect(result.rule).not.toBe("stayman-ask");
    }
  });
});

// ─── Smolen after 2D denial [bridgebum/stayman] ───────────

describe("Stayman Smolen bids after 2D denial", () => {
  test("[bridgebum/stayman] 3H Smolen: 4S+5H GF after 2D denial", () => {
    // 10+ HCP, 4 spades + 5 hearts, game-forcing
    // K(3)+Q(2) spades = 5, A(4)+J(1) hearts = 5, Q(2) diamonds = 2 → 12 HCP
    const responder = hand(
      "SK", "SQ", "S7", "S3",
      "HA", "HJ", "H7", "H5", "H3",
      "DQ", "D5",
      "C5", "C2",
    );
    expect(calculateHcp(responder)).toBe(12);
    expect(getSuitLength(responder)[0]).toBe(4); // 4 spades
    expect(getSuitLength(responder)[1]).toBe(5); // 5 hearts
    const result = callFromRules(responder, Seat.South, [
      "1NT", "P", "2C", "P", "2D", "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-smolen-hearts");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("[bridgebum/stayman] 3S Smolen: 5S+4H GF after 2D denial", () => {
    // 10+ HCP, 5 spades + 4 hearts, game-forcing
    // A(4)+K(3)+Q(2) spades = 9, J(1) hearts = 1, K(3) diamonds = 3 → 13 HCP
    const responder = hand(
      "SA", "SK", "SQ", "S7", "S3",
      "HJ", "H7", "H5", "H3",
      "DK", "D5",
      "C5", "C2",
    );
    expect(calculateHcp(responder)).toBe(13);
    expect(getSuitLength(responder)[0]).toBe(5); // 5 spades
    expect(getSuitLength(responder)[1]).toBe(4); // 4 hearts
    const result = callFromRules(responder, Seat.South, [
      "1NT", "P", "2C", "P", "2D", "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-smolen-spades");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("[bridgebum/stayman] no Smolen with 4-4: bids 3NT after 2D denial", () => {
    // 10+ HCP, 4 spades + 4 hearts (not 5-4), no Smolen — just 3NT
    // A(4)+K(3) spades = 7, Q(2) hearts = 2, K(3) diamonds = 3 → 12 HCP
    const responder = hand(
      "SA", "SK", "S7", "S3",
      "HQ", "H7", "H5", "H3",
      "DK", "D5", "D3",
      "C5", "C2",
    );
    expect(calculateHcp(responder)).toBe(12);
    const result = callFromRules(responder, Seat.South, [
      "1NT", "P", "2C", "P", "2D", "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-no-fit");
  });
});

// ─── Stayman after 2NT opening [bridgebum/stayman] ────────

describe("Stayman after 2NT opening", () => {
  test("[bridgebum/stayman] 3C Stayman ask after 2NT-P", () => {
    // 5+ HCP with 4-card major after 2NT opening
    // K(3)+Q(2) spades = 5, J(1) hearts = 1, Q(2) diamonds = 2 → 8 HCP
    const responder = hand(
      "SK", "SQ", "S7", "S3",
      "HJ", "H5", "H3",
      "DQ", "D5", "D3",
      "C5", "C3", "C2",
    );
    expect(calculateHcp(responder)).toBe(8);
    expect(getSuitLength(responder)[0]).toBe(4); // 4 spades
    const result = callFromRules(responder, Seat.South, ["2NT", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-ask");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("[bridgebum/stayman] opener responds 3H after 2NT-P-3C-P", () => {
    // Opener with 4 hearts responds 3H
    // A(4)+K(3) spades + K(3)+Q(2)+J(1) hearts + A(4)+K(3) diamonds = 20 HCP
    const opener = hand(
      "SA", "SK", "S5",
      "HK", "HQ", "HJ", "H3",
      "DA", "DK", "D5",
      "C5", "C3", "C2",
    );
    expect(getSuitLength(opener)[1]).toBe(4); // 4 hearts
    const result = callFromRules(opener, Seat.North, ["2NT", "P", "3C", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-response-hearts");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });
});
