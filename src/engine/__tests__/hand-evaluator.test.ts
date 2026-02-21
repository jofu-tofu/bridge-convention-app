import { describe, test, expect } from "vitest";
import { Suit } from "../types";
import type { Card } from "../types";
import {
  calculateHcp,
  getSuitLength,
  isBalanced,
  calculateDistributionPoints,
  getCardsInSuit,
  evaluateHand,
} from "../hand-evaluator";
import { HCP_VALUES, createDeck } from "../constants";
import { hand } from "./fixtures";

// Test fixtures — HCP verified: A=4, K=3, Q=2, J=1
const HAND_ALL_ACES = hand(
  "SA",
  "HA",
  "DA",
  "CA", // 4+4+4+4 = 16
  "S2",
  "S3",
  "S4",
  "H2",
  "H3",
  "D2",
  "D3",
  "C2",
  "C3",
); // 16 HCP, shape 4-3-3-3

const HAND_YARBOROUGH = hand(
  "S2",
  "S3",
  "S4",
  "S5",
  "H2",
  "H3",
  "H4",
  "D2",
  "D3",
  "D4",
  "C2",
  "C3",
  "C4",
); // 0 HCP, shape 4-3-3-3

const HAND_15_BALANCED = hand(
  "SA",
  "SK",
  "S3",
  "S2", // 4+3 = 7
  "HK",
  "HJ",
  "H3", // 3+1 = 4
  "DA",
  "D3",
  "D2", // 4
  "C3",
  "C2",
  "C4", // 0
); // 15 HCP (7+4+4+0), shape 4-3-3-3

const HAND_20_UNBAL = hand(
  "SA",
  "SK",
  "SQ",
  "SJ",
  "S2", // 4+3+2+1 = 10
  "HA",
  "HK",
  "HJ",
  "H4",
  "H2", // 4+3+1 = 8
  "DQ",
  "D2", // 2
  "C2", // 0
); // 20 HCP (10+8+2+0), shape 5-5-2-1

const HAND_13_4441 = hand(
  "SA",
  "S3",
  "S4",
  "S5", // 4
  "HA",
  "H3",
  "H4",
  "H5", // 4
  "DA",
  "D3",
  "D4",
  "D5", // 4
  "CJ", // 1
); // 13 HCP (4+4+4+1), shape 4-4-4-1

const HAND_17_7321 = hand(
  "SA",
  "SK",
  "SQ",
  "S9",
  "S8",
  "S7",
  "S6", // 4+3+2 = 9
  "HA",
  "HK",
  "H2", // 4+3 = 7
  "DJ",
  "D2", // 1
  "C2", // 0
); // 17 HCP (9+7+1+0), shape 7-3-2-1

describe("calculateHcp", () => {
  test("all aces hand scores 16", () => {
    expect(calculateHcp(HAND_ALL_ACES)).toBe(16);
  });

  test("yarborough scores 0", () => {
    expect(calculateHcp(HAND_YARBOROUGH)).toBe(0);
  });

  test("15 HCP balanced hand", () => {
    expect(calculateHcp(HAND_15_BALANCED)).toBe(15);
  });

  test("20 HCP unbalanced hand", () => {
    expect(calculateHcp(HAND_20_UNBAL)).toBe(20);
  });

  test("13 HCP 4-4-4-1 hand with aces and jack", () => {
    expect(calculateHcp(HAND_13_4441)).toBe(13);
  });

  test("17 HCP 7-3-2-1 hand", () => {
    expect(calculateHcp(HAND_17_7321)).toBe(17);
  });

  test("maximum possible HCP is 37", () => {
    const maxHand = hand(
      "SA",
      "SK",
      "SQ", // 4+3+2 = 9
      "HA",
      "HK",
      "HQ", // 4+3+2 = 9
      "DA",
      "DK",
      "DQ", // 4+3+2 = 9
      "CA",
      "CK",
      "CQ", // 4+3+2 = 9
      "SJ", // 1
    ); // 4A(16) + 4K(12) + 4Q(8) + 1J(1) = 37
    expect(calculateHcp(maxHand)).toBe(37);
  });
});

describe("getSuitLength", () => {
  test("returns correct tuple for 4-3-3-3", () => {
    const shape = getSuitLength(HAND_15_BALANCED);
    // [Spades, Hearts, Diamonds, Clubs]
    expect(shape).toEqual([4, 3, 3, 3]);
  });

  test("returns correct tuple for 5-5-2-1", () => {
    const shape = getSuitLength(HAND_20_UNBAL);
    expect(shape).toEqual([5, 5, 2, 1]);
  });

  test("returns correct tuple for 7-3-2-1", () => {
    const shape = getSuitLength(HAND_17_7321);
    expect(shape).toEqual([7, 3, 2, 1]);
  });

  test("returns correct tuple for 4-4-4-1", () => {
    const shape = getSuitLength(HAND_13_4441);
    expect(shape).toEqual([4, 4, 4, 1]);
  });
});

