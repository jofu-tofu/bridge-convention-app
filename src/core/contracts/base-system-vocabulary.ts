/**
 * Base bidding system identifiers.
 *
 * Shared vocabulary for the `baseSystem` field on `SystemProfileIR` and the
 * `systemId` field on `SystemConfig`. Every string that names a bidding
 * system must come from this file so grep finds all references.
 *
 * Add new entries here when the app gains support for another system.
 */

// ─── Known system IDs ───────────────────────────────────────

/** Standard American Yellow Card (SAYC). */
export const BASE_SYSTEM_SAYC = "sayc" as const;

/** Two-Over-One Game Forcing. */
export const BASE_SYSTEM_TWO_OVER_ONE = "two-over-one" as const;

/** Acol (standard British system). */
export const BASE_SYSTEM_ACOL = "acol" as const;

// ─── Union type ─────────────────────────────────────────────

/** All known base-system identifiers. Extend this union as new systems are added. */
export type BaseSystemId =
  | typeof BASE_SYSTEM_SAYC
  | typeof BASE_SYSTEM_TWO_OVER_ONE
  | typeof BASE_SYSTEM_ACOL;
