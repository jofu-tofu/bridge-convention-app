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
  BERGEN_NATURAL_1NT_HEARTS_SURFACES,
  BERGEN_NATURAL_1NT_SPADES_SURFACES,
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

    surfaces: [
      ...BERGEN_R1_HEARTS_SURFACES,
      ...BERGEN_R1_SPADES_SURFACES,
      ...BERGEN_NATURAL_1NT_HEARTS_SURFACES,
      ...BERGEN_NATURAL_1NT_SPADES_SURFACES,
      ...BERGEN_R2_AFTER_CONSTRUCTIVE_HEARTS_SURFACES,
      ...BERGEN_R2_AFTER_CONSTRUCTIVE_SPADES_SURFACES,
      ...BERGEN_R2_AFTER_LIMIT_HEARTS_SURFACES,
      ...BERGEN_R2_AFTER_LIMIT_SPADES_SURFACES,
      ...BERGEN_R2_AFTER_PREEMPTIVE_HEARTS_SURFACES,
      ...BERGEN_R2_AFTER_PREEMPTIVE_SPADES_SURFACES,
      ...BERGEN_R3_AFTER_GAME_SURFACES,
      ...BERGEN_R3_AFTER_SIGNOFF_SURFACES,
      ...BERGEN_R3_AFTER_GAME_TRY_HEARTS_SURFACES,
      ...BERGEN_R3_AFTER_GAME_TRY_SPADES_SURFACES,
      ...BERGEN_R4_SURFACES,
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
