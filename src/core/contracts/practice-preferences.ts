/**
 * Practice preferences — persisted user choices that shape practice sessions.
 *
 * Composes domain types from drill.ts and base-system-vocabulary.ts into
 * a single blob for localStorage persistence. The app store owns the
 * reactive state; this file defines the shape.
 */

import type { BaseSystemId } from "./base-system-vocabulary";
import type { OpponentMode, DrillTuning } from "./drill";
import { DEFAULT_DRILL_TUNING } from "./drill";
import { BASE_SYSTEM_SAYC } from "./base-system-vocabulary";

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
  /** Opponent bidding behavior. */
  readonly opponentMode: OpponentMode;
  /** Deal-generation tuning (vulnerability, off-convention rate). */
  readonly drillTuning: DrillTuning;
  /** UI display preferences. */
  readonly display: DisplayPreferences;
}

export const DEFAULT_PRACTICE_PREFERENCES: PracticePreferences = {
  baseSystemId: BASE_SYSTEM_SAYC,
  opponentMode: "natural",
  drillTuning: DEFAULT_DRILL_TUNING,
  display: DEFAULT_DISPLAY_PREFERENCES,
};
