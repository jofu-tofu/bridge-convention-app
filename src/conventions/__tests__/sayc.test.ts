import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../engine/types";
import type { ContractBid, Hand } from "../../engine/types";
import {
  registerConvention,
  clearRegistry,
  evaluateBiddingRules,
} from "../registry";
import { saycConfig } from "../sayc";
import type { BiddingContext } from "../types";
import { evaluateHand } from "../../engine/hand-evaluator";
import { hand, auctionFromBids } from "./fixtures";

beforeEach(() => {
  clearRegistry();
  registerConvention(saycConfig);
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
  return evaluateBiddingRules(saycConfig.biddingRules, context);
}

// ─── Opening Bids ───────────────────────────────────────────

describe("SAYC opening bids", () => {
  test("1NT opening: 15-17 balanced, no 5-card major", () => {
    // 16 HCP, 4-3-3-3 balanced
    const opener = hand(
      "SA", "SK", "SQ", "S2", // 4 spades, 10 HCP
      "HK", "H5", "H3",       // 3 hearts, 3 HCP
      "DK", "D5", "D3",       // 3 diamonds, 3 HCP
      "C5", "C3", "C2",       // 3 clubs, 0 HCP
    );
    const result = callFromRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-open-1nt");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(1);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test("1NT does not match with 5-card major", () => {
    // 15 HCP, balanced but 5 spades
    const opener = hand(
      "SA", "SK", "SQ", "S5", "S2", // 5 spades
      "HK", "H5", "H3",              // 3 hearts
      "DK", "D3",                     // 2 diamonds
      "C5", "C3", "C2",              // 3 clubs
    );
    // 15 HCP, balanced 5-3-3-2 but has 5-card major
    const result = callFromRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
    // Should open 1S instead of 1NT
    expect(result!.rule).toBe("sayc-open-1s");
  });

  test("1H opening: 12+ HCP, 5+ hearts", () => {
    // 13 HCP, 5 hearts
    const opener = hand(
      "SA", "SK", "S3",        // 3 spades, 7 HCP
      "HK", "HQ", "HJ", "H7", "H3", // 5 hearts, 6 HCP
      "D5", "D3",              // 2 diamonds, 0 HCP
      "C5", "C3", "C2",       // 3 clubs, 0 HCP
    );
    const result = callFromRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-open-1h");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(1);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("1S opening: 12+ HCP, 5+ spades (longer than hearts)", () => {
    // 14 HCP, 5 spades 4 hearts
    const opener = hand(
      "SA", "SK", "SQ", "SJ", "S3", // 5 spades, 10 HCP
      "HK", "H7", "H5", "H3",       // 4 hearts, 3 HCP
      "DJ",                           // 1 diamond, 1 HCP
      "C5", "C3", "C2",              // 3 clubs, 0 HCP
    );
    const result = callFromRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-open-1s");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(1);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("1D opening: 12+ HCP, 4+ diamonds, no 5-card major", () => {
    // 13 HCP, 4 diamonds, no 5-card major
    const opener = hand(
      "SA", "SK", "S3",       // 3 spades, 7 HCP
      "HK", "H5", "H3",       // 3 hearts, 3 HCP
      "DK", "DJ", "D7", "D3", // 4 diamonds, 4 HCP (wait that's 14)
      "C5", "C3", "C2",       // 3 clubs, 0 HCP
    );
    // Actually 14 HCP which is fine for 1D
    const result = callFromRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-open-1d");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(1);
    expect(call.strain).toBe(BidSuit.Diamonds);
  });

  test("1C opening: 12+ HCP, no 5-card major, less than 4 diamonds", () => {
    // 13 HCP, 3-3-3-4 clubs longest
    const opener = hand(
      "SA", "SK", "S3",       // 3 spades, 7 HCP
      "HK", "H5", "H3",       // 3 hearts, 3 HCP
      "DQ", "D5", "D3",       // 3 diamonds, 2 HCP
      "CJ", "C7", "C5", "C3", // 4 clubs, 1 HCP
    );
    const result = callFromRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-open-1c");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(1);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("2C opening: 22+ HCP", () => {
    // 22 HCP
    const opener = hand(
      "SA", "SK", "SQ", "SJ", // 4 spades, 10 HCP
      "HA", "HK", "HQ",        // 3 hearts, 10 HCP
      "DK", "D5", "D3",        // 3 diamonds, 3 HCP (that's 23)
      "C5", "C3", "C2",        // 3 clubs, 0 HCP
    );
    // 23 HCP
    const result = callFromRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-open-2c");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("weak 2H: 5-11 HCP, 6+ hearts", () => {
    // 8 HCP, 6 hearts
    const opener = hand(
      "S5", "S3", "S2",              // 3 spades, 0 HCP
      "HK", "HQ", "HJ", "H7", "H5", "H3", // 6 hearts, 6 HCP
      "DQ",                            // 1 diamond, 2 HCP
      "C5", "C3", "C2",              // 3 clubs, 0 HCP
    );
    const result = callFromRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-open-weak-2h");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("weak 2S: 5-11 HCP, 6+ spades", () => {
    // 9 HCP, 6 spades
    const opener = hand(
      "SA", "SK", "SQ", "S7", "S5", "S3", // 6 spades, 9 HCP
      "H5", "H3", "H2",                    // 3 hearts, 0 HCP
      "D5", "D3",                           // 2 diamonds, 0 HCP
      "C3", "C2",                           // 2 clubs, 0 HCP
    );
    const result = callFromRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-open-weak-2s");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("pass with < 12 HCP (and not weak 2)", () => {
    // 8 HCP, no 6-card suit
    const opener = hand(
      "SK", "SQ", "S5", "S3", // 4 spades, 5 HCP
      "HJ", "H5", "H3",       // 3 hearts, 1 HCP
      "DQ", "D5", "D3",       // 3 diamonds, 2 HCP
      "C5", "C3", "C2",       // 3 clubs, 0 HCP
    );
    const result = callFromRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-pass");
    expect(result!.call.type).toBe("pass");
  });
});

// ─── Responses ──────────────────────────────────────────────

describe("SAYC responses to 1-level suit openings", () => {
  test("raise 1H to 2H: 6-10 HCP, 3+ hearts", () => {
    // Partner (North) opened 1H, we (South) have 9 HCP 3 hearts
    const responder = hand(
      "SK", "S5", "S3", "S2",  // 4 spades, 3 HCP
      "HQ", "HJ", "H7",        // 3 hearts, 3 HCP
      "DK", "D5", "D3",        // 3 diamonds, 3 HCP
      "C5", "C3", "C2",        // 3 clubs, 0 HCP
    );
    // 3 + 3 + 3 + 0 = 9 HCP. In 6-10 range.
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-respond-raise-major");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("raise 1S to 2S: 6-10 HCP, 3+ spades", () => {
    const responder = hand(
      "SQ", "SJ", "S7",        // 3 spades, 3 HCP
      "HK", "H5", "H3",        // 3 hearts, 3 HCP
      "DQ", "D5", "D3",        // 3 diamonds, 2 HCP
      "C5", "C4", "C3", "C2",  // 4 clubs, 0 HCP
    );
    // 8 HCP
    const result = callFromRules(responder, Seat.South, ["1S", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-respond-raise-major");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("1H over partner's minor: 6+ HCP, 4+ hearts", () => {
    const responder = hand(
      "S5", "S3", "S2",        // 3 spades, 0 HCP
      "HK", "HQ", "HJ", "H3", // 4 hearts, 6 HCP
      "DK", "D5", "D3",        // 3 diamonds, 3 HCP
      "C5", "C3", "C2",        // 3 clubs, 0 HCP
    );
    // 9 HCP, 4 hearts — but also has 3 heart support for raise range
    // However 1H response over minor should be chosen since partner opened minor
    const result = callFromRules(responder, Seat.South, ["1D", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-respond-1h-over-minor");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(1);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("1S over partner's 1H: 6+ HCP, 4+ spades", () => {
    const responder = hand(
      "SA", "SK", "SQ", "S3",  // 4 spades, 10 HCP
      "H5", "H3", "H2",        // 3 hearts, 0 HCP
      "DK", "D5", "D3",        // 3 diamonds, 3 HCP
      "C5", "C3", "C2",        // 3 clubs, 0 HCP
    );
    // 13 HCP, 4 spades
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-respond-1s-over-1h");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(1);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("1NT response: 6-10 HCP, no fit, partner opened suit", () => {
    // 7 HCP, only 2 hearts (no 3+ support), no 4+ spades
    const responder = hand(
      "SK", "S5", "S3",        // 3 spades, 3 HCP
      "H5", "H3",              // 2 hearts, 0 HCP
      "DK", "D5", "D3", "D2", // 4 diamonds, 3 HCP
      "CJ", "C5", "C3", "C2", // 4 clubs, 1 HCP
    );
    // 7 HCP, 2 hearts — can't raise 1H, no 4+ spades to bid 1S
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-respond-1nt");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(1);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });
});

// ─── Responses to 1NT ───────────────────────────────────────

describe("SAYC responses to 1NT", () => {
  test("Stayman: 8+ HCP, 4-card major after 1NT", () => {
    const responder = hand(
      "SK", "SQ", "SJ", "S3", // 4 spades, 6 HCP
      "HK", "H5", "H3",        // 3 hearts, 3 HCP
      "D5", "D3", "D2",        // 3 diamonds, 0 HCP
      "C5", "C3", "C2",        // 3 clubs, 0 HCP
    );
    // 9 HCP, 4 spades
    const result = callFromRules(responder, Seat.South, ["1NT", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-respond-1nt-stayman");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("Pass 1NT: 0-7 HCP", () => {
    const responder = hand(
      "SK", "S5", "S3", "S2",  // 4 spades, 3 HCP
      "H5", "H3", "H2",        // 3 hearts, 0 HCP
      "DQ", "D5", "D3",        // 3 diamonds, 2 HCP
      "C5", "C3", "C2",        // 3 clubs, 0 HCP
    );
    // 5 HCP
    const result = callFromRules(responder, Seat.South, ["1NT", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-respond-1nt-pass");
    expect(result!.call.type).toBe("pass");
  });
});

// ─── Edge Cases ─────────────────────────────────────────────

describe("SAYC edge cases", () => {
  test("opener with exactly 12 HCP opens 1-level suit", () => {
    // 12 HCP, 5 spades
    const opener = hand(
      "SA", "SK", "SQ", "S7", "S3", // 5 spades, 9 HCP
      "HK", "H5", "H3",              // 3 hearts, 3 HCP
      "D5", "D3",                     // 2 diamonds, 0 HCP
      "C5", "C3", "C2",              // 3 clubs, 0 HCP
    );
    // 12 HCP
    const result = callFromRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-open-1s");
  });

  test("4 HCP does not open (passes)", () => {
    const opener = hand(
      "SA", "S5", "S3", "S2", // 4 spades, 4 HCP
      "H5", "H3", "H2",       // 3 hearts, 0 HCP
      "D5", "D3", "D2",       // 3 diamonds, 0 HCP
      "C5", "C3", "C2",       // 3 clubs, 0 HCP
    );
    const result = callFromRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-pass");
  });

  test("config is internal", () => {
    expect(saycConfig.internal).toBe(true);
  });

  test("opener after passes: still opens", () => {
    // Dealer is North, East passes, South passes, West to bid with 14 HCP
    const opener = hand(
      "SA", "SK", "SQ", "S7", "S3", // 5 spades, 9 HCP
      "HK", "HQ", "H3",              // 3 hearts, 5 HCP
      "D5", "D3",                     // 2 diamonds, 0 HCP
      "C5", "C3", "C2",              // 3 clubs, 0 HCP
    );
    // After P-P-P, West's turn
    const result = callFromRules(opener, Seat.West, ["P", "P", "P"], Seat.North);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-open-1s");
  });

  test("sayc-respond-1nt-stayman does NOT fire after partner opens 2NT", () => {
    // 10 HCP, 4 hearts — would be Stayman after 1NT but NOT after 2NT
    const responder = hand(
      "SA", "S5", "S2",        // 3 spades, 4 HCP
      "HK", "HQ", "H6", "H2", // 4 hearts, 5 HCP
      "DJ", "D7", "D3",        // 3 diamonds, 1 HCP
      "C5", "C3", "C2",        // 3 clubs, 0 HCP
    );
    // 10 HCP, 4 hearts — Stayman candidate
    const result = callFromRules(responder, Seat.South, ["2NT", "P"]);
    if (result) {
      expect(result.rule).not.toBe("sayc-respond-1nt-stayman");
    }
  });

  test("sayc-respond-1nt-pass does NOT fire after partner opens 2NT", () => {
    // 5 HCP — would pass 1NT but should not match 1NT-pass rule after 2NT
    const responder = hand(
      "S8", "S5", "S2",        // 3 spades, 0 HCP
      "HK", "HQ", "H6", "H2", // 4 hearts, 5 HCP
      "DT", "D7", "D3",        // 3 diamonds, 0 HCP
      "C5", "C3", "C2",        // 3 clubs, 0 HCP
    );
    const result = callFromRules(responder, Seat.South, ["2NT", "P"]);
    if (result) {
      expect(result.rule).not.toBe("sayc-respond-1nt-pass");
    }
  });

  test("2NT opening: 20-21 balanced", () => {
    // 20 HCP, 4-3-3-3 balanced
    const opener = hand(
      "SA", "SK", "SQ", "SJ", // 4 spades, 10 HCP
      "HA", "HK", "H3",        // 3 hearts, 7 HCP
      "DK", "D5", "D3",        // 3 diamonds, 3 HCP
      "C5", "C3", "C2",        // 3 clubs, 0 HCP
    );
    // 10 + 7 + 3 + 0 = 20 HCP
    const result = callFromRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-open-2nt");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });
});
