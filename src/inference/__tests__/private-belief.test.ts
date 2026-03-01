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
    const existing = beliefs[seat]!;
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

  it("partner HCP range passed through unchanged", () => {
    const h = hand("SA", "SK", "SQ", "SJ", "ST", "HA", "HK", "DA", "DK", "CA", "CK", "CQ", "CJ");
    const eval_ = evaluateHand(h);

    const publicBelief = makeBeliefState({
      [Seat.North]: {
        hcpRange: { min: 6, max: 18 },
      },
    });

    const result = conditionOnOwnHand(publicBelief, Seat.South, h, eval_);

    expect(result.partnerHcpRange).toEqual({ min: 6, max: 18 });
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
    const h = hand("SA", "SK", "SQ", "SJ", "ST", "HA", "HK", "DA", "DK", "CA", "CK", "CQ", "CJ");
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
