import { describe, test, expect } from 'vitest';
import { Suit } from '../types';
import type { Card } from '../types';
import {
  calculateHcp,
  getSuitLength,
  isBalanced,
  calculateDistributionPoints,
  getCardsInSuit,
  evaluateHand,
} from '../hand-evaluator';
import { card, hand } from './fixtures';

// Test fixtures — HCP verified: A=4, K=3, Q=2, J=1
const HAND_ALL_ACES = hand(
  'SA', 'HA', 'DA', 'CA',       // 4+4+4+4 = 16
  'S2', 'S3', 'S4', 'H2', 'H3',
  'D2', 'D3', 'C2', 'C3',
); // 16 HCP, shape 4-3-3-3

const HAND_YARBOROUGH = hand(
  'S2', 'S3', 'S4', 'S5',
  'H2', 'H3', 'H4',
  'D2', 'D3', 'D4',
  'C2', 'C3', 'C4',
); // 0 HCP, shape 4-3-3-3

const HAND_15_BALANCED = hand(
  'SA', 'SK', 'S3', 'S2',       // 4+3 = 7
  'HK', 'HJ', 'H3',            // 3+1 = 4
  'DA', 'D3', 'D2',             // 4
  'C3', 'C2', 'C4',             // 0
); // 15 HCP (7+4+4+0), shape 4-3-3-3

const HAND_20_UNBAL = hand(
  'SA', 'SK', 'SQ', 'SJ', 'S2', // 4+3+2+1 = 10
  'HA', 'HK', 'HJ', 'H4', 'H2', // 4+3+1 = 8
  'DQ', 'D2',                    // 2
  'C2',                           // 0
); // 20 HCP (10+8+2+0), shape 5-5-2-1

const HAND_13_4441 = hand(
  'SA', 'S3', 'S4', 'S5',       // 4
  'HA', 'H3', 'H4', 'H5',      // 4
  'DA', 'D3', 'D4', 'D5',       // 4
  'CJ',                          // 1
); // 13 HCP (4+4+4+1), shape 4-4-4-1

const HAND_17_7321 = hand(
  'SA', 'SK', 'SQ', 'S9', 'S8', 'S7', 'S6', // 4+3+2 = 9
  'HA', 'HK', 'H2',                          // 4+3 = 7
  'DJ', 'D2',                                 // 1
  'C2',                                        // 0
); // 17 HCP (9+7+1+0), shape 7-3-2-1

describe('calculateHcp', () => {
  test('all aces hand scores 16', () => {
    expect(calculateHcp(HAND_ALL_ACES)).toBe(16);
  });

  test('yarborough scores 0', () => {
    expect(calculateHcp(HAND_YARBOROUGH)).toBe(0);
  });

  test('15 HCP balanced hand', () => {
    expect(calculateHcp(HAND_15_BALANCED)).toBe(15);
  });

  test('20 HCP unbalanced hand', () => {
    expect(calculateHcp(HAND_20_UNBAL)).toBe(20);
  });

  test('13 HCP 4-4-4-1 hand with aces and jack', () => {
    expect(calculateHcp(HAND_13_4441)).toBe(13);
  });

  test('17 HCP 7-3-2-1 hand', () => {
    expect(calculateHcp(HAND_17_7321)).toBe(17);
  });

  test('maximum possible HCP is 37', () => {
    const maxHand = hand(
      'SA', 'SK', 'SQ',          // 4+3+2 = 9
      'HA', 'HK', 'HQ',          // 4+3+2 = 9
      'DA', 'DK', 'DQ',          // 4+3+2 = 9
      'CA', 'CK', 'CQ',          // 4+3+2 = 9
      'SJ',                       // 1
    ); // 4A(16) + 4K(12) + 4Q(8) + 1J(1) = 37
    expect(calculateHcp(maxHand)).toBe(37);
  });
});

