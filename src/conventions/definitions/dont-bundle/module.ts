/**
 * DONT convention module — all DONT-specific logic in a composable unit.
 *
 * Provides: entry surfaces (R1 overcaller actions), post-entry surface groups
 * (advancer responses, reveal/relay), FSM states, facts, explanations, pedagogy.
 *
 * The module plugs into the DONT skeleton's dispatch state (overcaller-r1)
 * via entryTransitions and contributes its post-entry FSM subtree.
 */
import type {
  MachineState,
  MachineTransition,
} from "../../core/runtime/machine-types";
import { BidSuit } from "../../../engine/types";
import {
  DONT_R1_SURFACES,
  DONT_ADVANCER_2H_SURFACES,
  DONT_ADVANCER_2D_SURFACES,
  DONT_ADVANCER_2C_SURFACES,
  DONT_ADVANCER_2S_SURFACES,
  DONT_ADVANCER_DOUBLE_SURFACES,
  DONT_REVEAL_SURFACES,
  DONT_2C_RELAY_SURFACES,
  DONT_2D_RELAY_SURFACES,
} from "./meaning-surfaces";
import { dontFacts } from "./facts";
import { DONT_ENTRIES } from "./explanation-catalog";
import { DONT_PEDAGOGICAL_RELATIONS } from "./pedagogical-relations";

// ─── Entry transitions (from dispatch state to convention states) ────

const DONT_ENTRY_TRANSITIONS: readonly MachineTransition[] = [
  {
    transitionId: "r1-2h",
    match: { kind: "call", level: 2, strain: BidSuit.Hearts },
    target: "wait-advancer-2h",
  },
  {
    transitionId: "r1-2d",
    match: { kind: "call", level: 2, strain: BidSuit.Diamonds },
    target: "wait-advancer-2d",
  },
  {
    transitionId: "r1-2c",
    match: { kind: "call", level: 2, strain: BidSuit.Clubs },
    target: "wait-advancer-2c",
  },
  {
    transitionId: "r1-2s",
    match: { kind: "call", level: 2, strain: BidSuit.Spades },
    target: "wait-advancer-2s",
  },
  {
    transitionId: "r1-double",
    match: {
      kind: "predicate",
      test: (call, _seat, _snapshot) => call.type === "double",
      callHint: { type: "double" },
    },
    target: "wait-advancer-double",
  },
  {
    transitionId: "r1-pass",
    match: { kind: "pass" },
    target: "terminal",
  },
];

// ─── Machine states (module-owned, post-entry subtree) ───────────────

