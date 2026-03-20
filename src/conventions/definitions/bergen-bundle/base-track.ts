/**
 * Bergen Raises — BaseTrackSpec for the protocol frame architecture.
 *
 * Converts the Bergen skeleton + machine FSM into a single self-contained
 * base track with opening patterns, states, transitions, surface fragments,
 * and register effects.
 *
 * Opening patterns (suit-parameterized):
 *   1H → P → responder-r1-hearts
 *   1S → P → responder-r1-spades
 *
 * State flow (per suit):
 *   R1: responder-r1-{suit} — Bergen raise selection (5 responses)
 *   R2: opener-after-{constructive|limit|preemptive}-{suit} — Opener rebid
 *   R3: responder-after-{game|signoff|game-try-{suit}} — Responder continuation
 *   R4: opener-r4-accept — Opener final acceptance
 *   Terminal: terminal, bergen-contested
 */

import type {
  BaseModuleSpec,
  FrameStateSpec,
  TransitionSpec,
  EffectSpec,
  SurfaceFragment,
} from "../../core/protocol/types";
import { BidSuit } from "../../../engine/types";
import { bid } from "../../core/surface-helpers";
import { bergenFacts } from "../modules/bergen/facts";
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
} from "../modules/bergen/meaning-surfaces";

// ── Effect helpers ───────────────────────────────────────────

/** Opponent-interference transitions shared by all active Bergen states. */
function interferenceTransitions(prefix: string): TransitionSpec[] {
  return [
    {
      transitionId: `${prefix}-opp-double`,
      when: { actor: "opponent", callType: "double" },
      goto: "bergen-contested",
    },
    {
      transitionId: `${prefix}-opp-bid`,
      when: { actor: "opponent", callType: "bid" },
      goto: "bergen-contested",
    },
  ];
}

/** Set the captain register. */
function setCaptain(side: "opener" | "responder"): EffectSpec {
  return { op: "setReg", path: "captain.side", value: side };
}

/** Set the agreed strain to a suit. */
function setAgreedStrain(suit: string): EffectSpec {
  return { op: "setReg", path: "agreement.strain", value: { type: "suit", suit } };
}

/** Set the agreement status register. */
function setAgreementStatus(status: "tentative" | "final"): EffectSpec {
  return { op: "setReg", path: "agreement.status", value: status };
}

/** Export the agreement.final tag (used when the contract level is settled). */
const AGREEMENT_FINAL_TAG: EffectSpec = { op: "exportTag", tag: "agreement.final" };

// ── Surface Fragments ────────────────────────────────────────

/** All surface fragments for the Bergen base track, keyed by fragment ID. */
export const BERGEN_SURFACE_FRAGMENTS: Readonly<Record<string, SurfaceFragment>> = {
  "bergen:responder-r1-hearts": {
    id: "bergen:responder-r1-hearts",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: BERGEN_R1_HEARTS_SURFACES,
  },
  "bergen:responder-r1-spades": {
    id: "bergen:responder-r1-spades",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: BERGEN_R1_SPADES_SURFACES,
  },
  "bergen:opener-after-constructive-hearts": {
    id: "bergen:opener-after-constructive-hearts",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: BERGEN_R2_AFTER_CONSTRUCTIVE_HEARTS_SURFACES,
  },
  "bergen:opener-after-constructive-spades": {
    id: "bergen:opener-after-constructive-spades",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: BERGEN_R2_AFTER_CONSTRUCTIVE_SPADES_SURFACES,
  },
  "bergen:opener-after-limit-hearts": {
    id: "bergen:opener-after-limit-hearts",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: BERGEN_R2_AFTER_LIMIT_HEARTS_SURFACES,
  },
  "bergen:opener-after-limit-spades": {
    id: "bergen:opener-after-limit-spades",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: BERGEN_R2_AFTER_LIMIT_SPADES_SURFACES,
  },
  "bergen:opener-after-preemptive-hearts": {
    id: "bergen:opener-after-preemptive-hearts",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: BERGEN_R2_AFTER_PREEMPTIVE_HEARTS_SURFACES,
  },
  "bergen:opener-after-preemptive-spades": {
    id: "bergen:opener-after-preemptive-spades",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: BERGEN_R2_AFTER_PREEMPTIVE_SPADES_SURFACES,
  },
  "bergen:responder-after-game": {
    id: "bergen:responder-after-game",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: BERGEN_R3_AFTER_GAME_SURFACES,
  },
  "bergen:responder-after-signoff": {
    id: "bergen:responder-after-signoff",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: BERGEN_R3_AFTER_SIGNOFF_SURFACES,
  },
  "bergen:responder-after-game-try-hearts": {
    id: "bergen:responder-after-game-try-hearts",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: BERGEN_R3_AFTER_GAME_TRY_HEARTS_SURFACES,
  },
  "bergen:responder-after-game-try-spades": {
    id: "bergen:responder-after-game-try-spades",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: BERGEN_R3_AFTER_GAME_TRY_SPADES_SURFACES,
  },
  "bergen:opener-r4-accept": {
    id: "bergen:opener-r4-accept",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: BERGEN_R4_SURFACES,
  },
};