describe("isBalanced", () => {
  test("4-3-3-3 is balanced", () => {
    expect(isBalanced([4, 3, 3, 3])).toBe(true);
  });

  test("4-4-3-2 is balanced", () => {
    expect(isBalanced([4, 4, 3, 2])).toBe(true);
  });

  test("5-3-3-2 is balanced", () => {
    expect(isBalanced([5, 3, 3, 2])).toBe(true);
  });

  test("5-4-2-2 is not balanced", () => {
    expect(isBalanced([5, 4, 2, 2])).toBe(false);
  });

  test("4-4-4-1 is not balanced", () => {
    expect(isBalanced([4, 4, 4, 1])).toBe(false);
  });

  test("6-3-2-2 is not balanced", () => {
    expect(isBalanced([6, 3, 2, 2])).toBe(false);
  });

  test("5-5-2-1 is not balanced", () => {
    expect(isBalanced([5, 5, 2, 1])).toBe(false);
  });
});

describe("calculateDistributionPoints", () => {
  test("void scores 3 shortness points", () => {
    const points = calculateDistributionPoints([5, 5, 3, 0]);
    expect(points.shortness).toBe(3);
  });

  test("singleton scores 2 shortness points", () => {
    const points = calculateDistributionPoints([5, 4, 3, 1]);
    expect(points.shortness).toBe(2);
  });

  test("doubleton scores 1 shortness point", () => {
    const points = calculateDistributionPoints([4, 4, 3, 2]);
    expect(points.shortness).toBe(1);
  });

  test("balanced hand has 0 shortness but may have length", () => {
    const points = calculateDistributionPoints([4, 3, 3, 3]);
    expect(points.shortness).toBe(0);
    expect(points.length).toBe(0);
  });

  test("5+ card suits score length points", () => {
    const points = calculateDistributionPoints([7, 3, 2, 1]);
    expect(points.length).toBe(3); // 7-4 = 3
  });

  test("total is shortness plus length", () => {
    const points = calculateDistributionPoints([7, 3, 2, 1]);
    expect(points.total).toBe(points.shortness + points.length);
  });
});

describe("getCardsInSuit", () => {
  test("returns only cards of requested suit", () => {
    const spades = getCardsInSuit(HAND_15_BALANCED, Suit.Spades);
    expect(spades).toHaveLength(4);
    expect(spades.every((c: Card) => c.suit === Suit.Spades)).toBe(true);
  });

  test("returns empty array for void suit", () => {
    const voidHand = hand(
      "SA",
      "SK",
      "SQ",
      "SJ",
      "S9",
      "HA",
      "HK",
      "HQ",
      "HJ",
      "DA",
      "DK",
      "DQ",
      "DJ",
    );
    const clubs = getCardsInSuit(voidHand, Suit.Clubs);
    expect(clubs).toHaveLength(0);
  });
});

describe("evaluateHand", () => {
  test("balanced 15 HCP hand evaluates to 15 total points", () => {
    const result = evaluateHand(HAND_15_BALANCED);
    expect(result.hcp).toBe(15);
    expect(result.shape).toEqual([4, 3, 3, 3]);
    expect(result.totalPoints).toBe(15); // balanced = 0 distribution points
  });

  test("total points equals HCP plus distribution points", () => {
    const result = evaluateHand(HAND_15_BALANCED);
    expect(result.totalPoints).toBe(result.hcp + result.distribution.total);
  });

  test("unbalanced hand includes distribution points in total", () => {
    const result = evaluateHand(HAND_20_UNBAL);
    expect(result.hcp).toBe(20);
    expect(result.distribution.total).toBeGreaterThan(0);
    expect(result.totalPoints).toBe(result.hcp + result.distribution.total);
  });
});

