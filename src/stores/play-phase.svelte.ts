/**
 * Play-phase sub-module.
 *
 * Owns all reactive state, derived values, and async logic for the card-play
 * lifecycle. Created via `createPlayPhase()` and called from the game store
 * coordinator.
 */

import { tick } from "svelte";

import type { Card, Seat, PlayedCard } from "../service";
import type { DevServicePort, SessionHandle } from "../service";
import type { PlayingViewport } from "../service";
import type { PhaseEvent } from "../service";
import type { PlaySuggestions } from "../service/debug-types";
import { TRICK_PAUSE, AI_PLAY_DELAY } from "./animate";

// Type-only import — no runtime circular dependency.
import type { PlayLogEntry } from "./game.svelte";

// ── Internal state shape ────────────────────────────────────────────

interface PlayPhaseState {
  score: number | null;
  aborted: boolean;
  showingTrickResult: boolean;
  processing: boolean;
  log: PlayLogEntry[];
  suggestions: PlaySuggestions;
}

function freshPlayState(aborted = false): PlayPhaseState {
  return { score: null, aborted, showingTrickResult: false, processing: false, log: [], suggestions: [] };
}

// ── Dependency contract ─────────────────────────────────────────────

export interface PlayDeps {
  getActiveHandle: () => SessionHandle | null;
  getActiveService: () => DevServicePort;
  getPlayingViewport: () => PlayingViewport | null;
  setPlayingViewport: (vp: PlayingViewport | null) => void;
  dispatchEvent: (handle: SessionHandle, event: PhaseEvent) => Promise<unknown>;
  delayFn: (ms: number) => Promise<void>;
}

// ── Factory ─────────────────────────────────────────────────────────

