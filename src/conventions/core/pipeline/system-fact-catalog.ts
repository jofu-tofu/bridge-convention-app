/**
 * System-level fact catalog.
 *
 * Provides fact definitions and evaluators for system-semantic facts —
 * concepts whose concrete meaning varies by bidding system (SAYC, 2/1, Acol).
 *
 * Convention modules reference these fact IDs in their surface clauses
 * (via the vocabulary in `core/contracts/system-fact-vocabulary.ts`) but
 * never define the evaluators. The base system owns the "what this means"
 * and conventions own the "what to do about it."
 */

import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
} from "../../../core/contracts/fact-catalog";
import { num, fv } from "./fact-helpers";
import type { SystemConfig } from "../../../core/contracts/system-config";
import {
  SYSTEM_RESPONDER_WEAK_HAND,
  SYSTEM_RESPONDER_INVITE_VALUES,
  SYSTEM_RESPONDER_GAME_VALUES,
  SYSTEM_RESPONDER_SLAM_VALUES,
  SYSTEM_OPENER_NOT_MINIMUM,
} from "../../../core/contracts/system-fact-vocabulary";

// ─── Fact definitions (system-agnostic metadata) ────────────

const SYSTEM_FACT_DEFINITIONS: readonly FactDefinition[] = [
  {
    id: SYSTEM_RESPONDER_WEAK_HAND,
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Responder is below the invite threshold — too weak to act",
    valueType: "boolean",
    derivesFrom: ["hand.hcp"],
    constrainsDimensions: ["pointRange"],
  },
  {
    id: SYSTEM_RESPONDER_INVITE_VALUES,
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Responder has invitational values opposite a 1NT opening",
    valueType: "boolean",
    derivesFrom: ["hand.hcp"],
    constrainsDimensions: ["pointRange"],
  },
  {
    id: SYSTEM_RESPONDER_GAME_VALUES,
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Responder has game-forcing values opposite a 1NT opening",
    valueType: "boolean",
    derivesFrom: ["hand.hcp"],
    constrainsDimensions: ["pointRange"],
  },
  {
    id: SYSTEM_RESPONDER_SLAM_VALUES,
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Responder has slam-exploration values opposite a 1NT opening",
    valueType: "boolean",
    derivesFrom: ["hand.hcp"],
    constrainsDimensions: ["pointRange"],
  },
  {
    id: SYSTEM_OPENER_NOT_MINIMUM,
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Opener is above the minimum of their 1NT range",
    valueType: "boolean",
    derivesFrom: ["hand.hcp"],
    constrainsDimensions: ["pointRange"],
  },
];

// ─── Evaluator factory ──────────────────────────────────────

/** Creates system-semantic fact evaluators parameterized by the active SystemConfig. */
function createSystemEvaluators(sys: SystemConfig): Map<string, FactEvaluatorFn> {
  return new Map<string, FactEvaluatorFn>([
    [SYSTEM_RESPONDER_WEAK_HAND, (_h, _ev, m) =>
      fv(SYSTEM_RESPONDER_WEAK_HAND, num(m, "hand.hcp") < sys.responderThresholds.inviteMin)],
    [SYSTEM_RESPONDER_INVITE_VALUES, (_h, _ev, m) => {
      const hcp = num(m, "hand.hcp");
      return fv(SYSTEM_RESPONDER_INVITE_VALUES,
        hcp >= sys.responderThresholds.inviteMin && hcp <= sys.responderThresholds.inviteMax);
    }],
    [SYSTEM_RESPONDER_GAME_VALUES, (_h, _ev, m) =>
      fv(SYSTEM_RESPONDER_GAME_VALUES, num(m, "hand.hcp") >= sys.responderThresholds.gameMin)],
    [SYSTEM_RESPONDER_SLAM_VALUES, (_h, _ev, m) =>
      fv(SYSTEM_RESPONDER_SLAM_VALUES, num(m, "hand.hcp") >= sys.responderThresholds.slamMin)],
    [SYSTEM_OPENER_NOT_MINIMUM, (_h, _ev, m) =>
      fv(SYSTEM_OPENER_NOT_MINIMUM, num(m, "hand.hcp") >= sys.openerRebid.notMinimum)],
  ]);
}

// ─── Public factory ─────────────────────────────────────────

/**
 * Creates a FactCatalogExtension containing system-semantic facts.
 *
 * The base system profile calls this with its SystemConfig; the resulting
 * extension is merged into the pipeline's fact catalog alongside bridge-level
 * and convention-module facts.
 */
export function createSystemFactCatalog(sys: SystemConfig): FactCatalogExtension {
  return {
    definitions: SYSTEM_FACT_DEFINITIONS,
    evaluators: createSystemEvaluators(sys),
  };
}
