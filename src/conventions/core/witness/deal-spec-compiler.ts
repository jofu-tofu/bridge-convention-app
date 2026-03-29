import type { Suit, Seat, DealConstraints, SeatConstraint } from "../../../engine/types";
import type {
  DealSpec,
  TeachingControls,
} from "../deal-spec-types";
import type { HandPredicate } from "../agreement-module";
import { resolveRole } from "../../pipeline/deal-spec-generator";
import { VULNERABILITY_MAP } from "../../pipeline/witness-constants";
import { compileFactClause, SUIT_FACT_MAP, type MutableSeatConstraint } from "../runtime/fact-compiler";
import { FactOperator } from "../../pipeline/evaluation/meaning";

/**
 * Extended DealConstraints that carries pedagogical metadata alongside
 * engine-consumable seat constraints.
 */
interface WitnessCompilationResult extends DealConstraints {
  readonly teachingControls?: TeachingControls;
}

// ─── Fact compilation delegated to shared fact-compiler.ts ────

function createBuilder(seat: Seat): MutableSeatConstraint {
  return { seat };
}

function applyPredicate(
  builder: MutableSeatConstraint,
  predicate: HandPredicate,
): void {
  const isAnyConjunction = predicate.conjunction === "any";

  for (const clause of predicate.clauses) {
    if (isAnyConjunction) {
      // For "any" conjunction with suit gte, use minLengthAny
      const suit = SUIT_FACT_MAP[clause.factId];
      if (suit !== undefined && clause.operator === FactOperator.Gte) {
        if (!builder.minLengthAny) builder.minLengthAny = {};
        builder.minLengthAny[suit] = clause.value as number;
        continue;
      }
    }
    compileFactClause(builder, clause.factId, clause.operator, clause.value);
  }
}

function builderToConstraint(builder: MutableSeatConstraint): SeatConstraint {
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
  if (builder.minLength && Object.keys(builder.minLength).length > 0) result.minLength = builder.minLength;
  if (builder.maxLength && Object.keys(builder.maxLength).length > 0) result.maxLength = builder.maxLength;
  if (builder.minLengthAny) result.minLengthAny = builder.minLengthAny;

  return result;
}

/**
 * Compile a DealSpec into DealConstraints for the engine's deal generator.
 *
 * Maps role-relative SeatRoles (self/partner/lho/rho) to compass Seats based
 * on the user's seat. Converts HandPredicate clauses into the engine's
 * SeatConstraint format (minHcp/maxHcp/balanced/minLength/maxLength/minLengthAny).
 *
 * Non-seat layers (public-guard, exclusion, joint) are skipped because they
 * cannot be represented in DealConstraints and are handled at higher layers.
 *
 * TeachingControls are passed through as metadata on the result.
 * @internal
 */
export function compileDealSpec(
  spec: DealSpec,
  userSeat: Seat,
): WitnessCompilationResult {
  const builders = new Map<Seat, MutableSeatConstraint>();

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
    ...(spec.setup?.vulnerability && { vulnerability: VULNERABILITY_MAP[spec.setup.vulnerability] }),
    ...(spec.setup?.dealerRole && { dealer: resolveRole(spec.setup.dealerRole, userSeat) }),
    ...(spec.teachingControls && { teachingControls: spec.teachingControls }),
  };

  return result;
}
