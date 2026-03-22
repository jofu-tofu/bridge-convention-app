/**
 * Bergen Raises convention module.
 *
 * Self-contained module exporting a ConventionModule object.
 */

import type { ConventionModule } from "../../../core/convention-module";
import type { SystemConfig } from "../../../../core/contracts/system-config";
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

/**
 * Create a Bergen Raises ConventionModule for the given system config.
 *
 * Bergen thresholds are convention-intrinsic (same in all systems),
 * so the SystemConfig parameter is currently unused. Accepting it
 * maintains a uniform factory signature for the module registry.
 */
export function createBergenModule(_sys: SystemConfig): ConventionModule {
  return {
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

    facts: bergenFacts,

    explanationEntries: BERGEN_EXPLANATION_ENTRIES,
  };
}

/** @deprecated Use `createBergenModule` via module registry. */
export const bergenModule: ConventionModule = createBergenModule(
  // Unused — Bergen thresholds are convention-intrinsic.
  // Passed only to satisfy the factory signature.
  undefined as unknown as SystemConfig,
);
