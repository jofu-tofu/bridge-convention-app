import { describe, test, expect } from "vitest";
import { Suit, Seat, Vulnerability } from "../types";
import type { Card, Deal, DealConstraints } from "../types";
import { checkConstraints, generateDeal } from "../deal-generator";
import { calculateHcp } from "../hand-evaluator";
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

describe("checkConstraints maxLength", () => {
  test("maxLength constraint rejects hand with too many cards in suit", () => {
    // North has 4 spades in fixtureDeal
    const deal = fixtureDeal();
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, maxLength: { [Suit.Spades]: 3 } }],
    };
    expect(checkConstraints(deal, constraints)).toBe(false);
  });

  test("maxLength already enforced: opener with 5-card heart suit rejected when maxLength[Hearts]=4", () => {
    // South has 4 hearts in fixtureDeal
    const deal = fixtureDeal();
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.South, maxLength: { [Suit.Hearts]: 3 } }],
    };
    expect(checkConstraints(deal, constraints)).toBe(false);
  });
});

describe("checkConstraints minLengthAny", () => {
  test("minLengthAny passes when at least one suit meets minimum", () => {
    const deal = fixtureDeal();
    // South has 4 hearts — satisfies "4+ hearts OR 4+ spades"
    const constraints: DealConstraints = {
      seats: [{
        seat: Seat.South,
        minLengthAny: { [Suit.Hearts]: 4, [Suit.Spades]: 4 },
      }],
    };
    expect(checkConstraints(deal, constraints)).toBe(true);
  });

  test("minLengthAny rejects when no suit meets any minimum", () => {
    const deal = fixtureDeal();
    // North has 4-3-3-3, so no suit has 5+
    const constraints: DealConstraints = {
      seats: [{
        seat: Seat.North,
        minLengthAny: { [Suit.Hearts]: 5, [Suit.Spades]: 5 },
      }],
    };
    expect(checkConstraints(deal, constraints)).toBe(false);
  });

  test("minLengthAny with single suit entry works", () => {
    const deal = fixtureDeal();
    // North has 4 spades — "4+ in spades only" should pass
    const constraints: DealConstraints = {
      seats: [{
        seat: Seat.North,
        minLengthAny: { [Suit.Spades]: 4 },
      }],
    };
    expect(checkConstraints(deal, constraints)).toBe(true);
  });

  test("minLengthAny with single suit rejects when not met", () => {
    const deal = fixtureDeal();
    // North has 3 hearts — "4+ in hearts only" should fail
    const constraints: DealConstraints = {
      seats: [{
        seat: Seat.North,
        minLengthAny: { [Suit.Hearts]: 4 },
      }],
    };
    expect(checkConstraints(deal, constraints)).toBe(false);
  });
});

describe("checkConstraints customCheck", () => {
  test("customCheck is called and filters correctly", () => {
    const deal = fixtureDeal();
    // North has 21 HCP — custom check requires < 20
    const constraints: DealConstraints = {
      seats: [{
        seat: Seat.North,
        customCheck: (h) => calculateHcp(h) < 20,
      }],
    };
    expect(checkConstraints(deal, constraints)).toBe(false);
  });

  test("customCheck passes when predicate returns true", () => {
    const deal = fixtureDeal();
    const constraints: DealConstraints = {
      seats: [{
        seat: Seat.North,
        customCheck: (h) => calculateHcp(h) > 20,
      }],
    };
    expect(checkConstraints(deal, constraints)).toBe(true);
  });

  test("customCheck only runs when standard checks pass", () => {
    let customCheckCalled = false;
    const deal = fixtureDeal();
    // minHcp 30 will fail before customCheck runs (North has 21)
    const constraints: DealConstraints = {
      seats: [{
        seat: Seat.North,
        minHcp: 30,
        customCheck: () => {
          customCheckCalled = true;
          return true;
        },
      }],
    };
    expect(checkConstraints(deal, constraints)).toBe(false);
    expect(customCheckCalled).toBe(false);
  });

  test("customCheck that throws is treated as rejection", () => {
    const deal = fixtureDeal();
    const constraints: DealConstraints = {
      seats: [{
        seat: Seat.North,
        customCheck: () => {
          throw new Error("boom");
        },
      }],
    };
    // Should not crash, just reject the deal
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

  test("throws after maxAttempts exhausted", () => {
    // Impossible constraint with low maxAttempts
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, minHcp: 38 }],
      maxAttempts: 10,
    };
    expect(() => generateDeal(constraints)).toThrow(/10 attempts/);
  });

  test("respects custom maxAttempts value", () => {
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, minHcp: 38 }],
      maxAttempts: 5,
    };
    expect(() => generateDeal(constraints)).toThrow(/5 attempts/);
  });

  test("default maxAttempts is 10000", () => {
    // This test verifies the error message mentions 10000
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, minHcp: 38 }],
    };
    expect(() => generateDeal(constraints)).toThrow(/10000 attempts/);
  });

  test("returns iteration metadata", () => {
    const result = generateDeal({ seats: [] });
    expect(result.iterations).toBeGreaterThanOrEqual(1);
    expect(result.relaxationSteps).toBe(0);
  });

  test("relaxationSteps always 0", () => {
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, minHcp: 12 }],
    };
    const result = generateDeal(constraints);
    expect(result.relaxationSteps).toBe(0);
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

  test("generates deal satisfying exact HCP constraints (no relaxation)", () => {
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, minHcp: 15, maxHcp: 17 }],
    };
    for (let i = 0; i < 20; i++) {
      const result = generateDeal(constraints);
      const hcp = calculateHcp(result.deal.hands[Seat.North]);
      expect(hcp).toBeGreaterThanOrEqual(15);
      expect(hcp).toBeLessThanOrEqual(17);
      expect(result.relaxationSteps).toBe(0);
    }
  });

  test("Stayman-like constraints succeed reliably", () => {
    // 15-17 balanced opener + 8+ HCP responder with 4-card major
    const constraints: DealConstraints = {
      seats: [
        {
          seat: Seat.North,
          minHcp: 15,
          maxHcp: 17,
          balanced: true,
          maxLength: { [Suit.Hearts]: 4, [Suit.Spades]: 4 },
        },
        {
          seat: Seat.South,
          minHcp: 8,
          minLengthAny: { [Suit.Hearts]: 4, [Suit.Spades]: 4 },
        },
      ],
    };
    for (let i = 0; i < 10; i++) {
      const result = generateDeal(constraints);
      expect(checkConstraints(result.deal, constraints)).toBe(true);
    }
  });
});

describe("generateDeal benchmark", () => {
  test("100 Stayman-constrained deals with mean < 500 attempts", () => {
    const constraints: DealConstraints = {
      seats: [
        {
          seat: Seat.North,
          minHcp: 15,
          maxHcp: 17,
          balanced: true,
          maxLength: { [Suit.Hearts]: 4, [Suit.Spades]: 4 },
        },
        {
          seat: Seat.South,
          minHcp: 8,
          minLengthAny: { [Suit.Hearts]: 4, [Suit.Spades]: 4 },
        },
      ],
    };
    let totalIterations = 0;
    let maxIterations = 0;
    for (let i = 0; i < 100; i++) {
      const result = generateDeal(constraints);
      totalIterations += result.iterations;
      maxIterations = Math.max(maxIterations, result.iterations);
      expect(checkConstraints(result.deal, constraints)).toBe(true);
    }
    const meanIterations = totalIterations / 100;
    expect(meanIterations).toBeLessThan(500);
    expect(maxIterations).toBeLessThan(5000);
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
