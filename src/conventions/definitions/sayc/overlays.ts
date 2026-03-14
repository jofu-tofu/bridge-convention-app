// SAYC overlay patches for competitive interference.
// Overlays replace the dispatch round's hand tree when interference is detected.

import { CompetitionMode } from "../../core/dialogue/dialogue-state";
import type { ConventionOverlayPatch } from "../../core/overlay/overlay";
import { saycPass } from "./helpers";

export const saycOverlays: readonly ConventionOverlayPatch[] = [
  // After 1NT doubled: systems OFF — no Stayman, no transfers, natural bidding only.
  // Future: natural bidding hand tree.
  {
    id: "sayc-1nt-doubled",
    roundName: "dispatch",
    matches: (state) =>
      state.familyId === "sayc-1nt" &&
      state.competitionMode === CompetitionMode.Doubled,
    replacementTree: saycPass("1nt-systems-off"),
  },

  // After 1-level suit opening overcalled: natural bidding, negative doubles available.
  // Future: negative double / natural hand tree.
  {
    id: "sayc-overcalled",
    roundName: "dispatch",
    matches: (state) =>
      state.familyId === "sayc-suit" &&
      state.competitionMode === CompetitionMode.Overcalled,
    replacementTree: saycPass("overcalled-natural"),
  },
];
