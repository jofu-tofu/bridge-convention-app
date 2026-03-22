/**
 * Weak Twos convention module.
 *
 * Self-contained module exporting a ConventionModule object.
 * FSM states and transitions are defined in the RuleModule (weak-twos-rules.ts).
 */

import type { ConventionModule } from "../../../core/convention-module";
import type { SystemConfig } from "../../../../core/contracts/system-config";
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

/**
 * Create a Weak Twos ConventionModule for the given system config.
 *
 * Weak Two thresholds are convention-intrinsic (same in all systems),
 * so the SystemConfig parameter is currently unused. Accepting it
 * maintains a uniform factory signature for the module registry.
 */
export function createWeakTwosModule(_sys: SystemConfig): ConventionModule {
  return {
    moduleId: "weak-twos",

    surfaces: [
      ...WEAK_TWO_R1_SURFACES,
      ...WEAK_TWO_R2_HEARTS_SURFACES,
      ...WEAK_TWO_R2_SPADES_SURFACES,
      ...WEAK_TWO_R2_DIAMONDS_SURFACES,
      ...WEAK_TWO_OGUST_HEARTS_SURFACES,
      ...WEAK_TWO_OGUST_SPADES_SURFACES,
      ...WEAK_TWO_OGUST_DIAMONDS_SURFACES,
      ...POST_OGUST_HEARTS_SURFACES,
      ...POST_OGUST_SPADES_SURFACES,
      ...POST_OGUST_DIAMONDS_SURFACES,
    ],

    facts: weakTwoFacts,

    explanationEntries: WEAK_TWO_ENTRIES,
  };
}

/** @deprecated Use `createWeakTwosModule` via module registry. */
export const weakTwosModule: ConventionModule = createWeakTwosModule(
  undefined as unknown as SystemConfig,
);
