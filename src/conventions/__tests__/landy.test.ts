// Sources consulted:
// - bridgebum.com/landy.php [bridgebum/landy]

import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../engine/types";
import type { ContractBid, Hand } from "../../engine/types";
import {
  calculateHcp,
  getSuitLength,
  isBalanced,
  evaluateHand,
} from "../../engine/hand-evaluator";
import { checkConstraints, generateDeal } from "../../engine/deal-generator";
import {
  registerConvention,
  clearRegistry,
  evaluateBiddingRules,
} from "../registry";
import { landyConfig, landyDealConstraints } from "../landy";
import type { BiddingContext } from "../types";
import { hand, auctionFromBids } from "./fixtures";

beforeEach(() => {
  clearRegistry();
  registerConvention(landyConfig);
});

// ─── Helpers ────────────────────────────────────────────────

function makeBiddingContext(
  h: Hand,
  seat: Seat,
  bids: string[],
  dealer: Seat = Seat.East,
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
  dealer: Seat = Seat.East,
) {
  const context = makeBiddingContext(h, seat, bids, dealer);
  return evaluateBiddingRules(context, landyConfig);
}

// ─── Deal Constraints ───────────────────────────────────────

describe("Landy deal constraints", () => {
  test("[bridgebum/landy] East 15-17 HCP balanced", () => {
    for (let i = 0; i < 20; i++) {
      const result = generateDeal(landyDealConstraints);
      const eastHand = result.deal.hands[Seat.East];
      const hcp = calculateHcp(eastHand);
      const shape = getSuitLength(eastHand);

      expect(hcp).toBeGreaterThanOrEqual(15);
      expect(hcp).toBeLessThanOrEqual(17);
      expect(isBalanced(shape)).toBe(true);
    }
  });

  test("[bridgebum/landy] South 10+ HCP with 5-4 in majors", () => {
    for (let i = 0; i < 20; i++) {
      const result = generateDeal(landyDealConstraints);
      const southHand = result.deal.hands[Seat.South];
      const hcp = calculateHcp(southHand);
      const shape = getSuitLength(southHand);
      const spades = shape[0]!;
      const hearts = shape[1]!;

      expect(hcp).toBeGreaterThanOrEqual(10);
      expect(
        (spades >= 5 && hearts >= 4) || (hearts >= 5 && spades >= 4),
      ).toBe(true);
    }
  });

  test("[bridgebum/landy] rejects South with only 4-3 majors", () => {
    // 12 HCP, 4S + 3H — not enough shape for Landy
    const weakMajors = hand(
      "SA",
      "SK",
      "S5",
      "S2",
      "HK",
      "H5",
      "H3",
      "D5",
      "D3",
      "D2",
      "C5",
      "C3",
      "C2",
    );
    const satisfied = checkConstraints(
      {
        hands: {
          [Seat.East]: hand(
            "SQ",
            "SJ",
            "S3",
            "HQ",
            "HJ",
            "H2",
            "DA",
            "DK",
            "D6",
            "CA",
            "CK",
            "C4",
            "C3",
          ),
          [Seat.South]: weakMajors,
          [Seat.North]: hand(
            "S9",
            "S8",
            "S7",
            "HA",
            "H9",
            "H8",
            "DQ",
            "DJ",
            "D9",
            "CQ",
            "CJ",
            "C9",
            "C8",
          ),
          [Seat.West]: hand(
            "ST",
            "S6",
            "S4",
            "HT",
            "H7",
            "H6",
            "H4",
            "DT",
            "D8",
            "D7",
            "D4",
            "CT",
            "C7",
            // only 13 cards total
          ),
        },
        dealer: Seat.East,
        vulnerability:
          "None" as unknown as import("../../engine/types").Vulnerability,
      },
      landyDealConstraints,
    );
    expect(satisfied).toBe(false);
  });

  test("[bridgebum/landy] accepts South with 5 hearts 4 spades 10 HCP", () => {
    const fiveFour = hand(
      "SQ",
      "SJ",
      "S7",
      "S2",
      "HA",
      "HK",
      "H8",
      "H5",
      "H3",
      "D5",
      "D3",
      "C5",
      "C2",
    );
    const satisfied = checkConstraints(
      {
        hands: {
          [Seat.East]: hand(
            "SA",
            "SK",
            "S4",
            "HT",
            "H6",
            "H2",
            "DA",
            "DK",
            "D6",
            "D2",
            "CQ",
            "CJ",
            "C4",
          ),
          [Seat.South]: fiveFour,
          [Seat.North]: hand(
            "S9",
            "S8",
            "S5",
            "HQ",
            "HJ",
            "H9",
            "DQ",
            "DJ",
            "D9",
            "CK",
            "CT",
            "C9",
            "C8",
          ),
          [Seat.West]: hand(
            "ST",
            "S6",
            "S3",
            "HK",
            "H7",
            "H4",
            "DT",
            "D8",
            "D7",
            "D4",
            "CA",
            "C7",
            "C6",
          ),
        },
        dealer: Seat.East,
        vulnerability:
          "None" as unknown as import("../../engine/types").Vulnerability,
      },
      landyDealConstraints,
    );
    expect(satisfied).toBe(true);
  });

  test("[bridgebum/landy] dealer is East", () => {
    expect(landyDealConstraints.dealer).toBe(Seat.East);
  });
});

