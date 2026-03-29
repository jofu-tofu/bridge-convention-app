import { describe, it, expect } from "vitest";
import { invertComposition } from "../facts/fact-inversion";
import type { FactComposition, PrimitiveClause } from "../../core/fact-catalog";
import { SUIT_FACT_MAP } from "../../core/runtime/fact-compiler";
import { Suit } from "../../../engine/types";

// ─── Factory helpers ────────────────────────────────────────────────

function makePrimitive(
  factId: string,
  operator: PrimitiveClause["operator"],
  value: PrimitiveClause["value"],
): FactComposition {
  return { kind: "primitive", clause: { factId, operator, value } };
}

function makeAnd(...operands: FactComposition[]): FactComposition {
  return { kind: "and", operands };
}

function makeOr(...operands: FactComposition[]): FactComposition {
  return { kind: "or", operands };
}

function makeNot(operand: FactComposition): FactComposition {
  return { kind: "not", operand };
}

/** Reverse lookup: Suit → factId string */
const suitToFactId = Object.fromEntries(
  Object.entries(SUIT_FACT_MAP).map(([id, suit]) => [suit, id]),
) as Record<Suit, string>;

// ─── invertHcp (via primitive dispatch) ─────────────────────────────

describe("invertComposition", () => {
  describe("HCP primitives", () => {
    it("range → minHcp + maxHcp", () => {
      const result = invertComposition(
        makePrimitive("hand.hcp", FactOperator.Range, { min: 15, max: 17 }),
      );
      expect(result).toEqual({ minHcp: 15, maxHcp: 17 });
    });

    it("gte → minHcp only", () => {
      const result = invertComposition(makePrimitive("hand.hcp", FactOperator.Gte, 12));
      expect(result).toEqual({ minHcp: 12 });
    });

    it("lte → maxHcp only", () => {
      const result = invertComposition(makePrimitive("hand.hcp", FactOperator.Lte, 9));
      expect(result).toEqual({ maxHcp: 9 });
    });

    it("eq → minHcp === maxHcp", () => {
      const result = invertComposition(makePrimitive("hand.hcp", FactOperator.Eq, 16));
      expect(result).toEqual({ minHcp: 16, maxHcp: 16 });
    });
  });

  // ─── invertSuitLength ───────────────────────────────────────────

  describe("suit length primitives", () => {
    it("gte → minLength for the suit", () => {
      const result = invertComposition(
        makePrimitive(suitToFactId[Suit.Spades], FactOperator.Gte, 5),
      );
      expect(result).toEqual({ minLength: { [Suit.Spades]: 5 } });
    });

    it("lte → maxLength for the suit", () => {
      const result = invertComposition(
        makePrimitive(suitToFactId[Suit.Hearts], FactOperator.Lte, 3),
      );
      expect(result).toEqual({ maxLength: { [Suit.Hearts]: 3 } });
    });

    it("eq → both minLength and maxLength", () => {
      const result = invertComposition(
        makePrimitive(suitToFactId[Suit.Diamonds], FactOperator.Eq, 4),
      );
      expect(result).toEqual({
        minLength: { [Suit.Diamonds]: 4 },
        maxLength: { [Suit.Diamonds]: 4 },
      });
    });

    it("range → minLength + maxLength", () => {
      const result = invertComposition(
        makePrimitive(suitToFactId[Suit.Clubs], FactOperator.Range, { min: 3, max: 5 }),
      );
      expect(result).toEqual({
        minLength: { [Suit.Clubs]: 3 },
        maxLength: { [Suit.Clubs]: 5 },
      });
    });
  });

  // ─── invertPrimitive: balanced ──────────────────────────────────

  describe("balanced primitives", () => {
    it("hand.isBalanced → balanced: true", () => {
      const result = invertComposition(
        makePrimitive("hand.isBalanced", FactOperator.Eq, 1),
      );
      expect(result).toEqual({ balanced: true });
    });

    it("bridge.isBalanced → balanced: true", () => {
      const result = invertComposition(
        makePrimitive("bridge.isBalanced", FactOperator.Eq, 1),
      );
      expect(result).toEqual({ balanced: true });
    });
  });

  // ─── unknown factId ─────────────────────────────────────────────

  describe("unknown primitive", () => {
    it("returns empty constraint", () => {
      const result = invertComposition(
        makePrimitive("hand.losers", FactOperator.Lte, 7),
      );
      expect(result).toEqual({});
    });
  });

  // ─── not composition ────────────────────────────────────────────

  describe("not composition", () => {
    it("returns empty constraint", () => {
      const result = invertComposition(
        makeNot(makePrimitive("hand.hcp", FactOperator.Gte, 10)),
      );
      expect(result).toEqual({});
    });
  });

  // ─── intersectAll (AND) ─────────────────────────────────────────

  describe("and composition", () => {
    it("empty operands → empty constraint", () => {
      expect(invertComposition(makeAnd())).toEqual({});
    });

    it("single operand → passthrough", () => {
      const result = invertComposition(
        makeAnd(makePrimitive("hand.hcp", FactOperator.Gte, 10)),
      );
      expect(result).toEqual({ minHcp: 10 });
    });

    it("tightens HCP bounds (max of mins, min of maxes)", () => {
      const result = invertComposition(
        makeAnd(
          makePrimitive("hand.hcp", FactOperator.Range, { min: 10, max: 20 }),
          makePrimitive("hand.hcp", FactOperator.Range, { min: 12, max: 17 }),
        ),
      );
      expect(result.minHcp).toBe(12);
      expect(result.maxHcp).toBe(17);
    });

    it("merges minLength per suit (takes max)", () => {
      const result = invertComposition(
        makeAnd(
          makePrimitive(suitToFactId[Suit.Spades], FactOperator.Gte, 4),
          makePrimitive(suitToFactId[Suit.Spades], FactOperator.Gte, 5),
          makePrimitive(suitToFactId[Suit.Hearts], FactOperator.Gte, 3),
        ),
      );
      expect(result.minLength).toEqual({
        [Suit.Spades]: 5,
        [Suit.Hearts]: 3,
      });
    });

    it("merges maxLength per suit (takes min)", () => {
      const result = invertComposition(
        makeAnd(
          makePrimitive(suitToFactId[Suit.Clubs], FactOperator.Lte, 5),
          makePrimitive(suitToFactId[Suit.Clubs], FactOperator.Lte, 3),
        ),
      );
      expect(result.maxLength).toEqual({ [Suit.Clubs]: 3 });
    });

    it("merges minLengthAny from nested OR", () => {
      // AND( OR(spades≥5, hearts≥5), hcp≥12 )
      const result = invertComposition(
        makeAnd(
          makeOr(
            makePrimitive(suitToFactId[Suit.Spades], FactOperator.Gte, 5),
            makePrimitive(suitToFactId[Suit.Hearts], FactOperator.Gte, 5),
          ),
          makePrimitive("hand.hcp", FactOperator.Gte, 12),
        ),
      );
      expect(result.minHcp).toBe(12);
      expect(result.minLengthAny).toEqual({
        [Suit.Spades]: 5,
        [Suit.Hearts]: 5,
      });
    });

    it("propagates balanced", () => {
      const result = invertComposition(
        makeAnd(
          makePrimitive("hand.isBalanced", FactOperator.Eq, 1),
          makePrimitive("hand.hcp", FactOperator.Range, { min: 15, max: 17 }),
        ),
      );
      expect(result.balanced).toBe(true);
      expect(result.minHcp).toBe(15);
      expect(result.maxHcp).toBe(17);
    });
  });

  // ─── unionAll (OR) ──────────────────────────────────────────────

  describe("or composition", () => {
    it("empty operands → empty constraint", () => {
      expect(invertComposition(makeOr())).toEqual({});
    });

    it("single operand → passthrough", () => {
      const result = invertComposition(
        makeOr(makePrimitive("hand.hcp", FactOperator.Gte, 10)),
      );
      expect(result).toEqual({ minHcp: 10 });
    });

    it("loosens HCP bounds (min of mins, max of maxes)", () => {
      const result = invertComposition(
        makeOr(
          makePrimitive("hand.hcp", FactOperator.Range, { min: 10, max: 15 }),
          makePrimitive("hand.hcp", FactOperator.Range, { min: 6, max: 20 }),
        ),
      );
      expect(result.minHcp).toBe(6);
      expect(result.maxHcp).toBe(20);
    });

    it("drops minHcp if any branch lacks it", () => {
      // One branch has hcp≥10, other branch is suit-only (no hcp)
      const result = invertComposition(
        makeOr(
          makePrimitive("hand.hcp", FactOperator.Gte, 10),
          makePrimitive(suitToFactId[Suit.Spades], FactOperator.Gte, 6),
        ),
      );
      expect(result.minHcp).toBeUndefined();
    });

    it("promotes minLength to minLengthAny in OR", () => {
      const result = invertComposition(
        makeOr(
          makePrimitive(suitToFactId[Suit.Spades], FactOperator.Gte, 5),
          makePrimitive(suitToFactId[Suit.Hearts], FactOperator.Gte, 5),
        ),
      );
      // In OR, per-suit minLength becomes minLengthAny
      expect(result.minLength).toBeUndefined();
      expect(result.minLengthAny).toEqual({
        [Suit.Spades]: 5,
        [Suit.Hearts]: 5,
      });
    });

    it("merges existing minLengthAny across branches", () => {
      // OR( AND(spades≥5|hearts≥4), clubs≥6 )
      // First branch produces minLengthAny from nested OR; second adds clubs
      const result = invertComposition(
        makeOr(
          makeOr(
            makePrimitive(suitToFactId[Suit.Spades], FactOperator.Gte, 5),
            makePrimitive(suitToFactId[Suit.Hearts], FactOperator.Gte, 4),
          ),
          makePrimitive(suitToFactId[Suit.Clubs], FactOperator.Gte, 6),
        ),
      );
      expect(result.minLengthAny).toEqual({
        [Suit.Spades]: 5,
        [Suit.Hearts]: 4,
        [Suit.Clubs]: 6,
      });
    });
  });
});
