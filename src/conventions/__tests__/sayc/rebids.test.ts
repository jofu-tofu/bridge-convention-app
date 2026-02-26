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

describe("SAYC opener rebids", () => {
  // Migrated from rules.test.ts
  test("raise partner's major response: 12-16 HCP, 4+ support", () => {
    // After 1H-P-1S-P, opener with 14 HCP and 4+ spades raises to 2S
    // K(3)+J(1) spades + A(4)+K(3)+Q(2) hearts + J(1) diamonds = 14 HCP
    const opener = hand(
      "SK", "SJ", "S7", "S3",
      "HA", "HK", "HQ", "H5", "H3",
      "DJ", "D5",
      "C5", "C2",
    );
    const result = callFromRules(opener, Seat.North, ["1H", "P", "1S", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-rebid-raise-partner-major");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  // Migrated from rules.test.ts
  test("rebid own 6+ suit: 12-17 HCP", () => {
    // After 1H-P-1S-P, opener with 6+ hearts and 13 HCP rebids 2H
    // A(4)+K(3)+Q(2)+J(1) hearts + K(3) diamonds = 13 HCP
    const opener = hand(
      "S5", "S3",
      "HA", "HK", "HQ", "HJ", "H7", "H3",
      "DK", "D5", "D3",
      "C5", "C2",
    );
    const result = callFromRules(opener, Seat.North, ["1H", "P", "1S", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-rebid-own-suit");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  // New tests for remaining rebid rules
  test("game after raise: 19+ HCP, partner raised major → 4M", () => {
    // After 1S-P-2S-P, opener with 19+ HCP bids 4S
    // A(4)+K(3)+Q(2)+J(1) spades + A(4)+K(3) hearts + Q(2) diamonds = 19 HCP
    const opener = hand(
      "SA", "SK", "SQ", "SJ", "S3", // 5 spades, 10 HCP
      "HA", "HK", "H5",              // 3 hearts, 7 HCP
      "DQ", "D3",                     // 2 diamonds, 2 HCP
      "C5", "C3", "C2",              // 3 clubs, 0 HCP
    );
    const result = callFromRules(opener, Seat.North, ["1S", "P", "2S", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-rebid-4m-after-raise");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("invite after raise: 17-18 HCP, partner raised major → 3M", () => {
    // After 1H-P-2H-P, opener with 17 HCP invites with 3H
    // A(4)+K(3)+Q(2) hearts + A(4)+K(3) spades + J(1) diamonds = 17 HCP
    const opener = hand(
      "SA", "SK", "S5",              // 3 spades, 7 HCP
      "HA", "HK", "HQ", "H7", "H3", // 5 hearts, 10 HCP (A4+K3+Q2=9... wait that's 9)
      "DJ", "D3",                     // 2 diamonds, 1 HCP (total 17? 7+9+1=17. But wait: no)
      "C5", "C3", "C2",              // 3 clubs, 0 HCP
    );
    // A(4)+K(3) spades=7 + A(4)+K(3)+Q(2) hearts=9 + J(1) diamonds=1 + 0 clubs = 17 HCP
    const result = callFromRules(opener, Seat.North, ["1H", "P", "2H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-rebid-3m-invite");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("pass after raise: 12-16 HCP, partner raised major", () => {
    // After 1S-P-2S-P, opener with 13 HCP passes
    // A(4)+K(3) spades + Q(2)+J(1) hearts + K(3) diamonds = 13 HCP
    const opener = hand(
      "SA", "SK", "S7", "S5", "S3", // 5 spades, 7 HCP
      "HQ", "HJ", "H5",              // 3 hearts, 3 HCP
      "DK", "D3",                     // 2 diamonds, 3 HCP
      "C5", "C3", "C2",              // 3 clubs, 0 HCP
    );
    const result = callFromRules(opener, Seat.North, ["1S", "P", "2S", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-rebid-pass-after-raise");
    expect(result!.call.type).toBe("pass");
  });

  test("rebid 1NT: 12-14 balanced, partner responded new suit", () => {
    // After 1D-P-1H-P, opener with 13 HCP balanced rebids 1NT
    // A(4)+K(3) spades + J(1) hearts + Q(2)+J(1) diamonds + Q(2) clubs = 13 HCP
    const opener = hand(
      "SA", "SK", "S5",        // 3 spades, 7 HCP
      "HJ", "H5", "H3",        // 3 hearts, 1 HCP
      "DQ", "DJ", "D7", "D3",  // 4 diamonds, 3 HCP
      "CQ", "C5", "C3",        // 3 clubs, 2 HCP
    );
    // 7+1+3+2 = 13 HCP, balanced 3-3-4-3
    const result = callFromRules(opener, Seat.North, ["1D", "P", "1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-rebid-1nt");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(1);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test("rebid 2NT: 18-19 balanced", () => {
    // After 1C-P-1S-P, opener with 18 HCP balanced rebids 2NT
    // A(4)+K(3)+Q(2) spades + A(4)+K(3) hearts + Q(2) clubs = 18 HCP
    const opener = hand(
      "SA", "SK", "SQ",              // 3 spades, 9 HCP
      "HA", "HK", "H5",              // 3 hearts, 7 HCP
      "D5", "D3", "D2",              // 3 diamonds, 0 HCP
      "CQ", "C7", "C5", "C3",        // 4 clubs, 2 HCP
    );
    // 9+7+0+2 = 18 HCP, balanced 3-3-3-4
    const result = callFromRules(opener, Seat.North, ["1C", "P", "1S", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-rebid-2nt");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });
});