describe('getSuitLength', () => {
  test('returns correct tuple for 4-3-3-3', () => {
    const shape = getSuitLength(HAND_15_BALANCED);
    // [Spades, Hearts, Diamonds, Clubs]
    expect(shape).toEqual([4, 3, 3, 3]);
  });

  test('returns correct tuple for 5-5-2-1', () => {
    const shape = getSuitLength(HAND_20_UNBAL);
    expect(shape).toEqual([5, 5, 2, 1]);
  });

  test('returns correct tuple for 7-3-2-1', () => {
    const shape = getSuitLength(HAND_17_7321);
    expect(shape).toEqual([7, 3, 2, 1]);
  });

  test('returns correct tuple for 4-4-4-1', () => {
    const shape = getSuitLength(HAND_13_4441);
    expect(shape).toEqual([4, 4, 4, 1]);
  });
});

describe('isBalanced', () => {
  test('4-3-3-3 is balanced', () => {
    expect(isBalanced([4, 3, 3, 3])).toBe(true);
  });

  test('4-4-3-2 is balanced', () => {
    expect(isBalanced([4, 4, 3, 2])).toBe(true);
  });

  test('5-3-3-2 is balanced', () => {
    expect(isBalanced([5, 3, 3, 2])).toBe(true);
  });

  test('5-4-2-2 is not balanced', () => {
    expect(isBalanced([5, 4, 2, 2])).toBe(false);
  });

  test('4-4-4-1 is not balanced', () => {
    expect(isBalanced([4, 4, 4, 1])).toBe(false);
  });

  test('6-3-2-2 is not balanced', () => {
    expect(isBalanced([6, 3, 2, 2])).toBe(false);
  });

  test('5-5-2-1 is not balanced', () => {
    expect(isBalanced([5, 5, 2, 1])).toBe(false);
  });
});

describe('calculateDistributionPoints', () => {
  test('void scores 3 shortness points', () => {
    const points = calculateDistributionPoints([5, 5, 3, 0]);
    expect(points.shortness).toBe(3);
  });

  test('singleton scores 2 shortness points', () => {
    const points = calculateDistributionPoints([5, 4, 3, 1]);
    expect(points.shortness).toBe(2);
  });

  test('doubleton scores 1 shortness point', () => {
    const points = calculateDistributionPoints([4, 4, 3, 2]);
    expect(points.shortness).toBe(1);
  });

  test('balanced hand has 0 shortness but may have length', () => {
    const points = calculateDistributionPoints([4, 3, 3, 3]);
    expect(points.shortness).toBe(0);
    expect(points.length).toBe(0);
  });

  test('5+ card suits score length points', () => {
    const points = calculateDistributionPoints([7, 3, 2, 1]);
    expect(points.length).toBe(3); // 7-4 = 3
  });

  test('total is shortness plus length', () => {
    const points = calculateDistributionPoints([7, 3, 2, 1]);
    expect(points.total).toBe(points.shortness + points.length);
  });
});

describe('getCardsInSuit', () => {
  test('returns only cards of requested suit', () => {
    const spades = getCardsInSuit(HAND_15_BALANCED, Suit.Spades);
    expect(spades).toHaveLength(4);
    expect(spades.every((c: Card) => c.suit === Suit.Spades)).toBe(true);
  });

  test('returns empty array for void suit', () => {
    const voidHand = hand(
      'SA', 'SK', 'SQ', 'SJ', 'S9',
      'HA', 'HK', 'HQ', 'HJ',
      'DA', 'DK', 'DQ', 'DJ',
    );
    const clubs = getCardsInSuit(voidHand, Suit.Clubs);
    expect(clubs).toHaveLength(0);
  });
});

describe('evaluateHand', () => {
  test('returns full HandEvaluation with strategy name', () => {
    const result = evaluateHand(HAND_15_BALANCED);
    expect(result.hcp).toBe(15);
    expect(result.shape).toEqual([4, 3, 3, 3]);
    expect(result.strategy).toBe('HCP');
    expect(result.totalPoints).toBe(result.hcp + result.distribution.total);
  });

  test('unbalanced hand includes distribution points in total', () => {
    const result = evaluateHand(HAND_20_UNBAL);
    expect(result.hcp).toBe(20);
    expect(result.distribution.total).toBeGreaterThan(0);
    expect(result.totalPoints).toBe(result.hcp + result.distribution.total);
  });
});
