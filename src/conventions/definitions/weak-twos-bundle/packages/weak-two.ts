/**
 * Weak Two ModulePackage — single module covering the full weak two conversation:
 *   R1 — opener's weak two opening (2D, 2H, 2S)
 *   R2 — responder's action (game raise, Ogust ask, invite, pass)
 *   R3 — opener's Ogust rebid (solid, min/bad, min/good, max/bad, max/good)
 *
 * This is the base-system module for the Weak Two bundle. It contributes
 * all FSM states (opener wait, responder R2, Ogust R3) and the skeleton
 * infrastructure states (idle, terminal, contested).
 */
import type { ModulePackage } from "../../../core/composition/module-package";
import type { MachineFragment } from "../../../core/composition/machine-fragment";
import { weakTwoModule } from "../module";
import { WEAK_TWO_SKELETON } from "../compose";

/**
 * Build the weak-two machine fragment.
 *
 * Includes skeleton states (idle, terminal, weak-two-contested) plus all
 * module-owned states. Entry transitions route opener's 2D/2H/2S into
 * the appropriate opened-wait states.
 */
function buildWeakTwoFragment(): MachineFragment {
  return {
    states: [...WEAK_TWO_SKELETON.states, ...weakTwoModule.machineStates],
    entryTransitions: weakTwoModule.entryTransitions,
  };
}

export const weakTwoPackage: ModulePackage = {
  moduleId: "weak-two",

  meta: {
    description:
      "Weak Two Bids with Ogust 2NT — preemptive openings and structured hand description",
    kind: "base-system",
  },

  exports: {
    facts: weakTwoModule.facts,

    surfaces: [
      // R1: opener weak two surfaces → dispatch (entry) group
      { groupId: "opener-r1", surfaces: [...weakTwoModule.entrySurfaces] },
      // R2 + R3: responder and Ogust surface groups
      ...weakTwoModule.surfaceGroups.map((g) => ({
        groupId: g.groupId,
        surfaces: [...g.surfaces],
      })),
    ],

    explanationEntries: weakTwoModule.explanationEntries,

    pedagogicalRelations: weakTwoModule.pedagogicalRelations,
  },

  runtime: {
    machineFragment: buildWeakTwoFragment(),
  },
};
