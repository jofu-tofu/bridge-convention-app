/**
 * DONT ModulePackage — wraps the DONT ConventionModule into package form.
 */
import type { ModulePackage } from "../../../core/composition/module-package";
import { dontModule } from "../module";
import { dontFacts } from "../facts";
import { DONT_EXPLANATION_CATALOG } from "../explanation-catalog";
import { DONT_PEDAGOGICAL_RELATIONS } from "../pedagogical-relations";

export const dontPackage: ModulePackage = {
  moduleId: "dont",

  exports: {
    surfaces: [
      // Entry surfaces go into a dedicated group (merged with skeleton dispatch)
      { groupId: "overcaller-r1", surfaces: dontModule.entrySurfaces },
      ...dontModule.surfaceGroups.map(g => ({
        groupId: g.groupId,
        surfaces: g.surfaces,
      })),
    ],
    facts: dontFacts,
    explanationEntries: [...DONT_EXPLANATION_CATALOG.entries],
    pedagogicalRelations: DONT_PEDAGOGICAL_RELATIONS,
  },

  runtime: {
    machineFragment: {
      states: dontModule.machineStates,
      entryTransitions: dontModule.entryTransitions,
    },
  },
};
