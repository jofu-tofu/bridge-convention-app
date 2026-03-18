/**
 * Weak Two Bids convention module.
 *
 * Single module covering the full weak two conversation:
 *   R1 — opener's weak two opening (2D, 2H, 2S)
 *   R2 — responder's action (game raise, Ogust ask, invite, pass)
 *   R3 — opener's Ogust rebid (solid, min/bad, min/good, max/bad, max/good)
 *
 * Entry point: the idle/dispatch state where the opener chooses a weak two bid.
 */
import type { MachineState, MachineTransition } from "../../core/runtime/machine-types";
import type { ConventionModule } from "../../core/composition/module-types";
import { BidSuit } from "../../../engine/types";
import {
  WEAK_TWO_R1_SURFACES,
  WEAK_TWO_R2_HEARTS_SURFACES,
  WEAK_TWO_R2_SPADES_SURFACES,
  WEAK_TWO_R2_DIAMONDS_SURFACES,
  WEAK_TWO_OGUST_HEARTS_SURFACES,
  WEAK_TWO_OGUST_SPADES_SURFACES,
  WEAK_TWO_OGUST_DIAMONDS_SURFACES,
  POST_OGUST_HEARTS_SURFACES,
  POST_OGUST_SPADES_SURFACES,
  POST_OGUST_DIAMONDS_SURFACES,
} from "./meaning-surfaces";
import { weakTwoFacts } from "./facts";
import { WEAK_TWO_ENTRIES } from "./explanation-catalog";
import { WEAK_TWO_PEDAGOGICAL_RELATIONS } from "./pedagogical-relations";

// ─── Entry transitions ──────────────────────────────────────────
//
// These are injected into the skeleton's dispatch state (idle).
// Each transition routes the opener's weak two opening to the
// appropriate "opened" wait state.

const WEAK_TWO_ENTRY_TRANSITIONS: readonly MachineTransition[] = [
  {
    transitionId: "idle-to-weak-two-opened-h",
    match: { kind: "call", level: 2, strain: BidSuit.Hearts },
    target: "weak-two-opened-h",
  },
  {
    transitionId: "idle-to-weak-two-opened-s",
    match: { kind: "call", level: 2, strain: BidSuit.Spades },
    target: "weak-two-opened-s",
  },
  {
    transitionId: "idle-to-weak-two-opened-d",
    match: { kind: "call", level: 2, strain: BidSuit.Diamonds },
    target: "weak-two-opened-d",
  },
];

// ─── Module-owned machine states ────────────────────────────────
//
// All states after the opening bid: opponent-wait states,
// responder R2 states, and Ogust R3 states.

