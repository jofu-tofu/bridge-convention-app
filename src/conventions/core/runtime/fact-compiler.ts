/**
 * Shared fact-to-constraint compiler.
 *
 * Compiles surface clauses (factId + operator + value) into engine-level
 * SeatConstraint fields. Used by both the coverage-spec-compiler (FSM
 * targeting) and the deal-spec-compiler (deal generation specs).
 *
 * Adding a new compilable fact type here automatically enables it in
 * both systems — no need to update two files.
 */

import { Suit } from "../../../engine/types";
import type { Seat } from "../../../engine/types";
import { FactOperator } from "../../pipeline/evaluation/meaning";

// ── Clause value type (union of all representable clause values) ─────

type ClauseValue =
  | number
  | boolean
  | string
  | { min: number; max: number }
  | readonly string[];

// ── Suit fact ID mapping (single source of truth) ───────────────────

export const SUIT_FACT_MAP: Readonly<Record<string, Suit>> = {
  "hand.suitLength.spades": Suit.Spades,
  "hand.suitLength.hearts": Suit.Hearts,
  "hand.suitLength.diamonds": Suit.Diamonds,
  "hand.suitLength.clubs": Suit.Clubs,
};

// ── Mutable builder for per-seat constraints ────────────────────────

export interface MutableSeatConstraint {
  seat: Seat;
  minHcp?: number;
  maxHcp?: number;
  balanced?: boolean;
  minLength?: Partial<Record<Suit, number>>;
  maxLength?: Partial<Record<Suit, number>>;
  minLengthAny?: Partial<Record<Suit, number>>;
}

// ── Options for compile behaviour ───────────────────────────────────

interface CompileFactOptions {
  /**
   * When `"any"`, suit-length `gte` constraints are routed to
   * `minLengthAny` instead of `minLength`. This corresponds to an
   * OR-conjunction ("at least one of these suits meets the minimum").
   *
   * Defaults to `"and"` (normal AND semantics via `minLength`).
   */
  suitLengthMode?: "and" | "any";
}

// ── Core compilation function ───────────────────────────────────────

/**
 * Compile a single fact clause into constraint mutations on a builder.
 *
 * Returns `true` if the clause was compiled, `false` if the factId is
 * unknown. Callers can use the return value for diagnostics.
 */
export function compileFactClause(
  builder: MutableSeatConstraint,
  factId: string,
  operator: string,
  value: ClauseValue,
  options?: CompileFactOptions,
): boolean {
  // ── HCP ─────────────────────────────────────────────────────
  if (factId === "hand.hcp") {
    applyHcpConstraint(builder, operator, value);
    return true;
  }

  // ── Suit length ─────────────────────────────────────────────
  const suit = SUIT_FACT_MAP[factId];
  if (suit !== undefined) {
    applySuitConstraint(builder, suit, operator, value, options);
    return true;
  }

  // ── Balanced ────────────────────────────────────────────────
  if (factId === "hand.isBalanced" || factId === "bridge.isBalanced") {
    if (operator === FactOperator.Boolean) {
      builder.balanced = value as boolean;
    }
    return true;
  }

  // ── Four-card major (OR: hearts 4+ OR spades 4+) ───────────
  if (factId === "bridge.hasFourCardMajor" && value === true) {
    if (!builder.minLengthAny) builder.minLengthAny = {};
    builder.minLengthAny[Suit.Hearts] = Math.max(builder.minLengthAny[Suit.Hearts] ?? 0, 4);
    builder.minLengthAny[Suit.Spades] = Math.max(builder.minLengthAny[Suit.Spades] ?? 0, 4);
    return true;
  }

  // ── Five-card major (OR: hearts 5+ OR spades 5+) ───────────
  if (factId === "bridge.hasFiveCardMajor" && value === true) {
    if (!builder.minLengthAny) builder.minLengthAny = {};
    builder.minLengthAny[Suit.Hearts] = Math.max(builder.minLengthAny[Suit.Hearts] ?? 0, 5);
    builder.minLengthAny[Suit.Spades] = Math.max(builder.minLengthAny[Suit.Spades] ?? 0, 5);
    return true;
  }

  // ── Unknown fact — not compilable ──────────────────────────
  return false;
}

// ── Internal helpers ────────────────────────────────────────────────

function applyHcpConstraint(
  builder: MutableSeatConstraint,
  operator: string,
  value: ClauseValue,
): void {
  switch (operator) {
    case FactOperator.Gte:
      builder.minHcp = Math.max(builder.minHcp ?? 0, value as number);
      break;
    case FactOperator.Lte:
      builder.maxHcp = Math.min(builder.maxHcp ?? 37, value as number);
      break;
    case FactOperator.Eq:
      builder.minHcp = value as number;
      builder.maxHcp = value as number;
      break;
    case FactOperator.Range: {
      const range = value as { min: number; max: number };
      builder.minHcp = Math.max(builder.minHcp ?? 0, range.min);
      builder.maxHcp = Math.min(builder.maxHcp ?? 37, range.max);
      break;
    }
  }
}

function applySuitConstraint(
  builder: MutableSeatConstraint,
  suit: Suit,
  operator: string,
  value: ClauseValue,
  options?: CompileFactOptions,
): void {
  const useAny = options?.suitLengthMode === "any";

  // For "any" mode, suit-length gte goes to minLengthAny
  if (useAny && operator === FactOperator.Gte) {
    if (!builder.minLengthAny) builder.minLengthAny = {};
    builder.minLengthAny[suit] = value as number;
    return;
  }

  switch (operator) {
    case FactOperator.Gte:
      if (!builder.minLength) builder.minLength = {};
      builder.minLength[suit] = Math.max(builder.minLength[suit] ?? 0, value as number);
      break;
    case FactOperator.Lte:
      if (!builder.maxLength) builder.maxLength = {};
      builder.maxLength[suit] = Math.min(builder.maxLength[suit] ?? 13, value as number);
      break;
    case FactOperator.Eq:
      if (!builder.minLength) builder.minLength = {};
      if (!builder.maxLength) builder.maxLength = {};
      builder.minLength[suit] = value as number;
      builder.maxLength[suit] = value as number;
      break;
    case FactOperator.Range: {
      const range = value as { min: number; max: number };
      if (!builder.minLength) builder.minLength = {};
      if (!builder.maxLength) builder.maxLength = {};
      builder.minLength[suit] = Math.max(builder.minLength[suit] ?? 0, range.min);
      builder.maxLength[suit] = Math.min(builder.maxLength[suit] ?? 13, range.max);
      break;
    }
  }
}
