import { describe, it, expect } from "vitest";
import { Seat, Suit } from "../../engine/types";
import { SUIT_ORDER, SEATS } from "../../engine/constants";
import { createInitialBeliefState } from "../belief-accumulator";
import type { PublicBeliefState } from "../types";
import type { PrivateBeliefState } from "../private-belief";
import type { BeliefData } from "../../conventions/core/effective-context";
import { toBeliefData } from "../belief-converter";

function makePublicBelief(overrides?: Partial<Record<Seat, {
  hcpRange: { min: number; max: number };
  suitLengths: Record<Suit, { min: number; max: number }>;
}>>): PublicBeliefState {
  const initial = createInitialBeliefState();
  if (!overrides) return initial;

  const beliefs = { ...initial.beliefs };
  for (const [seat, data] of Object.entries(overrides)) {
    beliefs[seat as Seat] = {
      ...initial.beliefs[seat as Seat],
      hcpRange: data.hcpRange,
      suitLengths: data.suitLengths,
    };
  }
  return { beliefs, annotations: [] };
}

describe("toBeliefData", () => {
  it("maps PublicBeliefState to BeliefData for all 4 seats", () => {
    const pub = makePublicBelief({
      [Seat.North]: {
        hcpRange: { min: 15, max: 17 },
        suitLengths: {
          [Suit.Spades]: { min: 2, max: 5 },
          [Suit.Hearts]: { min: 2, max: 5 },
          [Suit.Diamonds]: { min: 2, max: 5 },
          [Suit.Clubs]: { min: 2, max: 5 },
        },
      },
      [Seat.South]: {
        hcpRange: { min: 8, max: 12 },
        suitLengths: {
          [Suit.Spades]: { min: 4, max: 6 },
          [Suit.Hearts]: { min: 0, max: 3 },
          [Suit.Diamonds]: { min: 2, max: 5 },
          [Suit.Clubs]: { min: 2, max: 5 },
        },
      },
    });

    const result = toBeliefData(pub);

    // North HCP
    expect(result.beliefs[Seat.North].hcpRange).toEqual({ min: 15, max: 17 });
    // North suit lengths
    expect(result.beliefs[Seat.North].suitLengths[Suit.Spades]).toEqual({ min: 2, max: 5 });

    // South HCP
    expect(result.beliefs[Seat.South].hcpRange).toEqual({ min: 8, max: 12 });
    // South suit lengths
    expect(result.beliefs[Seat.South].suitLengths[Suit.Spades]).toEqual({ min: 4, max: 6 });
    expect(result.beliefs[Seat.South].suitLengths[Suit.Hearts]).toEqual({ min: 0, max: 3 });

    // East and West should have defaults from initial state
    expect(result.beliefs[Seat.East].hcpRange.min).toBe(0);
    expect(result.beliefs[Seat.East].hcpRange.max).toBe(40);
    expect(result.beliefs[Seat.West].hcpRange.min).toBe(0);
    expect(result.beliefs[Seat.West].hcpRange.max).toBe(40);
  });

  it("applies private override to partner seat only", () => {
    const pub = makePublicBelief({
      [Seat.North]: {
        hcpRange: { min: 15, max: 17 },
        suitLengths: {
          [Suit.Spades]: { min: 2, max: 13 },
          [Suit.Hearts]: { min: 2, max: 13 },
          [Suit.Diamonds]: { min: 2, max: 13 },
          [Suit.Clubs]: { min: 2, max: 13 },
        },
      },
    });

    const privateOverride: PrivateBeliefState = {
      seat: Seat.South,
      partnerSeat: Seat.North,
      partnerHcpRange: { min: 15, max: 17 },
      partnerSuitLengths: {
        [Suit.Spades]: { min: 2, max: 8 },
        [Suit.Hearts]: { min: 2, max: 9 },
        [Suit.Diamonds]: { min: 2, max: 7 },
        [Suit.Clubs]: { min: 2, max: 10 },
      },
    };

    const result = toBeliefData(pub, privateOverride);

    // North (partner) should use narrowed private override values
    expect(result.beliefs[Seat.North].suitLengths[Suit.Spades]).toEqual({ min: 2, max: 8 });
    expect(result.beliefs[Seat.North].suitLengths[Suit.Hearts]).toEqual({ min: 2, max: 9 });
    expect(result.beliefs[Seat.North].suitLengths[Suit.Diamonds]).toEqual({ min: 2, max: 7 });
    expect(result.beliefs[Seat.North].suitLengths[Suit.Clubs]).toEqual({ min: 2, max: 10 });

    // North HCP from private override (now uses narrowed HCP range)
    expect(result.beliefs[Seat.North].hcpRange).toEqual({ min: 15, max: 17 });

    // South, East, West should be unchanged from public
    expect(result.beliefs[Seat.South].hcpRange.min).toBe(0);
    expect(result.beliefs[Seat.East].hcpRange.min).toBe(0);
    expect(result.beliefs[Seat.West].hcpRange.min).toBe(0);
  });

  it("handles initial (default) belief state", () => {
    const initial = createInitialBeliefState();
    const result = toBeliefData(initial);

    for (const seat of SEATS) {
      expect(result.beliefs[seat].hcpRange).toEqual({ min: 0, max: 40 });
      for (const suit of SUIT_ORDER) {
        expect(result.beliefs[seat].suitLengths[suit]).toEqual({ min: 0, max: 13 });
      }
    }
  });

  it("applies private HCP override to partner seat", () => {
    const pub = makePublicBelief({
      [Seat.North]: {
        hcpRange: { min: 10, max: 37 },
        suitLengths: {
          [Suit.Spades]: { min: 0, max: 13 },
          [Suit.Hearts]: { min: 0, max: 13 },
          [Suit.Diamonds]: { min: 0, max: 13 },
          [Suit.Clubs]: { min: 0, max: 13 },
        },
      },
    });

    const privateOverride: PrivateBeliefState = {
      seat: Seat.South,
      partnerSeat: Seat.North,
      partnerHcpRange: { min: 10, max: 22 }, // narrowed from 37 by own HCP
      partnerSuitLengths: {
        [Suit.Spades]: { min: 0, max: 8 },
        [Suit.Hearts]: { min: 0, max: 9 },
        [Suit.Diamonds]: { min: 0, max: 11 },
        [Suit.Clubs]: { min: 0, max: 11 },
      },
    };

    const result = toBeliefData(pub, privateOverride);

    // Partner (North) HCP should use narrowed private range, not public
    expect(result.beliefs[Seat.North].hcpRange).toEqual({ min: 10, max: 22 });
    // Non-partner seats unchanged
    expect(result.beliefs[Seat.South].hcpRange.max).toBe(40);
  });

  it("drift protection: output has all seat keys and suit keys", () => {
    const pub = createInitialBeliefState();
    const result: BeliefData = toBeliefData(pub);

    // All 4 seats present
    for (const seat of SEATS) {
      expect(result.beliefs[seat]).toBeDefined();
      expect(result.beliefs[seat].hcpRange).toBeDefined();
      expect(result.beliefs[seat].suitLengths).toBeDefined();

      // All 4 suits present per seat
      for (const suit of SUIT_ORDER) {
        expect(result.beliefs[seat].suitLengths[suit]).toBeDefined();
        expect(typeof result.beliefs[seat].suitLengths[suit].min).toBe("number");
        expect(typeof result.beliefs[seat].suitLengths[suit].max).toBe("number");
      }
    }
  });
});
