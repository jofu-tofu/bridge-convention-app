import { createBundle } from "../../core/bundle";
import type { DealConstraints } from "../../../engine/types";
import { Seat, Suit, BidSuit } from "../../../engine/types";
import { ConventionCategory } from "../../core/types";
import { CAP_OPENING_MAJOR } from "../../../core/contracts/capability-vocabulary";
import { buildAuction } from "../../../engine/auction-helpers";
import { compileProfileFromPackages } from "../../core/composition";
import type { MachineState } from "../../core/runtime/machine-types";
import { BERGEN_PROFILE } from "./system-profile";
import { BERGEN_ROUTED_SURFACES, createBergenSurfaceRouter } from "./surface-routing";
import { BERGEN_ALTERNATIVE_GROUPS } from "./alternatives";
import { bergenRaisesPackage } from "./packages/bergen-raises";

// ─── Deal constraints ───────────────────────────────────────────

const bergenBundleDealConstraints: DealConstraints = {
  seats: [
    // North = opener: 12-21 HCP, 5+ in a major
    {
      seat: Seat.North,
      minHcp: 12,
      maxHcp: 21,
      minLengthAny: { [Suit.Spades]: 5, [Suit.Hearts]: 5 },
    },
    // South = responder: 0+ HCP, 4+ in a major
    {
      seat: Seat.South,
      minHcp: 0,
      minLengthAny: { [Suit.Spades]: 4, [Suit.Hearts]: 4 },
    },
  ],
  dealer: Seat.North,
};

// ─── Skeleton states (shared structure, not module-owned) ───────

const BERGEN_SKELETON_STATES: readonly MachineState[] = [
  // idle: dispatch on opening bid
  {
    stateId: "idle",
    parentId: null,
    transitions: [
      {
        transitionId: "idle-to-major-opened-hearts",
        match: { kind: "call", level: 1, strain: BidSuit.Hearts },
        target: "major-opened-hearts",
      },
      {
        transitionId: "idle-to-major-opened-spades",
        match: { kind: "call", level: 1, strain: BidSuit.Spades },
        target: "major-opened-spades",
      },
    ],
  },

  // major-opened: waiting for opponent pass or interference
  {
    stateId: "major-opened-hearts",
    parentId: null,
    transitions: [
      {
        transitionId: "hearts-opponent-double",
        match: { kind: "opponent-action", callType: "double" },
        target: "bergen-contested",
      },
      {
        transitionId: "hearts-opponent-bid",
        match: { kind: "opponent-action", callType: "bid" },
        target: "bergen-contested",
      },
      {
        transitionId: "hearts-pass-to-responder",
        match: { kind: "pass" },
        target: "responder-r1-hearts",
      },
    ],
  },
  {
    stateId: "major-opened-spades",
    parentId: null,
    transitions: [
      {
        transitionId: "spades-opponent-double",
        match: { kind: "opponent-action", callType: "double" },
        target: "bergen-contested",
      },
      {
        transitionId: "spades-opponent-bid",
        match: { kind: "opponent-action", callType: "bid" },
        target: "bergen-contested",
      },
      {
        transitionId: "spades-pass-to-responder",
        match: { kind: "pass" },
        target: "responder-r1-spades",
      },
    ],
  },

  // End states
  {
    stateId: "terminal",
    parentId: null,
    transitions: [],
  },
  {
    stateId: "bergen-contested",
    parentId: null,
    transitions: [],
    entryEffects: {
      setCompetitionMode: "Contested",
    },
  },
];

// ─── Compile bundle from packages ───────────────────────────────

const composed = compileProfileFromPackages(
  BERGEN_PROFILE,
  [bergenRaisesPackage],
  {
    machineId: "bergen-conversation",
    skeletonStates: BERGEN_SKELETON_STATES,
    dispatchStateId: "idle",
    entrySurfaceGroupId: "responder-r1-hearts",
  },
);

// ─── Bundle assembly ────────────────────────────────────────────

export const bergenBundle = createBundle({
  id: "bergen-bundle",
  name: "Bergen Raises Bundle",
  description: "Bergen Raises — constructive, limit, and preemptive responses to 1M opening",
  category: ConventionCategory.Constructive,
  memberIds: ["bergen-bundle", "bergen-raises"],
  declaredCapabilities: { [CAP_OPENING_MAJOR]: "active" },
  dealConstraints: bergenBundleDealConstraints,
  defaultAuction: (seat) => {
    if (seat === Seat.South || seat === Seat.East) {
      return buildAuction(Seat.North, ["1H", "P"]);
    }
    return undefined;
  },
  composed,
  systemProfile: BERGEN_PROFILE,
  acceptableAlternatives: BERGEN_ALTERNATIVE_GROUPS,
});
