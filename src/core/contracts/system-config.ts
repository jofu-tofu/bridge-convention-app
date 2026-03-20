/**
 * System-level bidding configuration.
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

import type { BaseSystemId } from "./base-system-vocabulary";
import { BASE_SYSTEM_SAYC, BASE_SYSTEM_TWO_OVER_ONE } from "./base-system-vocabulary";

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
] as const;

const SYSTEM_CONFIG_MAP: Readonly<Record<string, SystemConfig>> = {
  [BASE_SYSTEM_SAYC]: SAYC_SYSTEM_CONFIG,
  [BASE_SYSTEM_TWO_OVER_ONE]: TWO_OVER_ONE_SYSTEM_CONFIG,
};

/** Look up SystemConfig by base system id. Falls back to SAYC for unknown ids. */
export function getSystemConfig(id: BaseSystemId): SystemConfig {
  return SYSTEM_CONFIG_MAP[id] ?? SAYC_SYSTEM_CONFIG;
}
