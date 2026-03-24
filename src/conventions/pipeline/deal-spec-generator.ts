/**
 * DealSpec runtime — compiles a DealSpec into engine-level
 * DealConstraints for hand-first rejection-sampling deal generation.
 *
 * The main entry point is {@link compileDealSpec}, which converts the
 * declarative IR layers into concrete seat constraints that the existing
 * {@link generateDeal} engine can consume directly.
 *
 * A higher-level {@link generateDealSpec} orchestrates compilation,
 * deal generation, and optional diagnostic-mode unsat analysis.
 */

import type {
  DealSpec,
  SeatRole,
  JointConstraint,
  UnsatisfiableResult,
} from "../../bootstrap/deal-spec-types";
import type { HandPredicate } from "../core/agreement-module";
import { Suit } from "../../engine/types";
import type { Seat, Vulnerability, DealConstraints, SeatConstraint, Deal } from "../../engine/types";
import { generateDeal } from "../../engine/deal-generator";
import { evaluateDealConstraint } from "./deal-constraint-evaluator";
import { CLOCKWISE, SUIT_FACT_MAP, VULNERABILITY_MAP } from "./witness-constants";

// ─── Seat-role resolution ──────────────────────────────────────────

function oppositeSeat(s: Seat): Seat {
  const idx = CLOCKWISE.indexOf(s);
  return CLOCKWISE[(idx + 2) % 4]!;
}

function lhoSeat(s: Seat): Seat {
  const idx = CLOCKWISE.indexOf(s);
  return CLOCKWISE[(idx + 1) % 4]!;
}

function rhoSeat(s: Seat): Seat {
  const idx = CLOCKWISE.indexOf(s);
  return CLOCKWISE[(idx + 3) % 4]!;
}

/**
 * Map a role-relative seat reference to a compass Seat.
 *
 * "openingSide" defaults to `userSeat` — the caller is typically the opener
 * in practice-mode scenarios.
 * @internal
 */
export function resolveRole(role: SeatRole, userSeat: Seat): Seat {
  switch (role) {
    case "self":
      return userSeat;
    case "partner":
      return oppositeSeat(userSeat);
    case "lho":
      return lhoSeat(userSeat);
    case "rho":
      return rhoSeat(userSeat);
    case "openingSide":
      return userSeat;
  }
}

// ─── Hand predicate → SeatConstraint ───────────────────────────────

/**
 * Compile a {@link HandPredicate} into an engine {@link SeatConstraint}.
 *
 * Recognised fact IDs:
 * - `hcp`       → minHcp / maxHcp
 * - `spades`, `hearts`, `diamonds`, `clubs` → minLength / maxLength
 * - `balanced`  → balanced flag
 *
 * Unrecognised clauses are logged to `diagnostics` and skipped.
 */
function compileHandPredicate(
  predicate: HandPredicate,
  seat: Seat,
  diagnostics: string[],
): SeatConstraint {
  let minHcp: number | undefined;
  let maxHcp: number | undefined;
  let balanced: boolean | undefined;
  const minLength: Partial<Record<Suit, number>> = {};
  const maxLength: Partial<Record<Suit, number>> = {};

  for (const clause of predicate.clauses) {
    if (clause.factId === "hcp") {
      switch (clause.operator) {
        case "gte":
          minHcp = clause.value as number;
          break;
        case "lte":
          maxHcp = clause.value as number;
          break;
        case "eq":
          minHcp = clause.value as number;
          maxHcp = clause.value as number;
          break;
        case "range": {
          const range = clause.value as { min: number; max: number };
          minHcp = range.min;
          maxHcp = range.max;
          break;
        }
        default:
          diagnostics.push(
            `Unsupported operator '${clause.operator}' for hcp on seat ${seat}`,
          );
      }
    } else if (clause.factId in SUIT_FACT_MAP) {
      const suit = SUIT_FACT_MAP[clause.factId]!;
      switch (clause.operator) {
        case "gte":
          minLength[suit] = clause.value as number;
          break;
        case "lte":
          maxLength[suit] = clause.value as number;
          break;
        case "eq":
          minLength[suit] = clause.value as number;
          maxLength[suit] = clause.value as number;
          break;
        case "range": {
          const range = clause.value as { min: number; max: number };
          minLength[suit] = range.min;
          maxLength[suit] = range.max;
          break;
        }
        default:
          diagnostics.push(
            `Unsupported operator '${clause.operator}' for ${clause.factId} on seat ${seat}`,
          );
      }
    } else if (clause.factId === "balanced") {
      if (clause.operator === "boolean") {
        balanced = clause.value as boolean;
      } else {
        diagnostics.push(
          `Expected boolean operator for 'balanced' on seat ${seat}, got '${clause.operator}'`,
        );
      }
    } else {
      diagnostics.push(
        `Unknown factId '${clause.factId}' on seat ${seat}; skipped`,
      );
    }
  }

  const constraint: SeatConstraint = {
    seat,
    ...(minHcp !== undefined && { minHcp }),
    ...(maxHcp !== undefined && { maxHcp }),
    ...(balanced !== undefined && { balanced }),
    ...(Object.keys(minLength).length > 0 && { minLength }),
    ...(Object.keys(maxLength).length > 0 && { maxLength }),
  };

  return constraint;
}

