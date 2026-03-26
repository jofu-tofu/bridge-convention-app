/**
 * Pure animation helpers for AI bid/play delays.
 *
 * No Svelte, no $state. Callbacks mutate store state; delayFn is injectable
 * for testing (pass a no-op or fake-timer-driven delay).
 */

export const AI_PLAY_DELAY = 500;
export const TRICK_PAUSE = 1000;
