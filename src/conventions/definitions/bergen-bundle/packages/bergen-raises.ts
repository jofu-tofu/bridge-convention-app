import type { ModulePackage } from "../../../core/composition/module-package";
import type { MachineState } from "../../../core/runtime/machine-types";
import { BidSuit } from "../../../../engine/types";
import {
  BERGEN_R1_HEARTS_SURFACES,
  BERGEN_R1_SPADES_SURFACES,
  BERGEN_R2_AFTER_CONSTRUCTIVE_HEARTS_SURFACES,
  BERGEN_R2_AFTER_CONSTRUCTIVE_SPADES_SURFACES,
  BERGEN_R2_AFTER_LIMIT_HEARTS_SURFACES,
  BERGEN_R2_AFTER_LIMIT_SPADES_SURFACES,
  BERGEN_R2_AFTER_PREEMPTIVE_HEARTS_SURFACES,
  BERGEN_R2_AFTER_PREEMPTIVE_SPADES_SURFACES,
  BERGEN_R3_AFTER_GAME_SURFACES,
  BERGEN_R3_AFTER_SIGNOFF_SURFACES,
  BERGEN_R3_AFTER_GAME_TRY_HEARTS_SURFACES,
  BERGEN_R3_AFTER_GAME_TRY_SPADES_SURFACES,
  BERGEN_R4_SURFACES,
} from "../meaning-surfaces";
import { bergenFacts } from "../facts";
import { BERGEN_EXPLANATION_CATALOG } from "../explanation-catalog";
import { BERGEN_PEDAGOGICAL_RELATIONS } from "../pedagogical-relations";
import { BERGEN_ALTERNATIVE_GROUPS } from "../alternatives";

// ─── Machine states contributed by the bergen-raises module ────────

