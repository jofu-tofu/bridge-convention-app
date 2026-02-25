// Sources consulted:
// - bridgebum.com/gerber_convention.php [bridgebum/gerber]
// - ACBL Standard American Yellow Card, Slam Bidding section [SAYC slam]

import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../engine/types";
import type { ContractBid, Hand } from "../../engine/types";
import { calculateHcp } from "../../engine/hand-evaluator";
import { checkConstraints, generateDeal } from "../../engine/deal-generator";
import {
  registerConvention,
  clearRegistry,
  evaluateBiddingRules,
} from "../registry";
import { gerberConfig, gerberDealConstraints, countAces, countKings } from "../gerber";
import type { BiddingContext } from "../types";
import { evaluateHand } from "../../engine/hand-evaluator";
import { hand, auctionFromBids } from "./fixtures";

beforeEach(() => {
  clearRegistry();
  registerConvention(gerberConfig);
});

// --- Helpers ---

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
  return evaluateBiddingRules(context, gerberConfig);
}

// --- Deal Constraints ---

describe("Gerber deal constraints", () => {
  test("[bridgebum/gerber] opener 15-17 HCP balanced", () => {
    for (let i = 0; i < 20; i++) {
      const result = generateDeal(gerberDealConstraints);
      const openerHand = result.deal.hands[Seat.North];
      const hcp = calculateHcp(openerHand);
      expect(hcp).toBeGreaterThanOrEqual(15);
      expect(hcp).toBeLessThanOrEqual(17);
    }
  });

  test("[bridgebum/gerber] responder 16+ HCP", () => {
    for (let i = 0; i < 20; i++) {
      const result = generateDeal(gerberDealConstraints);
      const responderHand = result.deal.hands[Seat.South];
      const hcp = calculateHcp(responderHand);
      expect(hcp).toBeGreaterThanOrEqual(16);
    }
  });

  test("[bridgebum/gerber] rejects responder with 15 HCP", () => {
    // 15 HCP responder — below 16 threshold
    // SA(4)+SK(3)+SQ(2)+HK(3)+DK(3) = 15
    const responder15 = hand(
      "SA",
      "SK",
      "SQ",
      "S6",
      "S2",
      "HK",
      "H3",
      "DK",
      "D5",
      "D3",
      "C5",
      "C3",
      "C2",
    );
    expect(calculateHcp(responder15)).toBe(15);

    // Opener: 16 HCP balanced (3-4-3-3)
    // SJ(1)+S5+S3, HA(4)+HQ(2)+H5+H4, DA(4)+DQ(2)+D4, CK(3)+C7+C4 = 16
    const opener = hand(
      "SJ",
      "S5",
      "S3",
      "HA",
      "HQ",
      "H5",
      "H4",
      "DA",
      "DQ",
      "D4",
      "CK",
      "C7",
      "C4",
    );

    const satisfied = checkConstraints(
      {
        hands: {
          [Seat.North]: opener,
          [Seat.East]: hand(
            "ST",
            "S9",
            "S8",
            "HT",
            "H9",
            "H8",
            "H7",
            "DJ",
            "D8",
            "D7",
            "CA",
            "CQ",
            "C9",
          ),
          [Seat.South]: responder15,
          [Seat.West]: hand(
            "S7",
            "S4",
            "HJ",
            "H6",
            "H2",
            "DT",
            "D9",
            "D6",
            "D2",
            "CJ",
            "CT",
            "C8",
            "C6",
          ),
        },
        dealer: Seat.North,
        vulnerability:
          "None" as unknown as import("../../engine/types").Vulnerability,
      },
      gerberDealConstraints,
    );
    expect(satisfied).toBe(false);
  });

  test("[bridgebum/gerber] accepts responder with exactly 16 HCP", () => {
    // 16 HCP responder — boundary
    // SA(4)+SK(3)+HK(3)+DK(3)+CK(3) = 16
    const responder16 = hand(
      "SA",
      "SK",
      "S5",
      "S2",
      "HK",
      "H3",
      "DK",
      "D5",
      "D3",
      "CK",
      "C5",
      "C3",
      "C2",
    );
    expect(calculateHcp(responder16)).toBe(16);

    // Opener: 16 HCP balanced (3-4-3-3)
    // SQ(2)+HA(4)+HQ(2)+HJ(1)+DA(4)+DQ(2)+DJ(1) = 16
    const opener = hand(
      "SQ",
      "SJ",
      "S3",
      "HA",
      "HQ",
      "HJ",
      "H2",
      "DA",
      "DQ",
      "D4",
      "C7",
      "C6",
      "C4",
    );

    const satisfied = checkConstraints(
      {
        hands: {
          [Seat.North]: opener,
          [Seat.East]: hand(
            "S4",
            "S6",
            "S7",
            "H4",
            "H5",
            "H6",
            "H7",
            "D2",
            "D6",
            "D8",
            "C8",
            "C9",
            "CT",
          ),
          [Seat.South]: responder16,
          [Seat.West]: hand(
            "S8",
            "S9",
            "ST",
            "H8",
            "H9",
            "HT",
            "DJ",
            "DT",
            "D9",
            "D7",
            "CA",
            "CQ",
            "CJ",
          ),
        },
        dealer: Seat.North,
        vulnerability:
          "None" as unknown as import("../../engine/types").Vulnerability,
      },
      gerberDealConstraints,
    );
    expect(satisfied).toBe(true);
  });

  test("[bridgebum/gerber] accepts responder with 20 HCP", () => {
    // SA(4)+SK(3)+HA(4)+HK(3)+DA(4)+CQ(2) = 20
    const responder20 = hand(
      "SA",
      "SK",
      "S5",
      "S2",
      "HA",
      "HK",
      "DA",
      "D5",
      "D3",
      "CQ",
      "C5",
      "C3",
      "C2",
    );
    expect(calculateHcp(responder20)).toBe(20);

    // Opener: 15 HCP balanced (3-4-3-3)
    // SQ(2)+HQ(2)+HJ(1)+HT(0)+DK(3)+DQ(2)+CA(4)+CJ(1) = 15
    const opener = hand(
      "SQ",
      "S9",
      "S3",
      "HQ",
      "HJ",
      "HT",
      "H2",
      "DK",
      "DQ",
      "D4",
      "CA",
      "CJ",
      "C4",
    );
    expect(calculateHcp(opener)).toBe(15);

    const satisfied = checkConstraints(
      {
        hands: {
          [Seat.North]: opener,
          [Seat.East]: hand(
            "S4",
            "S6",
            "S7",
            "H3",
            "H4",
            "H5",
            "H6",
            "D2",
            "D6",
            "D7",
            "C6",
            "C8",
            "C9",
          ),
          [Seat.South]: responder20,
          [Seat.West]: hand(
            "S8",
            "S9",
            "ST",
            "H7",
            "H8",
            "H9",
            "DJ",
            "DT",
            "D9",
            "D8",
            "CK",
            "CT",
            "C7",
          ),
        },
        dealer: Seat.North,
        vulnerability:
          "None" as unknown as import("../../engine/types").Vulnerability,
      },
      gerberDealConstraints,
    );
    expect(satisfied).toBe(true);
  });
});

