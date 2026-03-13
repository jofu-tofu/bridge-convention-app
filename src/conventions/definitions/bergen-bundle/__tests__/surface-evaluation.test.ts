// Bergen Raises surface evaluation tests.
//
// These tests verify that the surface evaluator correctly identifies
// which Bergen raise type applies for a given hand, with particular
// focus on splinter detection.
//
// Sources: bridgebum.com/bergen_raises.php [bridgebum/bergen]
// Standard Bergen: splinter = 12+ HCP, 4-card support, singleton or void.

import { describe, test, expect } from "vitest";
import { BidSuit } from "../../../../engine/types";
import { evaluateHand, calculateHcp } from "../../../../engine/hand-evaluator";
import { hand } from "../../../../engine/__tests__/fixtures";
import { evaluateBergenFacts } from "../facts";
import { evaluateBergenSurfaces } from "../meaning-surfaces";

// ─── Helpers ──────────────────────────────────────────────────

function evaluateForBergen(h: ReturnType<typeof hand>, opening: BidSuit.Hearts | BidSuit.Spades) {
  const evaluation = evaluateHand(h);
  const facts = evaluateBergenFacts(evaluation, opening);
  return { facts, result: evaluateBergenSurfaces(facts) };
}

// ─── Splinter detection ───────────────────────────────────────

describe("Bergen surface evaluation — splinter detection", () => {
  test("[ref:bridgebum/bergen] 13 HCP + 4 hearts + shortage produces 3S splinter", () => {
    // SA(4) + HK(3) + HQ(2) + DK(3) + CJ(1) = 13 HCP
    // Shape: 1-4-3-5 → singleton spade = shortage
    const responder = hand(
      "SA",        // 1 spade (shortage)
      "HK", "HQ", "H6", "H2",  // 4 hearts
      "DK", "D7", "D3",         // 3 diamonds
      "CJ", "C8", "C5", "C3", "C2", // 5 clubs
    );
    expect(calculateHcp(responder)).toBe(13);

    const { facts, result } = evaluateForBergen(responder, BidSuit.Hearts);
    expect(facts.hasShortage).toBe(true);
    expect(facts.supportCount).toBe(4);
    expect(facts.hcp).toBe(13);

    expect(result).not.toBeNull();
    expect(result!.surface.id).toBe("splinter");
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Spades });
  });

  test("[ref:bridgebum/bergen] 12 HCP + 4 spades + shortage produces 3H splinter", () => {
    // SK(3) + SQ(2) + SA(4) = 9 in spades... no, need exactly 4 spades.
    // SK(3) + SQ(2) + S6 + S2 = 5 HCP in 4 spades
    // HA(4) = 4 HCP (1 heart = shortage)
    // DQ(2) + DJ(1) = 3 HCP in 3 diamonds
    // C-void or singleton
    // Let me build: SK(3)+SQ(2)+HA(4)+DQ(2)+DJ(1) = 12 HCP, shape 4-1-3-5
    const responder = hand(
      "SK", "SQ", "S6", "S2",   // 4 spades
      "HA",                       // 1 heart (shortage)
      "DQ", "DJ", "D7",          // 3 diamonds
      "C8", "C7", "C5", "C3", "C2", // 5 clubs
    );
    expect(calculateHcp(responder)).toBe(12);

    const { facts, result } = evaluateForBergen(responder, BidSuit.Spades);
    expect(facts.hasShortage).toBe(true);
    expect(facts.supportCount).toBe(4);
    expect(facts.hcp).toBe(12);

    expect(result).not.toBeNull();
    expect(result!.surface.id).toBe("splinter");
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Hearts });
  });

  test("[ref:bridgebum/bergen] exactly 12 HCP with shortage qualifies as splinter", () => {
    // SA(4) + HK(3) + HQ(2) + DK(3) = 12 HCP
    // Shape: 1-4-3-5 → singleton spade = shortage
    const responder = hand(
      "SA",                       // 1 spade (shortage)
      "HK", "HQ", "H6", "H2",   // 4 hearts
      "DK", "D7", "D3",          // 3 diamonds
      "C8", "C7", "C5", "C3", "C2", // 5 clubs
    );
    expect(calculateHcp(responder)).toBe(12);

    const { facts, result } = evaluateForBergen(responder, BidSuit.Hearts);
    expect(facts.hasShortage).toBe(true);
    expect(facts.supportCount).toBe(4);

    expect(result).not.toBeNull();
    expect(result!.surface.id).toBe("splinter");
    // Splinter after 1H opening = 3S (other major)
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Spades });
  });
});

// ─── Non-splinter raises (no shortage) ────────────────────────

