/**
 * Gerber edge case tests.
 *
 * Focus areas:
 * 1. Opponent interference — opponent bids/doubles instead of passing
 * 2. HCP boundary conditions — exact boundary values
 * 3. Unusual scenarios — 2NT, ace/king responses, void hands
 */

import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import {
  registerConvention,
  clearRegistry,
  evaluateBiddingRules,
} from "../../core/registry";
import { gerberConfig, countAces, countKings } from "../../definitions/gerber";
import { hand, makeBiddingContext } from "../fixtures";

// ─── Gerber — opponent interference ──────────────────────────

describe("Gerber — opponent interference", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(gerberConfig);
  });

  // 18 HCP, no void — valid Gerber responder
  const responder = hand(
    "SA", "SK", "SQ", "S2",
    "HA", "HK", "H3",
    "DK", "D5", "D3",
    "C5", "C3", "C2",
  );

  // 16 HCP balanced opener, 2 aces
  const opener = hand(
    "SQ", "SJ", "S3",
    "HK", "HQ", "HJ", "H2",
    "DA", "D7", "D4",
    "CA", "C7", "C4",
  );

  test("opponent overcalls after 1NT — Gerber ask should not fire", () => {
    const ctx = makeBiddingContext(responder, Seat.South, ["1NT", "2H"], Seat.North);
    const result = evaluateBiddingRules(ctx, gerberConfig);
    expect(result).toBeNull();
  });

  test("opponent doubles after 1NT — Gerber ask should not fire", () => {
    const ctx = makeBiddingContext(responder, Seat.South, ["1NT", "X"], Seat.North);
    const result = evaluateBiddingRules(ctx, gerberConfig);
    expect(result).toBeNull();
  });

  test("opponent bids after 4C ask — ace response should not fire", () => {
    // 1NT - P - 4C - 4D(overcall) instead of 1NT - P - 4C - P
    const ctx = makeBiddingContext(opener, Seat.North, ["1NT", "P", "4C", "4D"], Seat.North);
    const result = evaluateBiddingRules(ctx, gerberConfig);
    expect(result).toBeNull();
  });

  test("opponent doubles after 4C ask — ace response should not fire", () => {
    const ctx = makeBiddingContext(opener, Seat.North, ["1NT", "P", "4C", "X"], Seat.North);
    const result = evaluateBiddingRules(ctx, gerberConfig);
    expect(result).toBeNull();
  });

  test("opponent bids after ace response — king-ask/signoff should not fire", () => {
    // 1NT-P-4C-P-4H-4S(overcall) — responder can't continue Gerber
    const ctx = makeBiddingContext(responder, Seat.South, ["1NT", "P", "4C", "P", "4H", "4S"], Seat.North);
    const result = evaluateBiddingRules(ctx, gerberConfig);
    expect(result).toBeNull();
  });

  test("2NT opening — opponent overcalls after 2NT", () => {
    const ctx = makeBiddingContext(responder, Seat.South, ["2NT", "3C"], Seat.North);
    const result = evaluateBiddingRules(ctx, gerberConfig);
    expect(result).toBeNull();
  });

  test("non-jump 4C after suit bid — NOT Gerber", () => {
    // After 1H-P, a 4C bid is NOT Gerber (Gerber requires NT opening)
    const ctx = makeBiddingContext(responder, Seat.South, ["1H", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, gerberConfig);
    expect(result).toBeNull();
  });

  test("4C after 1C opening — NOT Gerber (suit bid, not NT)", () => {
    const ctx = makeBiddingContext(responder, Seat.South, ["1C", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, gerberConfig);
    expect(result).toBeNull();
  });
});

