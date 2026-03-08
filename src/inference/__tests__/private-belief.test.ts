import { describe, it, expect } from "vitest";
import { Seat, Suit } from "../../engine/types";
import { conditionOnOwnHand } from "../private-belief";
import type { PublicBeliefState } from "../types";
import { hand } from "../../engine/__tests__/fixtures";
import { evaluateHand } from "../../engine/hand-evaluator";
import { createInitialBeliefState } from "../belief-accumulator";

function makeBeliefState(overrides?: Partial<Record<Seat, { hcpRange?: { min: number; max: number }; suitLengths?: Partial<Record<Suit, { min: number; max: number }>> }>>): PublicBeliefState {
  const base = createInitialBeliefState();
  if (!overrides) return base;

  const beliefs = { ...base.beliefs };
  for (const [seatStr, data] of Object.entries(overrides)) {
    const seat = seatStr as Seat;
    const existing = beliefs[seat];
    beliefs[seat] = {
      ...existing,
      hcpRange: data.hcpRange ?? existing.hcpRange,
      suitLengths: {
        ...existing.suitLengths,
        ...data.suitLengths ? Object.fromEntries(
          Object.entries(data.suitLengths).map(([s, range]) => [
            s,
            range ?? existing.suitLengths[s as Suit],
          ]),
        ) : {},
      } as Record<Suit, { readonly min: number; readonly max: number }>,
    };
  }
  return { ...base, beliefs };
}

