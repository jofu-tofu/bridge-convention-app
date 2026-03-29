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

import { FactLayer } from "../../core/fact-layer";
import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
  FactValue,
  RelationalFactEvaluatorFn,
} from "../../core/fact-catalog";
import { EvaluationWorld } from "../../core/fact-catalog";
import { num, fv } from "./fact-helpers";
import type { SystemConfig } from "../../definitions/system-config";
import type { SuitName } from "../../../engine/types";
import {
  SYSTEM_RESPONDER_WEAK_HAND,
  SYSTEM_RESPONDER_INVITE_VALUES,
  SYSTEM_RESPONDER_GAME_VALUES,
  SYSTEM_RESPONDER_SLAM_VALUES,
  SYSTEM_OPENER_NOT_MINIMUM,
  SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT,
  SYSTEM_SUIT_RESPONSE_IS_GAME_FORCING,
  SYSTEM_ONE_NT_FORCING_AFTER_MAJOR,
  SYSTEM_RESPONDER_ONE_NT_RANGE,
  SYSTEM_DONT_OVERCALL_IN_RANGE,
} from "../../definitions/system-fact-vocabulary";
import { FactOperator } from "../evaluation/meaning";

// ─── Fact definitions ───────────────────────────────────────
//
// System-derived facts come in two flavors:
//
//   HAND-DEPENDENT     Combine hand data (HCP) with system thresholds.
//     derivesFrom:     ["hand.hcp"] — reads the hand
//     constrains:      ["pointRange"] — tells partner about strength
//     Value changes:   Per hand AND per system
//     Example:         "Does this 11-HCP hand qualify for a 2-level
//                       new suit?" → yes in SAYC (10+), no in 2/1 (12+)
//
//   SYSTEM-CONSTANT    Pure system properties, independent of hand.
//     derivesFrom:     [] — reads nothing from the hand
//     constrains:      [] — communicates system rules, not hand shape
//     Value changes:   Per system only (same for every hand)
//     Example:         "Is a 2-level new suit game-forcing?" → no in
//                       SAYC, yes in 2/1. True regardless of HCP.
//
// Both flavors live in the fact catalog so surfaces can reference them
// in clause arrays. System-constant facts let a module author two
// surfaces for the same decision point — one gated on the SAYC rule,
// one on the 2/1 rule — and the pipeline selects the right one.
// The evaluators receive SystemConfig via closure (createSystemEvaluators),
// not via the FactEvaluatorFn signature.
//
// CONTEXT-AWARE EVALUATORS (Phase B): Six hand-dependent system facts
// are promoted to relational evaluators so they auto-detect trump context
// via fitAgreed. When fitAgreed.strain is a suit, they compute HCP +
// shortage points and compare against *Tp.trump thresholds. Otherwise
// they fall back to HCP-only (current behavior preserved).