describe("extreme hand shapes — bridge edge cases", () => {
  test("13-0-0-0 shape: all cards in one suit", () => {
    const monosuit = hand(
      "SA", "SK", "SQ", "SJ", "ST",
      "S9", "S8", "S7", "S6", "S5",
      "S4", "S3", "S2",
    );
    expect(getSuitLength(monosuit)).toEqual([13, 0, 0, 0]);
  });

  test("13-0-0-0 shape is not balanced", () => {
    expect(isBalanced([13, 0, 0, 0])).toBe(false);
  });

  test("13-0-0-0 distribution: 3 voids (9 shortness) + 9 length points", () => {
    const points = calculateDistributionPoints([13, 0, 0, 0]);
    expect(points.shortness).toBe(9); // 3 voids × 3
    expect(points.length).toBe(9); // 13-4 = 9
    expect(points.total).toBe(18);
  });

  test("6-5-1-1 shape: two singletons", () => {
    const points = calculateDistributionPoints([6, 5, 1, 1]);
    expect(points.shortness).toBe(4); // 2 singletons × 2
    expect(points.length).toBe(3); // (6-4) + (5-4) = 2 + 1
    expect(points.total).toBe(7);
  });

  test("7-6-0-0 shape: two voids", () => {
    const points = calculateDistributionPoints([7, 6, 0, 0]);
    expect(points.shortness).toBe(6); // 2 voids × 3
    expect(points.length).toBe(5); // (7-4) + (6-4)
    expect(points.total).toBe(11);
  });

  test("only 4-3-3-3, 4-4-3-2, and 5-3-3-2 are balanced per ACBL", () => {
    // Exhaustive check: these three and only these are balanced
    const balanced = [
      [4, 3, 3, 3],
      [4, 4, 3, 2],
      [5, 3, 3, 2],
    ] as const;
    for (const shape of balanced) {
      expect(isBalanced([...shape])).toBe(true);
    }

    // All permutations of balanced shapes are also balanced
    expect(isBalanced([3, 3, 3, 4])).toBe(true);
    expect(isBalanced([3, 4, 4, 2])).toBe(true);
    expect(isBalanced([2, 3, 3, 5])).toBe(true);
  });

  test("common unbalanced shapes are not balanced", () => {
    const unbalanced = [
      [5, 4, 2, 2],
      [4, 4, 4, 1],
      [6, 3, 2, 2],
      [5, 5, 2, 1],
      [6, 4, 2, 1],
      [7, 3, 2, 1],
      [5, 4, 3, 1],
      [6, 3, 3, 1],
      [13, 0, 0, 0],
    ] as const;
    for (const shape of unbalanced) {
      expect(isBalanced([...shape])).toBe(false);
    }
  });
});

describe("hand evaluator edge cases", () => {
  test("yarborough total points = 0 (0 HCP + 4-3-3-3 shape)", () => {
    const result = evaluateHand(HAND_YARBOROUGH);
    expect(result.hcp).toBe(0);
    expect(result.totalPoints).toBe(0);
  });

  test("13-0-0-0 total points = 28 (10 HCP + 18 distribution)", () => {
    const monosuit = hand(
      "SA", "SK", "SQ", "SJ", "ST",
      "S9", "S8", "S7", "S6", "S5",
      "S4", "S3", "S2",
    );
    const result = evaluateHand(monosuit);
    expect(result.hcp).toBe(10);
    expect(result.distribution.total).toBe(18);
    expect(result.totalPoints).toBe(28);
  });

  test("5-3-3-2 with 5-card minor is balanced", () => {
    // 5 diamonds, 3-3-2 in others
    const fiveMinor = hand(
      "SA", "SK", "S2",             // 3 spades
      "HK", "H5",                    // 2 hearts
      "DQ", "DJ", "D8", "D5", "D3", // 5 diamonds
      "CQ", "C5", "C2",             // 3 clubs
    );
    const shape = getSuitLength(fiveMinor);
    expect(isBalanced(shape)).toBe(true);
  });

  test("maximum HCP single hand = 37 (all honors except one Jack)", () => {
    // 4A(16) + 4K(12) + 4Q(8) + 1J(1) = 37
    const maxHand = hand(
      "SA", "SK", "SQ",
      "HA", "HK", "HQ",
      "DA", "DK", "DQ",
      "CA", "CK", "CQ",
      "SJ",
    );
    expect(calculateHcp(maxHand)).toBe(37);
  });
});

describe("deck HCP invariants", () => {
  test("total deck HCP equals 40", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    let totalHcp = 0;
    for (const c of deck) {
      totalHcp += HCP_VALUES[c.rank];
    }
    expect(totalHcp).toBe(40);
  });

  test("max single-suit HCP is 10 (A+K+Q+J)", () => {
    const suitHand = hand(
      "SA", "SK", "SQ", "SJ", // AKQJ of spades = 4+3+2+1 = 10
      "H2", "H3", "H4", "H5",
      "H6", "D2", "D3", "D4",
      "C2",
    );
    const spadesCards = getCardsInSuit(suitHand, Suit.Spades);
    let suitHcp = 0;
    for (const c of spadesCards) {
      suitHcp += HCP_VALUES[c.rank];
    }
    expect(suitHcp).toBe(10);
  });
});
