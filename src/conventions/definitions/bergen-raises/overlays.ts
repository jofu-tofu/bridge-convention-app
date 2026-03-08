// Bergen Raises overlay patches for interference handling.
// Bergen is OFF when opponent doubles or overcalls partner's 1M opening.
// Pattern: follows Stayman's overlay structure (overlays.ts).

import { CompetitionMode, SystemMode } from "../../core/dialogue/dialogue-state";
import type { ConventionOverlayPatch } from "../../core/overlay/overlay";

export const bergenOverlays: readonly ConventionOverlayPatch[] = [
  // After opponent doubles 1M: Bergen OFF, natural raises only
  {
    id: "bergen-doubled",
    roundName: "opening",
    matches: (state) =>
      state.familyId === "bergen" &&
      state.competitionMode === CompetitionMode.Doubled &&
      state.systemMode === SystemMode.Off,
    suppressIntent: () => true,
  },

  // After opponent overcalls 1M: Bergen OFF, natural raises only
  {
    id: "bergen-overcalled",
    roundName: "opening",
    matches: (state) =>
      state.familyId === "bergen" &&
      state.competitionMode === CompetitionMode.Overcalled &&
      state.systemMode === SystemMode.Off,
    suppressIntent: () => true,
  },
];
