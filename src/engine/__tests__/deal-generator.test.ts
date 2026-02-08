import { describe, test, expect } from 'vitest';
import { Suit, Seat, Vulnerability } from '../types';
import type { Card, Deal, DealConstraints } from '../types';
import { checkConstraints, generateDeal } from '../deal-generator';
import { hand } from './fixtures';

// Fixture deal with known properties
function fixtureDeal(): Deal {
  return {
    hands: {
      [Seat.North]: hand(
        'SA', 'SK', 'SQ', 'SJ',  // 10 HCP spades
        'HA', 'HK', 'H3',        // 7 HCP
        'DA', 'D3', 'D2',        // 4 HCP
        'C3', 'C2', 'C4',        // 0 HCP
      ), // 21 HCP, 4-3-3-3 balanced
      [Seat.East]: hand(
        'S2', 'S3', 'S4', 'S5',
        'H2', 'H4', 'H5',
        'D4', 'D5', 'D6',
        'C5', 'C6', 'C7',
      ), // 0 HCP
      [Seat.South]: hand(
        'S6', 'S7', 'S8',
        'HQ', 'HJ', 'HT', 'H6',
        'DK', 'DQ', 'DJ',
        'CK', 'CQ',  'CJ',
      ), // 15 HCP, 3-4-3-3
      [Seat.West]: hand(
        'S9', 'ST',
        'H7', 'H8', 'H9',
        'D7', 'D8', 'D9', 'DT',
        'CA', 'C8', 'C9', 'CT',
      ), // 4 HCP, 2-3-4-4
    },
    dealer: Seat.North,
    vulnerability: Vulnerability.None,
  };
}

describe('checkConstraints', () => {
  test('empty constraints match any deal', () => {
    const deal = fixtureDeal();
    const constraints: DealConstraints = { seats: [] };
    expect(checkConstraints(deal, constraints)).toBe(true);
  });

  test('minHcp rejects below threshold', () => {
    const deal = fixtureDeal();
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.East, minHcp: 10 }],
    };
    expect(checkConstraints(deal, constraints)).toBe(false);
  });

  test('minHcp accepts at threshold', () => {
    const deal = fixtureDeal();
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, minHcp: 21 }],
    };
    expect(checkConstraints(deal, constraints)).toBe(true);
  });

  test('maxHcp rejects above threshold', () => {
    const deal = fixtureDeal();
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, maxHcp: 15 }],
    };
    expect(checkConstraints(deal, constraints)).toBe(false);
  });

  test('maxHcp accepts at threshold', () => {
    const deal = fixtureDeal();
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, maxHcp: 21 }],
    };
    expect(checkConstraints(deal, constraints)).toBe(true);
  });

  test('balanced constraint accepts balanced hand', () => {
    const deal = fixtureDeal();
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, balanced: true }],
    };
    expect(checkConstraints(deal, constraints)).toBe(true);
  });

  test('balanced constraint rejects unbalanced hand', () => {
    // All 4 hands use 52 unique cards — North is 6-4-2-1 unbalanced
    const unbalDeal: Deal = {
      hands: {
        [Seat.North]: hand(
          'SA', 'SK', 'SQ', 'SJ', 'S9', 'S8',  // 6 spades
          'HA', 'HK', 'HQ', 'HJ',               // 4 hearts
          'DA', 'D2',                              // 2 diamonds
          'CA',                                    // 1 club
        ),
        [Seat.East]: hand(
          'S2', 'S3', 'S4', 'S5',
          'H2', 'H4', 'H5', 'H6',
          'D4', 'D5', 'D6', 'D7',
          'C5',
        ),
        [Seat.South]: hand(
          'S6', 'S7', 'ST',
          'HT', 'H3', 'H9',
          'DK', 'DQ', 'DJ',
          'CK', 'CQ', 'CJ', 'CT',
        ),
        [Seat.West]: hand(
          'C2', 'C3', 'C4', 'C6', 'C7', 'C8', 'C9',
          'D3', 'D8', 'D9', 'DT',
          'H7', 'H8',
        ),
      },
      dealer: Seat.North,
      vulnerability: Vulnerability.None,
    };
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, balanced: true }],
    };
    expect(checkConstraints(unbalDeal, constraints)).toBe(false);
  });

  test('minLength constraint accepts when met', () => {
    const deal = fixtureDeal();
    // North has 4 spades
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, minLength: { [Suit.Spades]: 4 } }],
    };
    expect(checkConstraints(deal, constraints)).toBe(true);
  });

  test('minLength constraint rejects when not met', () => {
    const deal = fixtureDeal();
    // North has 4 spades, not 5
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, minLength: { [Suit.Spades]: 5 } }],
    };
    expect(checkConstraints(deal, constraints)).toBe(false);
  });

  test('multiple constraints on same seat use AND logic', () => {
    const deal = fixtureDeal();
    // North: 21 HCP, balanced — both must be true
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, minHcp: 15, maxHcp: 25, balanced: true }],
    };
    expect(checkConstraints(deal, constraints)).toBe(true);
  });

  test('fails if any one constraint is not met', () => {
    const deal = fixtureDeal();
    // North: 21 HCP, balanced — but maxHcp 15 fails
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, minHcp: 15, maxHcp: 15, balanced: true }],
    };
    expect(checkConstraints(deal, constraints)).toBe(false);
  });
});

describe('generateDeal', () => {
  test('unconstrained deal has 52 unique cards', () => {
    const result = generateDeal({ seats: [] });
    const allCards: Card[] = [];
    for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
      allCards.push(...result.deal.hands[seat].cards);
    }
    expect(allCards).toHaveLength(52);
    const keys = allCards.map((c) => `${c.suit}${c.rank}`);
    expect(new Set(keys).size).toBe(52);
  });

  test('each hand has 13 cards', () => {
    const result = generateDeal({ seats: [] });
    for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
      expect(result.deal.hands[seat].cards).toHaveLength(13);
    }
  });

  test('50 deals with minHcp=12 for North all satisfy', () => {
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, minHcp: 12 }],
    };
    for (let i = 0; i < 50; i++) {
      const result = generateDeal(constraints);
      expect(checkConstraints(result.deal, constraints)).toBe(true);
    }
  });

  test('50 deals with balanced=true for North all satisfy', () => {
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, balanced: true }],
    };
    for (let i = 0; i < 50; i++) {
      const result = generateDeal(constraints);
      expect(checkConstraints(result.deal, constraints)).toBe(true);
    }
  });

  test('impossible constraint throws', () => {
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, minHcp: 38 }],
    };
    expect(() => generateDeal(constraints)).toThrow();
  });

  test('returns iteration metadata', () => {
    const result = generateDeal({ seats: [] });
    expect(result.iterations).toBeGreaterThanOrEqual(1);
    expect(result.relaxationSteps).toBeGreaterThanOrEqual(0);
  });

  test('respects dealer constraint', () => {
    const result = generateDeal({ seats: [], dealer: Seat.East });
    expect(result.deal.dealer).toBe(Seat.East);
  });

  test('respects vulnerability constraint', () => {
    const result = generateDeal({ seats: [], vulnerability: Vulnerability.Both });
    expect(result.deal.vulnerability).toBe('Both');
  });
});
