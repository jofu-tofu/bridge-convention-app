/**
 * Weak Two composition: defines the skeleton and delegates to
 * the generic composeModules framework.
 *
 * Skeleton states are the shared FSM infrastructure that exists
 * regardless of module content:
 *   idle (dispatch) → ... → terminal / weak-two-contested
 *
 * The idle state is the dispatch point where the module contributes
 * its entry transitions (2H, 2S, 2D openings).
 */
import type { ConventionModule } from "../../core/composition/module-types";
import type { BundleSkeleton, ComposedBundle } from "../../core/composition/compose";
import { composeModules } from "../../core/composition/compose";
import type { PedagogicalRelation } from "../../../core/contracts/teaching-projection";

/**
 * The Weak Two skeleton — shared FSM infrastructure.
 *
 * idle (opener-r1, dispatch) → [module transitions] → ... → terminal / contested
 */
export const WEAK_TWO_SKELETON: BundleSkeleton = {
  machineId: "weak-two-conversation",
  dispatchStateId: "idle",
  entrySurfaceGroupId: "opener-r1",
  states: [
    {
      stateId: "idle",
      parentId: null,
      transitions: [],  // populated by module entryTransitions
      surfaceGroupId: "opener-r1",
    },
    {
      stateId: "terminal",
      parentId: null,
      transitions: [],
    },
    {
      stateId: "weak-two-contested",
      parentId: null,
      transitions: [],
      entryEffects: {
        setCompetitionMode: "Contested",
      },
    },
  ],
};

/**
 * Compose Weak Two convention modules using the generic framework.
 *
 * @param modules - Convention modules to compose (order determines entry transition priority)
 * @param crossModuleRelations - Pedagogical relations that span module boundaries
 */
export function composeWeakTwoModules(
  modules: readonly ConventionModule[],
  crossModuleRelations: readonly PedagogicalRelation[] = [],
): ComposedBundle {
  return composeModules(WEAK_TWO_SKELETON, modules, crossModuleRelations);
}
