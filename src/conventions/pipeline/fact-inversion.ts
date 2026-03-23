/**
 * Fact composition inversion — derives SeatConstraint from FactComposition trees.
 *
 * `invertComposition()` computes the loosest SeatConstraint that includes any hand
 * satisfying the composition. Used by deal constraint derivation to convert
 * module-derived fact compositions into engine-level constraints.
 *
 * Inversion semantics:
 * - `primitive` → compile via the same logic as `compileFactClause()`
 * - `and` → intersect (tightest bounds: max of mins, min of maxes)
 * - `or` → union (loosest bounds: min of mins, max of maxes; suit lengths merge into minLengthAny)
 * - `not` → skipped (negation doesn't contribute useful constraints for deal generation)
 */

import type { Suit } from "../../engine/types";
import type { FactComposition, PrimitiveClause } from "../../core/contracts/fact-catalog";
import { SUIT_FACT_MAP } from "../core/runtime/fact-compiler";

// ── Result type ─────────────────────────────────────────────────────

/** Partial constraint extracted from a composition — mergeable with other constraints. */
export interface InvertedConstraint {
  minHcp?: number;
  maxHcp?: number;
  balanced?: boolean;
  /** AND-semantics: all suits must meet their minimum. */
  minLength?: Partial<Record<Suit, number>>;
  /** Maximum lengths per suit. */
  maxLength?: Partial<Record<Suit, number>>;
  /** OR-semantics: at least one suit meets its minimum. */
  minLengthAny?: Partial<Record<Suit, number>>;
}

// ── Core inversion ──────────────────────────────────────────────────

/** Invert a FactComposition into the loosest SeatConstraint that includes all satisfying hands. */
export function invertComposition(comp: FactComposition): InvertedConstraint {
  switch (comp.kind) {
    case "primitive":
      return invertPrimitive(comp.clause);
    case "and":
      return intersectAll(comp.operands.map(invertComposition));
    case "or":
      return unionAll(comp.operands.map(invertComposition));
    case "not":
      // Negation doesn't produce useful positive constraints for deal generation.
      // A negated fact means "exclude hands where X is true" — we can't express
      // that as a positive SeatConstraint efficiently. Return empty (unconstrained).
      return {};
  }
}

// ── Primitive inversion ─────────────────────────────────────────────

function invertPrimitive(clause: PrimitiveClause): InvertedConstraint {
  // HCP
  if (clause.factId === "hand.hcp") {
    return invertHcp(clause);
  }

  // Suit length
  const suit = SUIT_FACT_MAP[clause.factId];
  if (suit !== undefined) {
    return invertSuitLength(suit, clause);
  }

  // Balanced
  if (clause.factId === "hand.isBalanced" || clause.factId === "bridge.isBalanced") {
    return { balanced: true };
  }

  // Unknown primitive — return empty
  return {};
}

function invertHcp(clause: PrimitiveClause): InvertedConstraint {
  if (clause.operator === "range") {
    const range = clause.value as { min: number; max: number };
    return { minHcp: range.min, maxHcp: range.max };
  }
  const v = clause.value as number;
  switch (clause.operator) {
    case "gte": return { minHcp: v };
    case "lte": return { maxHcp: v };
    case "eq": return { minHcp: v, maxHcp: v };
  }
}

function invertSuitLength(suit: Suit, clause: PrimitiveClause): InvertedConstraint {
  if (clause.operator === "range") {
    const range = clause.value as { min: number; max: number };
    return {
      minLength: { [suit]: range.min },
      maxLength: { [suit]: range.max },
    };
  }
  const v = clause.value as number;
  switch (clause.operator) {
    case "gte": return { minLength: { [suit]: v } };
    case "lte": return { maxLength: { [suit]: v } };
    case "eq": return { minLength: { [suit]: v }, maxLength: { [suit]: v } };
  }
}

// ── Set operations ──────────────────────────────────────────────────

