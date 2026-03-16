/**
 * Smolen ModulePackage — add-on module providing Smolen 3H/3S bids
 * after Stayman 2D denial, plus opener placement.
 *
 * Uses a handoff trigger on the "stayman:deny-major" frontier to inject
 * its transitions into Stayman's responder-r3-stayman-2d state.
 * This replaces the old hookTransitions pattern with frontier-based coupling.
 */
import type { ModulePackage } from "../../../core/composition/module-package";
import type { MachineFragment } from "../../../core/composition/machine-fragment";
import type { HandoffSpec } from "../../../core/composition/handoff";
import {
  smolenModule,
  smolenFacts,
} from "../modules/smolen";

function buildSmolenFragment(): MachineFragment {
  return {
    states: smolenModule.machineStates,
    entryTransitions: smolenModule.entryTransitions, // empty — Smolen has no dispatch entry
    submachines: smolenModule.submachines,
  };
}

/**
 * Build Smolen's handoff specs.
 *
 * The old path used hookTransitions with a direct state ID reference:
 *   hookTransitions: [{ targetStateId: "responder-r3-stayman-2d", transitions: [...] }]
 *
 * The new path uses a frontier trigger — no state-ID coupling:
 *   handoffs: [{ trigger: { kind: "frontier", frontierId: "stayman:deny-major" }, transitions: [...] }]
 */
function buildSmolenHandoffs(): readonly HandoffSpec[] {
  return smolenModule.hookTransitions!.map((hook) => ({
    trigger: {
      kind: "frontier" as const,
      frontierId: "stayman:deny-major",
    },
    transitions: hook.transitions,
  }));
}

export const smolenPackage: ModulePackage = {
  moduleId: "smolen",

  meta: {
    description: "Smolen 3H/3S game-forcing bids after Stayman 2D denial with 5-4 majors",
    kind: "add-on",
  },

  requires: [
    { kind: "module", id: "stayman" },
  ],

  exports: {
    facts: smolenFacts,

    surfaces: [
      // Smolen R3 surfaces contributed to the Stayman 2D denial group
      ...smolenModule.surfaceGroups.map((sg) => ({
        groupId: sg.groupId,
        surfaces: [...sg.surfaces],
      })),
    ],

    explanationEntries: smolenModule.explanationEntries,

    pedagogicalRelations: smolenModule.pedagogicalRelations,
  },

  runtime: {
    machineFragment: buildSmolenFragment(),
    handoffs: buildSmolenHandoffs(),
  },
};
