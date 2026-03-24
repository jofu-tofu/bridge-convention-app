/**
 * Base bidding system identifiers and system-level bidding configuration.
 *
 * Captures HCP thresholds and ranges that vary between bidding systems
 * (SAYC, 2/1 Game Forcing, Acol, etc.) but are shared across all
 * conventions that plug into that system.
 *
 * Convention modules MUST receive a SystemConfig via dependency injection
 * (factory function parameter) — they must NOT hardcode these values.
 *
 * Convention-intrinsic values (e.g. "Stayman requires a 4-card major")
 * are NOT part of SystemConfig; they belong to the convention module.
 */

// ─── Known system IDs ───────────────────────────────────────

/** Standard American Yellow Card (SAYC). */
export const BASE_SYSTEM_SAYC = "sayc" as const;

/** Two-Over-One Game Forcing. */
export const BASE_SYSTEM_TWO_OVER_ONE = "two-over-one" as const;

/** Acol (standard weak-NT variant, UK tournament bridge). */
export const BASE_SYSTEM_ACOL = "acol" as const;

/** All known base-system identifiers. Extend this union as new systems are added. */
export type BaseSystemId =
  | typeof BASE_SYSTEM_SAYC
  | typeof BASE_SYSTEM_TWO_OVER_ONE
  | typeof BASE_SYSTEM_ACOL;

// ─── 1NT system parameters ──────────────────────────────────

export interface NtOpeningConfig {
  /** Minimum HCP for a 1NT opening (e.g. 15 in SAYC, 12 in Acol). */
  readonly minHcp: number;
  /** Maximum HCP for a 1NT opening (e.g. 17 in SAYC, 14 in Acol). */
  readonly maxHcp: number;
}

export interface ResponderThresholds {
  /** Minimum HCP for an invitational response (e.g. 8 in SAYC). */
  readonly inviteMin: number;
  /** Maximum HCP for an invitational response (e.g. 9 in SAYC). */
  readonly inviteMax: number;
  /** Minimum HCP for a game-forcing response (e.g. 10 in SAYC). */
  readonly gameMin: number;
  /** Minimum HCP for slam exploration (e.g. 15 in SAYC). */
  readonly slamMin: number;
}

export interface OpenerRebidThresholds {
  /** HCP at which opener is "not minimum" — typically ntOpening.minHcp + 1. */
  readonly notMinimum: number;
}

export interface InterferenceThresholds {
  /** Minimum HCP to redouble after opponent doubles (e.g. 10 in SAYC). */
  readonly redoubleMin: number;
}

// ─── Suit response parameters ───────────────────────────────

export type SuitResponseForcingDuration = "one-round" | "game";
export type OneNtForcingStatus = "non-forcing" | "forcing" | "semi-forcing";

export interface SuitResponseConfig {
  /** Minimum HCP for a 2-level new-suit response to a 1-level suit opening.
   *  SAYC: 10 (forcing one round). 2/1: 12 (game-forcing). */
  readonly twoLevelMin: number;
  /** Forcing duration of a 2-level new-suit response.
   *  SAYC: "one-round". 2/1: "game". */
  readonly twoLevelForcingDuration: SuitResponseForcingDuration;
}

export interface OneNtResponseAfterMajorConfig {
  /** Whether 1NT response to 1M is forcing.
   *  SAYC: "non-forcing". 2/1: "semi-forcing" (opener may pass 5332 min).
   *  Strict 2/1: "forcing". */
  readonly forcing: OneNtForcingStatus;
  /** Maximum HCP for 1NT response to 1M.
   *  SAYC: 10. 2/1: 12. */
  readonly maxHcp: number;
  /** Minimum HCP for 1NT response to 1M (e.g. 6 in SAYC/Acol). */
  readonly minHcp: number;
}

// ─── DONT overcall parameters ────────────────────────────────

/** HCP bounds for DONT overcalls — may vary by system. */
export interface DontOvercallConfig {
  /** Minimum HCP for a DONT overcall (e.g. 8). */
  readonly minHcp: number;
  /** Maximum HCP for a DONT overcall (e.g. 15). */
  readonly maxHcp: number;
}

// ─── Opening requirements ───────────────────────────────────

/** Opening bid structural requirements that vary by system. */
export interface OpeningRequirements {
  /** Minimum suit length to open a major (4 in Acol, 5 in SAYC/2/1). */
  readonly majorSuitMinLength: 4 | 5;
}

// ─── Top-level SystemConfig ─────────────────────────────────

export interface SystemConfig {
  /** System identifier — must be a value from base-system-vocabulary.ts. */
  readonly systemId: BaseSystemId;
  /** Human-readable name (e.g. "Standard American Yellow Card"). */
  readonly displayName: string;

