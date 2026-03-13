import { describe, it, expect, vi } from "vitest";
import { evaluateDealConstraint } from "../deal-constraint-evaluator";
import { Seat, Suit, Rank, Vulnerability } from "../../../../engine/types";
import type { Deal, Hand, Card } from "../../../../engine/types";
import type { DealConstraintIR } from "../../../../core/contracts/predicate-surfaces";

// ─── Test helpers ──────────────────────────────────────────

function makeCard(suit: Suit, rank: Rank): Card {
  return { suit, rank };
}

function makeHand(cards: Card[]): Hand {
  return { cards };
}

/**
 * Build a minimal deal. Each hand is described by suits:
 * { S: Rank[], H: Rank[], D: Rank[], C: Rank[] }
 */
function makeDeal(hands: Record<Seat, Record<string, Rank[]>>): Deal {
  const suitMap: Record<string, Suit> = {
    S: Suit.Spades,
    H: Suit.Hearts,
    D: Suit.Diamonds,
    C: Suit.Clubs,
  };
  const built = {} as Record<Seat, Hand>;
  for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
    const cards: Card[] = [];
    for (const [s, ranks] of Object.entries(hands[seat])) {
      for (const r of ranks) {
        cards.push(makeCard(suitMap[s]!, r));
      }
    }
    built[seat] = makeHand(cards);
  }
  return { hands: built, dealer: Seat.North, vulnerability: Vulnerability.None };
}

// North: AKQ2 of spades, South: JT98 of spades → combined 8 spades
// East/West: fill remaining spades
const testDeal = makeDeal({
  [Seat.North]: {
    S: [Rank.Ace, Rank.King, Rank.Queen, Rank.Two],
    H: [Rank.Ace, Rank.King, Rank.Queen],
    D: [Rank.Ace, Rank.King, Rank.Queen],
    C: [Rank.Ace, Rank.King, Rank.Queen],
  },
  [Seat.South]: {
    S: [Rank.Jack, Rank.Ten, Rank.Nine, Rank.Eight],
    H: [Rank.Jack, Rank.Ten, Rank.Nine],
    D: [Rank.Jack, Rank.Ten, Rank.Nine],
    C: [Rank.Jack, Rank.Ten, Rank.Nine],
  },
  [Seat.East]: {
    S: [Rank.Seven, Rank.Six, Rank.Five],
    H: [Rank.Eight, Rank.Seven, Rank.Six, Rank.Five],
    D: [Rank.Eight, Rank.Seven, Rank.Six],
    C: [Rank.Eight, Rank.Seven, Rank.Six],
  },
  [Seat.West]: {
    S: [Rank.Four, Rank.Three],
    H: [Rank.Four, Rank.Three, Rank.Two],
    D: [Rank.Four, Rank.Three, Rank.Two],
    C: [Rank.Four, Rank.Three, Rank.Two],
  },
});

// ─── fit-check ─────────────────────────────────────────────

describe("evaluateDealConstraint", () => {
  describe("fit-check", () => {
    it("returns true when combined suit length meets threshold", () => {
      const constraint: DealConstraintIR = {
        kind: "fit-check",
        params: { suit: "S", seats: ["N", "S"], minLength: 8 },
      };
      expect(evaluateDealConstraint(constraint, testDeal)).toBe(true);
    });

    it("returns false when combined suit length is below threshold", () => {
      const constraint: DealConstraintIR = {
        kind: "fit-check",
        params: { suit: "S", seats: ["N", "S"], minLength: 9 },
      };
      expect(evaluateDealConstraint(constraint, testDeal)).toBe(false);
    });

    it("works with a single seat", () => {
      const constraint: DealConstraintIR = {
        kind: "fit-check",
        params: { suit: "S", seats: ["N"], minLength: 4 },
      };
      expect(evaluateDealConstraint(constraint, testDeal)).toBe(true);
    });

    it("returns false for single seat below threshold", () => {
      const constraint: DealConstraintIR = {
        kind: "fit-check",
        params: { suit: "S", seats: ["N"], minLength: 5 },
      };
      expect(evaluateDealConstraint(constraint, testDeal)).toBe(false);
    });

    it("checks hearts across E-W", () => {
      // East has 4 hearts, West has 3 hearts = 7 total
      const constraint: DealConstraintIR = {
        kind: "fit-check",
        params: { suit: "H", seats: ["E", "W"], minLength: 7 },
      };
      expect(evaluateDealConstraint(constraint, testDeal)).toBe(true);
    });
  });

  // ─── combined-hcp ──────────────────────────────────────────

  describe("combined-hcp", () => {
    it("returns true when combined HCP is in range", () => {
      // North has A K Q in each of 4 suits = 4*9 = 36... wait
      // North: SAKQ2 HAKQ DAKQ CAKQ → 3*3 + 3*3 + 3*3 + 3*3 + nothing for 2 = 9+9+9+9 = 36
      // Actually: A=4,K=3,Q=2 → per suit with AKQ = 9. 4 suits × 9 = 36. Plus the 2 is 0. = 36 HCP
      // South: J=1,T=0 per suit → 4 suits × 1 = 4 HCP
      // Combined N+S = 40 HCP
      const constraint: DealConstraintIR = {
        kind: "combined-hcp",
        params: { seats: ["N", "S"], min: 30, max: 40 },
      };
      expect(evaluateDealConstraint(constraint, testDeal)).toBe(true);
    });

    it("returns false when combined HCP is below minimum", () => {
      const constraint: DealConstraintIR = {
        kind: "combined-hcp",
        params: { seats: ["E", "W"], min: 10, max: 40 },
      };
      // East: 8,7,6,5 across suits → 0 HCP each. West: 4,3,2 → 0 HCP each.
      // Total E+W = 0
      expect(evaluateDealConstraint(constraint, testDeal)).toBe(false);
    });

    it("returns false when combined HCP exceeds maximum", () => {
      const constraint: DealConstraintIR = {
        kind: "combined-hcp",
        params: { seats: ["N", "S"], min: 0, max: 35 },
      };
      // N+S = 40 > 35
      expect(evaluateDealConstraint(constraint, testDeal)).toBe(false);
    });

    it("works with a single seat", () => {
      const constraint: DealConstraintIR = {
        kind: "combined-hcp",
        params: { seats: ["N"], min: 36, max: 36 },
      };
      expect(evaluateDealConstraint(constraint, testDeal)).toBe(true);
    });
  });

  // ─── custom ────────────────────────────────────────────────

  describe("custom", () => {
    it("returns true with a warning for custom constraints", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const constraint: DealConstraintIR = {
        kind: "custom",
        params: { label: "some-exotic-check" },
      };
      expect(evaluateDealConstraint(constraint, testDeal)).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("custom"),
      );
      consoleSpy.mockRestore();
    });
  });

  // ─── unknown kind ──────────────────────────────────────────

  describe("unknown kind", () => {
    it("throws for an unrecognized constraint kind", () => {
      const constraint = {
        kind: "unknown-kind" as DealConstraintIR["kind"],
        params: {},
      };
      expect(() => evaluateDealConstraint(constraint, testDeal)).toThrow();
    });
  });
});
