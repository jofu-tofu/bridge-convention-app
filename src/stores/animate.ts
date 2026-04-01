/**
 * Pure animation helpers for AI bid/play delays.
 *
 * No Svelte, no $state. Callbacks mutate store state; delayFn is injectable
 * for testing (pass a no-op or fake-timer-driven delay).
 */

/** Delay between AI card plays — tuned for readable pacing without feeling sluggish. */
export const AI_PLAY_DELAY = 500;
/** Pause after a completed trick before clearing — longer than play delay so the
 *  user can see all 4 cards before they sweep off the table. */
export const TRICK_PAUSE = 1000;
