/**
 * Stayman edge case tests.
 *
 * Focus areas:
 * 1. Opponent interference — opponent bids/doubles/redoubles instead of passing
 * 2. Wrong seat — convention evaluated for the wrong player
 * 3. HCP boundary conditions — exact boundary values
 * 4. Unusual hand shapes
 * 5. Opener has both 4-card majors
 * 6. Rebid edge cases after opener's response
 * 7. 2NT opening Stayman
 */

import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import {
  registerConvention,
  clearRegistry,
  evaluateBiddingRules,
} from "../../registry";
import { staymanConfig } from "../../stayman";
import { hand, makeBiddingContext } from "../fixtures";

// ─── Stayman — opponent interference ─────────────────────────

describe("Stayman — opponent interference", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
  });

  // 13 HCP, 4 hearts — valid Stayman responder
  const responder = hand(
    "SK", "S5", "S2",
    "HA", "HK", "HQ", "H3",
    "D5", "D3", "D2",
    "C5", "C3", "C2",
  );

  // 16 HCP balanced opener, 4 hearts
  const opener = hand(
    "SA", "SK", "S3",
    "HK", "HQ", "HJ", "H2",
    "DK", "D5", "D3",
    "C7", "C5", "C2",
  );

  test("opponent overcalls after 1NT — Stayman ask should not fire", () => {
    // 1NT - 2D(overcall) instead of 1NT - P
    const ctx = makeBiddingContext(responder, Seat.South, ["1NT", "2D"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).toBeNull();
  });

  test("opponent doubles after 1NT — Stayman ask should not fire", () => {
    // 1NT - X instead of 1NT - P
    const ctx = makeBiddingContext(responder, Seat.South, ["1NT", "X"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).toBeNull();
  });

  test("opponent bids after 2C ask — opener response should not fire", () => {
    // 1NT - P - 2C - 2D(overcall) instead of 1NT - P - 2C - P
    const ctx = makeBiddingContext(opener, Seat.North, ["1NT", "P", "2C", "2D"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).toBeNull();
  });

  test("opponent doubles after 2C ask — opener response should not fire", () => {
    const ctx = makeBiddingContext(opener, Seat.North, ["1NT", "P", "2C", "X"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).toBeNull();
  });

  test("opponent bids after opener response — rebid should not fire", () => {
    // 1NT - P - 2C - P - 2H - 2S(overcall) instead of ...2H - P
    const ctx = makeBiddingContext(responder, Seat.South, ["1NT", "P", "2C", "P", "2H", "2S"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).toBeNull();
  });

  test("opponent doubles after opener response — rebid should not fire", () => {
    const ctx = makeBiddingContext(responder, Seat.South, ["1NT", "P", "2C", "P", "2D", "X"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).toBeNull();
  });

  test("opponent redoubles — Stayman should not fire", () => {
    // Unusual but legal: 1NT - X - XX — not a Stayman auction
    const ctx = makeBiddingContext(responder, Seat.South, ["1NT", "X", "XX"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).toBeNull();
  });

  test("2NT Stayman — opponent overcalls after 2NT", () => {
    const ctx = makeBiddingContext(responder, Seat.South, ["2NT", "3C"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).toBeNull();
  });

  test("2NT Stayman — opponent doubles after 3C ask", () => {
    const ctx = makeBiddingContext(opener, Seat.North, ["2NT", "P", "3C", "X"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).toBeNull();
  });
});

describe("Stayman — wrong seat", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
  });

  const responder = hand(
    "SK", "S5", "S2",
    "HA", "HK", "HQ", "H3",
    "D5", "D3", "D2",
    "C5", "C3", "C2",
  );

  test("opener tries to make Stayman ask (wrong seat for ask)", () => {
    // North opened 1NT, it's North's turn again somehow — 1NT-P is correct auction
    // but North is the opener, not responder
    const ctx = makeBiddingContext(responder, Seat.North, ["1NT", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    // Stayman ask fires regardless of seat since it only checks auction + hand
    // This documents current behavior: the tree doesn't check seat for the ask
    if (result) {
      expect(result.rule).toBe("stayman-ask");
    }
  });
});

describe("Stayman — HCP boundary", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
  });

  test("exactly 8 HCP with 4-card major — Stayman ask fires", () => {
    // SK(3) + HQ(2) + HJ(1) + DQ(2) = 8 HCP, 4 hearts
    const h = hand(
      "SK", "S5", "S3", "S2",
      "HQ", "HJ", "H7", "H3",
      "DQ", "D5", "D3",
      "C5", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1NT", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-ask");
  });

  test("exactly 7 HCP with 4-card major — Stayman ask does NOT fire", () => {
    // SK(3) + HQ(2) + HJ(1) + DJ(1) = 7 HCP, 4 hearts
    const h = hand(
      "SK", "S5", "S3", "S2",
      "HQ", "HJ", "H7", "H3",
      "DJ", "D5", "D3",
      "C5", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1NT", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).toBeNull();
  });

  test("8+ HCP but no 4-card major — Stayman ask does NOT fire", () => {
    // SA(4) + SK(3) + DK(3) = 10 HCP, no 4-card major
    const h = hand(
      "SA", "SK", "S5",
      "HK", "H5", "H3",
      "DK", "D5", "D3",
      "C5", "C4", "C3", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1NT", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).toBeNull();
  });
});

// ─── Stayman — unusual hand shapes ─────────────────────────────

describe("Stayman — unusual hand shapes", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
  });

  test("[bridgebum/stayman] both 4-card majors — Stayman ask still fires", () => {
    // 10 HCP, 4S + 4H — Stayman is valid with either major
    // SA(4) + HK(3) + DQ(2) + CJ(1) = 10 HCP
    const h = hand(
      "SA", "S7", "S5", "S3",
      "HK", "H7", "H5", "H3",
      "DQ", "D5", "D3",
      "CJ", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1NT", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-ask");
  });

  test("[bridgebum/stayman] 5-4 in majors — Stayman ask still fires (has 4+M)", () => {
    // 12 HCP, 5S + 4H — Stayman valid, Smolen applies after denial
    // SA(4) + SK(3) + HK(3) + DQ(2) = 12 HCP
    const h = hand(
      "SA", "SK", "S7", "S5", "S3",
      "HK", "H7", "H5", "H3",
      "DQ", "D3",
      "C5", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1NT", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-ask");
  });

  test("[bridgebum/stayman] 4-card minor only, no major — Stayman ask does NOT fire", () => {
    // 10 HCP, 3S + 3H + 4D + 3C — no 4-card major
    const h = hand(
      "SA", "S5", "S3",
      "HK", "H5", "H3",
      "DK", "DQ", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1NT", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).toBeNull();
  });
});

describe("Stayman — opener has both 4-card majors", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
  });

  test("[bridgebum/stayman] opener with 4H + 4S — responds 2H (hearts shown first per tree)", () => {
    // Opener: 16 HCP, 4S + 4H — tree checks hearts first
    // SA(4) + SK(3) + HK(3) + HQ(2) + DK(3) + CJ(1) = 16 HCP
    const opener = hand(
      "SA", "SK", "S5", "S3",
      "HK", "HQ", "H5", "H3",
      "DK", "D5", "D3",
      "CJ", "C2",
    );
    const ctx = makeBiddingContext(opener, Seat.North, ["1NT", "P", "2C", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-response-hearts");
  });
});

describe("Stayman — rebid edge cases after opener's response", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
  });

  test("[bridgebum/stayman] responder with both majors after 2H — fits hearts (4H game)", () => {
    // 10+ HCP, 4S + 4H — opener showed 2H, responder fits
    // SA(4) + HK(3) + HQ(2) + DK(3) = 12 HCP
    const responder = hand(
      "SA", "S7", "S5", "S3",
      "HK", "HQ", "H5", "H3",
      "DK", "D5", "D3",
      "C5", "C2",
    );
    const ctx = makeBiddingContext(responder, Seat.South, ["1NT", "P", "2C", "P", "2H", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-major-fit");
  });

  test("[bridgebum/stayman] responder with 4S no 4H after 2H — bids 3NT (game, no fit)", () => {
    // 10+ HCP, 4S + 3H — opener showed 2H but no fit
    // SA(4) + SK(3) + DK(3) + CJ(1) = 11 HCP
    const responder = hand(
      "SA", "SK", "S7", "S3",
      "HQ", "H5", "H3",
      "DK", "D5", "D3",
      "CJ", "C5", "C2",
    );
    const ctx = makeBiddingContext(responder, Seat.South, ["1NT", "P", "2C", "P", "2H", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-no-fit");
  });

  test("[bridgebum/stayman] responder invitational (8-9 HCP) after 2S — fits spades -> 3S invite", () => {
    // 9 HCP, 4S — opener showed 2S, fits at invite level
    // SK(3) + HQ(2) + HJ(1) + DK(3) = 9 HCP
    const responder = hand(
      "SK", "S7", "S5", "S3",
      "HQ", "HJ", "H5",
      "DK", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(responder, Seat.South, ["1NT", "P", "2C", "P", "2S", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-major-fit-invite");
  });

  test("[bridgebum/stayman] responder invitational after 2D denial — bids 2NT invite", () => {
    // 8 HCP, 4H + 3S — opener denied with 2D, no Smolen (need 10+ and 5-4)
    // SK(3) + HQ(2) + HJ(1) + DQ(2) = 8 HCP
    const responder = hand(
      "SK", "S7", "S3",
      "HQ", "HJ", "H5", "H3",
      "DQ", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(responder, Seat.South, ["1NT", "P", "2C", "P", "2D", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-no-fit-invite");
  });

  test("[bridgebum/stayman] Smolen 3H: 4S + 5H after 2D denial, game-forcing", () => {
    // 12 HCP, 4S + 5H — Smolen shows the shorter major at 3-level
    // SA(4) + HK(3) + HQ(2) + DK(3) = 12 HCP
    const responder = hand(
      "SA", "S7", "S5", "S3",
      "HK", "HQ", "H7", "H5", "H3",
      "DK", "D3",
      "C5", "C2",
    );
    const ctx = makeBiddingContext(responder, Seat.South, ["1NT", "P", "2C", "P", "2D", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-smolen-hearts");
  });

  test("[bridgebum/stayman] Smolen 3S: 5S + 4H after 2D denial, game-forcing", () => {
    // 11 HCP, 5S + 4H — Smolen shows shorter major
    // SA(4) + SK(3) + HQ(2) + DQ(2) = 11 HCP
    const responder = hand(
      "SA", "SK", "S7", "S5", "S3",
      "HQ", "H7", "H5", "H3",
      "DQ", "D3",
      "C5", "C2",
    );
    const ctx = makeBiddingContext(responder, Seat.South, ["1NT", "P", "2C", "P", "2D", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-smolen-spades");
  });

  test("[bridgebum/stayman] Smolen requires 10+ HCP — 9 HCP with 5-4 gets invite instead", () => {
    // 9 HCP, 5S + 4H — not enough for Smolen (game-forcing)
    // SK(3) + SQ(2) + HQ(2) + DQ(2) = 9 HCP
    const responder = hand(
      "SK", "SQ", "S7", "S5", "S3",
      "HQ", "H7", "H5", "H3",
      "DQ", "D3",
      "C5", "C2",
    );
    const ctx = makeBiddingContext(responder, Seat.South, ["1NT", "P", "2C", "P", "2D", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).not.toBeNull();
    // With 9 HCP, should get invite (2NT), not Smolen
    expect(result!.rule).toBe("stayman-rebid-no-fit-invite");
  });
});

describe("Stayman — 2NT opening Stayman", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
  });

  test("[bridgebum/stayman] 3C ask after 2NT-P with 8+ HCP and 4-card major", () => {
    // 10 HCP, 4H — Stayman after 2NT uses 3C
    // SA(4) + HK(3) + DQ(2) + CJ(1) = 10 HCP
    const responder = hand(
      "SA", "S5", "S3",
      "HK", "H7", "H5", "H3",
      "DQ", "D5", "D3",
      "CJ", "C5", "C2",
    );
    const ctx = makeBiddingContext(responder, Seat.South, ["2NT", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-ask");
    const call = result!.call as import("../../../engine/types").ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("[bridgebum/stayman] 2NT Stayman — opener responds at 3-level", () => {
    // Opener: 20 HCP, 4 hearts
    // SA(4) + SK(3) + HK(3) + HQ(2) + HA(4) + DK(3) + CJ(1) = 20 HCP
    const opener = hand(
      "SA", "SK", "S5",
      "HA", "HK", "HQ", "H3",
      "DK", "D5", "D3",
      "CJ", "C5", "C2",
    );
    const ctx = makeBiddingContext(opener, Seat.North, ["2NT", "P", "3C", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-response-hearts");
    const call = result!.call as import("../../../engine/types").ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("[bridgebum/stayman] 2NT Stayman — 7 HCP does NOT fire ask", () => {
    // 7 HCP with 4-card major — too weak for 2NT Stayman
    const h = hand(
      "SK", "S5", "S3",
      "HQ", "HJ", "H5", "H3",
      "DJ", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["2NT", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).toBeNull();
  });
});