describe("Gerber — HCP boundary", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(gerberConfig);
  });

  test("exactly 16 HCP with no void — Gerber ask fires", () => {
    // SA(4)+SK(3)+SQ(2)+HA(4)+DK(3) = 16 HCP, no void
    const h = hand(
      "SA", "SK", "SQ", "S2",
      "HA", "H5", "H3",
      "DK", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1NT", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, gerberConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-ask");
  });

  test("15 HCP — Gerber ask does NOT fire", () => {
    // SA(4)+SK(3)+SQ(2)+HA(4)+DQ(2) = 15 HCP
    const h = hand(
      "SA", "SK", "SQ", "S2",
      "HA", "H5", "H3",
      "DQ", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1NT", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, gerberConfig);
    expect(result).toBeNull();
  });

  test("16+ HCP but has a void — Gerber ask does NOT fire", () => {
    // SA(4)+SK(3)+SQ(2)+HA(4)+HK(3)+DK(3) = 19 HCP, void in clubs
    const hVoid = hand(
      "SA", "SK", "SQ", "S7", "S5", "S3", "S2",
      "HA", "HK", "H5",
      "DK", "D5", "D3",
    );
    // 7 spades, 3 hearts, 3 diamonds, 0 clubs — void in clubs
    const ctx = makeBiddingContext(hVoid, Seat.South, ["1NT", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, gerberConfig);
    expect(result).toBeNull();
  });
});

// ─── Gerber — unusual scenarios ──────────────────────────────────

