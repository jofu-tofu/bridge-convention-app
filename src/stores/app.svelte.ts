import type { ConventionConfig } from "../conventions/types";

export type Screen = "select" | "game";

export function createAppStore() {
  let currentScreen = $state<Screen>("select");
  let selectedConvention = $state<ConventionConfig | null>(null);
  let devSeed = $state<number | null>(null);
  let devDealCount = $state(0);
  let debugPanelOpen = $state(false);

  return {
    get screen() {
      return currentScreen;
    },
    get selectedConvention() {
      return selectedConvention;
    },
    get devSeed() {
      return devSeed;
    },
    get devDealCount() {
      return devDealCount;
    },

    selectConvention(config: ConventionConfig) {
      selectedConvention = config;
      currentScreen = "game";
    },

    navigateToMenu() {
      selectedConvention = null;
      currentScreen = "select";
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
  };
}