const DONT_MACHINE_STATES: readonly MachineState[] = [
  // ── Wait states: opponent (West) passes through ─────────────
  {
    stateId: "wait-advancer-2h",
    parentId: "dont-active",
    allowedParentTransitions: ["opp-double", "opp-bid"],
    transitions: [
      {
        transitionId: "wait-2h-pass",
        match: { kind: "pass" },
        target: "advancer-after-2h",
      },
    ],
  },
  {
    stateId: "wait-advancer-2d",
    parentId: "dont-active",
    allowedParentTransitions: ["opp-double", "opp-bid"],
    transitions: [
      {
        transitionId: "wait-2d-pass",
        match: { kind: "pass" },
        target: "advancer-after-2d",
      },
    ],
  },
  {
    stateId: "wait-advancer-2c",
    parentId: "dont-active",
    allowedParentTransitions: ["opp-double", "opp-bid"],
    transitions: [
      {
        transitionId: "wait-2c-pass",
        match: { kind: "pass" },
        target: "advancer-after-2c",
      },
    ],
  },
  {
    stateId: "wait-advancer-2s",
    parentId: "dont-active",
    allowedParentTransitions: ["opp-double", "opp-bid"],
    transitions: [
      {
        transitionId: "wait-2s-pass",
        match: { kind: "pass" },
        target: "advancer-after-2s",
      },
    ],
  },
  {
    stateId: "wait-advancer-double",
    parentId: "dont-active",
    allowedParentTransitions: ["opp-double", "opp-bid"],
    transitions: [
      {
        transitionId: "wait-dbl-pass",
        match: { kind: "pass" },
        target: "advancer-after-double",
      },
    ],
  },

  // ── Advancer responses (North) ──────────────────────────────
  {
    stateId: "advancer-after-2h",
    parentId: "dont-active",
    allowedParentTransitions: ["opp-double", "opp-bid"],
    surfaceGroupId: "advancer-after-2h",
    entryEffects: {
      setCaptain: "responder",
    },
    transitions: [
      {
        transitionId: "adv-2h-pass",
        match: { kind: "pass" },
        target: "terminal",
      },
      {
        transitionId: "adv-2h-2s",
        match: { kind: "call", level: 2, strain: BidSuit.Spades },
        target: "terminal",
      },
      {
        transitionId: "adv-2h-2nt",
        match: { kind: "call", level: 2, strain: BidSuit.NoTrump },
        target: "terminal",
      },
      {
        transitionId: "adv-2h-3c",
        match: { kind: "call", level: 3, strain: BidSuit.Clubs },
        target: "terminal",
      },
      {
        transitionId: "adv-2h-3d",
        match: { kind: "call", level: 3, strain: BidSuit.Diamonds },
        target: "terminal",
      },
      {
        transitionId: "adv-2h-any",
        match: { kind: "any-bid" },
        target: "terminal",
      },
    ],
  },
  {
    stateId: "advancer-after-2d",
    parentId: "dont-active",
    allowedParentTransitions: ["opp-double", "opp-bid"],
    surfaceGroupId: "advancer-after-2d",
    entryEffects: {
      setCaptain: "responder",
    },
    transitions: [
      {
        transitionId: "adv-2d-pass",
        match: { kind: "pass" },
        target: "terminal",
      },
      {
        transitionId: "adv-2d-2h-relay",
        match: { kind: "call", level: 2, strain: BidSuit.Hearts },
        target: "wait-2d-relay",
      },
      {
        transitionId: "adv-2d-any",
        match: { kind: "any-bid" },
        target: "terminal",
      },
    ],
  },
  {
    stateId: "advancer-after-2c",
    parentId: "dont-active",
    allowedParentTransitions: ["opp-double", "opp-bid"],
    surfaceGroupId: "advancer-after-2c",
    entryEffects: {
      setCaptain: "responder",
    },
    transitions: [
      {
        transitionId: "adv-2c-pass",
        match: { kind: "pass" },
        target: "terminal",
      },
      {
        transitionId: "adv-2c-2d-relay",
        match: { kind: "call", level: 2, strain: BidSuit.Diamonds },
        target: "wait-2c-relay",
      },
      {
        transitionId: "adv-2c-any",
        match: { kind: "any-bid" },
        target: "terminal",
      },
    ],
  },
  {
    stateId: "advancer-after-2s",
    parentId: "dont-active",
    allowedParentTransitions: ["opp-double", "opp-bid"],
    surfaceGroupId: "advancer-after-2s",
    entryEffects: {
      setCaptain: "responder",
    },
    transitions: [
      {
        transitionId: "adv-2s-pass",
        match: { kind: "pass" },
        target: "terminal",
      },
      {
        transitionId: "adv-2s-any",
        match: { kind: "any-bid" },
        target: "terminal",
      },
    ],
  },
  {
    stateId: "advancer-after-double",
    parentId: "dont-active",
    allowedParentTransitions: ["opp-double", "opp-bid"],
    surfaceGroupId: "advancer-after-double",
    entryEffects: {
      setCaptain: "responder",
    },
    transitions: [
      {
        transitionId: "adv-dbl-2c-relay",
        match: { kind: "call", level: 2, strain: BidSuit.Clubs },
        target: "wait-reveal",
      },
      {
        transitionId: "adv-dbl-pass",
        match: { kind: "pass" },
        target: "terminal",
      },
      {
        transitionId: "adv-dbl-any",
        match: { kind: "any-bid" },
        target: "terminal",
      },
    ],
  },

  // ── Relay wait states (East passes through) ─────────────────
  {
    stateId: "wait-reveal",
    parentId: "dont-active",
    allowedParentTransitions: ["opp-double", "opp-bid"],
    transitions: [
      {
        transitionId: "wait-reveal-pass",
        match: { kind: "pass" },
        target: "overcaller-reveal",
      },
    ],
  },
  {
    stateId: "wait-2d-relay",
    parentId: "dont-active",
    allowedParentTransitions: ["opp-double", "opp-bid"],
    transitions: [
      {
        transitionId: "wait-2d-relay-pass",
        match: { kind: "pass" },
        target: "overcaller-2d-relay",
      },
    ],
  },
  {
    stateId: "wait-2c-relay",
    parentId: "dont-active",
    allowedParentTransitions: ["opp-double", "opp-bid"],
    transitions: [
      {
        transitionId: "wait-2c-relay-pass",
        match: { kind: "pass" },
        target: "overcaller-2c-relay",
      },
    ],
  },

  // ── Overcaller reveal / relay response ──────────────────────
  {
    stateId: "overcaller-reveal",
    parentId: "dont-active",
    allowedParentTransitions: ["opp-double", "opp-bid"],
    surfaceGroupId: "overcaller-reveal",
    entryEffects: {
      setCaptain: "opener",
    },
    transitions: [
      {
        transitionId: "reveal-pass",
        match: { kind: "pass" },
        target: "terminal",
      },
      {
        transitionId: "reveal-any",
        match: { kind: "any-bid" },
        target: "terminal",
      },
    ],
  },
  {
    stateId: "overcaller-2d-relay",
    parentId: "dont-active",
    allowedParentTransitions: ["opp-double", "opp-bid"],
    surfaceGroupId: "overcaller-2d-relay",
    entryEffects: {
      setCaptain: "opener",
    },
    transitions: [
      {
        transitionId: "2d-relay-pass",
        match: { kind: "pass" },
        target: "terminal",
      },
      {
        transitionId: "2d-relay-2s",
        match: { kind: "call", level: 2, strain: BidSuit.Spades },
        target: "terminal",
      },
      {
        transitionId: "2d-relay-any",
        match: { kind: "any-bid" },
        target: "terminal",
      },
    ],
  },
  {
    stateId: "overcaller-2c-relay",
    parentId: "dont-active",
    allowedParentTransitions: ["opp-double", "opp-bid"],
    surfaceGroupId: "overcaller-2c-relay",
    entryEffects: {
      setCaptain: "opener",
    },
    transitions: [
      {
        transitionId: "2c-relay-pass",
        match: { kind: "pass" },
        target: "terminal",
      },
      {
        transitionId: "2c-relay-2h",
        match: { kind: "call", level: 2, strain: BidSuit.Hearts },
        target: "terminal",
      },
      {
        transitionId: "2c-relay-2s",
        match: { kind: "call", level: 2, strain: BidSuit.Spades },
        target: "terminal",
      },
      {
        transitionId: "2c-relay-any",
        match: { kind: "any-bid" },
        target: "terminal",
      },
    ],
  },
];