const SYSTEM_FACT_DEFINITIONS: readonly FactDefinition[] = [
  // ── Hand-dependent system facts ─────────────────────────────
  // These combine hand.hcp with system-specific thresholds.
  {
    id: SYSTEM_RESPONDER_WEAK_HAND,
    layer: FactLayer.SystemDerived,
    world: EvaluationWorld.ActingHand,
    description: "Responder is below the invite threshold — too weak to act",
    valueType: "boolean",
    derivesFrom: ["hand.hcp"],
    constrainsDimensions: ["pointRange"],
  },
  {
    id: SYSTEM_RESPONDER_INVITE_VALUES,
    layer: FactLayer.SystemDerived,
    world: EvaluationWorld.ActingHand,
    description: "Responder has invitational values opposite a 1NT opening",
    valueType: "boolean",
    derivesFrom: ["hand.hcp"],
    constrainsDimensions: ["pointRange"],
  },
  {
    id: SYSTEM_RESPONDER_GAME_VALUES,
    layer: FactLayer.SystemDerived,
    world: EvaluationWorld.ActingHand,
    description: "Responder has game-forcing values opposite a 1NT opening",
    valueType: "boolean",
    derivesFrom: ["hand.hcp"],
    constrainsDimensions: ["pointRange"],
  },
  {
    id: SYSTEM_RESPONDER_SLAM_VALUES,
    layer: FactLayer.SystemDerived,
    world: EvaluationWorld.ActingHand,
    description: "Responder has slam-exploration values opposite a 1NT opening",
    valueType: "boolean",
    derivesFrom: ["hand.hcp"],
    constrainsDimensions: ["pointRange"],
  },
  {
    id: SYSTEM_OPENER_NOT_MINIMUM,
    layer: FactLayer.SystemDerived,
    world: EvaluationWorld.ActingHand,
    description: "Opener is above the minimum of their 1NT range",
    valueType: "boolean",
    derivesFrom: ["hand.hcp"],
    constrainsDimensions: ["pointRange"],
  },
  {
    id: SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT,
    layer: FactLayer.SystemDerived,
    world: EvaluationWorld.ActingHand,
    description: "Responder has enough HCP for a 2-level new-suit response",
    valueType: "boolean",
    derivesFrom: ["hand.hcp"],
    constrainsDimensions: ["pointRange"],
  },
  // ── System-constant facts ──────────────────────────────────
  // These are pure system properties — same value for every hand.
  // They exist in the catalog so surfaces can gate on them in clause
  // arrays (e.g., { factId: "system.suitResponse.isGameForcing",
  // operator: FactOperator.Boolean, value: true } to fire only in 2/1).
  // derivesFrom is empty because they read no hand data.
  // constrainsDimensions is empty because they communicate system
  // rules, not hand shape.
  {
    id: SYSTEM_SUIT_RESPONSE_IS_GAME_FORCING,
    layer: FactLayer.SystemDerived,
    world: EvaluationWorld.ActingHand,
    description: "The 2-level new-suit response is game-forcing in this system",
    valueType: "boolean",
    derivesFrom: [],
    constrainsDimensions: [],
  },
  {
    id: SYSTEM_ONE_NT_FORCING_AFTER_MAJOR,
    layer: FactLayer.SystemDerived,
    world: EvaluationWorld.ActingHand,
    description: "1NT forcing status after 1M in this system",
    valueType: "string",
    derivesFrom: [],
    constrainsDimensions: [],
  },
  {
    id: SYSTEM_RESPONDER_ONE_NT_RANGE,
    layer: FactLayer.SystemDerived,
    world: EvaluationWorld.ActingHand,
    description: "Responder is within the 1NT-response-to-1M HCP range",
    valueType: "boolean",
    derivesFrom: ["hand.hcp"],
    constrainsDimensions: ["pointRange"],
  },
  // ── DONT overcall facts ──────────────────────────────────────
  {
    id: SYSTEM_DONT_OVERCALL_IN_RANGE,
    layer: FactLayer.SystemDerived,
    world: EvaluationWorld.ActingHand,
    description: "Overcaller HCP is within the DONT overcall range",
    valueType: "boolean",
    derivesFrom: ["hand.hcp"],
    constrainsDimensions: ["pointRange"],
  },
];

// ─── Trump total-point helpers ─────────────────────────────────

const SUIT_FACT_IDS: Record<SuitName, string> = {
  spades: "hand.suitLength.spades",
  hearts: "hand.suitLength.hearts",
  diamonds: "hand.suitLength.diamonds",
  clubs: "hand.suitLength.clubs",
};
const ALL_SUITS: readonly SuitName[] = ["spades", "hearts", "diamonds", "clubs"];

/** Convert a strain string to SuitName (returns undefined for "notrump"). */
function strainToSuitName(strain: string): SuitName | undefined {
  if (strain === "hearts" || strain === "spades" || strain === "diamonds" || strain === "clubs") return strain;
  return undefined;
}

/** Compute HCP + shortage points (excluding agreed suit). */
export function computeTrumpTotalPoints(evaluated: ReadonlyMap<string, FactValue>, agreedSuit: SuitName): number {
  const hcp = num(evaluated, "hand.hcp");
  let shortagePoints = 0;
  for (const s of ALL_SUITS) {
    if (s === agreedSuit) continue;
    const length = num(evaluated, SUIT_FACT_IDS[s]!);
    if (length === 0) shortagePoints += 3;
    else if (length === 1) shortagePoints += 2;
    else if (length === 2) shortagePoints += 1;
  }
  return hcp + shortagePoints;
}

/** Detect the agreed trump suit from relational context. */
export function detectTrumpSuit(ctx: { fitAgreed?: { strain: string } | null }): SuitName | undefined {
  if (ctx.fitAgreed?.strain) return strainToSuitName(ctx.fitAgreed.strain);
  return undefined;
}

// ─── Evaluator factories ──────────────────────────────────────

/** Standard evaluators: all system facts have HCP-only evaluators as baseline.
 *  The 6 context-aware facts also have relational evaluators that override these
 *  when fitAgreed is present in the relational context. */
