// ── Session module public API ────────────────────────────────────────

// Phase machine
export { isValidTransition } from "./phase-machine";
export type { GamePhase } from "./phase-machine";

// Drill configuration
export type { OpponentMode, VulnerabilityDistribution, DrillSettings, PracticeMode, PracticeRole, PracticeFocus, ContinuationTarget, PlayPreference } from "./drill-types";
export { DEFAULT_DRILL_TUNING, DEFAULT_DRILL_SETTINGS, ALL_TARGETS_FOCUS } from "./drill-types";

// Play profiles
export type { PlayProfileId } from "./heuristics/play-profiles";
export { PLAY_PROFILES } from "./heuristics/play-profiles";

// Practice preferences
export type { PracticePreferences, DisplayPreferences } from "./practice-preferences";
export { DEFAULT_PRACTICE_PREFERENCES, DEFAULT_DISPLAY_PREFERENCES } from "./practice-preferences";

// Practice focus & bid context
export { derivePracticeFocus } from "./practice-focus";
export { resolveBidContext } from "./bid-context-resolver";

// Bid feedback (consumed by service/debug-types)
export type { BidFeedbackDTO } from "./bid-feedback-builder";
