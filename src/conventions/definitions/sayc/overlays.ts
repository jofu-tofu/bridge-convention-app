// SAYC overlay patches for competitive interference.
// Overlays replace the dispatch round's hand tree when interference is detected.

import { CompetitionMode } from "../../core/dialogue/dialogue-state";
import type { ConventionOverlayPatch } from "../../core/overlay/overlay";
import { fallback } from "../../core/tree/rule-tree";

export const saycOverlays: readonly ConventionOverlayPatch[] = [
  // After 1NT doubled: systems OFF — no Stayman, no transfers, natural bidding only.
  // Replacement tree is a fallback (pass); future: natural bidding hand tree.
  {
    id: "sayc-1nt-doubled",
    roundName: "dispatch",
    matches: (state) =>
      state.familyId === "sayc-1nt" &&
      state.competitionMode === CompetitionMode.Doubled,
    replacementTree: fallback("sayc-1nt-systems-off"),
  },

  // After 1-level suit opening overcalled: natural bidding, negative doubles available.
  // Replacement tree is a fallback (pass); future: negative double / natural hand tree.
  {
    id: "sayc-overcalled",
    roundName: "dispatch",
    matches: (state) =>
      state.familyId === "sayc-suit" &&
      state.competitionMode === CompetitionMode.Overcalled,
    replacementTree: fallback("sayc-overcalled-natural"),
  },
];