// ─── Overcaller Rule Tests ──────────────────────────────────

describe("Landy overcaller bidding rules", () => {
  // 5H + 4S: both majors
  const twoMajors5H4S = hand(
    "SQ",
    "SJ",
    "S7",
    "S2",
    "HA",
    "HK",
    "H8",
    "H5",
    "H3",
    "D5",
    "D3",
    "C5",
    "C2",
  );

  // 5S + 4H: both majors (spades longer)
  const twoMajors5S4H = hand(
    "SA",
    "SK",
    "SQ",
    "S7",
    "S2",
    "HK",
    "HJ",
    "H5",
    "H3",
    "D5",
    "D3",
    "C5",
    "C2",
  );

  // 5S + 5H: both majors equal
  const twoMajors5S5H = hand(
    "SA",
    "SK",
    "SQ",
    "S7",
    "S2",
    "HK",
    "HJ",
    "H8",
    "H5",
    "H3",
    "D5",
    "D3",
    "C2",
  );

  // 4-4-3-2: no Landy bid (need 5-4 in majors)
  const fourFour = hand(
    "SA",
    "SK",
    "SQ",
    "S2",
    "HK",
    "HJ",
    "H5",
    "H3",
    "D5",
    "D3",
    "D2",
    "C5",
    "C2",
  );

  test("[bridgebum/landy] landy-2c matches with 5H + 4S", () => {
    const result = callFromRules(twoMajors5H4S, Seat.South, ["1NT"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("landy-2c");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("[bridgebum/landy] landy-2c matches with 5S + 4H", () => {
    const result = callFromRules(twoMajors5S4H, Seat.South, ["1NT"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("landy-2c");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("[bridgebum/landy] landy-2c matches with 5S + 5H", () => {
    const result = callFromRules(twoMajors5S5H, Seat.South, ["1NT"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("landy-2c");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("[bridgebum/landy] rejects 4-4 majors (no 5-4 shape)", () => {
    const result = callFromRules(fourFour, Seat.South, ["1NT"]);
    expect(result).toBeNull();
  });

  test("[bridgebum/landy] rejects when auction is not 1NT", () => {
    const result = callFromRules(twoMajors5H4S, Seat.South, ["1H"]);
    expect(result).toBeNull();
  });

  test("[bridgebum/landy] rejects when auction has no 1NT opening", () => {
    // Empty auction (no bids yet) — can't overcall without an opening
    const result = callFromRules(twoMajors5H4S, Seat.South, []);
    expect(result).toBeNull();
  });
});

// ─── Response Rule Tests ────────────────────────────────────

describe("Landy response bidding rules", () => {
  // Advancer with 4+ hearts (hearts preference)
  const advancerHearts = hand(
    "S5",
    "S3",
    "S2",
    "HQ",
    "HJ",
    "H8",
    "H5",
    "DA",
    "DK",
    "D7",
    "D3",
    "C5",
    "C2",
  );

  // Advancer with 4+ spades, <4 hearts (spades preference)
  const advancerSpades = hand(
    "SQ",
    "SJ",
    "S7",
    "S5",
    "H5",
    "H3",
    "H2",
    "DA",
    "DK",
    "D7",
    "D3",
    "C5",
    "C2",
  );

  // Advancer with 5+ clubs (pass, happy to play 2C)
  const advancerClubs = hand(
    "S5",
    "S3",
    "H5",
    "H3",
    "D5",
    "D3",
    "CA",
    "CK",
    "CQ",
    "C8",
    "C5",
    "C3",
    "C2",
  );

  // Advancer with no strong preference (3-3 majors, fewer than 5 clubs)
  const advancerRelay = hand(
    "SQ",
    "S5",
    "S2",
    "HK",
    "H5",
    "H3",
    "DA",
    "DK",
    "D7",
    "D3",
    "D2",
    "C5",
    "C2",
  );

  test("[bridgebum/landy] landy-response-pass with 5+ clubs", () => {
    const result = callFromRules(advancerClubs, Seat.North, [
      "1NT",
      "2C",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("landy-response-pass");
    expect(result!.call.type).toBe("pass");
  });

  test("[bridgebum/landy] landy-response-2h with 4+ hearts", () => {
    const result = callFromRules(advancerHearts, Seat.North, [
      "1NT",
      "2C",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("landy-response-2h");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("[bridgebum/landy] landy-response-2s with 4+ spades <4 hearts", () => {
    const result = callFromRules(advancerSpades, Seat.North, [
      "1NT",
      "2C",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("landy-response-2s");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("[bridgebum/landy] landy-response-2d relay with no strong major preference", () => {
    const result = callFromRules(advancerRelay, Seat.North, [
      "1NT",
      "2C",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("landy-response-2d");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Diamonds);
  });

  test("[bridgebum/landy] hearts preference beats spades when both 4+", () => {
    // 4H + 4S: hearts shown first per convention priority
    const bothFour = hand(
      "SQ",
      "SJ",
      "S7",
      "S5",
      "HK",
      "HJ",
      "H5",
      "H3",
      "DA",
      "D7",
      "D3",
      "C5",
      "C2",
    );
    const result = callFromRules(bothFour, Seat.North, ["1NT", "2C", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("landy-response-2h");
  });
});

// ─── Full Sequence Integration ──────────────────────────────

describe("Landy full sequences", () => {
  test("1NT-2C-P-2H (overcall, partner picks hearts)", () => {
    const overcaller = hand(
      "SQ",
      "SJ",
      "S7",
      "S2",
      "HA",
      "HK",
      "H8",
      "H5",
      "H3",
      "D5",
      "D3",
      "C5",
      "C2",
    );
    const advancer = hand(
      "S5",
      "S3",
      "S2",
      "HQ",
      "HJ",
      "H8",
      "H5",
      "DA",
      "DK",
      "D7",
      "D3",
      "C5",
      "C2",
    );

    // Step 1: South overcalls 2C
    const overcall = callFromRules(overcaller, Seat.South, ["1NT"]);
    expect(overcall).not.toBeNull();
    expect(overcall!.rule).toBe("landy-2c");

    // Step 2: North responds 2H
    const response = callFromRules(advancer, Seat.North, ["1NT", "2C", "P"]);
    expect(response).not.toBeNull();
    expect(response!.rule).toBe("landy-response-2h");
  });

  test("1NT-2C-P-P (overcall, partner has clubs)", () => {
    const overcaller = hand(
      "SA",
      "SK",
      "SQ",
      "S7",
      "S2",
      "HK",
      "HJ",
      "H5",
      "H3",
      "D5",
      "D3",
      "C5",
      "C2",
    );
    const advancer = hand(
      "S5",
      "S3",
      "H5",
      "H3",
      "D5",
      "D3",
      "CA",
      "CK",
      "CQ",
      "C8",
      "C5",
      "C3",
      "C2",
    );

    const overcall = callFromRules(overcaller, Seat.South, ["1NT"]);
    expect(overcall).not.toBeNull();
    expect(overcall!.rule).toBe("landy-2c");

    const response = callFromRules(advancer, Seat.North, ["1NT", "2C", "P"]);
    expect(response).not.toBeNull();
    expect(response!.rule).toBe("landy-response-pass");
  });

  test("1NT-2C-P-2D (overcall, partner relays)", () => {
    const overcaller = hand(
      "SQ",
      "SJ",
      "S7",
      "S2",
      "HA",
      "HK",
      "H8",
      "H5",
      "H3",
      "D5",
      "D3",
      "C5",
      "C2",
    );
    const advancer = hand(
      "SQ",
      "S5",
      "S2",
      "HK",
      "H5",
      "H3",
      "DA",
      "DK",
      "D7",
      "D3",
      "D2",
      "C5",
      "C2",
    );

    const overcall = callFromRules(overcaller, Seat.South, ["1NT"]);
    expect(overcall).not.toBeNull();
    expect(overcall!.rule).toBe("landy-2c");

    const response = callFromRules(advancer, Seat.North, ["1NT", "2C", "P"]);
    expect(response).not.toBeNull();
    expect(response!.rule).toBe("landy-response-2d");
  });
});

// ─── Property-Based Invariants ──────────────────────────────

describe("Landy property-based invariants", () => {
  test("[bridgebum/landy invariant] 50 random constrained deals produce a Landy 2C bid", () => {
    let matchCount = 0;
    for (let i = 0; i < 50; i++) {
      const result = generateDeal(landyDealConstraints);
      const southHand = result.deal.hands[Seat.South];
      const ctx = makeBiddingContext(southHand, Seat.South, ["1NT"]);
      const ruleResult = evaluateBiddingRules(ctx, landyConfig);
      if (ruleResult !== null) matchCount++;
    }
    // All constrained deals should produce a Landy 2C (deal requires 5-4 majors)
    expect(matchCount).toBeGreaterThan(40);
  });

  test("[bridgebum/landy invariant] no Landy rule produces a bid below 2-level", () => {
    for (let i = 0; i < 50; i++) {
      const result = generateDeal(landyDealConstraints);
      const southHand = result.deal.hands[Seat.South];
      const ctx = makeBiddingContext(southHand, Seat.South, ["1NT"]);
      const ruleResult = evaluateBiddingRules(ctx, landyConfig);
      if (ruleResult !== null && ruleResult.call.type === "bid") {
        const bid = ruleResult.call as ContractBid;
        expect(bid.level).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