function createStandardSystemEvaluators(sys: SystemConfig): Map<string, FactEvaluatorFn> {
  return new Map<string, FactEvaluatorFn>([
    // ── Context-aware facts: HCP-only baseline (overridden by relational evaluators when context present) ──
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
    [SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT, (_h, _ev, m) =>
      fv(SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT, num(m, "hand.hcp") >= sys.suitResponse.twoLevelMin)],
    // ── System-constant: pure config values, no hand data ──
    [SYSTEM_SUIT_RESPONSE_IS_GAME_FORCING, () =>
      fv(SYSTEM_SUIT_RESPONSE_IS_GAME_FORCING, sys.suitResponse.twoLevelForcingDuration === "game")],
    [SYSTEM_ONE_NT_FORCING_AFTER_MAJOR, () =>
      fv(SYSTEM_ONE_NT_FORCING_AFTER_MAJOR, sys.oneNtResponseAfterMajor.forcing)],
    // ── Hand-dependent but not context-aware ──
    [SYSTEM_RESPONDER_ONE_NT_RANGE, (_h, _ev, m) => {
      const hcp = num(m, "hand.hcp");
      return fv(SYSTEM_RESPONDER_ONE_NT_RANGE, hcp >= sys.oneNtResponseAfterMajor.minHcp && hcp <= sys.oneNtResponseAfterMajor.maxHcp);
    }],
    // DONT overcall: boolean HCP range check
    [SYSTEM_DONT_OVERCALL_IN_RANGE, (_h, _ev, m) => {
      const hcp = num(m, "hand.hcp");
      return fv(SYSTEM_DONT_OVERCALL_IN_RANGE,
        hcp >= sys.dontOvercall.minHcp && hcp <= sys.dontOvercall.maxHcp);
    }],
  ]);
}

/** Context-aware relational evaluators: auto-detect trump context via fitAgreed. */
function createRelationalSystemEvaluators(sys: SystemConfig): Map<string, RelationalFactEvaluatorFn> {
  return new Map<string, RelationalFactEvaluatorFn>([
    [SYSTEM_RESPONDER_WEAK_HAND, (_h, _ev, m, ctx) => {
      const trumpSuit = detectTrumpSuit(ctx);
      if (trumpSuit) {
        const tp = computeTrumpTotalPoints(m, trumpSuit);
        return fv(SYSTEM_RESPONDER_WEAK_HAND, tp < sys.responderThresholds.inviteMinTp.trump);
      }
      return fv(SYSTEM_RESPONDER_WEAK_HAND, num(m, "hand.hcp") < sys.responderThresholds.inviteMin);
    }],
    [SYSTEM_RESPONDER_INVITE_VALUES, (_h, _ev, m, ctx) => {
      const trumpSuit = detectTrumpSuit(ctx);
      if (trumpSuit) {
        const tp = computeTrumpTotalPoints(m, trumpSuit);
        return fv(SYSTEM_RESPONDER_INVITE_VALUES,
          tp >= sys.responderThresholds.inviteMinTp.trump
          && tp <= sys.responderThresholds.inviteMaxTp.trump);
      }
      const hcp = num(m, "hand.hcp");
      return fv(SYSTEM_RESPONDER_INVITE_VALUES,
        hcp >= sys.responderThresholds.inviteMin && hcp <= sys.responderThresholds.inviteMax);
    }],
    [SYSTEM_RESPONDER_GAME_VALUES, (_h, _ev, m, ctx) => {
      const trumpSuit = detectTrumpSuit(ctx);
      if (trumpSuit) {
        const tp = computeTrumpTotalPoints(m, trumpSuit);
        return fv(SYSTEM_RESPONDER_GAME_VALUES, tp >= sys.responderThresholds.gameMinTp.trump);
      }
      return fv(SYSTEM_RESPONDER_GAME_VALUES, num(m, "hand.hcp") >= sys.responderThresholds.gameMin);
    }],
    [SYSTEM_RESPONDER_SLAM_VALUES, (_h, _ev, m, ctx) => {
      const trumpSuit = detectTrumpSuit(ctx);
      if (trumpSuit) {
        const tp = computeTrumpTotalPoints(m, trumpSuit);
        return fv(SYSTEM_RESPONDER_SLAM_VALUES, tp >= sys.responderThresholds.slamMinTp.trump);
      }
      return fv(SYSTEM_RESPONDER_SLAM_VALUES, num(m, "hand.hcp") >= sys.responderThresholds.slamMin);
    }],
    [SYSTEM_OPENER_NOT_MINIMUM, (_h, _ev, m, ctx) => {
      const trumpSuit = detectTrumpSuit(ctx);
      if (trumpSuit) {
        const tp = computeTrumpTotalPoints(m, trumpSuit);
        return fv(SYSTEM_OPENER_NOT_MINIMUM, tp >= sys.openerRebid.notMinimumTp.trump);
      }
      return fv(SYSTEM_OPENER_NOT_MINIMUM, num(m, "hand.hcp") >= sys.openerRebid.notMinimum);
    }],
    [SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT, (_h, _ev, m, ctx) => {
      const trumpSuit = detectTrumpSuit(ctx);
      if (trumpSuit) {
        const tp = computeTrumpTotalPoints(m, trumpSuit);
        return fv(SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT, tp >= sys.suitResponse.twoLevelMin);
      }
      return fv(SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT, num(m, "hand.hcp") >= sys.suitResponse.twoLevelMin);
    }],
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
    evaluators: createStandardSystemEvaluators(sys),
    relationalEvaluators: createRelationalSystemEvaluators(sys),
  };
}
