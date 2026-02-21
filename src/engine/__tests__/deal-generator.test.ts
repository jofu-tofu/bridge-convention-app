import { describe, test, expect } from "vitest";
import { Suit, Seat, Vulnerability } from "../types";
import type { Card, Deal, DealConstraints } from "../types";
import { checkConstraints, generateDeal, relaxConstraints } from "../deal-generator";
import { calculateHcp } from "../hand-evaluator";
import { HCP_VALUES } from "../constants";
import { hand } from "./fixtures";

// Fixture deal with known properties
function fixtureDeal(): Deal {
  return {
    hands: {
      [Seat.North]: hand(
        "SA",
        "SK",
        "SQ",
        "SJ", // 10 HCP spades
        "HA",
        "HK",
        "H3", // 7 HCP
        "DA",
        "D3",
        "D2", // 4 HCP
        "C3",
        "C2",
        "C4", // 0 HCP
      ), // 21 HCP, 4-3-3-3 balanced
      [Seat.East]: hand(
        "S2",
        "S3",
        "S4",
        "S5",
        "H2",
        "H4",
        "H5",
        "D4",
        "D5",
        "D6",
        "C5",
        "C6",
        "C7",
      ), // 0 HCP
      [Seat.South]: hand(
        "S6",
        "S7",
        "S8",
        "HQ",
        "HJ",
        "HT",
        "H6",
        "DK",
        "DQ",
        "DJ",
        "CK",
        "CQ",
        "CJ",
      ), // 15 HCP, 3-4-3-3
      [Seat.West]: hand(
        "S9",
        "ST",
        "H7",
        "H8",
        "H9",
        "D7",
        "D8",
        "D9",
        "DT",
        "CA",
        "C8",
        "C9",
        "CT",
      ), // 4 HCP, 2-3-4-4
    },
    dealer: Seat.North,
    vulnerability: Vulnerability.None,
  };
}

describe("checkConstraints", () => {
  test("empty constraints match any deal", () => {
    const deal = fixtureDeal();
    const constraints: DealConstraints = { seats: [] };
    expect(checkConstraints(deal, constraints)).toBe(true);
  });

  test("minHcp rejects below threshold", () => {
    const deal = fixtureDeal();
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.East, minHcp: 10 }],
    };
    expect(checkConstraints(deal, constraints)).toBe(false);
  });

  test("minHcp accepts at threshold", () => {
    const deal = fixtureDeal();
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, minHcp: 21 }],
    };
    expect(checkConstraints(deal, constraints)).toBe(true);
  });

  test("maxHcp rejects above threshold", () => {
    const deal = fixtureDeal();
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, maxHcp: 15 }],
    };
    expect(checkConstraints(deal, constraints)).toBe(false);
  });

  test("maxHcp accepts at threshold", () => {
    const deal = fixtureDeal();
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, maxHcp: 21 }],
    };
    expect(checkConstraints(deal, constraints)).toBe(true);
  });

  test("balanced constraint accepts balanced hand", () => {
    const deal = fixtureDeal();
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, balanced: true }],
    };
    expect(checkConstraints(deal, constraints)).toBe(true);
  });

  test("balanced constraint rejects unbalanced hand", () => {
    // All 4 hands use 52 unique cards — North is 6-4-2-1 unbalanced
    const unbalDeal: Deal = {
      hands: {
        [Seat.North]: hand(
          "SA",
          "SK",
          "SQ",
          "SJ",
          "S9",
          "S8", // 6 spades
          "HA",
          "HK",
          "HQ",
          "HJ", // 4 hearts
          "DA",
          "D2", // 2 diamonds
          "CA", // 1 club
        ),
        [Seat.East]: hand(
          "S2",
          "S3",
          "S4",
          "S5",
          "H2",
          "H4",
          "H5",
          "H6",
          "D4",
          "D5",
          "D6",
          "D7",
          "C5",
        ),
        [Seat.South]: hand(
          "S6",
          "S7",
          "ST",
          "HT",
          "H3",
          "H9",
          "DK",
          "DQ",
          "DJ",
          "CK",
          "CQ",
          "CJ",
          "CT",
        ),
        [Seat.West]: hand(
          "C2",
          "C3",
          "C4",
          "C6",
          "C7",
          "C8",
          "C9",
          "D3",
          "D8",
          "D9",
          "DT",
          "H7",
          "H8",
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

  test("minLength constraint accepts when met", () => {
    const deal = fixtureDeal();
    // North has 4 spades
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, minLength: { [Suit.Spades]: 4 } }],
    };
    expect(checkConstraints(deal, constraints)).toBe(true);
  });

  test("minLength constraint rejects when not met", () => {
    const deal = fixtureDeal();
    // North has 4 spades, not 5
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, minLength: { [Suit.Spades]: 5 } }],
    };
    expect(checkConstraints(deal, constraints)).toBe(false);
  });

  test("multiple constraints on same seat use AND logic", () => {
    const deal = fixtureDeal();
    // North: 21 HCP, balanced — both must be true
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, minHcp: 15, maxHcp: 25, balanced: true }],
    };
    expect(checkConstraints(deal, constraints)).toBe(true);
  });

  test("fails if any one constraint is not met", () => {
    const deal = fixtureDeal();
    // North: 21 HCP, balanced — but maxHcp 15 fails
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, minHcp: 15, maxHcp: 15, balanced: true }],
    };
    expect(checkConstraints(deal, constraints)).toBe(false);
  });
});