// ─── Joint constraint → post-deal check ────────────────────────────

/**
 * Build a deal-level validation function from joint constraint layers.
 *
 * Because the engine's {@link DealConstraints} only supports per-seat checks,
 * joint constraints (fit-check, combined-hcp) are compiled into a post-deal
 * validation function that uses {@link evaluateDealConstraint}.
 *
 * The returned function should be called on every generated deal to ensure
 * joint constraints are satisfied.
 */
function compileJointChecks(
  joints: readonly JointConstraint[],
  userSeat: Seat,
): ((deal: Deal) => boolean) | undefined {
  if (joints.length === 0) return undefined;

  // Pre-resolve role → seat for each joint constraint's params
  const resolved = joints.map((j) => {
    const seats = j.roles.map((r) => resolveRole(r, userSeat));
    // Patch the constraint params with resolved compass seats
    const params = { ...j.predicate.params, seats: seats.map((s) => s as string) };
    return { kind: j.predicate.kind, params } as const;
  });

  return (deal: Deal) =>
    resolved.every((c) => evaluateDealConstraint(c, deal));
}

// ─── Diagnostic helpers ────────────────────────────────────────────

/**
 * Simple unsat heuristic: check if HCP bounds across all four seats
 * sum to more than 40 (the deck total) or less than 0.
 */
function detectUnsatHcp(
  seatConstraints: readonly SeatConstraint[],
): string | undefined {
  let totalMinHcp = 0;
  let totalMaxHcp = 0;
  let hasAnyHcp = false;

  for (const sc of seatConstraints) {
    if (sc.minHcp !== undefined) {
      totalMinHcp += sc.minHcp;
      hasAnyHcp = true;
    }
    if (sc.maxHcp !== undefined) {
      totalMaxHcp += sc.maxHcp;
      hasAnyHcp = true;
    } else {
      // Unconstrained seat could have up to 37 HCP
      totalMaxHcp += 37;
    }
  }

  if (!hasAnyHcp) return undefined;

  if (totalMinHcp > 40) {
    return `Combined minHcp across seats (${totalMinHcp}) exceeds deck total of 40`;
  }
  if (totalMaxHcp < 0) {
    return `Combined maxHcp across seats is negative`;
  }
  return undefined;
}

/**
 * Simple unsat heuristic: check if minimum suit lengths across all
 * four seats sum to more than 13 (the suit total).
 */
function detectUnsatSuitLengths(
  seatConstraints: readonly SeatConstraint[],
): string[] {
  const issues: string[] = [];

  for (const suit of [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs]) {
    let totalMin = 0;
    for (const sc of seatConstraints) {
      const min = sc.minLength?.[suit];
      if (min !== undefined) totalMin += min;
    }
    if (totalMin > 13) {
      issues.push(
        `Combined minLength for ${suit} across seats (${totalMin}) exceeds suit total of 13`,
      );
    }
  }

  return issues;
}

// ─── Core compilation ──────────────────────────────────────────────

interface CompileResult {
  readonly dealConstraints: DealConstraints;
  readonly diagnostics: string[];
  /** Post-deal validation for joint constraints (if any). */
  readonly jointCheck?: (deal: Deal) => boolean;
}

/**
 * Compile a {@link DealSpec} into engine-level {@link DealConstraints}.
 *
 * Maps role-relative seats to compass seats, converts seat-constraint layers
 * to SeatConstraint entries, and translates setup fields (dealer, vulnerability,
 * maxAttempts).
 *
 * Joint constraints, public guards, and exclusion constraints are reported
 * in `diagnostics` since they cannot be represented in the per-seat
 * rejection-sampling model.  Joint constraints are additionally compiled
 * into a `jointCheck` function for post-deal validation (accessible via
 * {@link compileWitnessSpecFull}).
 */