const WEAK_TWO_MACHINE_STATES: readonly MachineState[] = [
  // ── Opponent wait: pass → responder (interference inherited from weak-two-active) ──
  {
    stateId: "weak-two-opened-h",
    parentId: "weak-two-active",
    allowedParentTransitions: ["weak-two-opponent-double", "weak-two-opponent-bid"],
    transitions: [
      {
        transitionId: "opened-h-pass-to-responder",
        match: { kind: "pass" },
        target: "responder-r2-h",
      },
    ],
  },
  {
    stateId: "weak-two-opened-s",
    parentId: "weak-two-active",
    allowedParentTransitions: ["weak-two-opponent-double", "weak-two-opponent-bid"],
    transitions: [
      {
        transitionId: "opened-s-pass-to-responder",
        match: { kind: "pass" },
        target: "responder-r2-s",
      },
    ],
  },
  {
    stateId: "weak-two-opened-d",
    parentId: "weak-two-active",
    allowedParentTransitions: ["weak-two-opponent-double", "weak-two-opponent-bid"],
    transitions: [
      {
        transitionId: "opened-d-pass-to-responder",
        match: { kind: "pass" },
        target: "responder-r2-d",
      },
    ],
  },

  // ── R2: responder actions ─────────────────────────────────────
  {
    stateId: "responder-r2-h",
    parentId: "weak-two-active",
    allowedParentTransitions: ["weak-two-opponent-double", "weak-two-opponent-bid"],
    transitions: [
      {
        transitionId: "r2-h-game-raise",
        match: { kind: "call", level: 4, strain: BidSuit.Hearts },
        target: "terminal",
      },
      {
        transitionId: "r2-h-ogust-ask",
        match: { kind: "call", level: 2, strain: BidSuit.NoTrump },
        target: "ogust-response-h",
      },
      {
        transitionId: "r2-h-invite-raise",
        match: { kind: "call", level: 3, strain: BidSuit.Hearts },
        target: "terminal",
      },
      {
        transitionId: "r2-h-pass",
        match: { kind: "pass" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "responder-r2-hearts",
    entryEffects: {
      setCaptain: "responder",
    },
  },
  {
    stateId: "responder-r2-s",
    parentId: "weak-two-active",
    allowedParentTransitions: ["weak-two-opponent-double", "weak-two-opponent-bid"],
    transitions: [
      {
        transitionId: "r2-s-game-raise",
        match: { kind: "call", level: 4, strain: BidSuit.Spades },
        target: "terminal",
      },
      {
        transitionId: "r2-s-ogust-ask",
        match: { kind: "call", level: 2, strain: BidSuit.NoTrump },
        target: "ogust-response-s",
      },
      {
        transitionId: "r2-s-invite-raise",
        match: { kind: "call", level: 3, strain: BidSuit.Spades },
        target: "terminal",
      },
      {
        transitionId: "r2-s-pass",
        match: { kind: "pass" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "responder-r2-spades",
    entryEffects: {
      setCaptain: "responder",
    },
  },
  {
    stateId: "responder-r2-d",
    parentId: "weak-two-active",
    allowedParentTransitions: ["weak-two-opponent-double", "weak-two-opponent-bid"],
    transitions: [
      {
        transitionId: "r2-d-game-raise",
        match: { kind: "call", level: 5, strain: BidSuit.Diamonds },
        target: "terminal",
      },
      {
        transitionId: "r2-d-ogust-ask",
        match: { kind: "call", level: 2, strain: BidSuit.NoTrump },
        target: "ogust-response-d",
      },
      {
        transitionId: "r2-d-invite-raise",
        match: { kind: "call", level: 3, strain: BidSuit.Diamonds },
        target: "terminal",
      },
      {
        transitionId: "r2-d-pass",
        match: { kind: "pass" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "responder-r2-diamonds",
    entryEffects: {
      setCaptain: "responder",
    },
  },

  // ── R3: Ogust response (opener describes hand) ────────────────
  {
    stateId: "ogust-response-h",
    parentId: "weak-two-active",
    allowedParentTransitions: ["weak-two-opponent-double", "weak-two-opponent-bid"],
    transitions: [
      {
        transitionId: "ogust-h-pass",
        match: { kind: "pass" },
        target: "ogust-response-h", // self-loop for opponent/partner pass
      },
      {
        transitionId: "ogust-h-any-bid",
        match: { kind: "any-bid" },
        target: "responder-after-ogust-h",
      },
    ],
    surfaceGroupId: "ogust-response-hearts",
    entryEffects: {
      setCaptain: "opener",
    },
  },
  {
    stateId: "ogust-response-s",
    parentId: "weak-two-active",
    allowedParentTransitions: ["weak-two-opponent-double", "weak-two-opponent-bid"],
    transitions: [
      {
        transitionId: "ogust-s-pass",
        match: { kind: "pass" },
        target: "ogust-response-s",
      },
      {
        transitionId: "ogust-s-any-bid",
        match: { kind: "any-bid" },
        target: "responder-after-ogust-s",
      },
    ],
    surfaceGroupId: "ogust-response-spades",
    entryEffects: {
      setCaptain: "opener",
    },
  },
  {
    stateId: "ogust-response-d",
    parentId: "weak-two-active",
    allowedParentTransitions: ["weak-two-opponent-double", "weak-two-opponent-bid"],
    transitions: [
      {
        transitionId: "ogust-d-pass",
        match: { kind: "pass" },
        target: "ogust-response-d",
      },
      {
        transitionId: "ogust-d-any-bid",
        match: { kind: "any-bid" },
        target: "responder-after-ogust-d",
      },
    ],
    surfaceGroupId: "ogust-response-diamonds",
    entryEffects: {
      setCaptain: "opener",
    },
  },

  // ── R4: Responder rebid after Ogust response (natural) ──────
  {
    stateId: "responder-after-ogust-h",
    parentId: "weak-two-active",
    allowedParentTransitions: ["weak-two-opponent-double", "weak-two-opponent-bid"],
    transitions: [
      {
        transitionId: "post-ogust-h-pass",
        match: { kind: "pass" },
        target: "responder-after-ogust-h", // self-loop for opponent pass
      },
      {
        transitionId: "post-ogust-h-any-bid",
        match: { kind: "any-bid" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "responder-after-ogust-hearts",
    entryEffects: {
      setCaptain: "responder",
    },
  },
  {
    stateId: "responder-after-ogust-s",
    parentId: "weak-two-active",
    allowedParentTransitions: ["weak-two-opponent-double", "weak-two-opponent-bid"],
    transitions: [
      {
        transitionId: "post-ogust-s-pass",
        match: { kind: "pass" },
        target: "responder-after-ogust-s",
      },
      {
        transitionId: "post-ogust-s-any-bid",
        match: { kind: "any-bid" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "responder-after-ogust-spades",
    entryEffects: {
      setCaptain: "responder",
    },
  },
  {
    stateId: "responder-after-ogust-d",
    parentId: "weak-two-active",
    allowedParentTransitions: ["weak-two-opponent-double", "weak-two-opponent-bid"],
    transitions: [
      {
        transitionId: "post-ogust-d-pass",
        match: { kind: "pass" },
        target: "responder-after-ogust-d",
      },
      {
        transitionId: "post-ogust-d-any-bid",
        match: { kind: "any-bid" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "responder-after-ogust-diamonds",
    entryEffects: {
      setCaptain: "responder",
    },
  },
];

// ─── Module assembly ────────────────────────────────────────────

export const weakTwoModule: ConventionModule = {
  moduleId: "weak-two",

  // R1: opener's weak two opening surfaces → dispatch state
  entrySurfaces: WEAK_TWO_R1_SURFACES,

  // Post-entry surface groups for R2 + R3 + R4
  surfaceGroups: [
    { groupId: "responder-r2-hearts", surfaces: WEAK_TWO_R2_HEARTS_SURFACES },
    { groupId: "responder-r2-spades", surfaces: WEAK_TWO_R2_SPADES_SURFACES },
    { groupId: "responder-r2-diamonds", surfaces: WEAK_TWO_R2_DIAMONDS_SURFACES },
    { groupId: "ogust-response-hearts", surfaces: WEAK_TWO_OGUST_HEARTS_SURFACES },
    { groupId: "ogust-response-spades", surfaces: WEAK_TWO_OGUST_SPADES_SURFACES },
    { groupId: "ogust-response-diamonds", surfaces: WEAK_TWO_OGUST_DIAMONDS_SURFACES },
    { groupId: "responder-after-ogust-hearts", surfaces: POST_OGUST_HEARTS_SURFACES },
    { groupId: "responder-after-ogust-spades", surfaces: POST_OGUST_SPADES_SURFACES },
    { groupId: "responder-after-ogust-diamonds", surfaces: POST_OGUST_DIAMONDS_SURFACES },
  ],

  // Entry transitions injected into the skeleton's dispatch (idle) state
  entryTransitions: WEAK_TWO_ENTRY_TRANSITIONS,

  // Module-owned FSM states (everything after the opening)
  machineStates: WEAK_TWO_MACHINE_STATES,

  facts: weakTwoFacts,

  explanationEntries: WEAK_TWO_ENTRIES,

  pedagogicalRelations: WEAK_TWO_PEDAGOGICAL_RELATIONS,
};
