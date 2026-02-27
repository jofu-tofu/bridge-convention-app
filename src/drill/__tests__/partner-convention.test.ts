/**
 * Integration tests: verify North (partner) uses the drilled convention,
 * not SAYC, through the full drill pipeline (config → session → strategy).
 *
 * These tests catch the bug where participantSeats was derived from
 * dealConstraints.seats, which for defensive conventions (Landy, DONT)
 * includes East (the 1NT opener) but not North (the advancer).
 */
import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../engine/types";
import type { ContractBid } from "../../engine/types";
import { createDrillConfig } from "../config-factory";
import { createDrillSession } from "../session";
import {
  clearRegistry,
  registerConvention,
} from "../../conventions/core/registry";
import { landyConfig } from "../../conventions/definitions/landy";
import { dontConfig } from "../../conventions/definitions/dont";
import { hand, auctionFromBids } from "../../conventions/__tests__/fixtures";

beforeEach(() => {
  clearRegistry();
});

// ─── Landy: North advancer responses ────────────────────────

describe("Landy drill: North uses Landy advancer responses", () => {
  function northBid(northHand: ReturnType<typeof hand>, bids: string[]) {
    registerConvention(landyConfig);
    const config = createDrillConfig("landy", Seat.South, {
      opponentBidding: true,
    });
    const session = createDrillSession(config);
    const auction = auctionFromBids(Seat.East, bids);
    return session.getNextBid(Seat.North, northHand, auction);
  }

  test("North bids 2H with 4+ hearts after 1NT-2C-P", () => {
    // 7 HCP, 4 hearts — basic Landy advancer response
    const advancer = hand(
      "S5", "S3", "S2",
      "HQ", "HJ", "H8", "H5",
      "DK", "D7", "D5", "D3",
      "C5", "C2",
    );
    const result = northBid(advancer, ["1NT", "2C", "P"]);
    expect(result).not.toBeNull();
    expect(result!.ruleName).toBe("landy-response-2h");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("North bids 2S with 4+ spades, <4 hearts after 1NT-2C-P", () => {
    // 8 HCP, 4 spades, 3 hearts
    const advancer = hand(
      "SQ", "SJ", "S7", "S5",
      "H5", "H3", "H2",
      "DK", "DQ", "D7", "D3",
      "C5", "C2",
    );
    const result = northBid(advancer, ["1NT", "2C", "P"]);
    expect(result).not.toBeNull();
    expect(result!.ruleName).toBe("landy-response-2s");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("North passes with 5+ clubs after 1NT-2C-P", () => {
    const advancer = hand(
      "S5", "S3",
      "H5", "H3",
      "D5", "D3",
      "CA", "CK", "CQ", "C8", "C5", "C3", "C2",
    );
    const result = northBid(advancer, ["1NT", "2C", "P"]);
    expect(result).not.toBeNull();
    expect(result!.ruleName).toBe("landy-response-pass");
    expect(result!.call.type).toBe("pass");
  });

  test("North bids 2NT with 12+ HCP after 1NT-2C-P", () => {
    // SA(4)+SK(3)+HK(3)+DQ(2)+CJ(1) = 13 HCP
    const advancer = hand(
      "SA", "SK", "S7", "S3",
      "HK", "H5", "H2",
      "DQ", "D5", "D3",
      "CJ", "C5", "C2",
    );
    const result = northBid(advancer, ["1NT", "2C", "P"]);
    expect(result).not.toBeNull();
    expect(result!.ruleName).toBe("landy-response-2nt");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test("North bids 2D relay with no major preference after 1NT-2C-P", () => {
    // 6 HCP, 3-3 majors, <5 clubs
    const advancer = hand(
      "SQ", "S5", "S2",
      "HJ", "H5", "H3",
      "DK", "D7", "D5", "D3", "D2",
      "C5", "C2",
    );
    const result = northBid(advancer, ["1NT", "2C", "P"]);
    expect(result).not.toBeNull();
    expect(result!.ruleName).toBe("landy-response-2d");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Diamonds);
  });
});

// ─── DONT: North advancer responses ─────────────────────────

describe("DONT drill: North uses DONT advancer responses", () => {
  function northBid(northHand: ReturnType<typeof hand>, bids: string[]) {
    registerConvention(dontConfig);
    const config = createDrillConfig("dont", Seat.South, {
      opponentBidding: true,
    });
    const session = createDrillSession(config);
    const auction = auctionFromBids(Seat.East, bids);
    return session.getNextBid(Seat.North, northHand, auction);
  }

  test("North passes after 1NT-2H-P (accepts partner's hearts)", () => {
    // 3+ hearts support
    const advancer = hand(
      "S5", "S3", "S2",
      "HQ", "HJ", "H8", "H5",
      "DK", "D7", "D5", "D3",
      "C5", "C2",
    );
    const result = northBid(advancer, ["1NT", "2H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.ruleName).toBe("dont-advance-pass");
    expect(result!.call.type).toBe("pass");
  });

  test("North relays 2S after 1NT-2H-P without heart support", () => {
    // <3 hearts, asks overcaller to clarify
    const advancer = hand(
      "SQ", "SJ", "S7", "S5",
      "H5", "H3",
      "DK", "DQ", "D7", "D3",
      "CA", "C5", "C2",
    );
    const result = northBid(advancer, ["1NT", "2H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.ruleName).toBe("dont-advance-next-step");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("North bids long suit after 1NT-X-P with 6+ suit", () => {
    // 6+ spades — bypasses relay
    const advancer = hand(
      "SA", "SK", "SQ", "SJ", "S7", "S5",
      "H5", "H3",
      "DK", "D7",
      "C5", "C3", "C2",
    );
    const result = northBid(advancer, ["1NT", "X", "P"]);
    expect(result).not.toBeNull();
    expect(result!.ruleName).toBe("dont-advance-long-suit");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("North relays 2C after 1NT-X-P without long suit", () => {
    // No 6+ suit, no 3+ support for any suit
    const advancer = hand(
      "SQ", "SJ", "S7",
      "H5", "H3",
      "DK", "DQ", "D7", "D3",
      "CA", "C5", "C3", "C2",
    );
    const result = northBid(advancer, ["1NT", "X", "P"]);
    expect(result).not.toBeNull();
    expect(result!.ruleName).toBe("dont-advance-next-step");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Clubs);
  });
});

// ─── East uses opponent strategy, not the drilled convention ──

describe("East uses opponent strategy, not the drilled convention", () => {
  test("East does not use Landy strategy in a Landy drill", () => {
    registerConvention(landyConfig);
    const config = createDrillConfig("landy", Seat.South, {
      opponentBidding: true,
    });
    // East should have SAYC (or opponent) strategy, not Landy
    const eastStrategy = config.seatStrategies[Seat.East];
    expect(eastStrategy).not.toBe("user");
    if (eastStrategy !== "user") {
      expect(eastStrategy.id).not.toBe("convention:landy");
    }
  });

  test("East does not use DONT strategy in a DONT drill", () => {
    registerConvention(dontConfig);
    const config = createDrillConfig("dont", Seat.South, {
      opponentBidding: true,
    });
    const eastStrategy = config.seatStrategies[Seat.East];
    expect(eastStrategy).not.toBe("user");
    if (eastStrategy !== "user") {
      expect(eastStrategy.id).not.toBe("convention:dont");
    }
  });
});
