import { describe, test, expect } from "vitest";
import { Suit, Rank, Seat } from "../types";
import type { Card } from "../types";
import {
  SUITS,
  RANKS,
  SEATS,
  SUIT_ORDER,
  HCP_VALUES,
  createDeck,
  createHand,
  nextSeat,
  partnerSeat,
} from "../constants";

describe("SUITS", () => {
  test("contains all 4 suits", () => {
    expect(SUITS).toHaveLength(4);
    expect(SUITS).toContain(Suit.Clubs);
    expect(SUITS).toContain(Suit.Diamonds);
    expect(SUITS).toContain(Suit.Hearts);
    expect(SUITS).toContain(Suit.Spades);
  });

  test("clubs lowest, spades highest (bridge ascending order)", () => {
    expect(SUITS.indexOf(Suit.Clubs)).toBeLessThan(SUITS.indexOf(Suit.Diamonds));
    expect(SUITS.indexOf(Suit.Diamonds)).toBeLessThan(SUITS.indexOf(Suit.Hearts));
    expect(SUITS.indexOf(Suit.Hearts)).toBeLessThan(SUITS.indexOf(Suit.Spades));
  });
});

describe("RANKS", () => {
  test("contains all 13 ranks", () => {
    expect(RANKS).toHaveLength(13);
  });

  test("Two is lowest rank, Ace is highest (bridge ascending order)", () => {
    expect(RANKS.indexOf(Rank.Two)).toBeLessThan(RANKS.indexOf(Rank.Ace));
    expect(RANKS.indexOf(Rank.Jack)).toBeLessThan(RANKS.indexOf(Rank.Queen));
    expect(RANKS.indexOf(Rank.Queen)).toBeLessThan(RANKS.indexOf(Rank.King));
    expect(RANKS.indexOf(Rank.King)).toBeLessThan(RANKS.indexOf(Rank.Ace));
  });
});

describe("SEATS", () => {
  test("contains all 4 seats", () => {
    expect(SEATS).toHaveLength(4);
    expect(SEATS).toContain(Seat.North);
    expect(SEATS).toContain(Seat.East);
    expect(SEATS).toContain(Seat.South);
    expect(SEATS).toContain(Seat.West);
  });

  test("ordered clockwise starting from North (bridge convention)", () => {
    expect(SEATS.indexOf(Seat.North)).toBeLessThan(SEATS.indexOf(Seat.East));
    expect(SEATS.indexOf(Seat.East)).toBeLessThan(SEATS.indexOf(Seat.South));
    expect(SEATS.indexOf(Seat.South)).toBeLessThan(SEATS.indexOf(Seat.West));
  });
});

describe("HCP_VALUES", () => {
  test("Ace=4, King=3, Queen=2, Jack=1", () => {
    expect(HCP_VALUES[Rank.Ace]).toBe(4);
    expect(HCP_VALUES[Rank.King]).toBe(3);
    expect(HCP_VALUES[Rank.Queen]).toBe(2);
    expect(HCP_VALUES[Rank.Jack]).toBe(1);
  });

  test("spot cards are worth 0", () => {
    expect(HCP_VALUES[Rank.Ten]).toBe(0);
    expect(HCP_VALUES[Rank.Two]).toBe(0);
    expect(HCP_VALUES[Rank.Nine]).toBe(0);
  });
});

describe("createDeck", () => {
  test("returns 52 cards", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
  });

  test("all cards are unique", () => {
    const deck = createDeck();
    const keys = deck.map((c: Card) => `${c.suit}${c.rank}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(52);
  });

  test("returns a new array each call", () => {
    const deck1 = createDeck();
    const deck2 = createDeck();
    expect(deck1).not.toBe(deck2);
  });
});

describe("createHand", () => {
  test("accepts exactly 13 cards", () => {
    const deck = createDeck();
    const hand = createHand(deck.slice(0, 13));
    expect(hand.cards).toHaveLength(13);
  });

  test("throws on fewer than 13 cards", () => {
    const deck = createDeck();
    expect(() => createHand(deck.slice(0, 12))).toThrow();
  });

  test("throws on more than 13 cards", () => {
    const deck = createDeck();
    expect(() => createHand(deck.slice(0, 14))).toThrow();
  });
});

describe("nextSeat", () => {
  test("rotates clockwise", () => {
    expect(nextSeat(Seat.North)).toBe(Seat.East);
    expect(nextSeat(Seat.East)).toBe(Seat.South);
    expect(nextSeat(Seat.South)).toBe(Seat.West);
    expect(nextSeat(Seat.West)).toBe(Seat.North);
  });
});

describe("partnerSeat", () => {
  test("returns opposite seat", () => {
    expect(partnerSeat(Seat.North)).toBe(Seat.South);
    expect(partnerSeat(Seat.South)).toBe(Seat.North);
    expect(partnerSeat(Seat.East)).toBe(Seat.West);
    expect(partnerSeat(Seat.West)).toBe(Seat.East);
  });
});

describe("SUIT_ORDER", () => {
  test("contains all 4 suits", () => {
    expect(SUIT_ORDER).toHaveLength(4);
    expect(SUIT_ORDER).toContain(Suit.Spades);
    expect(SUIT_ORDER).toContain(Suit.Hearts);
    expect(SUIT_ORDER).toContain(Suit.Diamonds);
    expect(SUIT_ORDER).toContain(Suit.Clubs);
  });

  test("spades highest, clubs lowest (bridge display ranking)", () => {
    expect(SUIT_ORDER.indexOf(Suit.Spades)).toBeLessThan(SUIT_ORDER.indexOf(Suit.Hearts));
    expect(SUIT_ORDER.indexOf(Suit.Hearts)).toBeLessThan(SUIT_ORDER.indexOf(Suit.Diamonds));
    expect(SUIT_ORDER.indexOf(Suit.Diamonds)).toBeLessThan(SUIT_ORDER.indexOf(Suit.Clubs));
  });
});

describe("createHand defensive copy", () => {
  test("createHand returns defensive copy", () => {
    const deck = createDeck();
    const original = deck.slice(0, 13);
    const firstCardBefore = { ...original[0] };
    const h = createHand(original);
    // Mutate the original array
    original[0] = deck[13]!;
    // Hand's cards should be unchanged
    expect(h.cards[0]!.suit).toBe(firstCardBefore.suit);
    expect(h.cards[0]!.rank).toBe(firstCardBefore.rank);
  });
});

describe("createDeck HCP total", () => {
  test("createDeck produces 40 total HCP", () => {
    const deck = createDeck();
    let totalHcp = 0;
    for (const c of deck) {
      totalHcp += HCP_VALUES[c.rank];
    }
    expect(totalHcp).toBe(40);
  });
});
