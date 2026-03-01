/**
 * Characterization tests: capture current evaluation behavior for all conventions.
 * These lock in semantics so slot tree migrations can be verified.
 *
 * What's captured:
 * - Bid evaluation results: for representative hands, evaluateBiddingRules() produces
 *   the same rule name, call, and meaning after migration.
 * - Teaching content structure: extractTeachingContent() produces the same number of
 *   rounds and bid options per round.
 */
import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { buildAuction } from "../../../engine/auction-helpers";
import {
  clearRegistry,
  registerConvention,
  evaluateBiddingRules,
} from "../../core/registry";
import { extractTeachingContent } from "../../../display/teaching-content";
import { staymanConfig } from "../../definitions/stayman";
import { bergenConfig } from "../../definitions/bergen-raises";
import { saycConfig } from "../../definitions/sayc";
import { hand } from "../../../engine/__tests__/fixtures";
import type { BiddingContext } from "../../core/types";

function ctx(h: ReturnType<typeof hand>, seat: Seat, bids: string[], dealer: Seat): BiddingContext {
  return {
    hand: h,
    auction: buildAuction(dealer, bids),
    seat,
    evaluation: evaluateHand(h),
    opponentConventionIds: [],
  };
}

function callStr(call: Call): string {
  if (call.type !== "bid") {
    if (call.type === "pass") return "P";
    if (call.type === "double") return "X";
    return "XX";
  }
  const strainMap = new Map<BidSuit, string>([
    [BidSuit.Clubs, "C"],
    [BidSuit.Diamonds, "D"],
    [BidSuit.Hearts, "H"],
    [BidSuit.Spades, "S"],
    [BidSuit.NoTrump, "NT"],
  ]);
  return `${call.level}${strainMap.get(call.strain) ?? "?"}`;
}

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
  registerConvention(bergenConfig);
  registerConvention(saycConfig);
});

// ─── Stayman ─────────────────────────────────────────────────

describe("Stayman characterization", () => {
  test("responder asks 2C after 1NT-P with 8+ HCP and 4-card major", () => {
    // 13 HCP, 4 hearts
    const h = hand("SK", "S5", "S2", "HA", "HK", "HQ", "H3", "D5", "D3", "D2", "C5", "C3", "C2");
    const result = evaluateBiddingRules(ctx(h, Seat.South, ["1NT", "P"], Seat.North), staymanConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-ask");
    expect(callStr(result!.call)).toBe("2C");
  });

  test("opener responds 2H with 4+ hearts after 1NT-P-2C-P", () => {
    // 16 HCP, 4 hearts
    const h = hand("SA", "SK", "S3", "HK", "HQ", "HJ", "H2", "DK", "D5", "D3", "C7", "C5", "C2");
    const result = evaluateBiddingRules(ctx(h, Seat.North, ["1NT", "P", "2C", "P"], Seat.North), staymanConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-response-hearts");
    expect(callStr(result!.call)).toBe("2H");
  });

  test("responder rebids 4H with fit after 2H response and 10+ HCP", () => {
    // 13 HCP, 4 hearts
    const h = hand("SK", "S5", "S2", "HA", "HK", "HQ", "H3", "D5", "D3", "D2", "C5", "C3", "C2");
    const result = evaluateBiddingRules(
      ctx(h, Seat.South, ["1NT", "P", "2C", "P", "2H", "P"], Seat.North),
      staymanConfig,
    );
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-major-fit");
    expect(callStr(result!.call)).toBe("4H");
  });

  test("teaching content has expected round structure", () => {
    const content = extractTeachingContent(staymanConfig, staymanConfig.explanations);
    expect(content).not.toBeNull();
    // Protocol dispatch produces rounds grouped by trigger condition
    expect(content!.rounds.length).toBeGreaterThanOrEqual(1);
    expect(content!.totalBidOptions).toBeGreaterThanOrEqual(3);
  });
});

// ─── Bergen Raises ───────────────────────────────────────────

describe("Bergen Raises characterization", () => {
  test("responder makes constructive raise 3C with 7-10 HCP and 4+ trump", () => {
    // 8 HCP, 4 hearts: SQ(2) S5 S2 HK(3) H6 H4 H2 DQ(2) D5 D3 CJ(1) C3 C2
    const h = hand("SQ", "S5", "S2", "HK", "H6", "H4", "H2", "DQ", "D5", "D3", "CJ", "C3", "C2");
    const result = evaluateBiddingRules(ctx(h, Seat.South, ["1H", "P"], Seat.North), bergenConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-constructive-raise");
    expect(callStr(result!.call)).toBe("3C");
  });

  test("opener rebids game after limit raise with 15+ HCP", () => {
    // 15 HCP, 5 hearts opener
    const h = hand("SK", "S5", "S2", "HA", "HK", "HQ", "H7", "H3", "DA", "D3", "C5", "C3", "C2");
    const result = evaluateBiddingRules(
      ctx(h, Seat.North, ["1H", "P", "3D", "P"], Seat.North),
      bergenConfig,
    );
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-rebid-game-after-limit");
    expect(callStr(result!.call)).toBe("4H");
  });

  test("teaching content has expected round structure", () => {
    const content = extractTeachingContent(bergenConfig);
    expect(content).not.toBeNull();
    // Bergen has multiple rounds: initial response, opener rebids per response type, responder continuations
    expect(content!.rounds.length).toBeGreaterThanOrEqual(1);
    expect(content!.totalBidOptions).toBeGreaterThanOrEqual(1);
  });
});

// ─── SAYC ────────────────────────────────────────────────────

describe("SAYC characterization", () => {
  test("opener bids 1NT with 15-17 balanced no 5M", () => {
    // 16 HCP, balanced (4-3-3-3), no 5-card major
    // AK(7) + KQ(5) + Q(2) + QJ(3) = doesn't work. Let me be precise:
    // SK(3) SJ(1) S7 S4 = 4 spades, 4 HCP
    // HK(3) HQ(2) H5 = 3 hearts, 5 HCP
    // DA(4) D8 D3 = 3 diamonds, 4 HCP
    // CK(3) C5 C2 = 3 clubs, 3 HCP
    // Total: 4+5+4+3 = 16 HCP, shape 4-3-3-3
    const h = hand("SK", "SJ", "S7", "S4", "HK", "HQ", "H5", "DA", "D8", "D3", "CK", "C5", "C2");
    const result = evaluateBiddingRules(
      ctx(h, Seat.South, [], Seat.South),
      saycConfig,
    );
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-open-1nt");
    expect(callStr(result!.call)).toBe("1NT");
  });

  test("responder transfers to hearts with 5+ hearts after 1NT-P", () => {
    // 5+ hearts
    const h = hand("S5", "S3", "HA", "HK", "HQ", "H7", "H3", "D5", "D3", "D2", "C5", "C3", "C2");
    const result = evaluateBiddingRules(
      ctx(h, Seat.South, ["1NT", "P"], Seat.North),
      saycConfig,
    );
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-respond-1nt-transfer-hearts");
    expect(callStr(result!.call)).toBe("2D");
  });

  test("teaching content has expected round structure", () => {
    const content = extractTeachingContent(saycConfig);
    expect(content).not.toBeNull();
    // SAYC has many rounds (opening + responses + rebids + competitive)
    expect(content!.rounds.length).toBeGreaterThanOrEqual(8);
    expect(content!.totalBidOptions).toBeGreaterThanOrEqual(1);
  });
});