describe("generateDeal", () => {
  test("unconstrained deal has 52 unique cards", () => {
    const result = generateDeal({ seats: [] });
    const allCards: Card[] = [];
    for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
      allCards.push(...result.deal.hands[seat].cards);
    }
    expect(allCards).toHaveLength(52);
    const keys = allCards.map((c) => `${c.suit}${c.rank}`);
    expect(new Set(keys).size).toBe(52);
  });

  test("each hand has 13 cards", () => {
    const result = generateDeal({ seats: [] });
    for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
      expect(result.deal.hands[seat].cards).toHaveLength(13);
    }
  });

  test("50 deals with minHcp=12 for North all satisfy", () => {
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, minHcp: 12 }],
    };
    for (let i = 0; i < 50; i++) {
      const result = generateDeal(constraints);
      expect(checkConstraints(result.deal, constraints)).toBe(true);
    }
  });

  test("50 deals with balanced=true for North all satisfy", () => {
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, balanced: true }],
    };
    for (let i = 0; i < 50; i++) {
      const result = generateDeal(constraints);
      expect(checkConstraints(result.deal, constraints)).toBe(true);
    }
  });

  test("impossible constraint throws", () => {
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, minHcp: 38 }],
    };
    expect(() => generateDeal(constraints)).toThrow();
  });

  test("returns iteration metadata", () => {
    const result = generateDeal({ seats: [] });
    expect(result.iterations).toBeGreaterThanOrEqual(1);
    expect(result.relaxationSteps).toBeGreaterThanOrEqual(0);
  });

  test("respects dealer constraint", () => {
    const result = generateDeal({ seats: [], dealer: Seat.East });
    expect(result.deal.dealer).toBe(Seat.East);
  });

  test("respects vulnerability constraint", () => {
    const result = generateDeal({
      seats: [],
      vulnerability: Vulnerability.Both,
    });
    expect(result.deal.vulnerability).toBe("Both");
  });

  test("every generated deal has exactly 40 total HCP", () => {
    for (let i = 0; i < 20; i++) {
      const result = generateDeal({ seats: [] });
      let totalHcp = 0;
      for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
        totalHcp += calculateHcp(result.deal.hands[seat]);
      }
      expect(totalHcp).toBe(40);
    }
  });

  test("no card appears in more than one hand", () => {
    for (let i = 0; i < 10; i++) {
      const result = generateDeal({ seats: [] });
      const allCards: Card[] = [];
      for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
        allCards.push(...result.deal.hands[seat].cards);
      }
      expect(allCards).toHaveLength(52);
      const keys = allCards.map((c) => `${c.suit}${c.rank}`);
      expect(new Set(keys).size).toBe(52);
    }
  });
});

