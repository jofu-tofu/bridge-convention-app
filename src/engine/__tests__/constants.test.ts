import { describe, test, expect } from 'vitest';
import { Suit, Rank, Seat } from '../types';
import type { Card, Hand } from '../types';
import {
  SUITS,
  RANKS,
  SEATS,
  HCP_VALUES,
  createDeck,
  createHand,
  nextSeat,
  partnerSeat,
} from '../constants';

describe('SUITS', () => {
  test('has exactly 4 suits in ascending order', () => {
    expect(SUITS).toEqual([Suit.Clubs, Suit.Diamonds, Suit.Hearts, Suit.Spades]);
  });
});

describe('RANKS', () => {
  test('has exactly 13 ranks in ascending order', () => {
    expect(RANKS).toHaveLength(13);
    expect(RANKS[0]).toBe(Rank.Two);
    expect(RANKS[12]).toBe(Rank.Ace);
  });
});

describe('SEATS', () => {
  test('has 4 seats in clockwise order', () => {
    expect(SEATS).toEqual([Seat.North, Seat.East, Seat.South, Seat.West]);
  });
});

describe('HCP_VALUES', () => {
  test('Ace=4, King=3, Queen=2, Jack=1', () => {
    expect(HCP_VALUES[Rank.Ace]).toBe(4);
    expect(HCP_VALUES[Rank.King]).toBe(3);
    expect(HCP_VALUES[Rank.Queen]).toBe(2);
    expect(HCP_VALUES[Rank.Jack]).toBe(1);
  });

  test('spot cards are worth 0', () => {
    expect(HCP_VALUES[Rank.Ten]).toBe(0);
    expect(HCP_VALUES[Rank.Two]).toBe(0);
    expect(HCP_VALUES[Rank.Nine]).toBe(0);
  });
});

describe('createDeck', () => {
  test('returns 52 cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
  });

  test('all cards are unique', () => {
    const deck = createDeck();
    const keys = deck.map((c: Card) => `${c.suit}${c.rank}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(52);
  });

  test('returns a new array each call', () => {
    const deck1 = createDeck();
    const deck2 = createDeck();
    expect(deck1).not.toBe(deck2);
  });
});

describe('createHand', () => {
  test('accepts exactly 13 cards', () => {
    const deck = createDeck();
    const hand = createHand(deck.slice(0, 13));
    expect(hand.cards).toHaveLength(13);
  });

  test('throws on fewer than 13 cards', () => {
    const deck = createDeck();
    expect(() => createHand(deck.slice(0, 12))).toThrow();
  });

  test('throws on more than 13 cards', () => {
    const deck = createDeck();
    expect(() => createHand(deck.slice(0, 14))).toThrow();
  });
});

describe('nextSeat', () => {
  test('rotates clockwise', () => {
    expect(nextSeat(Seat.North)).toBe(Seat.East);
    expect(nextSeat(Seat.East)).toBe(Seat.South);
    expect(nextSeat(Seat.South)).toBe(Seat.West);
    expect(nextSeat(Seat.West)).toBe(Seat.North);
  });
});

describe('partnerSeat', () => {
  test('returns opposite seat', () => {
    expect(partnerSeat(Seat.North)).toBe(Seat.South);
    expect(partnerSeat(Seat.South)).toBe(Seat.North);
    expect(partnerSeat(Seat.East)).toBe(Seat.West);
    expect(partnerSeat(Seat.West)).toBe(Seat.East);
  });
});
