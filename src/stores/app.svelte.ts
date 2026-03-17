import type { ConventionConfig } from "../conventions/core";
import type { OpponentMode } from "../bootstrap/types";

export type Screen = "select" | "game" | "learning" | "settings" | "coverage";

export function createAppStore() {
  let currentScreen = $state<Screen>("select");
  let selectedConvention = $state<ConventionConfig | null>(null);
  let devSeed = $state<number | null>(null);
  let devDealCount = $state(0);
  let debugPanelOpen = $state(false);
  let engineStatus = $state<string | null>(null);
  let engineError = $state<string | null>(null);
  let learningConvention = $state<ConventionConfig | null>(null);
  let autoplay = $state(false);
  let targetState = $state<string | null>(null);

  // Opponent strategy preference — persisted to localStorage
  const OPPONENT_MODE_KEY = "bridge-app:opponent-mode";
  function loadOpponentMode(): OpponentMode {
    try {
      const stored = localStorage.getItem(OPPONENT_MODE_KEY);
      if (stored === "none" || stored === "natural") return stored;
    } catch { /* SSR or storage unavailable */ }
    return "natural";
  }
  let opponentMode = $state<OpponentMode>(loadOpponentMode());

  return {
    get screen() {
      return currentScreen;
    },
    get selectedConvention() {
      return selectedConvention;
    },
    get learningConvention() {
      return learningConvention;
    },
    get devSeed() {
      return devSeed;
    },
    get devDealCount() {
      return devDealCount;
    },

    selectConvention(config: ConventionConfig) {
      selectedConvention = config;
      learningConvention = null;
      currentScreen = "game";
    },

    navigateToLearning(config: ConventionConfig) {
      learningConvention = config;
      selectedConvention = null;
      currentScreen = "learning";
    },

    navigateToMenu() {
      selectedConvention = null;
      learningConvention = null;
      currentScreen = "select";
    },

    navigateToSettings() {
      currentScreen = "settings";
    },

    navigateToCoverage() {
      currentScreen = "coverage";
    },

    setDevSeed(seed: number | null) {
      devSeed = seed;
      devDealCount = 0;
    },

    advanceDevDeal() {
      devDealCount++;
    },

    get debugPanelOpen() {
      return debugPanelOpen;
    },

    toggleDebugPanel() {
      debugPanelOpen = !debugPanelOpen;
    },

    setDebugPanel(open: boolean) {
      debugPanelOpen = open;
    },

    get engineStatus() {
      return engineStatus;
    },

    setEngineStatus(status: string) {
      engineStatus = status;
    },

    get engineError() {
      return engineError;
    },

    setEngineError(msg: string | null) {
      engineError = msg;
    },

    get autoplay() {
      return autoplay;
    },

    setAutoplay(on: boolean) {
      autoplay = on;
    },

    get opponentMode() {
      return opponentMode;
    },

    setOpponentMode(mode: OpponentMode) {
      opponentMode = mode;
      try { localStorage.setItem(OPPONENT_MODE_KEY, mode); } catch { /* ignore */ }
    },

    get targetState() {
      return targetState;
    },

    setTargetState(state: string | null) {
      targetState = state;
    },
  };
}
