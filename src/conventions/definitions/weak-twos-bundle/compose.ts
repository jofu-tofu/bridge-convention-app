/**
 * Weak Two composition: defines the skeleton and delegates to
 * the generic composeModules framework.
 *
 * Skeleton states are the shared FSM infrastructure that exists
 * regardless of module content:
 *   idle (dispatch) → [module transitions] → ... → terminal / weak-two-contested
 *
 *   weak-two-active (abstract parent — inherited interference transitions):
 *     All children inherit:
 *       → weak-two-contested (on opponent double/overcall)
 *
 * The idle state is the dispatch point where the module contributes
 * its entry transitions (2H, 2S, 2D openings).
 */
import type { BundleSkeleton } from "../../core/composition/compose";

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
    // ── Scope parent: all active states inherit opponent-action handling ──
    {
      stateId: "weak-two-active",
      parentId: null,
      transitions: [
        {
          transitionId: "weak-two-opponent-double",
          match: { kind: "opponent-action", callType: "double" },
          target: "weak-two-contested",
        },
        {
          transitionId: "weak-two-opponent-bid",
          match: { kind: "opponent-action", callType: "bid" },
          target: "weak-two-contested",
        },
      ],
    },
    {
      stateId: "terminal",
      parentId: null,
      transitions: [],
    },
    {
      stateId: "weak-two-contested",
      parentId: "weak-two-active",
      transitions: [
        {
          transitionId: "weak-two-contested-absorb",
          match: { kind: "pass" },
          target: "weak-two-contested",
        },
      ],
      allowedParentTransitions: ["weak-two-opponent-double", "weak-two-opponent-bid"],
      surfaceGroupId: "weak-two-interrupted",
      entryEffects: {
        setCompetitionMode: "Contested",
      },
    },
  ],
};