// ─── Module assembly ─────────────────────────────────────────────────

export const dontModule = {
  moduleId: "dont",

  entrySurfaces: DONT_R1_SURFACES,

  surfaceGroups: [
    { groupId: "advancer-after-2h", surfaces: DONT_ADVANCER_2H_SURFACES },
    { groupId: "advancer-after-2d", surfaces: DONT_ADVANCER_2D_SURFACES },
    { groupId: "advancer-after-2c", surfaces: DONT_ADVANCER_2C_SURFACES },
    { groupId: "advancer-after-2s", surfaces: DONT_ADVANCER_2S_SURFACES },
    { groupId: "advancer-after-double", surfaces: DONT_ADVANCER_DOUBLE_SURFACES },
    { groupId: "overcaller-reveal", surfaces: DONT_REVEAL_SURFACES },
    { groupId: "overcaller-2c-relay", surfaces: DONT_2C_RELAY_SURFACES },
    { groupId: "overcaller-2d-relay", surfaces: DONT_2D_RELAY_SURFACES },
  ],

  entryTransitions: DONT_ENTRY_TRANSITIONS,

  machineStates: DONT_MACHINE_STATES,

  facts: dontFacts,

  explanationEntries: DONT_ENTRIES,

  pedagogicalRelations: DONT_PEDAGOGICAL_RELATIONS,
};