// ── States ───────────────────────────────────────────────────

const BERGEN_STATES: Readonly<Record<string, FrameStateSpec>> = {
  // ── R1: Responder Bergen raise selection ────────────────────

  // Hearts: 3C=constructive, 3D=limit, 3H=preemptive, 3S=splinter, 4H=game
  "responder-r1-hearts": {
    id: "responder-r1-hearts",
    surface: "bergen:responder-r1-hearts",
    onEnter: [setCaptain("responder")],
    eventTransitions: [
      ...interferenceTransitions("r1-hearts"),
      {
        transitionId: "r1-hearts-constructive",
        when: { call: bid(3, BidSuit.Clubs) },
        goto: "opener-after-constructive-hearts",
        effects: [setAgreedStrain("hearts"), setAgreementStatus("tentative")],
      },
      {
        transitionId: "r1-hearts-limit",
        when: { call: bid(3, BidSuit.Diamonds) },
        goto: "opener-after-limit-hearts",
        effects: [setAgreedStrain("hearts"), setAgreementStatus("tentative")],
      },
      {
        transitionId: "r1-hearts-preemptive",
        when: { call: bid(3, BidSuit.Hearts) },
        goto: "opener-after-preemptive-hearts",
        effects: [setAgreedStrain("hearts"), setAgreementStatus("tentative")],
      },
      {
        transitionId: "r1-hearts-splinter",
        when: { call: bid(3, BidSuit.Spades) },
        goto: "terminal",
        effects: [setAgreedStrain("hearts"), setAgreementStatus("final"), AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "r1-hearts-game",
        when: { call: bid(4, BidSuit.Hearts) },
        goto: "terminal",
        effects: [setAgreedStrain("hearts"), setAgreementStatus("final"), AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "r1-hearts-pass",
        when: { callType: "pass" },
        goto: "terminal",
      },
    ],
  },

  // Spades: 3C=constructive, 3D=limit, 3S=preemptive, 3H=splinter, 4S=game
  "responder-r1-spades": {
    id: "responder-r1-spades",
    surface: "bergen:responder-r1-spades",
    onEnter: [setCaptain("responder")],
    eventTransitions: [
      ...interferenceTransitions("r1-spades"),
      {
        transitionId: "r1-spades-constructive",
        when: { call: bid(3, BidSuit.Clubs) },
        goto: "opener-after-constructive-spades",
        effects: [setAgreedStrain("spades"), setAgreementStatus("tentative")],
      },
      {
        transitionId: "r1-spades-limit",
        when: { call: bid(3, BidSuit.Diamonds) },
        goto: "opener-after-limit-spades",
        effects: [setAgreedStrain("spades"), setAgreementStatus("tentative")],
      },
      {
        transitionId: "r1-spades-preemptive",
        when: { call: bid(3, BidSuit.Spades) },
        goto: "opener-after-preemptive-spades",
        effects: [setAgreedStrain("spades"), setAgreementStatus("tentative")],
      },
      {
        transitionId: "r1-spades-splinter",
        when: { call: bid(3, BidSuit.Hearts) },
        goto: "terminal",
        effects: [setAgreedStrain("spades"), setAgreementStatus("final"), AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "r1-spades-game",
        when: { call: bid(4, BidSuit.Spades) },
        goto: "terminal",
        effects: [setAgreedStrain("spades"), setAgreementStatus("final"), AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "r1-spades-pass",
        when: { callType: "pass" },
        goto: "terminal",
      },
    ],
  },

  // ── R2: Opener rebids after constructive raise (3C) ────────

  "opener-after-constructive-hearts": {
    id: "opener-after-constructive-hearts",
    surface: "bergen:opener-after-constructive-hearts",
    onEnter: [setCaptain("opener")],
    eventTransitions: [
      ...interferenceTransitions("constructive-hearts"),
      {
        transitionId: "constructive-hearts-game",
        when: { call: bid(4, BidSuit.Hearts) },
        goto: "responder-after-game",
        effects: [setAgreementStatus("final"), AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "constructive-hearts-signoff",
        when: { call: bid(3, BidSuit.Hearts) },
        goto: "responder-after-signoff",
        effects: [setAgreementStatus("final"), AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "constructive-hearts-pass",
        when: { callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "constructive-hearts-game-try",
        when: { callType: "bid" },
        goto: "responder-after-game-try-hearts",
      },
    ],
  },

  "opener-after-constructive-spades": {
    id: "opener-after-constructive-spades",
    surface: "bergen:opener-after-constructive-spades",
    onEnter: [setCaptain("opener")],
    eventTransitions: [
      ...interferenceTransitions("constructive-spades"),
      {
        transitionId: "constructive-spades-game",
        when: { call: bid(4, BidSuit.Spades) },
        goto: "responder-after-game",
        effects: [setAgreementStatus("final"), AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "constructive-spades-signoff",
        when: { call: bid(3, BidSuit.Spades) },
        goto: "responder-after-signoff",
        effects: [setAgreementStatus("final"), AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "constructive-spades-pass",
        when: { callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "constructive-spades-game-try",
        when: { callType: "bid" },
        goto: "responder-after-game-try-spades",
      },
    ],
  },

  // ── R2: Opener rebids after limit raise (3D) ──────────────

  "opener-after-limit-hearts": {
    id: "opener-after-limit-hearts",
    surface: "bergen:opener-after-limit-hearts",
    onEnter: [setCaptain("opener")],
    eventTransitions: [
      ...interferenceTransitions("limit-hearts"),
      {
        transitionId: "limit-hearts-game",
        when: { call: bid(4, BidSuit.Hearts) },
        goto: "responder-after-game",
        effects: [setAgreementStatus("final"), AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "limit-hearts-signoff",
        when: { call: bid(3, BidSuit.Hearts) },
        goto: "responder-after-signoff",
        effects: [setAgreementStatus("final"), AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "limit-hearts-pass",
        when: { callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "limit-hearts-game-try",
        when: { callType: "bid" },
        goto: "responder-after-game-try-hearts",
      },
    ],
  },

  "opener-after-limit-spades": {
    id: "opener-after-limit-spades",
    surface: "bergen:opener-after-limit-spades",
    onEnter: [setCaptain("opener")],
    eventTransitions: [
      ...interferenceTransitions("limit-spades"),
      {
        transitionId: "limit-spades-game",
        when: { call: bid(4, BidSuit.Spades) },
        goto: "responder-after-game",
        effects: [setAgreementStatus("final"), AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "limit-spades-signoff",
        when: { call: bid(3, BidSuit.Spades) },
        goto: "responder-after-signoff",
        effects: [setAgreementStatus("final"), AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "limit-spades-pass",
        when: { callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "limit-spades-game-try",
        when: { callType: "bid" },
        goto: "responder-after-game-try-spades",
      },
    ],
  },

  // ── R2: Opener rebids after preemptive raise (3M) ──────────

  "opener-after-preemptive-hearts": {
    id: "opener-after-preemptive-hearts",
    surface: "bergen:opener-after-preemptive-hearts",
    onEnter: [setCaptain("opener")],
    eventTransitions: [
      ...interferenceTransitions("preemptive-hearts"),
      {
        transitionId: "preemptive-hearts-pass",
        when: { callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "preemptive-hearts-any-bid",
        when: { callType: "bid" },
        goto: "terminal",
        effects: [setAgreementStatus("final"), AGREEMENT_FINAL_TAG],
      },
    ],
  },

  "opener-after-preemptive-spades": {
    id: "opener-after-preemptive-spades",
    surface: "bergen:opener-after-preemptive-spades",
    onEnter: [setCaptain("opener")],
    eventTransitions: [
      ...interferenceTransitions("preemptive-spades"),
      {
        transitionId: "preemptive-spades-pass",
        when: { callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "preemptive-spades-any-bid",
        when: { callType: "bid" },
        goto: "terminal",
        effects: [setAgreementStatus("final"), AGREEMENT_FINAL_TAG],
      },
    ],
  },

  // ── R3: Responder after opener bids game (4M) ─────────────

  "responder-after-game": {
    id: "responder-after-game",
    surface: "bergen:responder-after-game",
    exportTags: ["agreement.final"],
    onEnter: [setCaptain("responder")],
    eventTransitions: [
      ...interferenceTransitions("after-game"),
      {
        transitionId: "after-game-pass",
        when: { callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "after-game-any",
        when: { callType: "bid" },
        goto: "terminal",
      },
    ],
  },

  // ── R3: Responder after opener signs off (3M) ─────────────

  "responder-after-signoff": {
    id: "responder-after-signoff",
    surface: "bergen:responder-after-signoff",
    exportTags: ["agreement.final"],
    onEnter: [setCaptain("responder")],
    eventTransitions: [
      ...interferenceTransitions("after-signoff"),
      {
        transitionId: "after-signoff-pass",
        when: { callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "after-signoff-any",
        when: { callType: "bid" },
        goto: "terminal",
      },
    ],
  },

  // ── R3: Responder after game try (hearts) ──────────────────

  "responder-after-game-try-hearts": {
    id: "responder-after-game-try-hearts",
    surface: "bergen:responder-after-game-try-hearts",
    onEnter: [setCaptain("responder")],
    eventTransitions: [
      ...interferenceTransitions("game-try-hearts"),
      {
        transitionId: "game-try-hearts-pass",
        when: { callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "game-try-hearts-bid",
        when: { callType: "bid" },
        goto: "opener-r4-accept",
      },
    ],
  },

  // ── R3: Responder after game try (spades) ──────────────────

  "responder-after-game-try-spades": {
    id: "responder-after-game-try-spades",
    surface: "bergen:responder-after-game-try-spades",
    onEnter: [setCaptain("responder")],
    eventTransitions: [
      ...interferenceTransitions("game-try-spades"),
      {
        transitionId: "game-try-spades-pass",
        when: { callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "game-try-spades-bid",
        when: { callType: "bid" },
        goto: "opener-r4-accept",
      },
    ],
  },

  // ── R4: Opener accepts responder's game-try decision ───────

  "opener-r4-accept": {
    id: "opener-r4-accept",
    surface: "bergen:opener-r4-accept",
    onEnter: [setCaptain("opener")],
    eventTransitions: [
      ...interferenceTransitions("r4-accept"),
      {
        transitionId: "r4-accept-pass",
        when: { callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "r4-accept-any",
        when: { callType: "bid" },
        goto: "terminal",
        effects: [setAgreementStatus("final"), AGREEMENT_FINAL_TAG],
      },
    ],
  },

  // ── Terminal states ────────────────────────────────────────

  "terminal": {
    id: "terminal",
    eventTransitions: [],
  },

  "bergen-contested": {
    id: "bergen-contested",
    onEnter: [
      { op: "setReg", path: "competition.mode", value: "contested" },
    ],
    eventTransitions: [
      {
        transitionId: "bergen-contested-absorb",
        when: { callType: "pass" },
        goto: "STAY",
      },
    ],
  },
};

// ── Base Track Spec ──────────────────────────────────────────

/**
 * Bergen Raises base track.
 *
 * Activates on uncontested 1H or 1S openings (1M followed by pass).
 * Two opening patterns select the suit-specific R1 dispatch state.
 * The track manages the full Bergen auction through R1-R4 with
 * interference handling at every active state.
 */
export const BERGEN_BASE_TRACK: BaseModuleSpec = {
  role: "base" as const,
  id: "bergen-raises",
  name: "Bergen Raises",
  openingPatterns: [
    {
      prefix: [
        { call: bid(1, BidSuit.Hearts) },
        { callType: "pass" },
      ],
      startState: "responder-r1-hearts",
      priority: 0,
    },
    {
      prefix: [
        { call: bid(1, BidSuit.Spades) },
        { callType: "pass" },
      ],
      startState: "responder-r1-spades",
      priority: 0,
    },
  ],
  states: BERGEN_STATES,
  initialStateId: "responder-r1-hearts",
  facts: bergenFacts,
};