describe("conditionOnOwnHand", () => {
  it("partner suit max capped by 13 minus own length (5 spades → partner max 8)", () => {
    // South has 5 spades
    const h = hand("SA", "SK", "SQ", "SJ", "ST", "HA", "HK", "DA", "DK", "CA", "CK", "CQ", "CJ");
    const eval_ = evaluateHand(h);

    const publicBelief = makeBeliefState({
      [Seat.North]: {
        suitLengths: {
          [Suit.Spades]: { min: 3, max: 10 },
        },
      },
    });

    const result = conditionOnOwnHand(publicBelief, Seat.South, h, eval_);

    // Partner (North) max spades capped at 13 - 5 = 8
    expect(result.partnerSuitLengths[Suit.Spades].max).toBe(8);
    expect(result.partnerSuitLengths[Suit.Spades].min).toBe(3);
  });

  it("partner HCP max capped by 40 minus own HCP (own 18 HCP → partner max 22)", () => {
    // SA(4)+SK(3)+SQ(2)+SJ(1)+ST(0)+HA(4)+HK(3)+DA(4)+DK(3)+CA(4)+CK(3)+CQ(2)+CJ(1) = 34 HCP
    const h = hand("SA", "SK", "SQ", "SJ", "ST", "HA", "HK", "DA", "DK", "CA", "CK", "CQ", "CJ");
    const eval_ = evaluateHand(h);
    // This hand has 34 HCP, so partner max = 40 - 34 = 6

    const publicBelief = makeBeliefState({
      [Seat.North]: {
        hcpRange: { min: 6, max: 37 },
      },
    });

    const result = conditionOnOwnHand(publicBelief, Seat.South, h, eval_);

    // Public max (37) > 40 - 34 (6), so clamped to 6
    expect(result.partnerHcpRange.max).toBe(6);
    expect(result.partnerHcpRange.min).toBe(6);
  });

  it("partner HCP max unchanged when public already tighter", () => {
    // SA(4)+SJ(1)+S7+S5+S3 + HK(3) + H5 + DK(3) + D6 + D3 + CQ(2) + C4 + C2 = 13 HCP
    const h = hand("SA", "SJ", "S7", "S5", "S3", "HK", "H5", "DK", "D6", "D3", "CQ", "C4", "C2");
    const eval_ = evaluateHand(h);
    // Own HCP: 13. Partner max cap = 40 - 13 = 27

    const publicBelief = makeBeliefState({
      [Seat.North]: {
        hcpRange: { min: 5, max: 17 }, // public max 17 < 27
      },
    });

    const result = conditionOnOwnHand(publicBelief, Seat.South, h, eval_);

    // Public max (17) is already tighter than 40 - 13 = 27, so no change
    expect(result.partnerHcpRange).toEqual({ min: 5, max: 17 });
  });

  it("own 0 HCP → partner max stays at public value (no narrowing)", () => {
    // All spot cards: 0 HCP
    const h = hand("S9", "S8", "S7", "S6", "H9", "H8", "H7", "H6", "D9", "D8", "D7", "C9", "C8");
    const eval_ = evaluateHand(h);

    const publicBelief = makeBeliefState({
      [Seat.North]: {
        hcpRange: { min: 0, max: 30 },
      },
    });

    const result = conditionOnOwnHand(publicBelief, Seat.South, h, eval_);

    // 40 - 0 = 40, public max 30 is tighter
    expect(result.partnerHcpRange).toEqual({ min: 0, max: 30 });
  });

  it("monotonicity: higher own HCP → lower or equal partner max", () => {
    const lowHcpHand = hand("SA", "S9", "S8", "S7", "H9", "H8", "H7", "H6", "D9", "D8", "D7", "C9", "C8");
    const highHcpHand = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "HQ", "HJ", "DA", "DK", "DQ", "CA", "CK");

    const publicBelief = makeBeliefState({
      [Seat.North]: {
        hcpRange: { min: 0, max: 40 },
      },
    });

    const lowResult = conditionOnOwnHand(publicBelief, Seat.South, lowHcpHand, evaluateHand(lowHcpHand));
    const highResult = conditionOnOwnHand(publicBelief, Seat.South, highHcpHand, evaluateHand(highHcpHand));

    expect(highResult.partnerHcpRange.max).toBeLessThanOrEqual(lowResult.partnerHcpRange.max);
  });

  it("own hand has 0 of a suit → partner max unchanged by own hand", () => {
    // South has 0 diamonds
    const h = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "HQ", "HJ", "CA", "CK", "CQ", "CJ", "CT");
    const eval_ = evaluateHand(h);

    const publicBelief = makeBeliefState({
      [Seat.North]: {
        suitLengths: {
          [Suit.Diamonds]: { min: 2, max: 10 },
        },
      },
    });

    const result = conditionOnOwnHand(publicBelief, Seat.South, h, eval_);

    // 13 - 0 = 13, but public max is 10, so min(13, 10) = 10
    expect(result.partnerSuitLengths[Suit.Diamonds].max).toBe(10);
  });

  it("uses correct partner seat (South → North)", () => {
    // Low HCP hand so partner HCP isn't clamped by own hand
    const h = hand("S9", "S8", "S7", "S6", "S5", "H9", "H8", "H7", "D9", "D8", "D7", "C9", "C8");
    const eval_ = evaluateHand(h); // 0 HCP

    const publicBelief = makeBeliefState({
      [Seat.North]: {
        hcpRange: { min: 10, max: 15 },
      },
    });

    const result = conditionOnOwnHand(publicBelief, Seat.South, h, eval_);

    expect(result.seat).toBe(Seat.South);
    expect(result.partnerSeat).toBe(Seat.North);
    // 40 - 0 = 40 > 15, so public range unchanged
    expect(result.partnerHcpRange).toEqual({ min: 10, max: 15 });
  });

  it("multiple suits narrowed independently", () => {
    // South: 5 spades, 4 hearts, 2 diamonds, 2 clubs
    const h = hand("SA", "SK", "SQ", "SJ", "ST", "HA", "HK", "HQ", "HJ", "DA", "DK", "CA", "CK");
    const eval_ = evaluateHand(h);

    const publicBelief = makeBeliefState({
      [Seat.North]: {
        suitLengths: {
          [Suit.Spades]: { min: 0, max: 13 },
          [Suit.Hearts]: { min: 0, max: 13 },
          [Suit.Diamonds]: { min: 0, max: 13 },
          [Suit.Clubs]: { min: 0, max: 13 },
        },
      },
    });

    const result = conditionOnOwnHand(publicBelief, Seat.South, h, eval_);

    expect(result.partnerSuitLengths[Suit.Spades].max).toBe(8);   // 13 - 5
    expect(result.partnerSuitLengths[Suit.Hearts].max).toBe(9);   // 13 - 4
    expect(result.partnerSuitLengths[Suit.Diamonds].max).toBe(11); // 13 - 2
    expect(result.partnerSuitLengths[Suit.Clubs].max).toBe(11);   // 13 - 2
  });
});
