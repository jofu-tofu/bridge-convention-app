import { Seat, Suit, Vulnerability } from "../../../engine/types";
import type {
  DealConstraints,
  SeatConstraint,
} from "../../../engine/types";
import type {
  WitnessSpecIR,
  SeatRole,
  PedagogicalControls,
} from "../../../core/contracts/witness-spec";
import type { HandPredicateIR } from "../../../core/contracts/predicate-surfaces";

/**
 * Extended DealConstraints that carries pedagogical metadata alongside
 * engine-consumable seat constraints.
 */
interface WitnessCompilationResult extends DealConstraints {
  readonly pedagogicalControls?: PedagogicalControls;
}

// ─── Seat ordering for rotation ───────────────────────────────
// Clockwise: N -> E -> S -> W -> N
const SEAT_ORDER: readonly Seat[] = [Seat.North, Seat.East, Seat.South, Seat.West];

/**
 * Resolve a role-relative SeatRole to a compass Seat based on the user's seat.
 *
 * The mapping is:
 *   self      -> userSeat
 *   partner   -> opposite seat
 *   lho       -> seat to the left of user
 *   rho       -> seat to the right of user
 *   openingSide -> userSeat (convention: user's side is the opening side)
 */
function resolveRole(role: SeatRole, userSeat: Seat): Seat {
  const userIndex = SEAT_ORDER.indexOf(userSeat);
  switch (role) {
    case "self":
      return userSeat;
    case "partner":
      return SEAT_ORDER[(userIndex + 2) % 4]!;
    case "lho":
      return SEAT_ORDER[(userIndex + 1) % 4]!;
    case "rho":
      return SEAT_ORDER[(userIndex + 3) % 4]!;
    case "openingSide":
      return userSeat;
  }
}

// ─── Fact ID to suit mapping ──────────────────────────────────
const SUIT_FACT_MAP: Readonly<Record<string, Suit>> = {
  "hand.suitLength.spades": Suit.Spades,
  "hand.suitLength.hearts": Suit.Hearts,
  "hand.suitLength.diamonds": Suit.Diamonds,
  "hand.suitLength.clubs": Suit.Clubs,
};

function extractSuit(factId: string): Suit | undefined {
  return SUIT_FACT_MAP[factId];
}

// ─── Vulnerability mapping ────────────────────────────────────
const VULN_MAP: Readonly<Record<string, Vulnerability>> = {
  none: Vulnerability.None,
  ns: Vulnerability.NorthSouth,
  ew: Vulnerability.EastWest,
  both: Vulnerability.Both,
};

// ─── Mutable builder for accumulating per-seat constraints ────
interface SeatConstraintBuilder {
  seat: Seat;
  minHcp?: number;
  maxHcp?: number;
  balanced?: boolean;
  minLength: Partial<Record<Suit, number>>;
  maxLength: Partial<Record<Suit, number>>;
  minLengthAny?: Partial<Record<Suit, number>>;
}

function createBuilder(seat: Seat): SeatConstraintBuilder {
  return { seat, minLength: {}, maxLength: {} };
}

function applyHcpClause(
  builder: SeatConstraintBuilder,
  operator: string,
  value: number | boolean | string | { min: number; max: number } | readonly string[],
): void {
  switch (operator) {
    case "gte":
      builder.minHcp = Math.max(builder.minHcp ?? 0, value as number);
      break;
    case "lte":
      builder.maxHcp = Math.min(builder.maxHcp ?? 37, value as number);
      break;
    case "eq":
      builder.minHcp = value as number;
      builder.maxHcp = value as number;
      break;
    case "range": {
      const range = value as { min: number; max: number };
      builder.minHcp = Math.max(builder.minHcp ?? 0, range.min);
      builder.maxHcp = Math.min(builder.maxHcp ?? 37, range.max);
      break;
    }
  }
}

