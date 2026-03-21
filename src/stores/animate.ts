/**
 * Pure animation helpers for AI bid/play delays.
 *
 * No Svelte, no $state. Callbacks mutate store state; delayFn is injectable
 * for testing (pass a no-op or fake-timer-driven delay).
 */

import type { AiBidEntry, AiPlayEntry } from "../service";

export const AI_BID_DELAY = 300;
export const AI_PLAY_DELAY = 500;
export const TRICK_PAUSE = 1000;

/** Animate AI bids one at a time with delays. */
export async function animateAiBids(
  aiBids: readonly AiBidEntry[],
  onBid: (bid: AiBidEntry) => void,
  delayFn: (ms: number) => Promise<void>,
): Promise<void> {
  for (const bid of aiBids) {
    await delayFn(AI_BID_DELAY);
    onBid(bid);
  }
}

/** Animate AI plays one at a time with delays, pausing at trick completions. */
export async function animateAiPlays(
  aiPlays: readonly AiPlayEntry[],
  callbacks: {
    onPlay: (play: AiPlayEntry) => void;
    getCurrentTrickLength: () => number;
    onTrickComplete: () => Promise<void>;
  },
  delayFn: (ms: number) => Promise<void>,
): Promise<void> {
  for (const play of aiPlays) {
    await delayFn(AI_PLAY_DELAY);
    callbacks.onPlay(play);
    if (callbacks.getCurrentTrickLength() === 4) {
      await delayFn(TRICK_PAUSE);
      await callbacks.onTrickComplete();
    }
  }
}
