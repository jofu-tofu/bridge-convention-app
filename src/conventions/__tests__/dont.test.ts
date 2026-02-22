// Sources consulted:
// - bridgebum.com/dont.php [bridgebum/dont]
// - Marty Bergen, original DONT description [Bergen/dont]

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
import { dontConfig, dontDealConstraints } from "../dont";
import type { BiddingContext } from "../types";
import { hand, auctionFromBids } from "./fixtures";

beforeEach(() => {
  clearRegistry();
  registerConvention(dontConfig);
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
  return evaluateBiddingRules(dontConfig.biddingRules, context);
}

// ─── Deal Constraints ───────────────────────────────────────

describe("DONT deal constraints", () => {
  test("[bridgebum/dont] East 15-17 HCP balanced", () => {
    for (let i = 0; i < 20; i++) {
      const result = generateDeal(dontDealConstraints);
      const eastHand = result.deal.hands[Seat.East];
      const hcp = calculateHcp(eastHand);
      const shape = getSuitLength(eastHand);

      expect(hcp).toBeGreaterThanOrEqual(15);
      expect(hcp).toBeLessThanOrEqual(17);
      expect(isBalanced(shape)).toBe(true);
    }
  });

  test("[bridgebum/dont] South 8-15 HCP with shape", () => {
    for (let i = 0; i < 20; i++) {
      const result = generateDeal(dontDealConstraints);
      const southHand = result.deal.hands[Seat.South];
      const hcp = calculateHcp(southHand);
      const shape = getSuitLength(southHand);
      const sorted = [...shape].sort((a, b) => b - a);

      expect(hcp).toBeGreaterThanOrEqual(8);
      expect(hcp).toBeLessThanOrEqual(15);
      expect(sorted[0]! >= 6 || (sorted[0]! >= 5 && sorted[1]! >= 4)).toBe(
        true,
      );
    }
  });

  test("[bridgebum/dont] rejects South with balanced hand", () => {
    // 12 HCP, 4-3-3-3 balanced — no 6+ suit, no 5-4
    const balancedSouth = hand(
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
    const shape = getSuitLength(balancedSouth);
    expect(isBalanced(shape)).toBe(true);
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
          [Seat.South]: balancedSouth,
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
          ),
        },
        dealer: Seat.East,
        vulnerability:
          "None" as unknown as import("../../engine/types").Vulnerability,
      },
      dontDealConstraints,
    );
    expect(satisfied).toBe(false);
  });

  test("[bridgebum/dont] accepts South with 6-card suit", () => {
    // 10 HCP, 6 hearts — single-suited
    const sixSuiter = hand(
      "S5",
      "S3",
      "S2",
      "HA",
      "HK",
      "HQ",
      "HJ",
      "H7",
      "H3",
      "D5",
      "D2",
      "C5",
      "C2",
    );
    const shape = getSuitLength(sixSuiter);
    const sorted = [...shape].sort((a, b) => b - a);
    expect(sorted[0]).toBe(6);
    const satisfied = checkConstraints(
      {
        hands: {
          [Seat.East]: hand(
            "SA",
            "SK",
            "S4",
            "HT",
            "H5",
            "H2",
            "DA",
            "DK",
            "D6",
            "D3",
            "CQ",
            "CJ",
            "C4",
          ),
          [Seat.South]: sixSuiter,
          [Seat.North]: hand(
            "SQ",
            "SJ",
            "S9",
            "H9",
            "H8",
            "H6",
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
            "S8",
            "S7",
            "S6",
            "HK",
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
      dontDealConstraints,
    );
    expect(satisfied).toBe(true);
  });

  test("[bridgebum/dont] accepts South with 5-4 shape", () => {
    // 10 HCP, 5 hearts + 4 spades
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
    const shape = getSuitLength(fiveFour);
    const sorted = [...shape].sort((a, b) => b - a);
    expect(sorted[0]).toBe(5);
    expect(sorted[1]).toBe(4);
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
      dontDealConstraints,
    );
    expect(satisfied).toBe(true);
  });

  test("[bridgebum/dont] rejects South with 5-3 shape (no second suit)", () => {
    // 10 HCP, 5-3-3-2 — longest suit is only 5, no second 4+
    const fiveThree = hand(
      "SA",
      "SK",
      "S5",
      "HQ",
      "HJ",
      "H8",
      "H5",
      "H3",
      "D5",
      "D3",
      "C5",
      "C3",
      "C2",
    );
    const shape = getSuitLength(fiveThree);
    const sorted = [...shape].sort((a, b) => b - a);
    expect(sorted[0]).toBe(5);
    expect(sorted[1]).toBe(3);
    const satisfied = checkConstraints(
      {
        hands: {
          [Seat.East]: hand(
            "SQ",
            "SJ",
            "S4",
            "HK",
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
          [Seat.South]: fiveThree,
          [Seat.North]: hand(
            "S9",
            "S8",
            "S7",
            "HA",
            "HT",
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
            "S2",
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
      dontDealConstraints,
    );
    expect(satisfied).toBe(false);
  });

  test("[bridgebum/dont] dealer is East", () => {
    expect(dontDealConstraints.dealer).toBe(Seat.East);
  });
});

// ─── Overcaller Rule Unit Tests ─────────────────────────────

describe("DONT overcaller bidding rules", () => {
  // 5H + 4S: two majors
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

  // 5S + 4H: two majors (spades longer)
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

  // 5D + 4H: diamonds and a major
  const diamonds5H4 = hand(
    "S5",
    "S3",
    "S2",
    "HK",
    "HJ",
    "H5",
    "H3",
    "DA",
    "DK",
    "D8",
    "D5",
    "D3",
    "C2",
  );

  // 5C + 4S: clubs and a higher suit
  const clubs5S4 = hand(
    "SA",
    "SJ",
    "S7",
    "S2",
    "H5",
    "H3",
    "D5",
    "D3",
    "CK",
    "CQ",
    "C8",
    "C5",
    "C2",
  );

  // 6S: natural spades
  const sixSpades = hand(
    "SA",
    "SK",
    "SQ",
    "SJ",
    "S7",
    "S2",
    "H5",
    "H3",
    "D5",
    "D3",
    "C5",
    "C3",
    "C2",
  );

  // 6H single-suited (no second 4+ suit)
  const sixHeartsSingle = hand(
    "S5",
    "S3",
    "S2",
    "HA",
    "HK",
    "HQ",
    "HJ",
    "H7",
    "H3",
    "D5",
    "D2",
    "C5",
    "C2",
  );

  // 6D single-suited
  const sixDiamondsSingle = hand(
    "S5",
    "S3",
    "S2",
    "H5",
    "H3",
    "DA",
    "DK",
    "DQ",
    "DJ",
    "D7",
    "D3",
    "C5",
    "C2",
  );

  // 6C single-suited
  const sixClubsSingle = hand(
    "S5",
    "S3",
    "S2",
    "H5",
    "H3",
    "D5",
    "D2",
    "CA",
    "CK",
    "CQ",
    "CJ",
    "C7",
    "C3",
  );

  // 6C + 4H: two-suited (should use 2C, not double)
  const sixClubs4Hearts = hand(
    "S5",
    "S3",
    "HK",
    "HJ",
    "H5",
    "H3",
    "D2",
    "CA",
    "CK",
    "CQ",
    "CJ",
    "C7",
    "C3",
  );

  // 4-4-3-2: no DONT bid
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

  // 5-3-3-2: no DONT bid (5 but no second 4+)
  const fiveThree = hand(
    "SA",
    "SK",
    "SQ",
    "S7",
    "S2",
    "H5",
    "H3",
    "H2",
    "D5",
    "D3",
    "C5",
    "C3",
    "C2",
  );

  test("[bridgebum/dont] dont-2h matches with 5 hearts 4 spades", () => {
    const result = callFromRules(twoMajors5H4S, Seat.South, ["1NT"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-2h");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("[bridgebum/dont] dont-2h matches with 5 spades 4 hearts", () => {
    const result = callFromRules(twoMajors5S4H, Seat.South, ["1NT"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-2h");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("[bridgebum/dont] dont-2d matches with 5 diamonds 4 hearts", () => {
    const result = callFromRules(diamonds5H4, Seat.South, ["1NT"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-2d");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Diamonds);
  });

  test("[bridgebum/dont] dont-2c matches with 5 clubs 4 spades", () => {
    const result = callFromRules(clubs5S4, Seat.South, ["1NT"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-2c");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("[bridgebum/dont] dont-2s matches with 6+ spades", () => {
    const result = callFromRules(sixSpades, Seat.South, ["1NT"]);
    expect(result).not.toBeNull();
    // 6 spades with only 3 hearts — no second 4+ suit from non-spade suits
    // But dont-2s fires because shape[0] >= 6
    // However, dont-2h checks first: spades >= 5 && hearts >= 4? hearts=2, no.
    // dont-2d: diamonds >= 5? no. dont-2c: clubs >= 5? no. Falls to dont-2s.
    expect(result!.rule).toBe("dont-2s");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("[bridgebum/dont] dont-double matches with 6 hearts no second 4+ suit", () => {
    const result = callFromRules(sixHeartsSingle, Seat.South, ["1NT"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-double");
    expect(result!.call.type).toBe("double");
  });

  test("[bridgebum/dont] dont-double matches with 6 diamonds single-suited", () => {
    const result = callFromRules(sixDiamondsSingle, Seat.South, ["1NT"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-double");
    expect(result!.call.type).toBe("double");
  });

  test("[bridgebum/dont] dont-double matches with 6 clubs single-suited", () => {
    const result = callFromRules(sixClubsSingle, Seat.South, ["1NT"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-double");
    expect(result!.call.type).toBe("double");
  });

  test("[bridgebum/dont] dont-double rejects 6 spades (use 2S instead)", () => {
    const result = callFromRules(sixSpades, Seat.South, ["1NT"]);
    expect(result).not.toBeNull();
    expect(result!.rule).not.toBe("dont-double");
    expect(result!.rule).toBe("dont-2s");
  });

  test("[bridgebum/dont] 6-4 hand bids two-suited not double (6C+4H = 2C not X)", () => {
    const result = callFromRules(sixClubs4Hearts, Seat.South, ["1NT"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-2c");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("[bridgebum/dont] rejects 4-4 shape (no DONT bid)", () => {
    const result = callFromRules(fourFour, Seat.South, ["1NT"]);
    // 4-4-3-2: no 5+ suit, no 6+ suit — no DONT overcall matches
    expect(result).toBeNull();
  });

  test("[bridgebum/dont] rejects 5-3 shape", () => {
    const result = callFromRules(fiveThree, Seat.South, ["1NT"]);
    // 5-3-3-2 with 5 spades and no other 4+ suit
    // dont-2h: spades 5+ AND hearts 4+? hearts=3, no. hearts 5+ && spades 4+? no.
    // dont-2d: diamonds 5+? no
    // dont-2c: clubs 5+? no
    // dont-2s: spades 6+? no (only 5)
    // dont-double: hearts/diamonds/clubs 6+? no
    expect(result).toBeNull();
  });

  test("[bridgebum/dont] rejects when auction is not 1NT", () => {
    const result = callFromRules(sixHeartsSingle, Seat.South, ["1H"]);
    expect(result).toBeNull();
  });

  test("[bridgebum/dont] rejects when North opens 1NT (wrong seat)", () => {
    // Using North as dealer — the auction ["1NT"] starts from North, not East.
    // South can't double partner's (North's) bid — legality check catches this.
    const result = callFromRules(
      sixHeartsSingle,
      Seat.South,
      ["1NT"],
      Seat.North,
    );
    expect(result).toBeNull();
  });
});

// ─── Overcaller Edge Cases ───────────────────────────────────

describe("DONT overcaller edge cases", () => {
  test("5H+5D hand with 2 spades: dont-2d fires (not dont-2h, needs 4+ spades)", () => {
    // 5H + 5D, only 2 spades — dont-2h requires spades>=4 OR hearts>=5+spades>=4
    // Hearts=5 spades=2: dont-2h fails (neither condition met for both majors)
    // dont-2d: diamonds>=5 && hearts>=4 → yes
    const hand5H5D2S = hand(
      "S5",
      "S2", // 2 spades
      "HA",
      "HK",
      "H8",
      "H5",
      "H3", // 5 hearts
      "DA",
      "DK",
      "D8",
      "D5",
      "D3", // 5 diamonds
      "C2", // 1 club
    );
    const result = callFromRules(hand5H5D2S, Seat.South, ["1NT"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-2d");
  });

  test("5C+5D hand: dont-2c fires (clubs + higher suit)", () => {
    // 5C + 5D, diamonds is the "higher suit" relative to clubs
    const _hand5C5D = hand(
      "S5",
      "S2",
      "H5",
      "H2",
      "DA",
      "DK",
      "D8",
      "D5",
      "D3", // 5 diamonds
      "CA",
      "CK",
      "C8",
      "C5", // 4 clubs — wait need 5
    );
    // Actually 5C needs exactly 5 clubs. Let me fix: 2S, 1H, 5D, 5C = 13
    const hand5C5Dv2 = hand(
      "S5",
      "S2",
      "H2",
      "DA",
      "DK",
      "D8",
      "D5",
      "D3", // 5 diamonds
      "CA",
      "CK",
      "C8",
      "C5",
      "C2", // 5 clubs
    );
    const result = callFromRules(hand5C5Dv2, Seat.South, ["1NT"]);
    expect(result).not.toBeNull();
    // dont-2d checks: diamonds>=5 && (spades>=4 || hearts>=4) → diamonds=5 but no 4+ major → false
    // dont-2c checks: clubs>=5 && (diamonds>=4 || hearts>=4 || spades>=4) → clubs=5 && diamonds=5 → true
    expect(result!.rule).toBe("dont-2c");
  });

  test("6H+3-3-1 (single-suited non-spades): dont-double fires", () => {
    // 6 hearts, 3-3-1 in others — single suited, not spades
    const hand6H = hand(
      "S5",
      "S3",
      "S2",
      "HA",
      "HK",
      "HQ",
      "H7",
      "H5",
      "H3",
      "D5",
      "D3",
      "D2",
      "C2",
    );
    const result = callFromRules(hand6H, Seat.South, ["1NT"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-double");
    expect(result!.call.type).toBe("double");
  });
});

describe("DONT advancer edge cases", () => {
  test("advancer 0 spades after 2S: advance-pass requires 2+ spades, fails", () => {
    // Advancer with 0 spades — cannot pass after 2S
    const noSpades = hand(
      "HK",
      "HQ",
      "HJ",
      "H7",
      "H5",
      "DA",
      "DK",
      "D7",
      "D3",
      "C5",
      "C3",
      "C2",
      "C8",
    );
    // advance-pass for 2S requires spades >= 2
    const passResult = callFromRules(noSpades, Seat.North, ["1NT", "2S", "P"]);
    // If advance-pass doesn't match, advance-next-step should also not match for 2S
    // (2S is natural, there's no "next step" after 2S in standard DONT)
    if (passResult !== null) {
      expect(passResult.rule).not.toBe("dont-advance-pass");
    }
  });
});

// ─── Advance Rule Tests ─────────────────────────────────────

describe("DONT advance bidding rules", () => {
  // Advancer with 3+ hearts (support after 2H)
  const advancerHeartsSupport = hand(
    "S5",
    "S3",
    "S2",
    "HQ",
    "HJ",
    "H8",
    "DA",
    "DK",
    "D7",
    "D3",
    "C5",
    "C3",
    "C2",
  );

  // Advancer with fewer than 3 hearts (prefers spades after 2H)
  const advancerFewHearts = hand(
    "SQ",
    "SJ",
    "S7",
    "S5",
    "H5",
    "H3",
    "DA",
    "DK",
    "D7",
    "D3",
    "C5",
    "C3",
    "C2",
  );

  // Advancer with 2+ spades (support after 2S)
  const advancerSpadesSupport = hand(
    "SQ",
    "S5",
    "HK",
    "HJ",
    "H7",
    "H3",
    "DA",
    "D7",
    "D3",
    "C5",
    "C3",
    "C2",
    "C8",
  );

  // Advancer with 3+ diamonds (support after 2D)
  const advancerDiamondSupport = hand(
    "S5",
    "S3",
    "HK",
    "H5",
    "H3",
    "DA",
    "DK",
    "D7",
    "D3",
    "C5",
    "C3",
    "C2",
    "C8",
  );

  // Advancer with fewer than 3 diamonds (asks for major after 2D)
  const advancerFewDiamonds = hand(
    "SQ",
    "SJ",
    "S7",
    "S5",
    "HK",
    "HJ",
    "H7",
    "H3",
    "D5",
    "D3",
    "C5",
    "C3",
    "C2",
  );

  // Advancer with 3+ clubs (support after 2C)
  const advancerClubSupport = hand(
    "S5",
    "S3",
    "HK",
    "H5",
    "H3",
    "DA",
    "D7",
    "D3",
    "CK",
    "CQ",
    "C8",
    "C5",
    "C2",
  );

  // Advancer with fewer than 3 clubs (asks for higher suit after 2C)
  const advancerFewClubs = hand(
    "SQ",
    "SJ",
    "S7",
    "S5",
    "HK",
    "HJ",
    "H7",
    "H3",
    "DA",
    "D7",
    "D3",
    "C5",
    "C2",
  );

  // Any hand for relay after double
  const advancerAny = hand(
    "SQ",
    "SJ",
    "S7",
    "S5",
    "HK",
    "H5",
    "H3",
    "DA",
    "D7",
    "D3",
    "C5",
    "C3",
    "C2",
  );

  test("[bridgebum/dont] advance passes after 2H with 3+ hearts", () => {
    const result = callFromRules(advancerHeartsSupport, Seat.North, [
      "1NT",
      "2H",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-advance-pass");
    expect(result!.call.type).toBe("pass");
  });

  test("[bridgebum/dont] advance bids 2S after 2H with <3 hearts (prefers spades)", () => {
    const result = callFromRules(advancerFewHearts, Seat.North, [
      "1NT",
      "2H",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-advance-next-step");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("[bridgebum/dont] advance passes after 2S with 2+ spades", () => {
    const result = callFromRules(advancerSpadesSupport, Seat.North, [
      "1NT",
      "2S",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-advance-pass");
    expect(result!.call.type).toBe("pass");
  });

  test("[bridgebum/dont] advance passes after 2D with 3+ diamonds", () => {
    const result = callFromRules(advancerDiamondSupport, Seat.North, [
      "1NT",
      "2D",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-advance-pass");
    expect(result!.call.type).toBe("pass");
  });

  test("[bridgebum/dont] advance bids 2H after 2D (asking for major)", () => {
    const result = callFromRules(advancerFewDiamonds, Seat.North, [
      "1NT",
      "2D",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-advance-next-step");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("[bridgebum/dont] advance passes after 2C with 3+ clubs", () => {
    const result = callFromRules(advancerClubSupport, Seat.North, [
      "1NT",
      "2C",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-advance-pass");
    expect(result!.call.type).toBe("pass");
  });

  test("[bridgebum/dont] advance bids 2D after 2C (asking for higher suit)", () => {
    const result = callFromRules(advancerFewClubs, Seat.North, [
      "1NT",
      "2C",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-advance-next-step");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Diamonds);
  });

  test("[bridgebum/dont] advance bids 2C relay after double (always)", () => {
    const result = callFromRules(advancerAny, Seat.North, ["1NT", "X", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-advance-next-step");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("[bridgebum/dont] advance with exactly 3 cards support (boundary)", () => {
    // Exactly 3 hearts — boundary test for pass after 2H
    const exactThreeHearts = hand(
      "SQ",
      "SJ",
      "S7",
      "S5",
      "HK",
      "H5",
      "H3",
      "DA",
      "D7",
      "D3",
      "C5",
      "C3",
      "C2",
    );
    const result = callFromRules(exactThreeHearts, Seat.North, [
      "1NT",
      "2H",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-advance-pass");
    expect(result!.call.type).toBe("pass");
  });
});

// ─── Full Sequence Integration ──────────────────────────────

describe("DONT full sequences", () => {
  test("1NT-2H-P-P (both majors, partner has hearts)", () => {
    // South: 5H + 4S (bids 2H showing both majors)
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
    // North: 3+ hearts (passes, accepting hearts)
    const advancer = hand(
      "S5",
      "S3",
      "S2",
      "HQ",
      "HJ",
      "H8",
      "DA",
      "DK",
      "D7",
      "D3",
      "C5",
      "C3",
      "C2",
    );

    // Step 1: South overcalls 2H
    const overcall = callFromRules(overcaller, Seat.South, ["1NT"]);
    expect(overcall).not.toBeNull();
    expect(overcall!.rule).toBe("dont-2h");

    // Step 2: North passes (has hearts support)
    const advance = callFromRules(advancer, Seat.North, ["1NT", "2H", "P"]);
    expect(advance).not.toBeNull();
    expect(advance!.rule).toBe("dont-advance-pass");
    expect(advance!.call.type).toBe("pass");
  });

  test("1NT-X-P-2C (single suited, relay)", () => {
    // South: 6 hearts, single-suited (doubles)
    const overcaller = hand(
      "S5",
      "S3",
      "S2",
      "HA",
      "HK",
      "HQ",
      "HJ",
      "H7",
      "H3",
      "D5",
      "D2",
      "C5",
      "C2",
    );
    // North: any hand (always relays 2C after double)
    const advancer = hand(
      "SQ",
      "SJ",
      "S7",
      "S4",
      "H9",
      "H8",
      "DA",
      "DK",
      "D7",
      "D3",
      "C8",
      "C3",
      "C2",
    );

    // Step 1: South doubles (single-suited)
    const overcall = callFromRules(overcaller, Seat.South, ["1NT"]);
    expect(overcall).not.toBeNull();
    expect(overcall!.rule).toBe("dont-double");

    // Step 2: North relays 2C
    const advance = callFromRules(advancer, Seat.North, ["1NT", "X", "P"]);
    expect(advance).not.toBeNull();
    expect(advance!.rule).toBe("dont-advance-next-step");
    const call = advance!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("1NT-2C-P-2D (clubs+higher, asking)", () => {
    // South: 5C + 4S (bids 2C showing clubs+higher)
    const overcaller = hand(
      "SA",
      "SJ",
      "S7",
      "S2",
      "H5",
      "H3",
      "D5",
      "D3",
      "CK",
      "CQ",
      "C8",
      "C5",
      "C2",
    );
    // North: fewer than 3 clubs (bids 2D to ask for higher suit)
    const advancer = hand(
      "SQ",
      "S9",
      "S5",
      "S3",
      "HK",
      "HQ",
      "HJ",
      "H7",
      "DA",
      "D7",
      "D3",
      "C4",
      "C3",
    );

    // Step 1: South overcalls 2C
    const overcall = callFromRules(overcaller, Seat.South, ["1NT"]);
    expect(overcall).not.toBeNull();
    expect(overcall!.rule).toBe("dont-2c");

    // Step 2: North bids 2D (asking)
    const advance = callFromRules(advancer, Seat.North, ["1NT", "2C", "P"]);
    expect(advance).not.toBeNull();
    expect(advance!.rule).toBe("dont-advance-next-step");
    const call = advance!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Diamonds);
  });

  test("1NT-2D-P-2H (diamonds+major, asking for major)", () => {
    // South: 5D + 4H (bids 2D showing diamonds+major)
    const overcaller = hand(
      "S5",
      "S3",
      "S2",
      "HK",
      "HJ",
      "H5",
      "H3",
      "DA",
      "DK",
      "D8",
      "D5",
      "D3",
      "C2",
    );
    // North: fewer than 3 diamonds (bids 2H asking for major)
    const advancer = hand(
      "SQ",
      "SJ",
      "S7",
      "S4",
      "HA",
      "HQ",
      "H9",
      "H8",
      "D7",
      "D2",
      "CQ",
      "C5",
      "C3",
    );

    const overcall = callFromRules(overcaller, Seat.South, ["1NT"]);
    expect(overcall).not.toBeNull();
    expect(overcall!.rule).toBe("dont-2d");

    const advance = callFromRules(advancer, Seat.North, ["1NT", "2D", "P"]);
    expect(advance).not.toBeNull();
    expect(advance!.rule).toBe("dont-advance-next-step");
    const call = advance!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("1NT-2S-P-P (natural spades, partner supports)", () => {
    // South: 6 spades (bids 2S natural)
    const overcaller = hand(
      "SA",
      "SK",
      "SQ",
      "SJ",
      "S7",
      "S2",
      "H5",
      "H3",
      "D5",
      "D3",
      "C5",
      "C3",
      "C2",
    );
    // North: 2+ spades (passes)
    const advancer = hand(
      "S9",
      "S5",
      "HK",
      "HQ",
      "HJ",
      "H7",
      "DA",
      "DK",
      "D7",
      "CQ",
      "C8",
      "C4",
      "C2",
    );

    const overcall = callFromRules(overcaller, Seat.South, ["1NT"]);
    expect(overcall).not.toBeNull();
    expect(overcall!.rule).toBe("dont-2s");

    const advance = callFromRules(advancer, Seat.North, ["1NT", "2S", "P"]);
    expect(advance).not.toBeNull();
    expect(advance!.rule).toBe("dont-advance-pass");
  });
});

// ─── Property-Based Invariants ──────────────────────────────

describe("DONT property-based invariants", () => {
  test("[bridgebum/dont invariant] 50 random constrained deals produce a DONT overcall bid", () => {
    let matchCount = 0;
    for (let i = 0; i < 50; i++) {
      const result = generateDeal(dontDealConstraints);
      const southHand = result.deal.hands[Seat.South];
      const ctx = makeBiddingContext(southHand, Seat.South, ["1NT"]);
      const ruleResult = evaluateBiddingRules(dontConfig.biddingRules, ctx);
      if (ruleResult !== null) matchCount++;
    }
    // Most constrained deals should produce a valid DONT overcall
    expect(matchCount).toBeGreaterThan(30);
  });

  test("[bridgebum/dont invariant] no DONT rule produces a bid below 2-level", () => {
    for (let i = 0; i < 50; i++) {
      const result = generateDeal(dontDealConstraints);
      const southHand = result.deal.hands[Seat.South];
      const ctx = makeBiddingContext(southHand, Seat.South, ["1NT"]);
      const ruleResult = evaluateBiddingRules(dontConfig.biddingRules, ctx);
      if (ruleResult !== null && ruleResult.call.type === "bid") {
        const bid = ruleResult.call as ContractBid;
        expect(bid.level).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
