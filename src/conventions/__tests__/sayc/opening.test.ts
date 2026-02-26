import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { ContractBid } from "../../../engine/types";
import { registerConvention, clearRegistry } from "../../core/registry";
import { saycConfig } from "../../definitions/sayc";
import { hand } from "../fixtures";
import { callFromRules } from "./helpers";

beforeEach(() => {
  clearRegistry();
  registerConvention(saycConfig);
});

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
    const result = callFromRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
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
      "DK", "D5", "D3",        // 3 diamonds, 3 HCP
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

describe("SAYC edge cases - opening", () => {
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

  test("weak 2D: 5-11 HCP, 6+ diamonds", () => {
    // K(3)+Q(2)+J(1)=6 HCP diamonds + J(1) clubs = 7 HCP total
    const opener = hand(
      "S5", "S3",
      "H5", "H3",
      "DK", "DQ", "DJ", "D7", "D5", "D3", // 6 diamonds
      "CJ", "C3", "C2",
    );
    const result = callFromRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-open-weak-2d");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Diamonds);
  });
});