export function createPlayPhase(deps: PlayDeps) {
  // ── State ───────────────────────────────────────────────────────
  let play = $state<PlayPhaseState>(freshPlayState());
  let animatedTrickOverride = $state<readonly PlayedCard[] | null>(null);

  // ── Derived ─────────────────────────────────────────────────────

  const displayedCurrentTrick = $derived.by((): readonly PlayedCard[] => {
    if (animatedTrickOverride) return animatedTrickOverride;
    const vp = deps.getPlayingViewport();
    if (!vp) return [];
    return vp.currentTrick;
  });

  // ── Helpers ─────────────────────────────────────────────────────

  async function fetchPlaySuggestions(handle: SessionHandle) {
    if (!import.meta.env.DEV) return;
    try {
      play.suggestions = await deps.getActiveService().getPlaySuggestions(handle);
    } catch {
      play.suggestions = [];
    }
  }

  /**
   * Animate a sequence of AI plays with delays between cards and pauses at trick boundaries.
   * Builds a local trick buffer that overrides the viewport's currentTrick for display.
   */
  async function animateAiPlays(
    handle: SessionHandle,
    aiPlays: readonly { seat: Seat; card: Card; reason: string; trickComplete?: boolean }[],
    baseTrick: readonly PlayedCard[],
  ): Promise<{ ok: boolean; finalCompletedTrick: readonly PlayedCard[] | null }> {
    if (aiPlays.length === 0) return { ok: true, finalCompletedTrick: null };
    // Start with the cards already visible in the current trick
    const trickBuffer: PlayedCard[] = [...baseTrick];
    animatedTrickOverride = trickBuffer;
    let finalCompletedTrick: readonly PlayedCard[] | null = null;

    for (const aiPlay of aiPlays) {
      await deps.delayFn(AI_PLAY_DELAY);
      if (deps.getActiveHandle() !== handle || play.aborted) return { ok: false, finalCompletedTrick: null };

      // Add the AI card to the display buffer
      trickBuffer.push({ card: aiPlay.card, seat: aiPlay.seat });
      animatedTrickOverride = [...trickBuffer];

      play.log = [...play.log, {
        seat: aiPlay.seat, card: aiPlay.card, reason: aiPlay.reason,
        trickIndex: deps.getPlayingViewport()?.tricks.length ?? 0,
      }];

      // Pause at trick boundaries (4th card in trick)
      if (aiPlay.trickComplete) {
        play.showingTrickResult = true;

        // Capture the completed trick if this is the last AI play
        const isLastAiPlay = aiPlay === aiPlays[aiPlays.length - 1];
        if (isLastAiPlay) {
          finalCompletedTrick = [...trickBuffer];
        }

        await deps.delayFn(TRICK_PAUSE);
        if (deps.getActiveHandle() !== handle || play.aborted) return { ok: false, finalCompletedTrick: null };

        play.showingTrickResult = false;
        // Clear the trick buffer for the next trick
        trickBuffer.length = 0;
        animatedTrickOverride = [...trickBuffer];
      }
    }

    animatedTrickOverride = null;
    return { ok: true, finalCompletedTrick };
  }

  /**
   * Show the final completed trick briefly, then transition to review.
   */
  async function showFinalTrickAndTransition(
    handle: SessionHandle,
    finalTrick: readonly PlayedCard[],
    resultScore: number | null,
  ): Promise<void> {
    animatedTrickOverride = finalTrick;
    play.showingTrickResult = true;
    await deps.delayFn(TRICK_PAUSE);
    if (deps.getActiveHandle() !== handle || play.aborted) return;
    play.score = resultScore;
    animatedTrickOverride = null;
    await deps.dispatchEvent(handle, { type: "PLAY_COMPLETE" });
  }

  // ── Main action ─────────────────────────────────────────────────

  async function userPlayCardViaService(card: Card, seat: Seat) {
    const activeHandle = deps.getActiveHandle();
    if (!activeHandle) return;
    if (play.processing || play.aborted) return;

    const handle = activeHandle;
    const activeService = deps.getActiveService();
    play.processing = true;
    try {
      // Snapshot the current trick before the service processes the play
      const playingVp = deps.getPlayingViewport();
      const trickBeforePlay: PlayedCard[] = playingVp
        ? [...playingVp.currentTrick]
        : [];

      const result = await activeService.playCard(handle, card, seat);
      if (deps.getActiveHandle() !== handle) return;

      if (!result.accepted) return;

      // When play completes, skip viewport refresh to keep hands visible during
      // the last trick animation (otherwise all hands show as empty)
      if (!result.playComplete) {
        deps.setPlayingViewport(await activeService.getPlayingViewport(handle));
        if (deps.getActiveHandle() !== handle) return;
      }

      // Build the base trick: cards that were visible + the user's card
      const baseTrick: PlayedCard[] = [...trickBeforePlay, { card, seat }];

      // If the user's card completed the trick (4th card), pause to show it
      if (baseTrick.length === 4) {
        animatedTrickOverride = baseTrick;
        play.showingTrickResult = true;
        await deps.delayFn(TRICK_PAUSE);
        if (deps.getActiveHandle() !== handle || play.aborted) return;

        if (!result.playComplete) {
          play.showingTrickResult = false;
          animatedTrickOverride = null;
          // Start fresh for AI plays in the next trick
          const { ok } = await animateAiPlays(handle, result.aiPlays, []);
          if (!ok) return;
        }
        // When play completes, keep the last trick visible on the table
      } else {
        // User's card didn't complete the trick — AI continues
        const { ok, finalCompletedTrick } = await animateAiPlays(handle, result.aiPlays, baseTrick);
        if (!ok) return;

        if (result.playComplete) {
          // AI completed the final trick. finalCompletedTrick should be non-null here
          // because playComplete + baseTrick.length < 4 means AI played the completing card.
          // Guard defensively in case the service contract changes.
          if (finalCompletedTrick) {
            await showFinalTrickAndTransition(handle, finalCompletedTrick, result.score);
          } else {
            play.score = result.score;
            await deps.dispatchEvent(handle, { type: "PLAY_COMPLETE" });
          }
          return;
        }
      }

      // Handle play completion (baseTrick.length === 4 branch)
      if (result.playComplete) {
        play.score = result.score;
        play.suggestions = [];
        await deps.dispatchEvent(handle, { type: "PLAY_COMPLETE" });
      } else {
        // Normal mid-game — refresh viewport for next turn
        deps.setPlayingViewport(await activeService.getPlayingViewport(handle));
        if (deps.getActiveHandle() !== handle) return;
        void fetchPlaySuggestions(handle);
      }
    } finally {
      play.processing = false;
      animatedTrickOverride = null;
      await tick();
    }
  }

  function resetPlay() {
    play = freshPlayState(true); // aborted=true cancels in-flight animations
    animatedTrickOverride = null;
    deps.setPlayingViewport(null);
  }

  // ── Public surface ──────────────────────────────────────────────

  return {
    // State accessors
    get play() { return play; },
    set play(v: PlayPhaseState) { play = v; },
    get animatedTrickOverride() { return animatedTrickOverride; },
    set animatedTrickOverride(v: readonly PlayedCard[] | null) { animatedTrickOverride = v; },

    // Derived (read-only)
    get displayedCurrentTrick() { return displayedCurrentTrick; },

    // Actions
    userPlayCardViaService,
    animateAiPlays,
    showFinalTrickAndTransition,
    fetchPlaySuggestions,
    resetPlay,

    // Lifecycle
    reset() {
      play = freshPlayState();
      animatedTrickOverride = null;
    },
  };
}

export type PlayPhase = ReturnType<typeof createPlayPhase>;
