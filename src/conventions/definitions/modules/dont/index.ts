/**
 * DONT (Disturbing Opponents' Notrump) convention module.
 *
 * Self-contained module exporting a ConventionModule object.
 * FSM states and transitions are handled by the protocol frame (base-track.ts).
 */

import type { ConventionModule } from "../../../../core/contracts/convention-module";
import {
  DONT_R1_SURFACES,
  DONT_ADVANCER_2H_SURFACES,
  DONT_ADVANCER_2D_SURFACES,
  DONT_ADVANCER_2C_SURFACES,
  DONT_ADVANCER_2S_SURFACES,
  DONT_ADVANCER_DOUBLE_SURFACES,
  DONT_REVEAL_SURFACES,
  DONT_2C_RELAY_SURFACES,
  DONT_2D_RELAY_SURFACES,
} from "./meaning-surfaces";
import { dontFacts } from "./facts";
import { DONT_ENTRIES } from "./explanation-catalog";

export const dontModule: ConventionModule = {
  moduleId: "dont",

  entrySurfaces: DONT_R1_SURFACES,

  surfaceGroups: [
    { groupId: "overcaller-r1", surfaces: DONT_R1_SURFACES },
    { groupId: "advancer-2h", surfaces: DONT_ADVANCER_2H_SURFACES },
    { groupId: "advancer-2d", surfaces: DONT_ADVANCER_2D_SURFACES },
    { groupId: "advancer-2c", surfaces: DONT_ADVANCER_2C_SURFACES },
    { groupId: "advancer-2s", surfaces: DONT_ADVANCER_2S_SURFACES },
    { groupId: "advancer-double", surfaces: DONT_ADVANCER_DOUBLE_SURFACES },
    { groupId: "overcaller-reveal", surfaces: DONT_REVEAL_SURFACES },
    { groupId: "relay-2c", surfaces: DONT_2C_RELAY_SURFACES },
    { groupId: "relay-2d", surfaces: DONT_2D_RELAY_SURFACES },
  ],

  entryTransitions: [],
  machineStates: [],

  facts: dontFacts,

  explanationEntries: DONT_ENTRIES,
};
