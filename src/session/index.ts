// ── Session module public API ────────────────────────────────────────

// Phase machine
export { isValidTransition } from "./phase-machine";
export type { GamePhase } from "./phase-machine";

// Drill configuration
export { OpponentMode, PracticeMode, PracticeRole, PlayPreference, PromptMode, DEFAULT_DRILL_TUNING, DEFAULT_DRILL_SETTINGS } from "./drill-types";
export type { VulnerabilityDistribution, DrillSettings } from "./drill-types";

// Play profiles
export type { PlayProfileId } from "./heuristics/play-profiles";
export { PLAY_PROFILES } from "./heuristics/play-profiles";

// Practice preferences
export type { PracticePreferences, DisplayPreferences } from "./practice-preferences";
export { DEFAULT_PRACTICE_PREFERENCES, DEFAULT_DISPLAY_PREFERENCES } from "./practice-preferences";

// Bid feedback (consumed by service/debug-types)
export type { BidFeedbackDTO } from "./bid-feedback-builder";

// Phase coordinator
export { resolveTransition } from "./phase-coordinator";
export type { ViewportNeeded } from "./phase-coordinator";