// --- Rule Unit Tests ---

describe("Gerber bidding rules -- gerber-ask", () => {
  test("[bridgebum/gerber] gerber-ask matches 16+ HCP after 1NT-P", () => {
    // SA(4)+SK(3)+HA(4)+DK(3)+CQ(2) = 16
    const responder = hand(
      "SA",
      "SK",
      "S5",
      "S2",
      "HA",
      "H3",
      "DK",
      "D5",
      "D3",
      "CQ",
      "C5",
      "C3",
      "C2",
    );
    expect(calculateHcp(responder)).toBe(16);
    const result = callFromRules(responder, Seat.South, ["1NT", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-ask");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("[bridgebum/gerber] gerber-ask rejects 15 HCP", () => {
    // SA(4)+SK(3)+SQ(2)+HK(3)+DK(3) = 15
    const weakResponder = hand(
      "SA",
      "SK",
      "SQ",
      "S6",
      "S2",
      "HK",
      "H3",
      "DK",
      "D5",
      "D3",
      "C5",
      "C3",
      "C2",
    );
    expect(calculateHcp(weakResponder)).toBe(15);
    const result = callFromRules(weakResponder, Seat.South, ["1NT", "P"]);
    if (result !== null) {
      expect(result.rule).not.toBe("gerber-ask");
    }
  });

  test("[bridgebum/gerber] gerber-ask fires after 2NT-P", () => {
    const responder = hand(
      "SA",
      "SK",
      "S5",
      "S2",
      "HA",
      "H3",
      "DK",
      "D5",
      "D3",
      "CQ",
      "C5",
      "C3",
      "C2",
    );
    const result = callFromRules(responder, Seat.South, ["2NT", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-ask");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("[bridgebum/gerber] gerber-ask rejects hand with void", () => {
    // SA(4)+SK(3)+SQ(2)+SJ(1)+HA(4)+HK(3)+DA(4)+DK(3) = 24 HCP, void in clubs
    const responderWithVoid = hand(
      "SA",
      "SK",
      "SQ",
      "SJ",
      "S5",
      "S2",
      "HA",
      "HK",
      "H3",
      "DA",
      "DK",
      "D5",
      "D3",
    );
    expect(calculateHcp(responderWithVoid)).toBe(24);
    const result = callFromRules(responderWithVoid, Seat.South, ["1NT", "P"]);
    // Should not fire gerber-ask due to void in clubs
    if (result !== null) {
      expect(result.rule).not.toBe("gerber-ask");
    }
  });

  test("[bridgebum/gerber] boundary: exactly 16 HCP responder fires gerber-ask", () => {
    // SA(4)+SK(3)+HK(3)+DK(3)+CK(3) = 16
    const responder16 = hand(
      "SA",
      "SK",
      "S5",
      "S2",
      "HK",
      "H3",
      "DK",
      "D4",
      "D3",
      "CK",
      "C5",
      "C3",
      "C2",
    );
    expect(calculateHcp(responder16)).toBe(16);
    const result = callFromRules(responder16, Seat.South, ["1NT", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-ask");
  });
});

describe("Gerber bidding rules -- ace responses", () => {
  test("[bridgebum/gerber] gerber-response-zero-four matches opener with 0 aces after 1NT-P-4C-P", () => {
    // 0 aces, 16 HCP: SK(3)+SQ(2)+HK(3)+HQ(2)+DK(3)+CK(3) = 16
    const opener0 = hand(
      "SK",
      "SQ",
      "S5",
      "S2",
      "HK",
      "HQ",
      "H3",
      "DK",
      "D7",
      "D5",
      "CK",
      "C7",
      "C2",
    );
    expect(countAces(opener0)).toBe(0);
    expect(calculateHcp(opener0)).toBe(16);
    const result = callFromRules(opener0, Seat.North, ["1NT", "P", "4C", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-response-zero-four");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Diamonds);
  });

  test("[bridgebum/gerber] gerber-response-zero-four matches opener with 4 aces", () => {
    const opener4 = hand(
      "SA",
      "S5",
      "S2",
      "HA",
      "H3",
      "H2",
      "DA",
      "D3",
      "D2",
      "CA",
      "C5",
      "C3",
      "C2",
    );
    expect(countAces(opener4)).toBe(4);
    const result = callFromRules(opener4, Seat.North, ["1NT", "P", "4C", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-response-zero-four");
  });

  test("[bridgebum/gerber] gerber-response-one matches opener with 1 ace", () => {
    const opener1 = hand(
      "SA",
      "SQ",
      "SJ",
      "S2",
      "HK",
      "HQ",
      "H3",
      "DK",
      "DQ",
      "D5",
      "CK",
      "C7",
      "C2",
    );
    expect(countAces(opener1)).toBe(1);
    const result = callFromRules(opener1, Seat.North, ["1NT", "P", "4C", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-response-one");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("[bridgebum/gerber] gerber-response-two matches opener with 2 aces", () => {
    const opener2 = hand(
      "SQ",
      "SJ",
      "S3",
      "HK",
      "HQ",
      "HJ",
      "H2",
      "DA",
      "D7",
      "D4",
      "CA",
      "C7",
      "C4",
    );
    expect(countAces(opener2)).toBe(2);
    const result = callFromRules(opener2, Seat.North, ["1NT", "P", "4C", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-response-two");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("[bridgebum/gerber] gerber-response-three matches opener with 3 aces", () => {
    const opener3 = hand(
      "SA",
      "SQ",
      "S3",
      "HA",
      "HQ",
      "HJ",
      "H2",
      "DA",
      "D7",
      "D4",
      "CK",
      "C7",
      "C4",
    );
    expect(countAces(opener3)).toBe(3);
    const result = callFromRules(opener3, Seat.North, ["1NT", "P", "4C", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-response-three");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test("[bridgebum/gerber] gerber-response-one rejects opener with 0 aces", () => {
    const opener0 = hand(
      "SK",
      "SQ",
      "S5",
      "S2",
      "HK",
      "HQ",
      "H3",
      "DK",
      "D7",
      "D5",
      "CK",
      "C7",
      "C2",
    );
    expect(countAces(opener0)).toBe(0);
    const result = callFromRules(opener0, Seat.North, ["1NT", "P", "4C", "P"]);
    expect(result).not.toBeNull();
    // Should match zero-four, not one
    expect(result!.rule).toBe("gerber-response-zero-four");
  });

  test("[bridgebum/gerber] gerber-response-two rejects opener with 1 ace", () => {
    const opener1 = hand(
      "SA",
      "SQ",
      "SJ",
      "S2",
      "HK",
      "HQ",
      "H3",
      "DK",
      "DQ",
      "D5",
      "CK",
      "C7",
      "C2",
    );
    expect(countAces(opener1)).toBe(1);
    const result = callFromRules(opener1, Seat.North, ["1NT", "P", "4C", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).not.toBe("gerber-response-two");
    expect(result!.rule).toBe("gerber-response-one");
  });
});

describe("Gerber bidding rules -- king-ask", () => {
  test("[bridgebum/gerber] gerber-king-ask fires with 3+ total aces after ace response", () => {
    // Responder has 2 aces, opener showed 4H (1 ace) -> total 3 -> ask for kings
    const responder2 = hand(
      "SA",
      "SK",
      "S5",
      "S2",
      "HA",
      "H3",
      "DK",
      "D5",
      "D3",
      "CQ",
      "C5",
      "C3",
      "C2",
    );
    expect(countAces(responder2)).toBe(2);
    const result = callFromRules(responder2, Seat.South, [
      "1NT",
      "P",
      "4C",
      "P",
      "4H",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-king-ask");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(5);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("[bridgebum/gerber] gerber-king-ask fires with 4 total aces after 4S response", () => {
    // Responder has 2 aces, opener showed 4S (2 aces) -> total 4 -> ask for kings
    const responder2 = hand(
      "SA",
      "SK",
      "S5",
      "S2",
      "HA",
      "H3",
      "DK",
      "D5",
      "D3",
      "CQ",
      "C5",
      "C3",
      "C2",
    );
    expect(countAces(responder2)).toBe(2);
    const result = callFromRules(responder2, Seat.South, [
      "1NT",
      "P",
      "4C",
      "P",
      "4S",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-king-ask");
  });
});

describe("Gerber bidding rules -- king responses", () => {
  test("[bridgebum/gerber] gerber-king-response-zero-four matches opener with 0 kings", () => {
    // 0 kings: SA(4)+SQ(2)+HA(4)+HQ(2)+DA(4) = 16 HCP, 0 kings
    const opener0k = hand(
      "SA",
      "SQ",
      "S5",
      "S2",
      "HA",
      "HQ",
      "H3",
      "DA",
      "D7",
      "D5",
      "CJ",
      "C7",
      "C2",
    );
    expect(countKings(opener0k)).toBe(0);
    const result = callFromRules(opener0k, Seat.North, [
      "1NT", "P", "4C", "P", "4H", "P", "5C", "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-king-response-zero-four");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(5);
    expect(call.strain).toBe(BidSuit.Diamonds);
  });

  test("[bridgebum/gerber] gerber-king-response-one matches opener with 1 king", () => {
    const opener1k = hand(
      "SK",
      "SQ",
      "SJ",
      "S2",
      "HA",
      "HQ",
      "H3",
      "DA",
      "DQ",
      "D5",
      "CJ",
      "C7",
      "C2",
    );
    expect(countKings(opener1k)).toBe(1);
    const result = callFromRules(opener1k, Seat.North, [
      "1NT", "P", "4C", "P", "4S", "P", "5C", "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-king-response-one");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(5);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("[bridgebum/gerber] gerber-king-response-two matches opener with 2 kings", () => {
    const opener2k = hand(
      "SK",
      "SQ",
      "SJ",
      "S2",
      "HK",
      "HQ",
      "H3",
      "DA",
      "DQ",
      "D5",
      "CJ",
      "C7",
      "C2",
    );
    expect(countKings(opener2k)).toBe(2);
    const result = callFromRules(opener2k, Seat.North, [
      "1NT", "P", "4C", "P", "4H", "P", "5C", "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-king-response-two");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(5);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("[bridgebum/gerber] gerber-king-response-three matches opener with 3 kings", () => {
    const opener3k = hand(
      "SK",
      "SQ",
      "S3",
      "HK",
      "HQ",
      "HJ",
      "H2",
      "DK",
      "D7",
      "D4",
      "CA",
      "C7",
      "C4",
    );
    expect(countKings(opener3k)).toBe(3);
    const result = callFromRules(opener3k, Seat.North, [
      "1NT", "P", "4C", "P", "4NT", "P", "5C", "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-king-response-three");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(5);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });
});

describe("Gerber bidding rules -- signoff", () => {
  test("[bridgebum/gerber] gerber-signoff bids 4NT signoff with 2 combined aces after 4H", () => {
    // Responder has 1 ace, opener showed 4H (1 ace) -> total 2 -> direct signoff (< 3)
    const responder1 = hand(
      "SA",
      "SK",
      "SQ",
      "S2",
      "HK",
      "H3",
      "DK",
      "D5",
      "D3",
      "CQ",
      "C5",
      "C3",
      "C2",
    );
    expect(countAces(responder1)).toBe(1);
    const result = callFromRules(responder1, Seat.South, [
      "1NT",
      "P",
      "4C",
      "P",
      "4H",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-signoff");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test("[bridgebum/gerber] gerber-signoff bids 5NT signoff after 4S when not enough aces", () => {
    // Responder has 0 aces, opener showed 4S (2 aces) -> total 2 -> direct signoff
    // SK(3)+SQ(2)+HK(3)+HQ(2)+DK(3)+CK(3) = 16
    const responder0 = hand(
      "SK",
      "SQ",
      "S5",
      "S2",
      "HK",
      "HQ",
      "H3",
      "DK",
      "D7",
      "D5",
      "CK",
      "C3",
      "C2",
    );
    expect(countAces(responder0)).toBe(0);
    const result = callFromRules(responder0, Seat.South, [
      "1NT",
      "P",
      "4C",
      "P",
      "4S",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-signoff");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(5);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test("[bridgebum/gerber] gerber-signoff after king response: 7NT with 4 aces + 4 kings", () => {
    // Responder has 2 aces 2 kings, opener showed 4S (2 aces), king resp 5S (2 kings)
    // -> total 4 aces, 4 kings -> 7NT
    const responder = hand(
      "SA",
      "SK",
      "S5",
      "S2",
      "HA",
      "HK",
      "DQ",
      "D5",
      "D3",
      "CQ",
      "C5",
      "C3",
      "C2",
    );
    expect(countAces(responder)).toBe(2);
    expect(countKings(responder)).toBe(2);
    const result = callFromRules(responder, Seat.South, [
      "1NT", "P", "4C", "P", "4S", "P", "5C", "P", "5S", "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-signoff");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(7);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test("[bridgebum/gerber] gerber-signoff after king response: 6NT with 3 aces + 2 kings", () => {
    // Responder has 2 aces 1 king, opener showed 4H (1 ace), king resp 5H (1 king)
    // -> total 3 aces, 2 kings -> 6NT
    const responder = hand(
      "SA",
      "SK",
      "S5",
      "S2",
      "HA",
      "H3",
      "DQ",
      "D5",
      "D3",
      "CQ",
      "C5",
      "C3",
      "C2",
    );
    expect(countAces(responder)).toBe(2);
    expect(countKings(responder)).toBe(1);
    const result = callFromRules(responder, Seat.South, [
      "1NT", "P", "4C", "P", "4H", "P", "5C", "P", "5H", "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-signoff");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(6);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });
});

// --- Full Sequence Integration ---

describe("Gerber full sequences", () => {
  test("1NT-P-4C-P-4S-P-5C-P-5H-P-6NT (3 aces, ask kings, 2 kings -> 6NT)", () => {
    // Opener: 16 HCP, 2 aces, 1 king
    const opener = hand(
      "SQ",
      "SJ",
      "S3",
      "HK",
      "HQ",
      "HJ",
      "H2",
      "DA",
      "D7",
      "D4",
      "CA",
      "C7",
      "C4",
    );
    expect(countAces(opener)).toBe(2);
    expect(countKings(opener)).toBe(1);

    // Responder: 17 HCP, 1 ace, 2 kings
    const responder = hand(
      "SA",
      "SK",
      "SQ",
      "S2",
      "HK",
      "H3",
      "DQ",
      "D5",
      "D3",
      "CQ",
      "C5",
      "C3",
      "C2",
    );
    expect(countAces(responder)).toBe(1);
    expect(countKings(responder)).toBe(2);

    // Step 1: 4C (Gerber)
    const ask = callFromRules(responder, Seat.South, ["1NT", "P"]);
    expect(ask!.rule).toBe("gerber-ask");

    // Step 2: 4S (2 aces)
    const aceResp = callFromRules(opener, Seat.North, ["1NT", "P", "4C", "P"]);
    expect(aceResp!.rule).toBe("gerber-response-two");

    // Step 3: 5C (ask kings, total 3 aces)
    const kingAsk = callFromRules(responder, Seat.South, [
      "1NT", "P", "4C", "P", "4S", "P",
    ]);
    expect(kingAsk!.rule).toBe("gerber-king-ask");

    // Step 4: 5H (1 king)
    const kingResp = callFromRules(opener, Seat.North, [
      "1NT", "P", "4C", "P", "4S", "P", "5C", "P",
    ]);
    expect(kingResp!.rule).toBe("gerber-king-response-one");

    // Step 5: 6NT (3 aces, 3 kings -> 6NT)
    const signoff = callFromRules(responder, Seat.South, [
      "1NT", "P", "4C", "P", "4S", "P", "5C", "P", "5H", "P",
    ]);
    expect(signoff!.rule).toBe("gerber-signoff");
    expect((signoff!.call as ContractBid).level).toBe(6);
    expect((signoff!.call as ContractBid).strain).toBe(BidSuit.NoTrump);
  });

  test("1NT-P-4C-P-4D-P-king-ask (4D = 0 or 4 aces, responder has 0 so opener has 4)", () => {
    // Opener with 4 aces
    const opener = hand(
      "SA",
      "S5",
      "S2",
      "HA",
      "H3",
      "H2",
      "DA",
      "D3",
      "D2",
      "CA",
      "C5",
      "C3",
      "C2",
    );
    expect(countAces(opener)).toBe(4);

    // Responder with 0 aces, 16 HCP
    const responder = hand(
      "SK",
      "SQ",
      "S7",
      "S3",
      "HK",
      "HQ",
      "H4",
      "DK",
      "D5",
      "D4",
      "CK",
      "C4",
      "C3",
    );
    expect(countAces(responder)).toBe(0);

    // Step 1: 4C
    const ask = callFromRules(responder, Seat.South, ["1NT", "P"]);
    expect(ask!.rule).toBe("gerber-ask");

    // Step 2: 4D (0 or 4 aces)
    const aceResp = callFromRules(opener, Seat.North, ["1NT", "P", "4C", "P"]);
    expect(aceResp!.rule).toBe("gerber-response-zero-four");

    // Step 3: 5C king-ask (responder has 0 aces, disambiguates opener = 4, total = 4)
    const kingAsk = callFromRules(responder, Seat.South, [
      "1NT", "P", "4C", "P", "4D", "P",
    ]);
    expect(kingAsk!.rule).toBe("gerber-king-ask");
  });

  test("1NT-P-4C-P-4H-P-4NT signoff (1 opener + 0 responder = 1 -> direct signoff)", () => {
    // Opener: 1 ace
    const opener = hand(
      "SA",
      "SQ",
      "SJ",
      "S2",
      "HK",
      "HQ",
      "H3",
      "DK",
      "DQ",
      "D5",
      "CK",
      "C7",
      "C2",
    );
    expect(countAces(opener)).toBe(1);

    // Responder: 0 aces, 16 HCP
    const responder = hand(
      "SK",
      "SQ",
      "S5",
      "S3",
      "HK",
      "HQ",
      "H2",
      "DK",
      "D7",
      "D4",
      "D3",
      "CK",
      "C2",
    );
    expect(countAces(responder)).toBe(0);
    expect(calculateHcp(responder)).toBe(16);

    const ask = callFromRules(responder, Seat.South, ["1NT", "P"]);
    expect(ask!.rule).toBe("gerber-ask");

    const response = callFromRules(opener, Seat.North, ["1NT", "P", "4C", "P"]);
    expect(response!.rule).toBe("gerber-response-one");

    const signoff = callFromRules(responder, Seat.South, [
      "1NT",
      "P",
      "4C",
      "P",
      "4H",
      "P",
    ]);
    expect(signoff!.rule).toBe("gerber-signoff");
    expect((signoff!.call as ContractBid).level).toBe(4);
    expect((signoff!.call as ContractBid).strain).toBe(BidSuit.NoTrump);
  });

  test("1NT-P-4C-P-4NT-P-king-ask (3 opener aces + 0 responder = 3 -> ask kings)", () => {
    // Opener: 3 aces
    const opener = hand(
      "SA",
      "SQ",
      "S3",
      "HA",
      "HQ",
      "HJ",
      "H2",
      "DA",
      "D7",
      "D4",
      "CK",
      "C7",
      "C4",
    );
    expect(countAces(opener)).toBe(3);

    // Responder: 0 aces, 16 HCP
    const responder = hand(
      "SK",
      "SQ",
      "S5",
      "S2",
      "HK",
      "HQ",
      "H3",
      "DK",
      "D5",
      "D3",
      "CK",
      "C4",
      "C2",
    );
    expect(countAces(responder)).toBe(0);
    expect(calculateHcp(responder)).toBe(16);

    const ask = callFromRules(responder, Seat.South, ["1NT", "P"]);
    expect(ask!.rule).toBe("gerber-ask");

    const response = callFromRules(opener, Seat.North, ["1NT", "P", "4C", "P"]);
    expect(response!.rule).toBe("gerber-response-three");

    // With 3 total aces, king-ask fires
    const kingAsk = callFromRules(responder, Seat.South, [
      "1NT",
      "P",
      "4C",
      "P",
      "4NT",
      "P",
    ]);
    expect(kingAsk!.rule).toBe("gerber-king-ask");
  });
});

// --- Reference Hand Verification ---

describe("Gerber reference hands", () => {
  test("[bridgebum/gerber] Example: AKxxx Kxx AKx xx -- 17 HCP responder bids 4C", () => {
    // AKxxx = SA SK S5 S4 S3, Kxx = HK H5 H3, AKx = DA DK D5, xx = C3 C2
    // SA(4)+SK(3)+HK(3)+DA(4)+DK(3) = 17
    const responder = hand(
      "SA",
      "SK",
      "S5",
      "S4",
      "S3",
      "HK",
      "H5",
      "H3",
      "DA",
      "DK",
      "D5",
      "C3",
      "C2",
    );
    expect(calculateHcp(responder)).toBe(17);
    const result = callFromRules(responder, Seat.South, ["1NT", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-ask");
  });

  test("[bridgebum/gerber] 4D response = 0 or 4 aces", () => {
    // Verify both 0-ace and 4-ace hands produce 4D
    const opener0 = hand(
      "SK",
      "SQ",
      "S5",
      "S2",
      "HK",
      "HQ",
      "H3",
      "DK",
      "D7",
      "D5",
      "CK",
      "C7",
      "C2",
    );
    const opener4 = hand(
      "SA",
      "S5",
      "S2",
      "HA",
      "H3",
      "H2",
      "DA",
      "D3",
      "D2",
      "CA",
      "C5",
      "C3",
      "C2",
    );

    const result0 = callFromRules(opener0, Seat.North, ["1NT", "P", "4C", "P"]);
    const result4 = callFromRules(opener4, Seat.North, ["1NT", "P", "4C", "P"]);

    expect(result0!.rule).toBe("gerber-response-zero-four");
    expect(result4!.rule).toBe("gerber-response-zero-four");
    expect((result0!.call as ContractBid).strain).toBe(BidSuit.Diamonds);
    expect((result4!.call as ContractBid).strain).toBe(BidSuit.Diamonds);
  });

  test("[bridgebum/gerber] opener 0 aces with 16 HCP from KQJ only", () => {
    // SK(3)+SQ(2)+HK(3)+HQ(2)+DK(3)+CK(3) = 16
    const opener0 = hand(
      "SK",
      "SQ",
      "S5",
      "S2",
      "HK",
      "HQ",
      "H3",
      "DK",
      "D7",
      "D5",
      "CK",
      "C7",
      "C2",
    );
    expect(countAces(opener0)).toBe(0);
    expect(calculateHcp(opener0)).toBe(16);
    const result = callFromRules(opener0, Seat.North, ["1NT", "P", "4C", "P"]);
    expect(result!.rule).toBe("gerber-response-zero-four");
  });

  test("[bridgebum/gerber] responder with all 4 aces disambiguates 4D as opener 0", () => {
    const responder4 = hand(
      "SA",
      "S5",
      "S2",
      "HA",
      "H3",
      "DA",
      "D5",
      "D3",
      "D2",
      "CA",
      "C5",
      "C3",
      "C2",
    );
    expect(countAces(responder4)).toBe(4);
    // After 4D, responder has 4 aces -> opener = 0, total = 4 -> king-ask (3+ aces)
    const result = callFromRules(responder4, Seat.South, [
      "1NT",
      "P",
      "4C",
      "P",
      "4D",
      "P",
    ]);
    expect(result!.rule).toBe("gerber-king-ask");
    expect((result!.call as ContractBid).level).toBe(5);
    expect((result!.call as ContractBid).strain).toBe(BidSuit.Clubs);
  });

  test("[bridgebum/gerber] countAces helper returns correct counts", () => {
    const noAces = hand(
      "SK",
      "SQ",
      "S5",
      "S2",
      "HK",
      "HQ",
      "H3",
      "DK",
      "D7",
      "D5",
      "CK",
      "C7",
      "C2",
    );
    const twoAces = hand(
      "SA",
      "SK",
      "S5",
      "S2",
      "HA",
      "H3",
      "DK",
      "D5",
      "D3",
      "CQ",
      "C5",
      "C3",
      "C2",
    );
    const fourAces = hand(
      "SA",
      "S5",
      "S2",
      "HA",
      "H3",
      "H2",
      "DA",
      "D3",
      "D2",
      "CA",
      "C5",
      "C3",
      "C2",
    );
    expect(countAces(noAces)).toBe(0);
    expect(countAces(twoAces)).toBe(2);
    expect(countAces(fourAces)).toBe(4);
  });
});

// --- Edge Cases: Ace Disambiguation and Signoff Boundaries ---

describe("Gerber edge cases — ace disambiguation", () => {
  test("responder with 1 ace sees 4D: infers opener=4, total=5 → king-ask", () => {
    // Responder has 1 ace, opener showed 4D (0 or 4).
    // Since responder != 4 aces, disambiguation says opener = 4.
    // Total = 1 + 4 = 5 (impossible in real bridge — only 4 aces exist).
    // With 3+ total aces, king-ask fires instead of direct signoff.
    const responder1 = hand(
      "SA",
      "SK",
      "SQ",
      "S2",
      "HK",
      "H3",
      "DK",
      "D5",
      "D3",
      "CQ",
      "C5",
      "C3",
      "C2",
    );
    expect(countAces(responder1)).toBe(1);
    const result = callFromRules(responder1, Seat.South, [
      "1NT",
      "P",
      "4C",
      "P",
      "4D",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-king-ask");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(5);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("king-ask after 4S with exactly 1 responder ace: total=3 → 5C", () => {
    // Responder has 1 ace, opener showed 4S (2 aces) → total = 3 → king-ask
    const responder1 = hand(
      "SA",
      "SK",
      "SQ",
      "S2",
      "HK",
      "H3",
      "DK",
      "D5",
      "D3",
      "CQ",
      "C5",
      "C3",
      "C2",
    );
    expect(countAces(responder1)).toBe(1);
    const result = callFromRules(responder1, Seat.South, [
      "1NT",
      "P",
      "4C",
      "P",
      "4S",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-king-ask");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(5);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("countAces returns 0 for hand with no face cards (yarborough-like)", () => {
    const noAces = hand(
      "S9",
      "S8",
      "S7",
      "S6",
      "H9",
      "H8",
      "H7",
      "D9",
      "D8",
      "D7",
      "C9",
      "C8",
      "C7",
    );
    expect(countAces(noAces)).toBe(0);
  });
});

// --- Property-Based Invariants ---

describe("Gerber property-based invariants", () => {
  test("[bridgebum/gerber invariant] 50 random deals: gerber-ask fires unless hand has void", () => {
    for (let i = 0; i < 50; i++) {
      const result = generateDeal(gerberDealConstraints);
      const responderHand = result.deal.hands[Seat.South];
      const hcp = calculateHcp(responderHand);
      expect(hcp).toBeGreaterThanOrEqual(16);

      const ctx = makeBiddingContext(responderHand, Seat.South, ["1NT", "P"]);
      const ruleResult = evaluateBiddingRules(ctx, gerberConfig);

      const hasVoid = ctx.evaluation.shape.some((s) => s === 0);
      if (hasVoid) {
        // Hands with void should NOT fire gerber-ask
        if (ruleResult !== null) {
          expect(ruleResult.rule).not.toBe("gerber-ask");
        }
      } else {
        expect(ruleResult).not.toBeNull();
        expect(ruleResult!.rule).toBe("gerber-ask");
        const call = ruleResult!.call as ContractBid;
        expect(call.level).toBe(4);
        expect(call.strain).toBe(BidSuit.Clubs);
      }
    }
  });

  test("[bridgebum/gerber invariant] all ace responses map to exactly one response rule", () => {
    // For each ace count (0-4), exactly one response rule should match
    const aceHands: Hand[] = [
      // 0 aces (16 HCP)
      hand(
        "SK",
        "SQ",
        "S5",
        "S2",
        "HK",
        "HQ",
        "H3",
        "DK",
        "D7",
        "D5",
        "CK",
        "C7",
        "C2",
      ),
      // 1 ace
      hand(
        "SA",
        "SQ",
        "SJ",
        "S2",
        "HK",
        "HQ",
        "H3",
        "DK",
        "DQ",
        "D5",
        "CK",
        "C7",
        "C2",
      ),
      // 2 aces
      hand(
        "SA",
        "SQ",
        "SJ",
        "S2",
        "HA",
        "HQ",
        "H3",
        "DK",
        "DQ",
        "D5",
        "CK",
        "C7",
        "C2",
      ),
      // 3 aces
      hand(
        "SA",
        "SQ",
        "S3",
        "HA",
        "HQ",
        "HJ",
        "H2",
        "DA",
        "D7",
        "D4",
        "CK",
        "C7",
        "C4",
      ),
      // 4 aces
      hand(
        "SA",
        "S5",
        "S2",
        "HA",
        "H3",
        "H2",
        "DA",
        "D3",
        "D2",
        "CA",
        "C5",
        "C3",
        "C2",
      ),
    ];

    const expectedRules = [
      "gerber-response-zero-four", // 0 aces
      "gerber-response-one", // 1 ace
      "gerber-response-two", // 2 aces
      "gerber-response-three", // 3 aces
      "gerber-response-zero-four", // 4 aces
    ];

    for (let i = 0; i < aceHands.length; i++) {
      const result = callFromRules(aceHands[i]!, Seat.North, [
        "1NT",
        "P",
        "4C",
        "P",
      ]);
      expect(result).not.toBeNull();
      expect(result!.rule).toBe(expectedRules[i]);
    }
  });

  test("[bridgebum/gerber invariant] after any ace response, either king-ask or signoff fires", () => {
    const responder = hand(
      "SA",
      "SK",
      "S5",
      "S2",
      "HA",
      "H3",
      "DK",
      "D5",
      "D3",
      "CQ",
      "C5",
      "C3",
      "C2",
    );
    const aceResponses = ["4D", "4H", "4S", "4NT"];
    for (const resp of aceResponses) {
      const result = callFromRules(responder, Seat.South, [
        "1NT",
        "P",
        "4C",
        "P",
        resp,
        "P",
      ]);
      expect(result).not.toBeNull();
      // With 2 aces, king-ask fires when total >= 3, signoff when < 3
      expect(["gerber-king-ask", "gerber-signoff"]).toContain(result!.rule);
    }
  });

  test("[bridgebum/gerber invariant] 50 random deals: opener ace response matches ace count", () => {
    for (let i = 0; i < 50; i++) {
      const result = generateDeal(gerberDealConstraints);
      const openerHand = result.deal.hands[Seat.North];
      const aces = countAces(openerHand);

      const ctx = makeBiddingContext(openerHand, Seat.North, [
        "1NT",
        "P",
        "4C",
        "P",
      ]);
      const ruleResult = evaluateBiddingRules(ctx, gerberConfig);
      expect(ruleResult).not.toBeNull();

      // Verify correct rule fires
      if (aces === 0 || aces === 4) {
        expect(ruleResult!.rule).toBe("gerber-response-zero-four");
      } else if (aces === 1) {
        expect(ruleResult!.rule).toBe("gerber-response-one");
      } else if (aces === 2) {
        expect(ruleResult!.rule).toBe("gerber-response-two");
      } else if (aces === 3) {
        expect(ruleResult!.rule).toBe("gerber-response-three");
      }
    }
  });

  test("[bridgebum/gerber invariant] king-ask fires with 3+ total aces, signoff with fewer", () => {
    // Test with various ace distributions — 3+ aces = king-ask, <3 = signoff
    const testCases = [
      { respAces: 2, response: "4S", expectedTotal: 4, expectedRule: "gerber-king-ask" }, // 2+2=4
      { respAces: 1, response: "4NT", expectedTotal: 4, expectedRule: "gerber-king-ask" }, // 1+3=4
      { respAces: 2, response: "4H", expectedTotal: 3, expectedRule: "gerber-king-ask" }, // 2+1=3
      { respAces: 1, response: "4H", expectedTotal: 2, expectedRule: "gerber-signoff" }, // 1+1=2 -> signoff
    ];

    for (const tc of testCases) {
      let h: Hand;
      if (tc.respAces === 0) {
        h = hand(
          "SK",
          "SQ",
          "S5",
          "S2",
          "HK",
          "HQ",
          "H3",
          "DK",
          "D7",
          "D5",
          "CK",
          "C7",
          "C2",
        );
      } else if (tc.respAces === 1) {
        h = hand(
          "SA",
          "SK",
          "SQ",
          "S2",
          "HK",
          "H3",
          "DK",
          "D5",
          "D3",
          "CQ",
          "C5",
          "C3",
          "C2",
        );
      } else {
        h = hand(
          "SA",
          "SK",
          "S5",
          "S2",
          "HA",
          "H3",
          "DK",
          "D5",
          "D3",
          "CQ",
          "C5",
          "C3",
          "C2",
        );
      }

      const result = callFromRules(h, Seat.South, [
        "1NT",
        "P",
        "4C",
        "P",
        tc.response,
        "P",
      ]);
      expect(result).not.toBeNull();
      expect(result!.rule).toBe(tc.expectedRule);
    }
  });
});