const bergenRaisesStates: readonly MachineState[] = [
  // ─── R1: responder bids Bergen raise ────────────────────────
  // Hearts: 3C=constructive, 3D=limit, 3H=preemptive, 3S=splinter, 4H=game
  {
    stateId: "responder-r1-hearts",
    parentId: null,
    transitions: [
      {
        transitionId: "r1-hearts-constructive",
        match: { kind: "call", level: 3, strain: BidSuit.Clubs },
        target: "opener-after-constructive-hearts",
      },
      {
        transitionId: "r1-hearts-limit",
        match: { kind: "call", level: 3, strain: BidSuit.Diamonds },
        target: "opener-after-limit-hearts",
      },
      {
        transitionId: "r1-hearts-preemptive",
        match: { kind: "call", level: 3, strain: BidSuit.Hearts },
        target: "opener-after-preemptive-hearts",
      },
      {
        transitionId: "r1-hearts-splinter",
        match: { kind: "call", level: 3, strain: BidSuit.Spades },
        target: "terminal",
      },
      {
        transitionId: "r1-hearts-game",
        match: { kind: "call", level: 4, strain: BidSuit.Hearts },
        target: "terminal",
      },
      {
        transitionId: "r1-hearts-pass",
        match: { kind: "pass" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "responder-r1-hearts",
    entryEffects: {
      setCaptain: "responder",
    },
  },
  // Spades: 3C=constructive, 3D=limit, 3S=preemptive, 3H=splinter, 4S=game
  {
    stateId: "responder-r1-spades",
    parentId: null,
    transitions: [
      {
        transitionId: "r1-spades-constructive",
        match: { kind: "call", level: 3, strain: BidSuit.Clubs },
        target: "opener-after-constructive-spades",
      },
      {
        transitionId: "r1-spades-limit",
        match: { kind: "call", level: 3, strain: BidSuit.Diamonds },
        target: "opener-after-limit-spades",
      },
      {
        transitionId: "r1-spades-preemptive",
        match: { kind: "call", level: 3, strain: BidSuit.Spades },
        target: "opener-after-preemptive-spades",
      },
      {
        transitionId: "r1-spades-splinter",
        match: { kind: "call", level: 3, strain: BidSuit.Hearts },
        target: "terminal",
      },
      {
        transitionId: "r1-spades-game",
        match: { kind: "call", level: 4, strain: BidSuit.Spades },
        target: "terminal",
      },
      {
        transitionId: "r1-spades-pass",
        match: { kind: "pass" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "responder-r1-spades",
    entryEffects: {
      setCaptain: "responder",
    },
  },

  // ─── R2: opener rebids ──────────────────────────────────────

  // After constructive (3C): opener decides game/try/signoff
  {
    stateId: "opener-after-constructive-hearts",
    parentId: null,
    transitions: [
      {
        transitionId: "constructive-hearts-pass",
        match: { kind: "pass" },
        target: "opener-after-constructive-hearts", // stay — waiting for opener through opponent pass
      },
      {
        transitionId: "constructive-hearts-game",
        match: { kind: "call", level: 4, strain: BidSuit.Hearts },
        target: "responder-after-game",
      },
      {
        transitionId: "constructive-hearts-signoff",
        match: { kind: "call", level: 3, strain: BidSuit.Hearts },
        target: "responder-after-signoff",
      },
      {
        transitionId: "constructive-hearts-game-try",
        match: { kind: "any-bid" },
        target: "responder-after-game-try-hearts",
      },
    ],
    surfaceGroupId: "opener-after-constructive-hearts",
    entryEffects: {
      setCaptain: "opener",
    },
  },
  {
    stateId: "opener-after-constructive-spades",
    parentId: null,
    transitions: [
      {
        transitionId: "constructive-spades-pass",
        match: { kind: "pass" },
        target: "opener-after-constructive-spades", // stay — waiting for opener
      },
      {
        transitionId: "constructive-spades-game",
        match: { kind: "call", level: 4, strain: BidSuit.Spades },
        target: "responder-after-game",
      },
      {
        transitionId: "constructive-spades-signoff",
        match: { kind: "call", level: 3, strain: BidSuit.Spades },
        target: "responder-after-signoff",
      },
      {
        transitionId: "constructive-spades-game-try",
        match: { kind: "any-bid" },
        target: "responder-after-game-try-spades",
      },
    ],
    surfaceGroupId: "opener-after-constructive-spades",
    entryEffects: {
      setCaptain: "opener",
    },
  },

  // After limit (3D): opener accepts (game) or declines (signoff at 3M)
  {
    stateId: "opener-after-limit-hearts",
    parentId: null,
    transitions: [
      {
        transitionId: "limit-hearts-pass",
        match: { kind: "pass" },
        target: "opener-after-limit-hearts", // stay — waiting for opener
      },
      {
        transitionId: "limit-hearts-game",
        match: { kind: "call", level: 4, strain: BidSuit.Hearts },
        target: "responder-after-game",
      },
      {
        transitionId: "limit-hearts-signoff",
        match: { kind: "call", level: 3, strain: BidSuit.Hearts },
        target: "responder-after-signoff",
      },
      {
        transitionId: "limit-hearts-game-try",
        match: { kind: "any-bid" },
        target: "responder-after-game-try-hearts",
      },
    ],
    surfaceGroupId: "opener-after-limit-hearts",
    entryEffects: {
      setCaptain: "opener",
    },
  },
  {
    stateId: "opener-after-limit-spades",
    parentId: null,
    transitions: [
      {
        transitionId: "limit-spades-pass",
        match: { kind: "pass" },
        target: "opener-after-limit-spades", // stay — waiting for opener
      },
      {
        transitionId: "limit-spades-game",
        match: { kind: "call", level: 4, strain: BidSuit.Spades },
        target: "responder-after-game",
      },
      {
        transitionId: "limit-spades-signoff",
        match: { kind: "call", level: 3, strain: BidSuit.Spades },
        target: "responder-after-signoff",
      },
      {
        transitionId: "limit-spades-game-try",
        match: { kind: "any-bid" },
        target: "responder-after-game-try-spades",
      },
    ],
    surfaceGroupId: "opener-after-limit-spades",
    entryEffects: {
      setCaptain: "opener",
    },
  },

  // After preemptive (3H for hearts / 3S for spades): opener passes or bids game → terminal
  {
    stateId: "opener-after-preemptive-hearts",
    parentId: null,
    transitions: [
      {
        transitionId: "preemptive-hearts-pass",
        match: { kind: "pass" },
        target: "opener-after-preemptive-hearts", // stay — waiting for opener
      },
      {
        transitionId: "preemptive-hearts-any-bid",
        match: { kind: "any-bid" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "opener-after-preemptive-hearts",
    entryEffects: {
      setCaptain: "opener",
    },
  },
  {
    stateId: "opener-after-preemptive-spades",
    parentId: null,
    transitions: [
      {
        transitionId: "preemptive-spades-pass",
        match: { kind: "pass" },
        target: "opener-after-preemptive-spades", // stay — waiting for opener
      },
      {
        transitionId: "preemptive-spades-any-bid",
        match: { kind: "any-bid" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "opener-after-preemptive-spades",
    entryEffects: {
      setCaptain: "opener",
    },
  },

  // ─── R3: responder continuation after opener rebid ──────────

  // R3: after opener bids game (4M) — responder just passes
  {
    stateId: "responder-after-game",
    parentId: null,
    transitions: [
      {
        transitionId: "after-game-pass",
        match: { kind: "pass" },
        target: "responder-after-game",
      },
      {
        transitionId: "after-game-any",
        match: { kind: "any-bid" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "responder-after-game",
    entryEffects: {
      setCaptain: "responder",
    },
  },
  // R3: after opener signs off (3M) — responder just passes
  {
    stateId: "responder-after-signoff",
    parentId: null,
    transitions: [
      {
        transitionId: "after-signoff-pass",
        match: { kind: "pass" },
        target: "responder-after-signoff",
      },
      {
        transitionId: "after-signoff-any",
        match: { kind: "any-bid" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "responder-after-signoff",
    entryEffects: {
      setCaptain: "responder",
    },
  },
  // R3: after opener makes game try — responder decides based on HCP (hearts)
  {
    stateId: "responder-after-game-try-hearts",
    parentId: null,
    transitions: [
      {
        transitionId: "game-try-hearts-pass",
        match: { kind: "pass" },
        target: "responder-after-game-try-hearts",
      },
      {
        transitionId: "game-try-hearts-bid",
        match: { kind: "any-bid" },
        target: "opener-r4-accept",
      },
    ],
    surfaceGroupId: "responder-after-game-try-hearts",
    entryEffects: {
      setCaptain: "responder",
    },
  },
  // R3: after opener makes game try — responder decides based on HCP (spades)
  {
    stateId: "responder-after-game-try-spades",
    parentId: null,
    transitions: [
      {
        transitionId: "game-try-spades-pass",
        match: { kind: "pass" },
        target: "responder-after-game-try-spades",
      },
      {
        transitionId: "game-try-spades-bid",
        match: { kind: "any-bid" },
        target: "opener-r4-accept",
      },
    ],
    surfaceGroupId: "responder-after-game-try-spades",
    entryEffects: {
      setCaptain: "responder",
    },
  },

  // ─── R4: opener accepts responder's game-try decision ───────
  {
    stateId: "opener-r4-accept",
    parentId: null,
    transitions: [
      {
        transitionId: "r4-accept-pass",
        match: { kind: "pass" },
        target: "opener-r4-accept",
      },
      {
        transitionId: "r4-accept-any",
        match: { kind: "any-bid" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "opener-r4-accept",
    entryEffects: {
      setCaptain: "opener",
    },
  },
];

// ─── Module Package ─────────────────────────────────────────────

export const bergenRaisesPackage: ModulePackage = {
  moduleId: "bergen",

  exports: {
    surfaces: [
      // R1: Responder initial bids
      { groupId: "responder-r1-hearts", surfaces: BERGEN_R1_HEARTS_SURFACES },
      { groupId: "responder-r1-spades", surfaces: BERGEN_R1_SPADES_SURFACES },
      // R2: Opener rebids
      { groupId: "opener-after-constructive-hearts", surfaces: BERGEN_R2_AFTER_CONSTRUCTIVE_HEARTS_SURFACES },
      { groupId: "opener-after-constructive-spades", surfaces: BERGEN_R2_AFTER_CONSTRUCTIVE_SPADES_SURFACES },
      { groupId: "opener-after-limit-hearts", surfaces: BERGEN_R2_AFTER_LIMIT_HEARTS_SURFACES },
      { groupId: "opener-after-limit-spades", surfaces: BERGEN_R2_AFTER_LIMIT_SPADES_SURFACES },
      { groupId: "opener-after-preemptive-hearts", surfaces: BERGEN_R2_AFTER_PREEMPTIVE_HEARTS_SURFACES },
      { groupId: "opener-after-preemptive-spades", surfaces: BERGEN_R2_AFTER_PREEMPTIVE_SPADES_SURFACES },
      // R3: Responder continuations
      { groupId: "responder-after-game", surfaces: BERGEN_R3_AFTER_GAME_SURFACES },
      { groupId: "responder-after-signoff", surfaces: BERGEN_R3_AFTER_SIGNOFF_SURFACES },
      { groupId: "responder-after-game-try-hearts", surfaces: BERGEN_R3_AFTER_GAME_TRY_HEARTS_SURFACES },
      { groupId: "responder-after-game-try-spades", surfaces: BERGEN_R3_AFTER_GAME_TRY_SPADES_SURFACES },
      // R4: Opener final acceptance
      { groupId: "opener-r4-accept", surfaces: BERGEN_R4_SURFACES },
    ],
    facts: bergenFacts,
    explanationEntries: [...BERGEN_EXPLANATION_CATALOG.entries],
    pedagogicalRelations: BERGEN_PEDAGOGICAL_RELATIONS,
  },

  runtime: {
    machineFragment: {
      states: bergenRaisesStates,
      entryTransitions: [],
    },
  },
};
