import type { Screen } from "../../stores/app.svelte";

interface LearnSubItem {
  label: string;
  active: boolean;
  onclick: () => void;
}

/**
 * Shared learn sub-navigation items used by both desktop NavRail flyout
 * and mobile LearnSubNav segmented control.
 */
export function createLearnSubItems(
  currentScreen: Screen,
  navigate: { toConventions: () => void; toProfiles: () => void },
): LearnSubItem[] {
  return [
    {
      label: "Conventions",
      active: currentScreen === "learning",
      onclick: navigate.toConventions,
    },
    {
      label: "Systems",
      active: currentScreen === "profiles",
      onclick: navigate.toProfiles,
    },
  ];
}
