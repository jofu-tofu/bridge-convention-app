import { describe, test, expect } from 'vitest';
import { Suit, Rank, Seat } from '../types';
import type { Card } from '../types';

describe('Suit', () => {
  test('has exactly 4 values', () => {
    const values = Object.values(Suit);
    expect(values).toHaveLength(4);
  });

  test('values are single-char bridge notation', () => {
    expect(Suit.Clubs).toBe('C');
    expect(Suit.Diamonds).toBe('D');
    expect(Suit.Hearts).toBe('H');
    expect(Suit.Spades).toBe('S');
  });
});

describe('Rank', () => {
  test('has exactly 13 values', () => {
    const values = Object.values(Rank);
    expect(values).toHaveLength(13);
  });

  test('numeric ranks use digit strings', () => {
    expect(Rank.Two).toBe('2');
    expect(Rank.Nine).toBe('9');
  });

  test('Ten uses T notation', () => {
    expect(Rank.Ten).toBe('T');
  });

  test('face cards use single-char notation', () => {
    expect(Rank.Jack).toBe('J');
    expect(Rank.Queen).toBe('Q');
    expect(Rank.King).toBe('K');
    expect(Rank.Ace).toBe('A');
  });
});

describe('Card', () => {
  test('is constructible from Suit and Rank', () => {
    const card: Card = { suit: Suit.Spades, rank: Rank.Ace };
    expect(card.suit).toBe('S');
    expect(card.rank).toBe('A');
  });

  test('is a plain object matching raw string values', () => {
    const card: Card = { suit: Suit.Hearts, rank: Rank.King };
    expect(card).toEqual({ suit: 'H', rank: 'K' });
  });
});

describe('Seat', () => {
  test('has exactly 4 values', () => {
    const values = Object.values(Seat);
    expect(values).toHaveLength(4);
  });

  test('values are single-char compass notation', () => {
    expect(Seat.North).toBe('N');
    expect(Seat.East).toBe('E');
    expect(Seat.South).toBe('S');
    expect(Seat.West).toBe('W');
  });
});
