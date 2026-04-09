/**
 * Viewport caching sub-module.
 *
 * Owns the reactive viewport cache and provides fetch/lookup helpers.
 * Created via `createViewportCache()` and called from the game store coordinator.
 */

import type {
  BiddingViewport,
  DeclarerPromptViewport,
  PlayingViewport,
  ExplanationViewport,
} from "../service";
import type { DrillHandle } from "../service";
import type { DevServicePort } from "../service";
import type { GamePhase, ViewportNeeded } from "../service";

// ── Internal state shape ────────────────────────────────────────────

export interface ViewportCache {
  bidding: BiddingViewport | null;
  declarerPrompt: DeclarerPromptViewport | null;
  playing: PlayingViewport | null;
  explanation: ExplanationViewport | null;
}

export function freshViewportCache(): ViewportCache {
  return { bidding: null, declarerPrompt: null, playing: null, explanation: null };
}

// ── Dependency contract ─────────────────────────────────────────────

export interface ViewportCacheDeps {
  getActiveService: () => DevServicePort;
}

// ── Factory ─────────────────────────────────────────────────────────

export function createViewportCache(deps: ViewportCacheDeps) {
  let viewports = $state<ViewportCache>(freshViewportCache());

  async function fetchAndCache(handle: DrillHandle, vpName: ViewportNeeded): Promise<void> {
    const svc = deps.getActiveService();
    switch (vpName) {
      case "bidding":
        viewports.bidding = await svc.getBiddingViewport(handle);
        break;
      case "declarerPrompt":
        viewports.declarerPrompt = await svc.getDeclarerPromptViewport(handle);
        break;
      case "playing":
        viewports.playing = await svc.getPlayingViewport(handle);
        break;
      case "explanation":
        viewports.explanation = await svc.getExplanationViewport(handle);
        break;
    }
  }

  function reset(): void {
    viewports = freshViewportCache();
  }

  return {
    get viewports() { return viewports; },
    set viewports(v: ViewportCache) { viewports = v; },
    fetchAndCache,
    reset,
  };
}

/** Map a game phase to the viewport it needs, or null if none. */
export function viewportNeededForPhase(currentPhase: GamePhase): ViewportNeeded | null {
  switch (currentPhase) {
    case "BIDDING":
      return "bidding";
    case "DECLARER_PROMPT":
      return "declarerPrompt";
    case "PLAYING":
      return "playing";
    case "EXPLANATION":
      return "explanation";
  }
}

export type ViewportCacheModule = ReturnType<typeof createViewportCache>;
