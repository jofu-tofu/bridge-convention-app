import { CompetitionMode, SystemMode } from "../../core/dialogue/dialogue-state";
import { getSystemModeFor } from "../../core/dialogue/dialogue-state";
import type { ConventionOverlayPatch } from "../../core/overlay";
import { round1AskAfterDouble } from "./tree";
import { fallback } from "../../core/rule-tree";
import { STAYMAN_CAPABILITY } from "./constants";

export const staymanOverlays: readonly ConventionOverlayPatch[] = [
  {
    id: "stayman-doubled",
    roundName: "nt-opening",
    matches: (state) =>
      state.competitionMode === CompetitionMode.Doubled &&
      getSystemModeFor(state, STAYMAN_CAPABILITY) === SystemMode.Modified,
    replacementTree: round1AskAfterDouble,
  },
  {
    id: "stayman-overcalled",
    roundName: "nt-opening",
    matches: (state) =>
      state.competitionMode !== CompetitionMode.Uncontested &&
      getSystemModeFor(state, STAYMAN_CAPABILITY) === SystemMode.Off,
    replacementTree: fallback("system-off-overcall"),
  },
];