export function compileDealSpec(
  spec: DealSpec,
  userSeat: Seat,
): { dealConstraints: DealConstraints; diagnostics: string[] } {
  const diagnostics: string[] = [];
  const seatConstraints: SeatConstraint[] = [];
  const jointLayers: JointConstraint[] = [];

  for (const layer of spec.layers) {
    switch (layer.kind) {
      case "seat": {
        const compass = resolveRole(layer.role, userSeat);
        const constraint = compileHandPredicate(layer.predicate, compass, diagnostics);
        seatConstraints.push(constraint);
        break;
      }
      case "joint":
        jointLayers.push(layer);
        diagnostics.push(
          `Joint constraint on [${layer.roles.join(", ")}] compiled to post-deal validation`,
        );
        break;
      case "public-guard":
        diagnostics.push(
          `Public guard on field '${layer.guard.field}' skipped (not a deal constraint)`,
        );
        break;
      case "exclusion":
        diagnostics.push(
          `Exclusion of meanings [${layer.meaningIds.join(", ")}] requires pipeline evaluation`,
        );
        break;
    }
  }

  // Resolve dealer from setup
  let dealer: Seat | undefined;
  if (spec.setup?.dealerRole) {
    dealer = resolveRole(spec.setup.dealerRole, userSeat);
  }

  // Resolve vulnerability from setup
  let vulnerability: Vulnerability | undefined;
  if (spec.setup?.vulnerability) {
    vulnerability = VULNERABILITY_MAP[spec.setup.vulnerability];
  }

  const dealConstraints: DealConstraints = {
    seats: seatConstraints,
    ...(dealer !== undefined && { dealer }),
    ...(vulnerability !== undefined && { vulnerability }),
    ...(spec.maxAttempts !== undefined && { maxAttempts: spec.maxAttempts }),
  };

  // Build the full result (the jointCheck field is included for
  // callers who destructure the return value via compileWitnessSpecFull)
  const result: CompileResult = {
    dealConstraints,
    diagnostics,
    jointCheck: compileJointChecks(jointLayers, userSeat),
  };

  return result;
}

/**
 * Full compilation result including the joint-constraint post-deal check.
 * Use this when you need to validate joint constraints after deal generation.
 * @internal
 */
export function compileWitnessSpecFull(
  spec: DealSpec,
  userSeat: Seat,
): CompileResult {
  return compileDealSpec(spec, userSeat) as CompileResult;
}

// ─── High-level generation ─────────────────────────────────────────

/** @internal */
export interface WitnessGeneratorResult {
  readonly deal: Deal;
  readonly iterations: number;
  readonly diagnostics: string[];
}

/**
 * Generate a deal that witnesses the spec.
 *
 * Uses hand-first rejection sampling (the default strategy):
 * 1. Compile the spec into per-seat constraints.
 * 2. Generate random deals until seat constraints are met.
 * 3. Post-filter for joint constraints (if any).
 *
 * In diagnostic mode, catches generation failures and returns a
 * {@link UnsatisfiableResult} describing the likely unsat core.
 */
export function generateDealSpec(
  spec: DealSpec,
  userSeat: Seat,
  rng?: () => number,
): WitnessGeneratorResult | UnsatisfiableResult {
  const compiled = compileWitnessSpecFull(spec, userSeat);
  const { dealConstraints, diagnostics, jointCheck } = compiled;

  // Diagnostic mode: run unsat heuristics before attempting generation
  if (spec.diagnosticMode) {
    const unsatIssues: string[] = [];
    const hcpIssue = detectUnsatHcp(dealConstraints.seats);
    if (hcpIssue) unsatIssues.push(hcpIssue);
    unsatIssues.push(...detectUnsatSuitLengths(dealConstraints.seats));

    if (unsatIssues.length > 0) {
      return {
        specId: spec.specId,
        unsatCore: unsatIssues,
      };
    }
  }

  // If there are joint constraints, we need to loop with post-filtering
  if (jointCheck) {
    const maxAttempts = spec.maxAttempts ?? 10_000;
    const innerAttempts = Math.max(100, Math.floor(maxAttempts / 10));
    let totalIterations = 0;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = generateDeal(
          { ...dealConstraints, maxAttempts: innerAttempts },
          rng,
        );
        totalIterations += result.iterations;
        if (jointCheck(result.deal)) {
          return { deal: result.deal, iterations: totalIterations, diagnostics };
        }
      } catch {
        // Inner generation failed; keep trying outer loop
        totalIterations += innerAttempts;
      }
    }

    if (spec.diagnosticMode) {
      return {
        specId: spec.specId,
        unsatCore: [
          ...diagnostics.filter((d) => d.includes("Joint constraint")),
          `Failed to satisfy joint constraints after ${maxAttempts} outer attempts`,
        ],
      };
    }
    throw new Error(
      `Failed to generate witness deal after ${maxAttempts} attempts (joint constraints unsatisfied)`,
    );
  }

  // No joint constraints — straight generation
  try {
    const result = generateDeal(dealConstraints, rng);
    return { deal: result.deal, iterations: result.iterations, diagnostics };
  } catch (e) {
    if (spec.diagnosticMode) {
      const unsatIssues: string[] = [];
      const hcpIssue = detectUnsatHcp(dealConstraints.seats);
      if (hcpIssue) unsatIssues.push(hcpIssue);
      unsatIssues.push(...detectUnsatSuitLengths(dealConstraints.seats));
      if (unsatIssues.length === 0) {
        unsatIssues.push("Generation exhausted maxAttempts (constraints may be too tight)");
      }
      return {
        specId: spec.specId,
        unsatCore: unsatIssues,
      };
    }
    throw e;
  }
}
