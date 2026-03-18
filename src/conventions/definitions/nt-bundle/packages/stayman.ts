/**
 * Stayman ModulePackage — add-on module providing Stayman 2C ask,
 * opener responses, and R3 continuations.
 *
 * Exports the "stayman:deny-major" frontier from the responder-r3-stayman-2d
 * state, enabling Smolen to hand off into this state without direct state-ID coupling.
 */
import type { ModulePackage } from "../../../core/composition/module-package";
import type { MachineFragment } from "../../../core/composition/machine-fragment";
import {
  staymanModule,
  staymanFacts,
  OPENER_STAYMAN_SURFACES,
  STAYMAN_R3_AFTER_2H_SURFACES,
  STAYMAN_R3_AFTER_2S_SURFACES,
  STAYMAN_R3_AFTER_2D_SURFACES,
  INTERFERENCE_REDOUBLE_SURFACE,
} from "../modules/stayman";

/**
 * Build the Stayman machine fragment.
 *
 * Exports the "stayman:deny-major" frontier from the 2D denial state,
 * which Smolen uses via a handoff trigger.
 */
function buildStaymanFragment(): MachineFragment {
  return {
    states: staymanModule.machineStates,
    entryTransitions: staymanModule.entryTransitions,
    exportedFrontiers: [
      {
        frontierId: "stayman:deny-major",
        stateId: staymanModule.exposedStates!.afterOpener2D!,
      },
    ],
  };
}

export const staymanPackage: ModulePackage = {
  moduleId: "stayman",

  meta: {
    description: "Stayman 2C ask for 4-card majors after 1NT",
    kind: "add-on",
  },

  exports: {
    capabilities: ["stayman:ask-major"],

    facts: staymanFacts,

    surfaces: [
      // Entry surfaces go into the dispatch group
      { groupId: "responder-r1", surfaces: [...staymanModule.entrySurfaces] },
      // Post-entry surface groups
      { groupId: "opener-stayman-response", surfaces: [...OPENER_STAYMAN_SURFACES] },
      { groupId: "responder-r3-after-stayman-2h", surfaces: [...STAYMAN_R3_AFTER_2H_SURFACES] },
      { groupId: "responder-r3-after-stayman-2s", surfaces: [...STAYMAN_R3_AFTER_2S_SURFACES] },
      { groupId: "responder-r3-after-stayman-2d", surfaces: [...STAYMAN_R3_AFTER_2D_SURFACES] },
      // Skeleton surface group: interference handling
      { groupId: "nt-interrupted", surfaces: [INTERFERENCE_REDOUBLE_SURFACE] },
    ],

    explanationEntries: staymanModule.explanationEntries,

    pedagogicalRelations: staymanModule.pedagogicalRelations,
  },

  runtime: {
    machineFragment: buildStaymanFragment(),
  },
};