  /** 1NT opening HCP range. */
  readonly ntOpening: NtOpeningConfig;
  /** Responder point-range thresholds opposite a 1NT opening. */
  readonly responderThresholds: ResponderThresholds;
  /** Opener rebid thresholds (e.g. super-accept, not-minimum). */
  readonly openerRebid: OpenerRebidThresholds;
  /** Interference thresholds. */
  readonly interference: InterferenceThresholds;
  /** 2-level new-suit response parameters (forcing level, HCP threshold). */
  readonly suitResponse: SuitResponseConfig;
  /** 1NT response to 1M parameters (forcing status, HCP ceiling). */
  readonly oneNtResponseAfterMajor: OneNtResponseAfterMajorConfig;
  /** Structural opening bid requirements (major length, etc.). */
  readonly openingRequirements: OpeningRequirements;
  /** DONT overcall HCP bounds. */
  readonly dontOvercall: DontOvercallConfig;
}

// ─── Concrete system configs ────────────────────────────────

export const SAYC_SYSTEM_CONFIG: SystemConfig = {
  systemId: BASE_SYSTEM_SAYC,
  displayName: "Standard American Yellow Card",
  ntOpening: { minHcp: 15, maxHcp: 17 },
  responderThresholds: {
    inviteMin: 8,
    inviteMax: 9,
    gameMin: 10,
    slamMin: 15,
  },
  openerRebid: { notMinimum: 16 },
  interference: { redoubleMin: 10 },
  suitResponse: { twoLevelMin: 10, twoLevelForcingDuration: "one-round" },
  oneNtResponseAfterMajor: { forcing: "non-forcing", maxHcp: 10, minHcp: 6 },
  openingRequirements: { majorSuitMinLength: 5 },
  dontOvercall: { minHcp: 8, maxHcp: 15 },
};

export const TWO_OVER_ONE_SYSTEM_CONFIG: SystemConfig = {
  systemId: BASE_SYSTEM_TWO_OVER_ONE,
  displayName: "2/1 Game Forcing",
  ntOpening: { minHcp: 15, maxHcp: 17 },
  responderThresholds: {
    inviteMin: 8,
    inviteMax: 9,
    gameMin: 10,
    slamMin: 15,
  },
  openerRebid: { notMinimum: 16 },
  interference: { redoubleMin: 10 },
  suitResponse: { twoLevelMin: 12, twoLevelForcingDuration: "game" },
  oneNtResponseAfterMajor: { forcing: "semi-forcing", maxHcp: 12, minHcp: 6 },
  openingRequirements: { majorSuitMinLength: 5 },
  dontOvercall: { minHcp: 8, maxHcp: 15 },
};

export const ACOL_SYSTEM_CONFIG: SystemConfig = {
  systemId: BASE_SYSTEM_ACOL,
  displayName: "Acol",
  // Standard weak NT: 12-14 HCP (EBU standard, UK tournament play)
  ntOpening: { minHcp: 12, maxHcp: 14 },
  responderThresholds: {
    // Thresholds shifted to keep 25 combined for game (EBU standard Acol)
    inviteMin: 10,  // 10+12=22 combined; invite with 22-24, game at 25+
    inviteMax: 12,  // invite range: 10-12
    gameMin: 13,    // 13+12=25 combined for game
    slamMin: 19,    // 19+14=33 combined for slam
  },
  // minHcp+1 pattern: accepts invite with 13-14, declines with 12
  openerRebid: { notMinimum: 13 },
  // 9+12=21 min combined for penalty interest (cf. SAYC: 10+15=25). Assumes strength redouble — not Wriggle/SOS escape.
  interference: { redoubleMin: 9 },
  // Practical guideline; Acol forces new suit by structure regardless of HCP. Simplified for teaching.
  suitResponse: { twoLevelMin: 10, twoLevelForcingDuration: "one-round" },
  // "Dustbin 1NT": non-forcing, capped at 9; with 10+ responder bids a new suit
  oneNtResponseAfterMajor: { forcing: "non-forcing", maxHcp: 9, minHcp: 6 },
  openingRequirements: { majorSuitMinLength: 4 },
  dontOvercall: { minHcp: 8, maxHcp: 15 },
};

// ─── System config registry ─────────────────────────────────

/** UI-friendly metadata for each base system. */
export interface BaseSystemMeta {
  readonly id: BaseSystemId;
  readonly label: string;
  readonly shortLabel: string;
}

/** Available base systems for the UI selector (order = display order). */
export const AVAILABLE_BASE_SYSTEMS: readonly BaseSystemMeta[] = [
  { id: BASE_SYSTEM_SAYC, label: "Standard American Yellow Card", shortLabel: "SAYC" },
  { id: BASE_SYSTEM_TWO_OVER_ONE, label: "2/1 Game Forcing", shortLabel: "2/1" },
  { id: BASE_SYSTEM_ACOL, label: "Acol", shortLabel: "Acol" },
] as const;

const SYSTEM_CONFIG_MAP: Readonly<Record<string, SystemConfig>> = {
  [BASE_SYSTEM_SAYC]: SAYC_SYSTEM_CONFIG,
  [BASE_SYSTEM_TWO_OVER_ONE]: TWO_OVER_ONE_SYSTEM_CONFIG,
  [BASE_SYSTEM_ACOL]: ACOL_SYSTEM_CONFIG,
};

/** Look up SystemConfig by base system id. Falls back to SAYC for unknown ids. */
export function getSystemConfig(id: BaseSystemId): SystemConfig {
  return SYSTEM_CONFIG_MAP[id] ?? SAYC_SYSTEM_CONFIG;
}
