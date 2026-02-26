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

describe("SAYC competitive bids", () => {
  // Migrated from rules.test.ts
  test("1NT overcall: 15-18 balanced, not opener/responder", () => {
    // Opponent (North) opened 1D, East overcalls 1NT with 15-18 balanced
    // A(4)+K(3) spades + A(4) hearts + K(3) diamonds + J(1) clubs = 15 HCP
    const overcaller = hand(
      "SA", "SK", "S5",
      "HA", "H5", "H3",
      "DK", "D5", "D3",
      "CJ", "C5", "C3", "C2",
    );
    const result = callFromRules(overcaller, Seat.East, ["1D"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-1nt-overcall");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(1);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  // New tests
  test("1-level overcall: 8+ HCP, 5+ card suit higher than opponent", () => {
    // North opens 1C, East overcalls with 5+ spades and 10 HCP
    // A(4)+K(3) spades + Q(2) hearts + J(1) diamonds = 10 HCP
    const overcaller = hand(
      "SA", "SK", "S7", "S5", "S3", // 5 spades, 7 HCP
      "HQ", "H5", "H3",              // 3 hearts, 2 HCP
      "DJ", "D5", "D3",              // 3 diamonds, 1 HCP
      "C5", "C2",                     // 2 clubs, 0 HCP
    );
    const result = callFromRules(overcaller, Seat.East, ["1C"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-overcall-1level");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(1);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("2-level overcall: 10+ HCP, 5+ card suit", () => {
    // North opens 1S, East overcalls 2H with 5+ hearts and 12 HCP
    // A(4)+K(3)+Q(2) hearts + K(3) diamonds = 12 HCP
    const overcaller = hand(
      "S5", "S3", "S2",                    // 3 spades, 0 HCP
      "HA", "HK", "HQ", "H7", "H3",       // 5 hearts, 9 HCP (A4+K3+Q2=9)
      "DK", "D5", "D3",                    // 3 diamonds, 3 HCP
      "C5", "C2",                           // 2 clubs, 0 HCP
    );
    // 0+9+3+0 = 12 HCP
    const result = callFromRules(overcaller, Seat.East, ["1S"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-overcall-2level");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("no overcall: insufficient HCP or no good suit", () => {
    // North opens 1S, East has only 6 HCP and no 5-card suit
    // K(3) hearts + Q(2) diamonds + J(1) clubs = 6 HCP
    const overcaller = hand(
      "S5", "S3", "S2",        // 3 spades, 0 HCP
      "HK", "H5", "H3", "H2", // 4 hearts, 3 HCP
      "DQ", "D5", "D3",        // 3 diamonds, 2 HCP
      "CJ", "C5", "C3",        // 3 clubs, 1 HCP
    );
    // 6 HCP, no 5-card suit — passes
    const result = callFromRules(overcaller, Seat.East, ["1S"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-pass");
    expect(result!.call.type).toBe("pass");
  });
});
