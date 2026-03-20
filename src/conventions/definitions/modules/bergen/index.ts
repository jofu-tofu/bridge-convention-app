/**
 * Bergen Raises convention module.
 *
 * Self-contained module exporting a ConventionModule object.
 * FSM states and transitions are handled by the protocol frame (base-track.ts).
 */

import type { ConventionModule } from "../../../../core/contracts/convention-module";
import {
  BERGEN_R1_HEARTS_SURFACES,
  BERGEN_R1_SPADES_SURFACES,
  BERGEN_R2_AFTER_CONSTRUCTIVE_HEARTS_SURFACES,
  BERGEN_R2_AFTER_CONSTRUCTIVE_SPADES_SURFACES,
  BERGEN_R2_AFTER_LIMIT_HEARTS_SURFACES,
  BERGEN_R2_AFTER_LIMIT_SPADES_SURFACES,
  BERGEN_R2_AFTER_PREEMPTIVE_HEARTS_SURFACES,
  BERGEN_R2_AFTER_PREEMPTIVE_SPADES_SURFACES,
  BERGEN_R3_AFTER_GAME_SURFACES,
  BERGEN_R3_AFTER_SIGNOFF_SURFACES,
  BERGEN_R3_AFTER_GAME_TRY_HEARTS_SURFACES,
  BERGEN_R3_AFTER_GAME_TRY_SPADES_SURFACES,
  BERGEN_R4_SURFACES,
} from "./meaning-surfaces";
import { bergenFacts } from "./facts";
import { BERGEN_EXPLANATION_ENTRIES } from "./explanation-catalog";
import { BERGEN_PEDAGOGICAL_RELATIONS } from "./pedagogical-relations";
import { BERGEN_ALTERNATIVE_GROUPS } from "./alternatives";

export const bergenModule: ConventionModule = {
  moduleId: "bergen",

  entrySurfaces: [
    ...BERGEN_R1_HEARTS_SURFACES,
    ...BERGEN_R1_SPADES_SURFACES,
  ],

  surfaceGroups: [
    { groupId: "responder-r1-hearts", surfaces: BERGEN_R1_HEARTS_SURFACES },
    { groupId: "responder-r1-spades", surfaces: BERGEN_R1_SPADES_SURFACES },
    { groupId: "opener-after-constructive-hearts", surfaces: BERGEN_R2_AFTER_CONSTRUCTIVE_HEARTS_SURFACES },
    { groupId: "opener-after-constructive-spades", surfaces: BERGEN_R2_AFTER_CONSTRUCTIVE_SPADES_SURFACES },
    { groupId: "opener-after-limit-hearts", surfaces: BERGEN_R2_AFTER_LIMIT_HEARTS_SURFACES },
    { groupId: "opener-after-limit-spades", surfaces: BERGEN_R2_AFTER_LIMIT_SPADES_SURFACES },
    { groupId: "opener-after-preemptive-hearts", surfaces: BERGEN_R2_AFTER_PREEMPTIVE_HEARTS_SURFACES },
    { groupId: "opener-after-preemptive-spades", surfaces: BERGEN_R2_AFTER_PREEMPTIVE_SPADES_SURFACES },
    { groupId: "responder-after-game", surfaces: BERGEN_R3_AFTER_GAME_SURFACES },
    { groupId: "responder-after-signoff", surfaces: BERGEN_R3_AFTER_SIGNOFF_SURFACES },
    { groupId: "responder-after-game-try-hearts", surfaces: BERGEN_R3_AFTER_GAME_TRY_HEARTS_SURFACES },
    { groupId: "responder-after-game-try-spades", surfaces: BERGEN_R3_AFTER_GAME_TRY_SPADES_SURFACES },
    { groupId: "opener-r4", surfaces: BERGEN_R4_SURFACES },
  ],

  // FSM handled by protocol frame (base-track.ts)
  entryTransitions: [],
  machineStates: [],

  facts: bergenFacts,

  explanationEntries: BERGEN_EXPLANATION_ENTRIES,
  pedagogicalRelations: BERGEN_PEDAGOGICAL_RELATIONS,
  alternatives: BERGEN_ALTERNATIVE_GROUPS,
  intentFamilies: [],
};

// Re-export individual pieces for backward compatibility
export { bergenFacts } from "./facts";
export { BERGEN_CLASSES } from "./semantic-classes";
export { BERGEN_EXPLANATION_ENTRIES, BERGEN_EXPLANATION_CATALOG } from "./explanation-catalog";
export { BERGEN_PEDAGOGICAL_RELATIONS } from "./pedagogical-relations";
export { BERGEN_ALTERNATIVE_GROUPS } from "./alternatives";
export * from "./meaning-surfaces";