/** Intersect constraints (AND): take the tightest bounds. */
function intersectAll(constraints: InvertedConstraint[]): InvertedConstraint {
  if (constraints.length === 0) return {};
  if (constraints.length === 1) return constraints[0]!;

  const result: InvertedConstraint = {};

  for (const c of constraints) {
    // HCP: take tightest
    if (c.minHcp !== undefined) {
      result.minHcp = Math.max(result.minHcp ?? 0, c.minHcp);
    }
    if (c.maxHcp !== undefined) {
      result.maxHcp = Math.min(result.maxHcp ?? 37, c.maxHcp);
    }

    // Balanced
    if (c.balanced !== undefined) {
      result.balanced = c.balanced;
    }

    // MinLength (AND): take max of each suit
    if (c.minLength) {
      if (!result.minLength) result.minLength = {};
      for (const [suitKey, val] of Object.entries(c.minLength)) {
        const suit = suitKey as unknown as Suit;
        result.minLength[suit] = Math.max(result.minLength[suit] ?? 0, val);
      }
    }

    // MaxLength (AND): take min of each suit
    if (c.maxLength) {
      if (!result.maxLength) result.maxLength = {};
      for (const [suitKey, val] of Object.entries(c.maxLength)) {
        const suit = suitKey as unknown as Suit;
        result.maxLength[suit] = Math.min(result.maxLength[suit] ?? 13, val);
      }
    }

    // MinLengthAny (AND): intersecting OR-constraints is complex.
    // For AND(minLengthAny_A, minLengthAny_B), the hand must satisfy BOTH.
    // We keep them merged — the deal generator checks each separately.
    if (c.minLengthAny) {
      if (!result.minLengthAny) result.minLengthAny = {};
      for (const [suitKey, val] of Object.entries(c.minLengthAny)) {
        const suit = suitKey as unknown as Suit;
        result.minLengthAny[suit] = Math.max(result.minLengthAny[suit] ?? 0, val);
      }
    }
  }

  return result;
}

/** Union constraints (OR): take the loosest bounds. */
function unionAll(constraints: InvertedConstraint[]): InvertedConstraint {
  if (constraints.length === 0) return {};
  if (constraints.length === 1) return constraints[0]!;

  const result: InvertedConstraint = {};
  let anyHasMinHcp = false;
  let anyHasMaxHcp = false;

  for (const c of constraints) {
    // HCP: take loosest (min of mins, max of maxes)
    if (c.minHcp !== undefined) {
      result.minHcp = anyHasMinHcp
        ? Math.min(result.minHcp!, c.minHcp)
        : c.minHcp;
      anyHasMinHcp = true;
    }
    if (c.maxHcp !== undefined) {
      result.maxHcp = anyHasMaxHcp
        ? Math.max(result.maxHcp!, c.maxHcp)
        : c.maxHcp;
      anyHasMaxHcp = true;
    }

    // For OR, suit length constraints from different branches become OR (minLengthAny)
    if (c.minLength) {
      if (!result.minLengthAny) result.minLengthAny = {};
      for (const [suitKey, val] of Object.entries(c.minLength)) {
        const suit = suitKey as unknown as Suit;
        // Take the minimum across branches for each suit
        const existing = result.minLengthAny[suit];
        result.minLengthAny[suit] = existing !== undefined
          ? Math.min(existing, val)
          : val;
      }
    }

    if (c.minLengthAny) {
      if (!result.minLengthAny) result.minLengthAny = {};
      for (const [suitKey, val] of Object.entries(c.minLengthAny)) {
        const suit = suitKey as unknown as Suit;
        const existing = result.minLengthAny[suit];
        result.minLengthAny[suit] = existing !== undefined
          ? Math.min(existing, val)
          : val;
      }
    }
  }

  // If any branch had no minHcp, the union is unconstrained
  if (anyHasMinHcp && constraints.some(c => c.minHcp === undefined)) {
    delete result.minHcp;
  }
  if (anyHasMaxHcp && constraints.some(c => c.maxHcp === undefined)) {
    delete result.maxHcp;
  }

  return result;
}
