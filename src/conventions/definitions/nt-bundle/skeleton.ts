/**
 * NT Bundle Skeleton — bundle-specific scaffolding for the 1NT response system.
 *
 * Defines the opening patterns and scaffold states (opened → entry → terminal +
 * contested) that module states plug into. Module entry transitions are injected
 * by composeModules() into the entry state.
 *
 * This replaces the 968-line hand-authored base-track.ts with ~40 lines of skeleton.
 */

import type { BundleSkeleton } from "../../core/composition/compose-modules";
import type { FrameStateSpec } from "../../core/protocol/types";
import { BidSuit } from "../../../engine/types";

const skeletonStates: readonly FrameStateSpec[] = [
  {
    id: "nt-opened",
    eventTransitions: [
      {
        transitionId: "nt-opened-pass",
        when: { callType: "pass" },
        goto: "responder-r1",
      },
      {
        transitionId: "nt-opened-opponent-interrupt",
        when: { actor: "opponent" },
        goto: "nt-contested",
      },
    ],
  },
  {
    id: "responder-r1",
    surface: "sf:responder-r1",
    exportTags: ["agreement.pending"],
    onEnter: [
      { op: "setReg", path: "captain.side", value: "responder" },
    ],
    eventTransitions: [
      // Module entry transitions are injected before these by composeModules()
      {
        transitionId: "r1-opponent-interrupt",
        when: { actor: "opponent" },
        goto: "nt-contested",
      },
    ],
  },
  {
    id: "terminal",
    surface: "sf:terminal-pass",
    eventTransitions: [
      {
        transitionId: "terminal-absorb",
        when: { callType: "pass" },
        goto: "STAY",
      },
    ],
  },
  {
    id: "nt-contested",
    surface: "sf:nt-interrupted",
    onEnter: [
      { op: "setReg", path: "competition.mode", value: "doubled" },
    ],
    eventTransitions: [
      {
        transitionId: "contested-absorb",
        when: { callType: "pass" },
        goto: "STAY",
      },
    ],
  },
];

export const NT_SKELETON: BundleSkeleton = {
  openingPatterns: [
    {
      prefix: [{ call: { type: "bid", level: 1, strain: BidSuit.NoTrump } }],
      startState: "nt-opened",
    },
  ],
  openingSurface: "sf:opener-1nt",
  skeletonStates,
  entryStateId: "responder-r1",
  initialStateId: "nt-opened",
};
