/**
 * Typed ID constants for Bergen Raises fact IDs.
 *
 * Module-derived facts defined in facts.ts, plus shared/template fact IDs
 * referenced in Bergen surface clauses.
 */

import {
  HAND_HCP,
  HAND_SUIT_LENGTH_HEARTS,
  HAND_SUIT_LENGTH_SPADES,
  BRIDGE_HAS_SHORTAGE,
  BRIDGE_TOTAL_POINTS_FOR_RAISE,
} from "../../../core/shared-fact-vocabulary";

// ─── Bergen module fact IDs ──────────────────────────────────

export const BERGEN_FACT_IDS = {
  HAS_MAJOR_SUPPORT: "module.bergen.hasMajorSupport",
} as const;

export type BergenFactId = (typeof BERGEN_FACT_IDS)[keyof typeof BERGEN_FACT_IDS];

// ─── Clause fact IDs referenced in Bergen surfaces ───────────
//
// These are shared/template fact IDs that Bergen clauses reference.
// Re-exported here for single-source-of-truth imports within the module.

export const BERGEN_CLAUSE_FACT_IDS = {
  HAND_HCP,
  HAND_SUIT_LENGTH_HEARTS,
  HAND_SUIT_LENGTH_SPADES,
  /** Template: resolved via surfaceBindings { suit } */
  SUIT_LENGTH_TEMPLATE: "hand.suitLength.$suit",
  BRIDGE_HAS_SHORTAGE,
  BRIDGE_TOTAL_POINTS_FOR_RAISE,
  /** System fact for 1NT response HCP range */
  SYSTEM_RESPONDER_ONE_NT_RANGE: "system.responder.oneNtRange",
} as const;
