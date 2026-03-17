/**
 * DONT-specific composition: defines the DONT skeleton and delegates to
 * the generic composeModules framework.
 *
 * Skeleton state hierarchy:
 *
 *   idle → overcaller-r1 (dispatch — entry transitions populated by modules)
 *
 *   dont-active (abstract parent — provides inherited interference transitions):
 *     All child states inherit:
 *       opponent double → dont-contested
 *       opponent bid    → dont-contested
 *
 *   overcaller-r1 (dispatch) → [module-provided transitions]
 *   terminal (end state)
 *   dont-contested (child of dont-active — opponent interference)
 */
import type { BundleSkeleton } from "../../core/composition/compose";
import { BidSuit } from "../../../engine/types";

/**
 * The DONT bundle skeleton — shared FSM infrastructure for all DONT modules.
 *
 * idle → overcaller-r1 (dispatch) → terminal / dont-contested
 */
export const DONT_SKELETON: BundleSkeleton = {
  machineId: "dont-conversation",
  dispatchStateId: "overcaller-r1",
  entrySurfaceGroupId: "overcaller-r1",
  states: [
    // ── idle ────────────────────────────────────────────────────
    {
      stateId: "idle",
      parentId: null,
      transitions: [
        {
          transitionId: "idle-to-overcaller-r1",
          match: { kind: "opponent-action", callType: "bid", level: 1, strain: BidSuit.NoTrump },
          target: "overcaller-r1",
        },
      ],
    },

    // ── dont-active: abstract parent with inherited interference ─
    {
      stateId: "dont-active",
      parentId: null,
      transitions: [
        {
          transitionId: "opp-double",
          match: { kind: "opponent-action", callType: "double" },
          target: "dont-contested",
        },
        {
          transitionId: "opp-bid",
          match: { kind: "opponent-action", callType: "bid" },
          target: "dont-contested",
        },
      ],
    },

    // ── overcaller-r1: dispatch state (entry transitions populated by modules)
    {
      stateId: "overcaller-r1",
      parentId: "dont-active",
      allowedParentTransitions: ["opp-double", "opp-bid"],
      transitions: [],
      surfaceGroupId: "overcaller-r1",
      entryEffects: {
        setCompetitionMode: "Contested",
      },
    },

    // ── terminal ────────────────────────────────────────────────
    {
      stateId: "terminal",
      parentId: null,
      transitions: [],
    },

    // ── dont-contested ──────────────────────────────────────────
    {
      stateId: "dont-contested",
      parentId: "dont-active",
      allowedParentTransitions: ["opp-double", "opp-bid"],
      surfaceGroupId: "dont-interrupted",
      transitions: [
        {
          transitionId: "dont-contested-absorb",
          match: { kind: "pass" },
          target: "dont-contested",
        },
      ],
      entryEffects: {
        setCompetitionMode: "Doubled",
      },
    },
  ],
};


