/**
 * Weak Twos convention module.
 *
 * Self-contained module exporting a ConventionModule object.
 * FSM states and transitions are handled by the protocol frame (base-track.ts).
 */

import type { ConventionModule } from "../../../../core/contracts/convention-module";
import {
  WEAK_TWO_R1_SURFACES,
  WEAK_TWO_R2_HEARTS_SURFACES,
  WEAK_TWO_R2_SPADES_SURFACES,
  WEAK_TWO_R2_DIAMONDS_SURFACES,
  WEAK_TWO_OGUST_HEARTS_SURFACES,
  WEAK_TWO_OGUST_SPADES_SURFACES,
  WEAK_TWO_OGUST_DIAMONDS_SURFACES,
  POST_OGUST_HEARTS_SURFACES,
  POST_OGUST_SPADES_SURFACES,
  POST_OGUST_DIAMONDS_SURFACES,
} from "./meaning-surfaces";
import { weakTwoFacts } from "./facts";
import { WEAK_TWO_ENTRIES } from "./explanation-catalog";
import { WEAK_TWO_PEDAGOGICAL_RELATIONS } from "./pedagogical-relations";
import { WEAK_TWO_ALTERNATIVE_GROUPS } from "./alternatives";

export const weakTwosModule: ConventionModule = {
  moduleId: "weak-twos",

  entrySurfaces: WEAK_TWO_R1_SURFACES,

  surfaceGroups: [
    { groupId: "responder-r1", surfaces: WEAK_TWO_R1_SURFACES },
    { groupId: "opener-r2-hearts", surfaces: WEAK_TWO_R2_HEARTS_SURFACES },
    { groupId: "opener-r2-spades", surfaces: WEAK_TWO_R2_SPADES_SURFACES },
    { groupId: "opener-r2-diamonds", surfaces: WEAK_TWO_R2_DIAMONDS_SURFACES },
    { groupId: "ogust-hearts", surfaces: WEAK_TWO_OGUST_HEARTS_SURFACES },
    { groupId: "ogust-spades", surfaces: WEAK_TWO_OGUST_SPADES_SURFACES },
    { groupId: "ogust-diamonds", surfaces: WEAK_TWO_OGUST_DIAMONDS_SURFACES },
    { groupId: "post-ogust-hearts", surfaces: POST_OGUST_HEARTS_SURFACES },
    { groupId: "post-ogust-spades", surfaces: POST_OGUST_SPADES_SURFACES },
    { groupId: "post-ogust-diamonds", surfaces: POST_OGUST_DIAMONDS_SURFACES },
  ],

  entryTransitions: [],
  machineStates: [],

  facts: weakTwoFacts,

  explanationEntries: WEAK_TWO_ENTRIES,
  pedagogicalRelations: WEAK_TWO_PEDAGOGICAL_RELATIONS,
  alternatives: WEAK_TWO_ALTERNATIVE_GROUPS,
  intentFamilies: [],
};
