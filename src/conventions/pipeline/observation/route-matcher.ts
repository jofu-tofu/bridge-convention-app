/**
 * Route matcher — evaluates RouteExpr patterns against a CommittedStep log.
 *
 * Core pattern matching for the rule interpreter. Routes describe
 * patterns over the auction's canonical observation history.
 */

import type { Seat } from "../../../engine/types";
import { partnerSeat } from "../../../engine/constants";
import type { BidAction } from "../bid-action";
import type { CommittedStep } from "../../core/committed-step";
import { TurnRole } from "../../core/rule-module";
import type { ObsPattern, RouteExpr } from "../../core/rule-module";

/**
 * Match a single ObsPattern against a single BidAction.
 *
 * Matches if `act` matches AND all specified optional fields match.
 * Unspecified fields are wildcards. When `pattern.actor` is set and
 * `actorRole` is provided, the actor must match too.
 */
export function matchObs(pattern: ObsPattern, obs: BidAction, actorRole?: TurnRole): boolean {
  // Actor check — only applies when both pattern and caller specify actor
  if (pattern.actor !== undefined && actorRole !== undefined && pattern.actor !== actorRole) return false;

  // Act check
  if (pattern.act !== "any" && pattern.act !== obs.act) return false;

  // Optional field checks — only check if the pattern specifies them
  if (pattern.feature !== undefined) {
    if (!("feature" in obs) || obs.feature !== pattern.feature) return false;
  }

  if (pattern.suit !== undefined) {
    // suit can be on various obs types (show, deny, inquire, etc.)
    // Transfer uses "targetSuit" instead of "suit"
    if ("suit" in obs) {
      if (obs.suit !== pattern.suit) return false;
    } else if ("targetSuit" in obs) {
      if (obs.targetSuit !== pattern.suit) return false;
    } else {
      return false;
    }
  }

  if (pattern.strain !== undefined) {
    // strain can be on open, raise, place, etc., and also on "targetSuit" for transfer
    if ("strain" in obs) {
      if (obs.strain !== pattern.strain) return false;
    } else if ("targetSuit" in obs) {
      // Transfer uses targetSuit, not strain
      if (obs.targetSuit !== pattern.strain) return false;
    } else {
      return false;
    }
  }

  if (pattern.strength !== undefined) {
    if (!("strength" in obs) || obs.strength !== pattern.strength) return false;
  }

  return true;
}

/**
 * Match a RouteExpr against a CommittedStep log.
 *
 * When `openerSeat` is provided, ObsPattern.actor filtering is active:
 * each step's actor is mapped to a TurnRole via the opener seat.
 */
export function matchRoute(
  expr: RouteExpr,
  log: readonly CommittedStep[],
  openerSeat?: Seat,
): boolean {
  switch (expr.kind) {
    case "last":
      return matchLast(expr.pattern, log, openerSeat);
    case "contains":
      return matchContains(expr.pattern, log, openerSeat);
    case "subseq":
      return matchSubseq(expr.steps, log, openerSeat);
    case "and":
      return expr.exprs.every((e) => matchRoute(e, log, openerSeat));
    case "or":
      return expr.exprs.some((e) => matchRoute(e, log, openerSeat));
    case "not":
      return !matchRoute(expr.expr, log, openerSeat);
  }
}

// ── Internal helpers ─────────────────────────────────────────────────

/** Derive actor role from seat and opener seat (inline to avoid circular dep). */
function deriveActorRole(actor: Seat, openerSeat: Seat): TurnRole {
  if (actor === openerSeat) return TurnRole.Opener;
  if (actor === partnerSeat(openerSeat)) return TurnRole.Responder;
  return TurnRole.Opponent;
}

/** Does any observation in a step match the pattern? */
function stepMatchesObs(
  pattern: ObsPattern,
  step: CommittedStep,
  openerSeat?: Seat,
): boolean {
  const actorRole = openerSeat !== undefined ? deriveActorRole(step.actor, openerSeat) : undefined;
  return step.publicActions.some((obs) => matchObs(pattern, obs, actorRole));
}

function matchLast(
  pattern: ObsPattern,
  log: readonly CommittedStep[],
  openerSeat?: Seat,
): boolean {
  if (log.length === 0) return false;
  return stepMatchesObs(pattern, log[log.length - 1]!, openerSeat);
}

function matchContains(
  pattern: ObsPattern,
  log: readonly CommittedStep[],
  openerSeat?: Seat,
): boolean {
  return log.some((step) => stepMatchesObs(pattern, step, openerSeat));
}

/**
 * Match a subsequence of patterns against the log.
 * Patterns must appear in order but may be separated by non-matching steps.
 */
function matchSubseq(
  patterns: readonly ObsPattern[],
  log: readonly CommittedStep[],
  openerSeat?: Seat,
): boolean {
  if (patterns.length === 0) return true;

  let patternIdx = 0;
  for (const step of log) {
    if (stepMatchesObs(patterns[patternIdx]!, step, openerSeat)) {
      patternIdx++;
      if (patternIdx === patterns.length) return true;
    }
  }
  return false;
}
