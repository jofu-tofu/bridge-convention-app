/**
 * SAYC edge case tests.
 *
 * Focus areas:
 * 1. Opening bid edge cases — major selection, NT ranges, weak twos, 2C strong
 */

import { describe, test, expect, beforeEach } from "vitest";
import { Seat } from "../../../engine/types";
import type { Hand } from "../../../engine/types";
import {
  registerConvention,
  clearRegistry,
  evaluateBiddingRules,
} from "../../registry";
import { saycConfig } from "../../sayc";
import { hand, makeBiddingContext } from "../fixtures";

// ─── Helpers ────────────────────────────────────────────────

function callFromSaycRules(h: Hand, seat: Seat, bids: string[], dealer: Seat = Seat.North) {
  const context = makeBiddingContext(h, seat, bids, dealer);
  return evaluateBiddingRules(context, saycConfig);
}

// ─── SAYC — opening bid edge cases ─────────────────────────────

describe("SAYC — opening bid edge cases", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(saycConfig);
  });

  test("5-5 in both majors — opens 1S (longer or equal, higher ranking)", () => {
    // 13 HCP, 5S + 5H — SAYC opens higher-ranking major
    // SA(4) + SK(3) + HK(3) + HQ(2) + DJ(1) = 13 HCP
    const opener = hand(
      "SA", "SK", "S7", "S5", "S3",
      "HK", "HQ", "H7", "H5", "H3",
      "DJ",
      "C5", "C2",
    );
    const result = callFromSaycRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-open-1s");
  });

  test("6H + 5S — opens 1H (longer major wins)", () => {
    // 13 HCP, 6H + 5S
    // SA(4) + HK(3) + HQ(2) + HJ(1) + DK(3) = 13 HCP
    const opener = hand(
      "SA", "S7", "S6", "S5", "S3",
      "HK", "HQ", "HJ", "H7", "H5", "H3",
      "DK",
      "C2",
    );
    const result = callFromSaycRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-open-1h");
  });

  test("exactly 15 HCP balanced, no 5-card major — opens 1NT", () => {
    // SA(4) + SK(3) + HK(3) + DK(3) + DQ(2) = 15 HCP, balanced 4-3-3-3
    const opener = hand(
      "SA", "SK", "SQ", "S3",
      "HK", "H5", "H3",
      "DK", "D5", "D3",
      "C5", "C3", "C2",
    );
    const result = callFromSaycRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-open-1nt");
  });

  test("exactly 17 HCP balanced, no 5-card major — opens 1NT (max)", () => {
    // SA(4) + SK(3) + HK(3) + HQ(2) + DK(3) + DQ(2) = 17 HCP
    const opener = hand(
      "SA", "SK", "S5", "S3",
      "HK", "HQ", "H5",
      "DK", "DQ", "D5",
      "C5", "C3", "C2",
    );
    const result = callFromSaycRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-open-1nt");
  });

  test("18 HCP balanced — does NOT open 1NT (exceeds 15-17 range)", () => {
    // SA(4) + SK(3) + SQ(2) + HK(3) + HQ(2) + DK(3) + CJ(1) = 18 HCP
    const opener = hand(
      "SA", "SK", "SQ", "S3",
      "HK", "HQ", "H5",
      "DK", "D5", "D3",
      "CJ", "C5", "C2",
    );
    const result = callFromSaycRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
    // Should open a suit, not 1NT
    expect(result!.rule).not.toBe("sayc-open-1nt");
  });

  test("exactly 22 HCP — opens 2C (strong)", () => {
    // SA(4)+SK(3)+SQ(2)+SJ(1)+HA(4)+HK(3)+DK(3)+DQ(2) = 22 HCP
    const opener = hand(
      "SA", "SK", "SQ", "SJ",
      "HA", "HK", "H5",
      "DK", "DQ", "D5",
      "C5", "C3", "C2",
    );
    const result = callFromSaycRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-open-2c");
  });

  test("21 HCP balanced — opens 2NT (not 2C)", () => {
    // SA(4)+SK(3)+SQ(2)+HA(4)+HK(3)+DK(3)+DQ(2) = 21 HCP
    const opener = hand(
      "SA", "SK", "SQ", "S3",
      "HA", "HK", "H5",
      "DK", "DQ", "D5",
      "C5", "C3", "C2",
    );
    const result = callFromSaycRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-open-2nt");
  });

  test("weak 2H with exactly 5 HCP — minimum for weak two", () => {
    // HK(3) + HQ(2) = 5 HCP, 6 hearts
    const opener = hand(
      "S5", "S3",
      "HK", "HQ", "H7", "H6", "H5", "H3",
      "D5", "D3", "D2",
      "C5", "C2",
    );
    const result = callFromSaycRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-open-weak-2h");
  });

  test("weak 2S with exactly 11 HCP — maximum for weak two", () => {
    // SA(4)+SK(3)+SQ(2)+SJ(1)+DJ(1) = 11 HCP, 6 spades
    const opener = hand(
      "SA", "SK", "SQ", "SJ", "S7", "S3",
      "H5", "H3",
      "DJ", "D5", "D3",
      "C5", "C2",
    );
    const result = callFromSaycRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-open-weak-2s");
  });

  test("12 HCP with 6-card major — opens 1M (not weak 2)", () => {
    // 12 HCP with 6 hearts — too strong for weak 2, opens 1H
    // HA(4) + HK(3) + HQ(2) + DK(3) = 12 HCP
    const opener = hand(
      "S5", "S3",
      "HA", "HK", "HQ", "H7", "H5", "H3",
      "DK", "D5", "D3",
      "C5", "C2",
    );
    const result = callFromSaycRules(opener, Seat.North, []);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-open-1h");
  });
});
