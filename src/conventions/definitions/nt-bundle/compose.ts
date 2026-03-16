/**
 * NT-specific composition: defines the 1NT skeleton and delegates to
 * the generic composeModules framework.
 */
import type { ConventionModule } from "../../core/composition/module-types";
import type { BundleSkeleton, ComposedBundle } from "../../core/composition/compose";
import { composeModules } from "../../core/composition/compose";
import type { PedagogicalRelation } from "../../../core/contracts/teaching-projection";
import { BidSuit } from "../../../engine/types";

/**
 * The 1NT bundle skeleton — shared FSM infrastructure for all NT response modules.
 *
 * idle (opener-1nt) → nt-opened → responder-r1 (dispatch) → terminal / nt-contested
 */
export const NT_SKELETON: BundleSkeleton = {
  machineId: "nt-conversation",
  dispatchStateId: "responder-r1",
  entrySurfaceGroupId: "responder-r1",
  states: [
    {
      stateId: "idle",
      parentId: null,
      surfaceGroupId: "opener-1nt",
      transitions: [
        {
          transitionId: "idle-to-nt-opened",
          match: { kind: "call", level: 1, strain: BidSuit.NoTrump },
          target: "nt-opened",
        },
      ],
    },
    {
      stateId: "nt-opened",
      parentId: null,
      transitions: [
        {
          transitionId: "nt-opened-opponent-double",
          match: { kind: "opponent-action", callType: "double" },
          target: "nt-contested",
        },
        {
          transitionId: "nt-opened-pass",
          match: { kind: "pass" },
          target: "responder-r1",
        },
      ],
    },
    {
      stateId: "responder-r1",
      parentId: "nt-opened",
      transitions: [],  // populated by module entryTransitions
      surfaceGroupId: "responder-r1",
      entryEffects: { setCaptain: "responder" },
      allowedParentTransitions: ["nt-opened-opponent-double"],
    },
    {
      stateId: "terminal",
      parentId: "nt-opened",
      transitions: [
        {
          transitionId: "terminal-absorb",
          match: { kind: "pass" },
          target: "terminal",
        },
      ],
      surfaceGroupId: "terminal-pass",
      allowedParentTransitions: ["nt-opened-opponent-double"],
    },
    {
      stateId: "nt-contested",
      parentId: "nt-opened",
      transitions: [
        {
          transitionId: "contested-absorb",
          match: { kind: "pass" },
          target: "nt-contested",
        },
      ],
      entryEffects: { setCompetitionMode: "Doubled" },
      allowedParentTransitions: ["nt-opened-opponent-double"],
    },
  ],
};

/**
 * Compose NT convention modules using the generic framework with the NT skeleton.
 *
 * @param modules - Convention modules to compose (order determines entry transition priority)
 * @param crossModuleRelations - Pedagogical relations that span module boundaries
 */
export function composeNtModules(
  modules: readonly ConventionModule[],
  crossModuleRelations: readonly PedagogicalRelation[] = [],
): ComposedBundle {
  return composeModules(NT_SKELETON, modules, crossModuleRelations);
}
