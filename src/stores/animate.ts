/**
 * Pure animation helpers for AI bid/play delays.
 *
 * No Svelte, no $state. Callbacks mutate store state; delayFn is injectable
 * for testing (pass a no-op or fake-timer-driven delay).
 */

/** Delay between AI bid reveals. */
export const AI_BID_DELAY = 300;
/** Delay between AI card plays — tuned for readable pacing without feeling sluggish. */
export const AI_PLAY_DELAY = 500;
/** Pause after a completed trick before clearing — longer than play delay so the
 *  user can see all 4 cards before they sweep off the table. */
export const TRICK_PAUSE = 1000;

/**
 * Animate a sequence of items with incremental reveal.
 *
 * Shared by bidding AI-bid animation, play AI-card animation, and drill-start
 * initial bids. Calls `onReveal(i)` after each delay so the caller can update
 * reactive state. Returns false if cancelled mid-loop.
 */
export async function animateIncremental(opts: {
  count: number;
  delayMs: number;
  delayFn: (ms: number) => Promise<void>;
  isCancelled: () => boolean;
  onReveal: (index: number) => void;
}): Promise<boolean> {
  for (let i = 0; i < opts.count; i++) {
    await opts.delayFn(opts.delayMs);
    if (opts.isCancelled()) return false;
    opts.onReveal(i);
  }
  return true;
}