function applySuitClause(
  builder: SeatConstraintBuilder,
  suit: Suit,
  operator: string,
  value: number | boolean | string | { min: number; max: number } | readonly string[],
  isAnyConjunction: boolean,
): void {
  if (isAnyConjunction && operator === "gte") {
    // For "any" conjunction, suit length gte becomes minLengthAny
    if (!builder.minLengthAny) {
      builder.minLengthAny = {};
    }
    builder.minLengthAny[suit] = value as number;
    return;
  }

  switch (operator) {
    case "gte":
      builder.minLength[suit] = Math.max(
        builder.minLength[suit] ?? 0,
        value as number,
      );
      break;
    case "lte":
      builder.maxLength[suit] = Math.min(
        builder.maxLength[suit] ?? 13,
        value as number,
      );
      break;
    case "eq":
      builder.minLength[suit] = value as number;
      builder.maxLength[suit] = value as number;
      break;
    case "range": {
      const range = value as { min: number; max: number };
      builder.minLength[suit] = Math.max(
        builder.minLength[suit] ?? 0,
        range.min,
      );
      builder.maxLength[suit] = Math.min(
        builder.maxLength[suit] ?? 13,
        range.max,
      );
      break;
    }
  }
}

function applyPredicate(
  builder: SeatConstraintBuilder,
  predicate: HandPredicateIR,
): void {
  const isAnyConjunction = predicate.conjunction === "any";

  for (const clause of predicate.clauses) {
    if (clause.factId === "hand.hcp") {
      applyHcpClause(builder, clause.operator, clause.value);
      continue;
    }

    if (clause.factId === "hand.isBalanced") {
      if (clause.operator === "boolean") {
        builder.balanced = clause.value as boolean;
      }
      continue;
    }

    const suit = extractSuit(clause.factId);
    if (suit) {
      applySuitClause(builder, suit, clause.operator, clause.value, isAnyConjunction);
    }
    // Unknown factIds are silently ignored — they may be bridge-derived
    // or module-derived facts not representable in DealConstraints.
  }
}

function builderToConstraint(builder: SeatConstraintBuilder): SeatConstraint {
  const result: {
    seat: Seat;
    minHcp?: number;
    maxHcp?: number;
    balanced?: boolean;
    minLength?: Partial<Record<Suit, number>>;
    maxLength?: Partial<Record<Suit, number>>;
    minLengthAny?: Partial<Record<Suit, number>>;
  } = { seat: builder.seat };

  if (builder.minHcp !== undefined) result.minHcp = builder.minHcp;
  if (builder.maxHcp !== undefined) result.maxHcp = builder.maxHcp;
  if (builder.balanced !== undefined) result.balanced = builder.balanced;
  if (Object.keys(builder.minLength).length > 0) result.minLength = builder.minLength;
  if (Object.keys(builder.maxLength).length > 0) result.maxLength = builder.maxLength;
  if (builder.minLengthAny) result.minLengthAny = builder.minLengthAny;

  return result;
}

/**
 * Compile a WitnessSpecIR into DealConstraints for the engine's deal generator.
 *
 * Maps role-relative SeatRoles (self/partner/lho/rho) to compass Seats based
 * on the user's seat. Converts HandPredicateIR clauses into the engine's
 * SeatConstraint format (minHcp/maxHcp/balanced/minLength/maxLength/minLengthAny).
 *
 * Non-seat layers (public-guard, exclusion, joint) are skipped because they
 * cannot be represented in DealConstraints and are handled at higher layers.
 *
 * PedagogicalControls are passed through as metadata on the result.
 * @internal
 */
export function compileWitnessSpec(
  spec: WitnessSpecIR,
  userSeat: Seat,
): WitnessCompilationResult {
  const builders = new Map<Seat, SeatConstraintBuilder>();

  for (const layer of spec.layers) {
    if (layer.kind !== "seat") {
      // public-guard, exclusion, and joint layers are not representable
      // in DealConstraints. They are handled at higher layers.
      continue;
    }

    const seat = resolveRole(layer.role, userSeat);
    let builder = builders.get(seat);
    if (!builder) {
      builder = createBuilder(seat);
      builders.set(seat, builder);
    }

    applyPredicate(builder, layer.predicate);
  }

  const seats = Array.from(builders.values()).map(builderToConstraint);

  const result: WitnessCompilationResult = {
    seats,
    ...(spec.maxAttempts !== undefined && { maxAttempts: spec.maxAttempts }),
    ...(spec.setup?.vulnerability && { vulnerability: VULN_MAP[spec.setup.vulnerability] }),
    ...(spec.setup?.dealerRole && { dealer: resolveRole(spec.setup.dealerRole, userSeat) }),
    ...(spec.pedagogicalControls && { pedagogicalControls: spec.pedagogicalControls }),
  };

  return result;
}
