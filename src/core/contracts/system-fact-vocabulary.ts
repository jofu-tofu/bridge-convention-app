/**
 * System-provided semantic fact vocabulary.
 *
 * These fact IDs represent bidding concepts whose concrete definitions
 * vary by base system (SAYC, 2/1, Acol). The base system provides
 * evaluators for these facts via `createSystemFactCatalog()`; convention
 * modules reference them in surface clauses without knowing the thresholds.
 *
 * Convention-intrinsic facts (e.g. "module.stayman.eligible") are NOT
 * part of this vocabulary — they belong to the convention module.
 *
 * Naming convention: `system.<role>.<concept>`
 *   - role: "responder", "opener" — who the fact describes
 *   - concept: camelCase semantic name
 */

// ─── Responder point-range facts ────────────────────────────

/** Responder has invitational values opposite a 1NT opening. */
export const SYSTEM_RESPONDER_INVITE_VALUES = "system.responder.inviteValues" as const;

/** Responder has game-forcing values opposite a 1NT opening. */
export const SYSTEM_RESPONDER_GAME_VALUES = "system.responder.gameValues" as const;

/** Responder has slam-exploration values opposite a 1NT opening. */
export const SYSTEM_RESPONDER_SLAM_VALUES = "system.responder.slamValues" as const;

// ─── Opener rebid facts ─────────────────────────────────────

/** Opener is above the minimum of their 1NT range (e.g. 16+ in a 15-17 system). */
export const SYSTEM_OPENER_NOT_MINIMUM = "system.opener.notMinimum" as const;

// ─── Collected vocabulary ───────────────────────────────────

/** All system-provided fact IDs. Used for catalog validation and documentation. */
export const SYSTEM_FACT_IDS = [
  SYSTEM_RESPONDER_INVITE_VALUES,
  SYSTEM_RESPONDER_GAME_VALUES,
  SYSTEM_RESPONDER_SLAM_VALUES,
  SYSTEM_OPENER_NOT_MINIMUM,
] as const;

/** Union type of all system-provided fact IDs. */
export type SystemFactId = typeof SYSTEM_FACT_IDS[number];
