/**
 * Practice preferences — persisted user choices that shape practice sessions.
 *
 * Composes domain types from drill-types.ts and system-config.ts into
 * a single blob for localStorage persistence. The app store owns the
 * reactive state; this file defines the shape.
 */

import type { BaseSystemId } from "../conventions";
import type { DrillSettings } from "./drill-types";
import { DEFAULT_DRILL_SETTINGS } from "./drill-types";
import { BASE_SYSTEM_SAYC } from "../conventions";

// ─── Display preferences ────────────────────────────────────
//
// UI preferences that affect how information is shown during drills
// but do NOT affect deal generation or scoring.

/** UI display preferences for the drill session. */
export interface DisplayPreferences {
  /** Show gray educational annotations under bids in the auction table.
   *  When false, only ACBL-required alerts and announcements are shown. */
  readonly showEducationalAnnotations: boolean;
}

export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  showEducationalAnnotations: true,
};

// ─── Composed practice preferences ──────────────────────────

export interface PracticePreferences {
  /** Base bidding system (e.g. "sayc", "two-over-one"). */
  readonly baseSystemId: BaseSystemId;
  /** Drill execution parameters (opponent behavior + deal generation). */
  readonly drill: DrillSettings;
  /** UI display preferences. */
  readonly display: DisplayPreferences;
}

export const DEFAULT_PRACTICE_PREFERENCES: PracticePreferences = {
  baseSystemId: BASE_SYSTEM_SAYC,
  drill: DEFAULT_DRILL_SETTINGS,
  display: DEFAULT_DISPLAY_PREFERENCES,
};
