/**
 * DONT (Disturbing Opponents' Notrump) convention module.
 *
 * Self-contained module exporting a ConventionModule object.
 * FSM states and transitions are defined in the RuleModule (dont-rules.ts).
 */

import type { ConventionModule } from "../../../core/convention-module";
import type { SystemConfig } from "../../../../core/contracts/system-config";
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

/**
 * Create a DONT ConventionModule for the given system config.
 *
 * DONT is a defensive convention based on suit patterns, not point
 * thresholds, so the SystemConfig parameter is unused. Accepting it
 * maintains a uniform factory signature for the module registry.
 */
export function createDontModule(_sys: SystemConfig): ConventionModule {
  return {
    moduleId: "dont",

    surfaces: [
      ...DONT_R1_SURFACES,
      ...DONT_ADVANCER_2H_SURFACES,
      ...DONT_ADVANCER_2D_SURFACES,
      ...DONT_ADVANCER_2C_SURFACES,
      ...DONT_ADVANCER_2S_SURFACES,
      ...DONT_ADVANCER_DOUBLE_SURFACES,
      ...DONT_REVEAL_SURFACES,
      ...DONT_2C_RELAY_SURFACES,
      ...DONT_2D_RELAY_SURFACES,
    ],

    facts: dontFacts,

    explanationEntries: DONT_ENTRIES,
  };
}

/** @deprecated Use `createDontModule` via module registry. */
export const dontModule: ConventionModule = createDontModule(
  undefined as unknown as SystemConfig,
);
