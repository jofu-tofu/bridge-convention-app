import { describe, it, expect } from "vitest";
import { Seat, Suit } from "../../engine/types";
import { conditionOnOwnHand } from "../private-belief";
import type { PublicBeliefState, BidAnnotation } from "../types";
import type { FactConstraintIR } from "../../core/contracts/agreement-module";
import { hand } from "../../engine/__tests__/fixtures";
import { evaluateHand } from "../../engine/hand-evaluator";
import { createInitialBeliefState, applyAnnotation } from "../belief-accumulator";

function makeAnnotation(seat: Seat, constraints: readonly FactConstraintIR[]): BidAnnotation {
  return { call: { type: "pass" }, seat, conventionId: null, meaning: "test", constraints };
}

function suitToName(suit: Suit): string {
  switch (suit) {
    case Suit.Spades: return "spades";
    case Suit.Hearts: return "hearts";
    case Suit.Diamonds: return "diamonds";
    case Suit.Clubs: return "clubs";
    default: return "unknown";
  }
}

function makeBeliefState(overrides?: Partial<Record<Seat, { hcpRange?: { min: number; max: number }; suitLengths?: Partial<Record<Suit, { min: number; max: number }>> }>>): PublicBeliefState {
  let state = createInitialBeliefState();
  if (!overrides) return state;

  for (const [seatStr, data] of Object.entries(overrides)) {
    const seat = seatStr as Seat;
    const constraints: FactConstraintIR[] = [];
    if (data.hcpRange) {
      if (data.hcpRange.min > 0) constraints.push({ factId: "hand.hcp", operator: "gte", value: data.hcpRange.min });
      if (data.hcpRange.max < 40) constraints.push({ factId: "hand.hcp", operator: "lte", value: data.hcpRange.max });
    }
    if (data.suitLengths) {
      for (const [suit, range] of Object.entries(data.suitLengths)) {
        if (range) {
          if (range.min > 0) constraints.push({ factId: `hand.suitLength.${suitToName(suit as Suit)}`, operator: "gte", value: range.min });
          if (range.max < 13) constraints.push({ factId: `hand.suitLength.${suitToName(suit as Suit)}`, operator: "lte", value: range.max });
        }
      }
    }
    if (constraints.length > 0) {
      state = applyAnnotation(state, makeAnnotation(seat, constraints));
    }
  }
  return state;
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

  it("partner HCP max capped by 40 minus own HCP (own 34 HCP → partner max 6)", () => {
    const h = hand("SA", "SK", "SQ", "SJ", "ST", "HA", "HK", "DA", "DK", "CA", "CK", "CQ", "CJ");
    const eval_ = evaluateHand(h);

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
    const h = hand("SA", "SJ", "S7", "S5", "S3", "HK", "H5", "DK", "D6", "D3", "CQ", "C4", "C2");
    const eval_ = evaluateHand(h);

    const publicBelief = makeBeliefState({
      [Seat.North]: {
        hcpRange: { min: 5, max: 17 },
      },
    });

    const result = conditionOnOwnHand(publicBelief, Seat.South, h, eval_);

    // Public max (17) is already tighter than 40 - 13 = 27, so no change
    expect(result.partnerHcpRange).toEqual({ min: 5, max: 17 });
  });

  it("own 0 HCP → partner max stays at public value (no narrowing)", () => {
    const h = hand("S9", "S8", "S7", "S6", "H9", "H8", "H7", "H6", "D9", "D8", "D7", "C9", "C8");
    const eval_ = evaluateHand(h);

    const publicBelief = makeBeliefState({
      [Seat.North]: {
        hcpRange: { min: 0, max: 30 },
      },
    });

    const result = conditionOnOwnHand(publicBelief, Seat.South, h, eval_);

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

    expect(result.partnerSuitLengths[Suit.Diamonds].max).toBe(10);
  });

  it("uses correct partner seat (South → North)", () => {
    const h = hand("S9", "S8", "S7", "S6", "S5", "H9", "H8", "H7", "D9", "D8", "D7", "C9", "C8");
    const eval_ = evaluateHand(h);

    const publicBelief = makeBeliefState({
      [Seat.North]: {
        hcpRange: { min: 10, max: 15 },
      },
    });

    const result = conditionOnOwnHand(publicBelief, Seat.South, h, eval_);

    expect(result.seat).toBe(Seat.South);
    expect(result.partnerSeat).toBe(Seat.North);
    expect(result.partnerHcpRange).toEqual({ min: 10, max: 15 });
  });

  it("multiple suits narrowed independently", () => {
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
