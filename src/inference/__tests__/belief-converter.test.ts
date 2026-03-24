import { describe, it, expect } from "vitest";
import { Seat, Suit } from "../../engine/types";
import { SUIT_ORDER, SEATS } from "../../engine/constants";
import { createInitialBeliefState } from "../belief-accumulator";
import { applyAnnotation } from "../belief-accumulator";
import type { PublicBeliefState, BidAnnotation } from "../types";
import type { PrivateBeliefState } from "../private-belief";
import type { BeliefData } from "../inference-types";
import { toBeliefData } from "../belief-converter";

import type { FactConstraint } from "../../conventions/core/agreement-module";

function makeAnnotation(seat: Seat, constraints: readonly FactConstraint[]): BidAnnotation {
  return { call: { type: "pass" }, seat, conventionId: null, meaning: "test", constraints };
}

function makePublicBelief(overrides?: Partial<Record<Seat, {
  hcpRange: { min: number; max: number };
  suitLengths: Record<Suit, { min: number; max: number }>;
}>>): PublicBeliefState {
  let state = createInitialBeliefState();
  if (!overrides) return state;

  for (const [seatStr, data] of Object.entries(overrides)) {
    const seat = seatStr as Seat;
    const constraints: FactConstraint[] = [];
    if (data.hcpRange.min > 0) constraints.push({ factId: "hand.hcp", operator: "gte", value: data.hcpRange.min });
    if (data.hcpRange.max < 40) constraints.push({ factId: "hand.hcp", operator: "lte", value: data.hcpRange.max });
    for (const [suit, range] of Object.entries(data.suitLengths)) {
      if (range.min > 0) constraints.push({ factId: `hand.suitLength.${suitToName(suit as Suit)}`, operator: "gte", value: range.min });
      if (range.max < 13) constraints.push({ factId: `hand.suitLength.${suitToName(suit as Suit)}`, operator: "lte", value: range.max });
    }
    if (constraints.length > 0) {
      state = applyAnnotation(state, makeAnnotation(seat, constraints));
    }
  }
  return state;
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

    // North HCP from private override
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
      partnerHcpRange: { min: 10, max: 22 },
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