describe("Gerber — unusual scenarios [bridgebum/gerber]", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(gerberConfig);
  });

  test("4C after 2NT — Gerber ask fires (valid after any NT opening)", () => {
    // 16 HCP, no void — after 2NT-P
    const h = hand(
      "SA", "SK", "SQ", "S2",
      "HA", "H5", "H3",
      "DK", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["2NT", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, gerberConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-ask");
  });

  test("responder with 0 aces — responds 4D (0 or 4 disambiguation)", () => {
    // 16 HCP, 0 aces — all from K/Q/J
    // K(3)+K(3)+K(3)+K(3)+Q(2)+Q(2) = 16 HCP
    const opener = hand(
      "SK", "SQ", "S5",
      "HK", "HQ", "H5", "H3",
      "DK", "D5", "D3",
      "CK", "C5", "C2",
    );
    const ctx = makeBiddingContext(opener, Seat.North, ["1NT", "P", "4C", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, gerberConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-response-zero-four");
    const call = result!.call as import("../../../engine/types").ContractBid;
    expect(call.strain).toBe(BidSuit.Diamonds);
  });

  test("responder with 4 aces — also responds 4D (0 or 4 disambiguation)", () => {
    // 16 HCP from 4 aces = only 16. Need balanced with no void.
    const opener = hand(
      "SA", "S5", "S3",
      "HA", "H5", "H3",
      "DA", "D5", "D3",
      "CA", "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(opener, Seat.North, ["1NT", "P", "4C", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, gerberConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-response-zero-four");
  });

  test("exactly 1 ace — responds 4H", () => {
    const opener = hand(
      "SA", "SK", "SQ",
      "HK", "HQ", "H5", "H3",
      "DK", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(opener, Seat.North, ["1NT", "P", "4C", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, gerberConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-response-one");
  });

  test("Gerber ask does NOT fire with void (even with 16+ HCP)", () => {
    // 18 HCP, void in clubs
    const hVoid = hand(
      "SA", "SK", "SQ", "SJ", "S7", "S5", "S3",
      "HA", "HK", "H5",
      "DK", "D5", "D3",
    );
    const ctx = makeBiddingContext(hVoid, Seat.South, ["1NT", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, gerberConfig);
    expect(result).toBeNull();
  });

  test("4C after 1C opening — NOT Gerber (requires NT opening)", () => {
    const h = hand(
      "SA", "SK", "SQ", "S2",
      "HA", "H5", "H3",
      "DK", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1C", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, gerberConfig);
    expect(result).toBeNull();
  });

  test("4C after 1S opening — NOT Gerber (suit opening, not NT)", () => {
    const h = hand(
      "SA", "SK", "SQ", "S2",
      "HA", "H5", "H3",
      "DK", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1S", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, gerberConfig);
    expect(result).toBeNull();
  });

  test("Gerber after 2NT-P-4C-P — ace response works same as 1NT", () => {
    // 2 aces after 2NT opening
    const opener = hand(
      "SA", "SK", "SQ",
      "HA", "HQ", "H5", "H3",
      "DK", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(opener, Seat.North, ["2NT", "P", "4C", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, gerberConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("gerber-response-two");
  });
});

// ─── Gerber ace/king disambiguation correctness ──────────────

describe("Gerber — ace/king disambiguation [bridgebum/gerber]", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(gerberConfig);
  });

  test("responder with 0 aces sees 4D response: infers opener has 4 aces", () => {
    // Responder has 0 aces. 4D = 0 or 4. Since responder has 0, opener must have 4.
    // Total = 0 + 4 = 4 aces (>= 3), so king-ask fires.
    // SK(3)+SQ(2)+HK(3)+HQ(2)+DK(3)+DQ(2)+CK(3) = 18 HCP, 0 aces
    const responder0 = hand(
      "SK", "SQ", "S5",
      "HK", "HQ", "H3",
      "DK", "DQ", "D3",
      "CK", "C5", "C3", "C2",
    );
    expect(countAces(responder0)).toBe(0);
    const ctx = makeBiddingContext(responder0, Seat.South,
      ["1NT", "P", "4C", "P", "4D", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, gerberConfig);
    expect(result).not.toBeNull();
    // With 4 total aces (>= 3), king-ask should fire
    expect(result!.rule).toBe("gerber-king-ask");
  });

  test("responder with 4 aces sees 4D response: infers opener has 0 aces", () => {
    // Responder has 4 aces. 4D = 0 or 4. Since responder has 4, opener must have 0.
    // Total = 4 + 0 = 4 aces (>= 3), so king-ask fires.
    // SA(4)+HA(4)+DA(4)+CA(4) = 16 HCP, 4 aces
    const responder4 = hand(
      "SA", "S5", "S2",
      "HA", "H3",
      "DA", "D5", "D3", "D2",
      "CA", "C5", "C3", "C2",
    );
    expect(countAces(responder4)).toBe(4);
    const ctx = makeBiddingContext(responder4, Seat.South,
      ["1NT", "P", "4C", "P", "4D", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, gerberConfig);
    expect(result).not.toBeNull();
    // 4 total aces (>= 3), king-ask fires
    expect(result!.rule).toBe("gerber-king-ask");
  });

  test("responder with 1 ace sees 4D response: infers opener has 0 aces, signs off", () => {
    // Responder has 1 ace. 4D = 0 or 4.
    // With correct disambiguation: responder != 0, so opener inferred as 0.
    // Total = 1 + 0 = 1 (< 3), so should sign off, NOT king-ask.
    // SA(4)+SK(3)+SQ(2)+HK(3)+DK(3)+CQ(2)+CJ(1) = 18 HCP, 1 ace
    const responder1 = hand(
      "SA", "SK", "SQ", "S2",
      "HK", "H3",
      "DK", "D5", "D3",
      "CQ", "CJ", "C3", "C2",
    );
    expect(countAces(responder1)).toBe(1);
    const ctx = makeBiddingContext(responder1, Seat.South,
      ["1NT", "P", "4C", "P", "4D", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, gerberConfig);
    expect(result).not.toBeNull();
    // With only 1 total ace (< 3), should sign off, not king-ask
    expect(result!.rule).toBe("gerber-signoff");
  });

  test("responder with 0 kings sees 5D response: infers opener has 4 kings", () => {
    // After full Gerber sequence including king-ask.
    // Responder has 0 kings. 5D = 0 or 4 kings. Since responder has 0, opener has 4.
    // Total kings = 4 => signoff at high level.
    // SA(4)+HA(4)+DA(4)+CA(4)+SQ(2) = 18 HCP, 0 kings, 4 aces
    const responder0k = hand(
      "SA", "SQ", "S2",
      "HA", "H3",
      "DA", "D5", "D3", "D2",
      "CA", "C5", "C3", "C2",
    );
    expect(countKings(responder0k)).toBe(0);
    const ctx = makeBiddingContext(responder0k, Seat.South,
      ["1NT", "P", "4C", "P", "4D", "P", "5C", "P", "5D", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, gerberConfig);
    expect(result).not.toBeNull();
    // After king response, signoff fires
    expect(result!.rule).toBe("gerber-signoff");
  });
});