describe("checkConstraints maxLength", () => {
  test("maxLength constraint rejects hand with too many cards in suit", () => {
    // North has 4 spades in fixtureDeal
    const deal = fixtureDeal();
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, maxLength: { [Suit.Spades]: 3 } }],
    };
    expect(checkConstraints(deal, constraints)).toBe(false);
  });
});

describe("multi-seat constraints", () => {
  test("multi-seat constraints both enforced", () => {
    const constraints: DealConstraints = {
      seats: [
        { seat: Seat.North, minHcp: 15, balanced: true },
        { seat: Seat.South, minHcp: 8 },
      ],
    };
    for (let i = 0; i < 20; i++) {
      const result = generateDeal(constraints);
      expect(checkConstraints(result.deal, constraints)).toBe(true);
    }
  });
});

describe("relaxConstraints", () => {
  test("widens minHcp by step amount", () => {
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, minHcp: 15 }],
    };
    const relaxed = relaxConstraints(constraints, 3);
    expect(relaxed.seats[0]!.minHcp).toBe(12);
  });

  test("widens maxHcp by step amount", () => {
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, maxHcp: 17 }],
    };
    const relaxed = relaxConstraints(constraints, 2);
    expect(relaxed.seats[0]!.maxHcp).toBe(19);
  });

  test("minHcp does not go below 0", () => {
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, minHcp: 2 }],
    };
    const relaxed = relaxConstraints(constraints, 5);
    expect(relaxed.seats[0]!.minHcp).toBe(0);
  });

  test("maxHcp does not exceed 37", () => {
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, maxHcp: 35 }],
    };
    const relaxed = relaxConstraints(constraints, 5);
    expect(relaxed.seats[0]!.maxHcp).toBe(37);
  });

  test("preserves shape constraints unchanged", () => {
    const constraints: DealConstraints = {
      seats: [{
        seat: Seat.North,
        minHcp: 15,
        balanced: true,
        minLength: { [Suit.Spades]: 5 },
      }],
    };
    const relaxed = relaxConstraints(constraints, 3);
    expect(relaxed.seats[0]!.balanced).toBe(true);
    expect(relaxed.seats[0]!.minLength).toEqual({ [Suit.Spades]: 5 });
    expect(relaxed.seats[0]!.minHcp).toBe(12);
  });

  test("leaves undefined HCP fields as undefined", () => {
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, balanced: true }],
    };
    const relaxed = relaxConstraints(constraints, 3);
    expect(relaxed.seats[0]!.minHcp).toBeUndefined();
    expect(relaxed.seats[0]!.maxHcp).toBeUndefined();
  });
});

describe("seeded RNG", () => {
  /** Simple seeded PRNG (mulberry32) for deterministic tests. */
  function createSeededRng(seed: number): () => number {
    let s = seed | 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  test("same seed produces identical deals", () => {
    const rng1 = createSeededRng(42);
    const rng2 = createSeededRng(42);
    const deal1 = generateDeal({ seats: [] }, rng1);
    const deal2 = generateDeal({ seats: [] }, rng2);
    expect(deal1.deal).toEqual(deal2.deal);
  });

  test("different seeds produce different deals", () => {
    const rng1 = createSeededRng(42);
    const rng2 = createSeededRng(999);
    const deal1 = generateDeal({ seats: [] }, rng1);
    const deal2 = generateDeal({ seats: [] }, rng2);
    const cards1 = deal1.deal.hands[Seat.North].cards.map((c) => `${c.suit}${c.rank}`);
    const cards2 = deal2.deal.hands[Seat.North].cards.map((c) => `${c.suit}${c.rank}`);
    expect(cards1).not.toEqual(cards2);
  });

  test("seeded deal with constraints still satisfies them", () => {
    const rng = createSeededRng(123);
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, minHcp: 12 }],
    };
    const result = generateDeal(constraints, rng);
    expect(checkConstraints(result.deal, constraints)).toBe(true);
  });
});
