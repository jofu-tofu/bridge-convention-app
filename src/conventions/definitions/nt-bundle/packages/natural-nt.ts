/**
 * Natural NT ModulePackage — base-system module providing infrastructure
 * states and natural NT responses (2NT invite, 3NT game).
 *
 * This package provides all skeleton FSM states (idle, nt-opened,
 * responder-r1, terminal, nt-contested) since it is the base-system
 * module that defines the 1NT conversation infrastructure.
 */
import type { ModulePackage } from "../../../core/composition/module-package";
import type { MachineFragment } from "../../../core/composition/machine-fragment";
import { naturalNtModule, ntResponseFacts, OPENER_1NT_SURFACE } from "../modules/natural-nt";
import { NT_SKELETON } from "../compose";

/**
 * Build the natural-nt machine fragment.
 *
 * Includes all skeleton states (idle, nt-opened, responder-r1, terminal,
 * nt-contested) plus the natural-nt entry transitions (3NT, pass, 2NT).
 * The skeleton states provide the infrastructure that other module
 * fragments plug into.
 */
function buildNaturalNtFragment(): MachineFragment {
  return {
    // Skeleton states are contributed by the natural-nt base-system module.
    // The machine assembler will inject entry transitions from all modules
    // into the dispatch state (responder-r1).
    states: NT_SKELETON.states,
    entryTransitions: naturalNtModule.entryTransitions,
  };
}

export const naturalNtPackage: ModulePackage = {
  moduleId: "natural-nt",

  meta: {
    description: "Natural NT responses: 2NT invite, 3NT game, and 1NT infrastructure states",
    kind: "base-system",
  },

  exports: {
    facts: ntResponseFacts,

    surfaces: [
      { groupId: "opener-1nt", surfaces: OPENER_1NT_SURFACE },
      { groupId: "responder-r1", surfaces: naturalNtModule.entrySurfaces },
    ],

    explanationEntries: naturalNtModule.explanationEntries,

    pedagogicalRelations: naturalNtModule.pedagogicalRelations,
  },

  runtime: {
    machineFragment: buildNaturalNtFragment(),
  },
};
