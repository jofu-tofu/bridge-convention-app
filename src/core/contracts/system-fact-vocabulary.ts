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

/** Responder is below the invite threshold — too weak to act (e.g. 0-7 in SAYC). */
export const SYSTEM_RESPONDER_WEAK_HAND = "system.responder.weakHand" as const;

/** Responder has invitational values opposite a 1NT opening. */
export const SYSTEM_RESPONDER_INVITE_VALUES = "system.responder.inviteValues" as const;

/** Responder has game-forcing values opposite a 1NT opening. */
export const SYSTEM_RESPONDER_GAME_VALUES = "system.responder.gameValues" as const;

/** Responder has slam-exploration values opposite a 1NT opening. */
export const SYSTEM_RESPONDER_SLAM_VALUES = "system.responder.slamValues" as const;

// ─── Opener rebid facts ─────────────────────────────────────

/** Opener is above the minimum of their 1NT range (e.g. 16+ in a 15-17 system). */
export const SYSTEM_OPENER_NOT_MINIMUM = "system.opener.notMinimum" as const;

// ─── Suit response facts ───────────────────────────────────

/** Responder has enough HCP for a 2-level new-suit response. */
export const SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT = "system.responder.twoLevelNewSuit" as const;

/** The 2-level new-suit response is game-forcing in this system.
 *  Used by modules to gate surfaces that differ between SAYC (false) and 2/1 (true). */
export const SYSTEM_SUIT_RESPONSE_IS_GAME_FORCING = "system.suitResponse.isGameForcing" as const;

// ─── 1NT response after major facts ────────────────────────

/** 1NT forcing status after 1M in this system (string: "non-forcing"|"forcing"|"semi-forcing"). */
export const SYSTEM_ONE_NT_FORCING_AFTER_MAJOR = "system.oneNtResponseAfterMajor.forcing" as const;

/** Responder is within the 1NT-response-to-1M HCP range. */
export const SYSTEM_RESPONDER_ONE_NT_RANGE = "system.responder.oneNtRange" as const;

// ─── Collected vocabulary ───────────────────────────────────

/** All system-provided fact IDs. Used for catalog validation and documentation. */
export const SYSTEM_FACT_IDS = [
  SYSTEM_RESPONDER_WEAK_HAND,
  SYSTEM_RESPONDER_INVITE_VALUES,
  SYSTEM_RESPONDER_GAME_VALUES,
  SYSTEM_RESPONDER_SLAM_VALUES,
  SYSTEM_OPENER_NOT_MINIMUM,
  SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT,
  SYSTEM_SUIT_RESPONSE_IS_GAME_FORCING,
  SYSTEM_ONE_NT_FORCING_AFTER_MAJOR,
  SYSTEM_RESPONDER_ONE_NT_RANGE,
] as const;

/** Union type of all system-provided fact IDs. */
export type SystemFactId = typeof SYSTEM_FACT_IDS[number];