describe("Bergen surface evaluation — non-splinter raises", () => {
  test("[ref:bridgebum/bergen] 13 HCP without shortage produces game raise", () => {
    // SA(4) + HK(3) + HQ(2) + DK(3) + CJ(1) = 13 HCP
    // Shape: 3-4-3-3 → no shortage
    const responder = hand(
      "SA", "S5", "S2",
      "HK", "HQ", "H6", "H2",
      "DK", "D7", "D3",
      "CJ", "C3", "C2",
    );
    expect(calculateHcp(responder)).toBe(13);

    const { facts, result } = evaluateForBergen(responder, BidSuit.Hearts);
    expect(facts.hasShortage).toBe(false);

    expect(result).not.toBeNull();
    expect(result!.surface.id).toBe("game-raise");
    expect(result!.call).toEqual({ type: "bid", level: 4, strain: BidSuit.Hearts });
  });

  test("[ref:bridgebum/bergen] 11 HCP without shortage produces limit raise", () => {
    // SA(4) + HK(3) + HJ(1) + DQ(2) + CJ(1) = 11 HCP
    // Shape: 3-4-3-3 → no shortage
    const responder = hand(
      "SA", "S5", "S2",
      "HK", "HJ", "H6", "H2",
      "DQ", "D7", "D3",
      "CJ", "C3", "C2",
    );
    expect(calculateHcp(responder)).toBe(11);

    const { facts, result } = evaluateForBergen(responder, BidSuit.Hearts);
    expect(facts.hasShortage).toBe(false);

    expect(result).not.toBeNull();
    expect(result!.surface.id).toBe("limit-raise");
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Diamonds });
  });

  test("[ref:bridgebum/bergen] 8 HCP produces constructive raise", () => {
    // HK(3) + DK(3) + DQ(2) = 8 HCP, 4 hearts
    // Shape: 3-4-3-3 → no shortage
    const responder = hand(
      "S8", "S5", "S2",
      "HK", "HT", "H6", "H2",
      "DK", "DQ", "D3",
      "C5", "C3", "C2",
    );
    expect(calculateHcp(responder)).toBe(8);

    const { facts, result } = evaluateForBergen(responder, BidSuit.Hearts);
    expect(result).not.toBeNull();
    expect(result!.surface.id).toBe("constructive-raise");
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Clubs });
  });

  test("[ref:bridgebum/bergen] 5 HCP produces preemptive raise", () => {
    // HK(3) + HQ(2) = 5 HCP, 4 hearts
    // Shape: 3-4-3-3 → no shortage
    const responder = hand(
      "S8", "S5", "S2",
      "HK", "HQ", "H6", "H2",
      "DT", "D7", "D3",
      "C5", "C3", "C2",
    );
    expect(calculateHcp(responder)).toBe(5);

    const { facts, result } = evaluateForBergen(responder, BidSuit.Hearts);
    expect(result).not.toBeNull();
    expect(result!.surface.id).toBe("preemptive-raise");
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Hearts });
  });
});

// ─── Splinter with void ──────────────────────────────────────

describe("Bergen surface evaluation — splinter with void", () => {
  test("[ref:bridgebum/bergen] 14 HCP with void produces splinter, not game raise", () => {
    // SA(4) + SK(3) + HQ(2) + HJ(1) + DK(3) + CJ(1) = 14 HCP
    // Shape: 0-4-3-6 → void in spades = shortage
    // Wait, can't have 0 spades and SA+SK. Let me fix.
    // Shape: 3-4-0-6 → void in diamonds
    // SA(4) + SK(3) + HQ(2) + HJ(1) + CK(3) + CJ(1) = 14 HCP
    const responder = hand(
      "SA", "SK", "S2",           // 3 spades
      "HQ", "HJ", "H6", "H2",    // 4 hearts
      // 0 diamonds (void)
      "CK", "CJ", "C8", "C5", "C3", "C2", // 6 clubs
    );
    expect(calculateHcp(responder)).toBe(14);

    const { facts, result } = evaluateForBergen(responder, BidSuit.Hearts);
    expect(facts.hasShortage).toBe(true);
    expect(facts.hcp).toBe(14);

    expect(result).not.toBeNull();
    expect(result!.surface.id).toBe("splinter");
  });
});

// ─── No match cases ──────────────────────────────────────────

describe("Bergen surface evaluation — no match", () => {
  test("3-card support returns null (no surface matches)", () => {
    // 13 HCP but only 3 hearts
    const responder = hand(
      "SA", "SK", "S5", "S2",
      "HK", "H5", "H2",
      "DK", "D7", "D3",
      "C5", "C3", "C2",
    );
    expect(calculateHcp(responder)).toBe(13);

    const { result } = evaluateForBergen(responder, BidSuit.Hearts);
    expect(result).toBeNull();
  });
});
