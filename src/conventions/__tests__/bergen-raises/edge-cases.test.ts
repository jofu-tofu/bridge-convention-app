/**
 * Bergen Raises edge case tests.
 *
 * Focus areas:
 * 1. Opponent interference — opponent bids/doubles instead of passing
 * 2. HCP boundary conditions — exact boundary values
 * 3. Unusual hand shapes — 5+ card support, suit-specific bids, splinters
 * 4. Opener rebid edge cases
 */

import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import {
  registerConvention,
  clearRegistry,
  evaluateBiddingRules,
} from "../../registry";
import { bergenConfig } from "../../bergen-raises";
import { hand, makeBiddingContext } from "../fixtures";

// ─── Bergen Raises — opponent interference ───────────────────

describe("Bergen Raises — opponent interference", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(bergenConfig);
  });

  // 8 HCP, 4 hearts — constructive raise range
  const responder = hand(
    "SQ", "S5", "S2",
    "HJ", "HT", "H6", "H2",
    "DK", "D7", "D3",
    "C5", "C3", "C2",
  );

  // 14 HCP opener, 5 hearts
  const opener = hand(
    "SK", "S5", "S2",
    "HA", "HK", "HQ", "H7", "H3",
    "D5", "D3",
    "C5", "C3", "C2",
  );

  test("opponent overcalls after 1H — Bergen response should not fire", () => {
    // 1H - 1S(overcall) instead of 1H - P
    const ctx = makeBiddingContext(responder, Seat.South, ["1H", "1S"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).toBeNull();
  });

  test("opponent doubles after 1H — Bergen response should not fire", () => {
    // 1H - X instead of 1H - P
    const ctx = makeBiddingContext(responder, Seat.South, ["1H", "X"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).toBeNull();
  });

  test("opponent overcalls after 1S — Bergen response should not fire", () => {
    const ctx = makeBiddingContext(responder, Seat.South, ["1S", "2C"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).toBeNull();
  });

  test("opponent bids after constructive raise — opener rebid should not fire", () => {
    // 1H - P - 3C - 3D(overcall) instead of ...3C - P
    const ctx = makeBiddingContext(opener, Seat.North, ["1H", "P", "3C", "3D"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).toBeNull();
  });

  test("opponent doubles after constructive raise — opener rebid should not fire", () => {
    const ctx = makeBiddingContext(opener, Seat.North, ["1H", "P", "3C", "X"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).toBeNull();
  });

  test("opponent bids after limit raise — opener rebid should not fire", () => {
    const ctx = makeBiddingContext(opener, Seat.North, ["1H", "P", "3D", "3S"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).toBeNull();
  });

  test("Bergen does NOT apply after minor opening (1D)", () => {
    // Bergen is only for major openings (1H or 1S)
    const ctx = makeBiddingContext(responder, Seat.South, ["1D", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).toBeNull();
  });

  test("Bergen does NOT apply after 1C opening", () => {
    const ctx = makeBiddingContext(responder, Seat.South, ["1C", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).toBeNull();
  });

  test("Bergen does NOT apply after 2H opening (weak two)", () => {
    const ctx = makeBiddingContext(responder, Seat.South, ["2H", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).toBeNull();
  });

  test("Bergen does NOT apply after 1NT opening", () => {
    const ctx = makeBiddingContext(responder, Seat.South, ["1NT", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).toBeNull();
  });
});

describe("Bergen Raises — HCP boundary", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(bergenConfig);
  });

  test("exactly 7 HCP with 4-card support — constructive raise fires", () => {
    // SK(3) + HJ(1) + DK(3) = 7 HCP, 4 hearts
    const h = hand(
      "SK", "S5", "S2",
      "HJ", "H7", "H5", "H3",
      "DK", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1H", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-constructive-raise");
  });

  test("exactly 6 HCP with 4-card support — preemptive raise fires", () => {
    // SQ(2) + HJ(1) + DK(3) = 6 HCP, 4 hearts
    const h = hand(
      "SQ", "S5", "S2",
      "HJ", "H7", "H5", "H3",
      "DK", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1H", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-preemptive-raise");
  });

  test("exactly 10 HCP with 4-card support — limit raise fires (10 in both ranges, limit wins by tree order)", () => {
    // SA(4) + HJ(1) + DK(3) + DQ(2) = 10 HCP, 4 hearts
    const h = hand(
      "SA", "S5", "S2",
      "HJ", "H7", "H5", "H3",
      "DK", "DQ", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1H", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).not.toBeNull();
    // 10 HCP is in BOTH limit (10-12) and constructive (7-10) ranges
    // Tree ordering: splinter -> game -> limit -> constructive
    // So limit (10-12) should win
    expect(result!.rule).toBe("bergen-limit-raise");
  });

  test("exactly 13 HCP with 4-card support — game raise fires", () => {
    // SA(4) + SK(3) + HJ(1) + DK(3) + DQ(2) = 13 HCP, 4 hearts
    const h = hand(
      "SA", "SK", "S2",
      "HJ", "H7", "H5", "H3",
      "DK", "DQ", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1H", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-game-raise");
  });

  test("3-card support only — Bergen does not fire", () => {
    // 10 HCP but only 3 hearts (need 4)
    const h = hand(
      "SA", "SK", "S5", "S2",
      "HJ", "H7", "H5",
      "DK", "DQ", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1H", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).toBeNull();
  });
});

// ─── Bergen Raises — unusual hand shapes ──────────────────────

describe("Bergen Raises — unusual hand shapes", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(bergenConfig);
  });

  test("[bridgebum/bergen] 5-card support — Bergen does NOT fire (requires exactly 4)", () => {
    // 8 HCP, 5 hearts — majorSupport() checks exactly 4, not 4+
    // SQ(2) + HK(3) + DK(3) = 8 HCP
    const h = hand(
      "SQ", "S5", "S2",
      "HK", "H7", "H5", "H3", "H2",
      "DK", "D5", "D3",
      "C5", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1H", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    // Bergen uses majorSupport() which defaults to exactly 4-card support
    // 5+ card support would use a standard raise, not Bergen coded raises
    expect(result).toBeNull();
  });

  test("[bridgebum/bergen] 6-card support — Bergen does NOT fire (requires exactly 4)", () => {
    // 7 HCP, 6 hearts
    // HK(3) + DK(3) + CJ(1) = 7 HCP
    const h = hand(
      "S5", "S2",
      "HK", "H7", "H6", "H5", "H3", "H2",
      "DK", "D5", "D3",
      "CJ", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1H", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).toBeNull();
  });

  test("[bridgebum/bergen] after 1S opening — constructive 3C bids clubs, not spades", () => {
    // Constructive raise always bids 3C regardless of major opened
    // 8 HCP, 4 spades
    const h = hand(
      "SK", "SJ", "S7", "S3",
      "HQ", "H5", "H3",
      "DK", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1S", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-constructive-raise");
    const call = result!.call as import("../../../engine/types").ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("[bridgebum/bergen] preemptive after 1S — bids 3S (not 3H)", () => {
    // 5 HCP, 4 spades — preemptive bids 3 of opened major
    // SQ(2) + DK(3) = 5 HCP
    const h = hand(
      "SQ", "S7", "S5", "S3",
      "H5", "H4", "H3",
      "DK", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1S", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-preemptive-raise");
    const call = result!.call as import("../../../engine/types").ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("[bridgebum/bergen] splinter after 1H — bids 3S (other major)", () => {
    // 13 HCP, 4 hearts, shortage (singleton spade)
    // SA(4) + HK(3) + HQ(2) + DA(4) = 13 HCP
    const h = hand(
      "SA",
      "HK", "HQ", "H7", "H3",
      "DA", "D5", "D3", "D2",
      "C5", "C4", "C3", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1H", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-splinter");
    const call = result!.call as import("../../../engine/types").ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("[bridgebum/bergen] splinter after 1S — bids 3H (other major)", () => {
    // 12 HCP, 4 spades, shortage (singleton heart)
    // SK(3) + SQ(2) + HA(4) + DK(3) = 12 HCP
    const h = hand(
      "SK", "SQ", "S7", "S3",
      "HA",
      "DK", "D5", "D3", "D2",
      "C5", "C4", "C3", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1S", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-splinter");
    const call = result!.call as import("../../../engine/types").ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("[bridgebum/bergen] splinter needs shortage — balanced 12+ HCP gets game raise instead", () => {
    // 13 HCP, 4 hearts, balanced (no shortage)
    // SA(4) + HK(3) + HQ(2) + DK(3) + CJ(1) = 13 HCP
    const h = hand(
      "SA", "S5", "S3",
      "HK", "HQ", "H7", "H3",
      "DK", "D5", "D3",
      "CJ", "C5", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1H", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-game-raise");
  });

  test("[bridgebum/bergen] 0 HCP with 4-card support — preemptive fires", () => {
    // 0 HCP, 4 hearts
    const h = hand(
      "S7", "S5", "S3",
      "H7", "H5", "H4", "H3",
      "D7", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1H", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-preemptive-raise");
  });
});

describe("Bergen Raises — opener rebid edge cases", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(bergenConfig);
  });

  test("[bridgebum/bergen] opener with 18+ after preemptive 3H — bids 4H game", () => {
    // 18 HCP opener after 1H-P-3H(preemptive)-P
    // SA(4) + SK(3) + HA(4) + HK(3) + HQ(2) + DK(3) = 19 HCP (adjusted)
    const opener = hand(
      "SA", "SK", "S5",
      "HA", "HK", "HQ", "H5", "H3",
      "DK", "D5",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(opener, Seat.North, ["1H", "P", "3H", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-rebid-game-after-preemptive");
  });

  test("[bridgebum/bergen] opener with 16 HCP after preemptive 3H — passes (below 18)", () => {
    // 16 HCP opener — not enough to override preemptive
    const opener = hand(
      "SA", "SK", "S5",
      "HK", "HQ", "HJ", "H5", "H3",
      "DK", "D5",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(opener, Seat.North, ["1H", "P", "3H", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-rebid-pass-after-preemptive");
  });

  test("[bridgebum/bergen] opener with 13 HCP after constructive 3C — passes (signoff)", () => {
    // 13 HCP — below 14 threshold for game try
    // SA(4) + HK(3) + HQ(2) + HJ(1) + DK(3) = 13 HCP
    const opener = hand(
      "SA", "S5", "S2",
      "HK", "HQ", "HJ", "H5", "H3",
      "DK", "D5",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(opener, Seat.North, ["1H", "P", "3C", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-rebid-signoff-after-constructive");
  });
});
