import type { ConventionConfig } from "../conventions/types";

export type Screen = "select" | "game" | "explanation";

export function createAppStore() {
  let currentScreen = $state<Screen>("select");
  let selectedConvention = $state<ConventionConfig | null>(null);

  return {
    get screen() {
      return currentScreen;
    },
    get selectedConvention() {
      return selectedConvention;
    },

    selectConvention(config: ConventionConfig) {
      selectedConvention = config;
      currentScreen = "game";
    },

    navigateToMenu() {
      selectedConvention = null;
      currentScreen = "select";
    },

    navigateToExplanation() {
      currentScreen = "explanation";
    },

    navigateToGame() {
      currentScreen = "game";
    },
  };
}
