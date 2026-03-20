/**
 * DONT (Disturb Opponents' Notrump) — BaseTrackSpec for the protocol frame
 * architecture.
 *
 * Converts the DONT skeleton + machine FSM into a single self-contained
 * base track with opening patterns, states, transitions, surface fragments,
 * and register effects.
 *
 * Opening pattern (defensive — activates on opponent's 1NT):
 *   opponent 1NT → overcaller-r1
 *
 * State flow:
 *   R1: overcaller-r1 — DONT action selection (2H/2D/2C/2S/X/Pass)
 *   Wait: wait-advancer-{2h|2d|2c|2s|double} — opponent passes through
 *   Advancer: advancer-after-{2h|2d|2c|2s|double} — partner responds
 *   Relay wait: wait-{reveal|2d-relay|2c-relay} — opponent passes through
 *   Reveal: overcaller-{reveal|2d-relay|2c-relay} — overcaller shows suit
 *   Terminal: terminal, dont-contested
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
import { dontFacts } from "../modules/dont/facts";
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
} from "../modules/dont/meaning-surfaces";

// ── Effect helpers ───────────────────────────────────────────

/** Opponent-interference transitions shared by all active DONT states. */
function interferenceTransitions(prefix: string): TransitionSpec[] {
  return [
    {
      transitionId: `${prefix}-opp-double`,
      when: { actor: "opponent", callType: "double" },
      goto: "dont-contested",
    },
    {
      transitionId: `${prefix}-opp-bid`,
      when: { actor: "opponent", callType: "bid" },
      goto: "dont-contested",
    },
  ];
}

function setCaptain(side: "opener" | "responder"): EffectSpec {
  return { op: "setReg", path: "captain.side", value: side };
}

const AGREEMENT_FINAL_TAG: EffectSpec = { op: "exportTag", tag: "agreement.final" };

// ── Surface Fragments ────────────────────────────────────────

/** All surface fragments for the DONT base track, keyed by fragment ID. */
export const DONT_SURFACE_FRAGMENTS: Readonly<Record<string, SurfaceFragment>> = {
  "dont:overcaller-r1": {
    id: "dont:overcaller-r1",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: DONT_R1_SURFACES,
  },
  "dont:advancer-after-2h": {
    id: "dont:advancer-after-2h",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: DONT_ADVANCER_2H_SURFACES,
  },
  "dont:advancer-after-2d": {
    id: "dont:advancer-after-2d",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: DONT_ADVANCER_2D_SURFACES,
  },
  "dont:advancer-after-2c": {
    id: "dont:advancer-after-2c",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: DONT_ADVANCER_2C_SURFACES,
  },
  "dont:advancer-after-2s": {
    id: "dont:advancer-after-2s",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: DONT_ADVANCER_2S_SURFACES,
  },
  "dont:advancer-after-double": {
    id: "dont:advancer-after-double",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: DONT_ADVANCER_DOUBLE_SURFACES,
  },
  "dont:overcaller-reveal": {
    id: "dont:overcaller-reveal",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: DONT_REVEAL_SURFACES,
  },
  "dont:overcaller-2d-relay": {
    id: "dont:overcaller-2d-relay",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: DONT_2D_RELAY_SURFACES,
  },
  "dont:overcaller-2c-relay": {
    id: "dont:overcaller-2c-relay",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: DONT_2C_RELAY_SURFACES,
  },
};

// ── States ───────────────────────────────────────────────────

const DONT_STATES: Readonly<Record<string, FrameStateSpec>> = {
  // ── R1: Overcaller DONT action selection ───────────────────

  "overcaller-r1": {
    id: "overcaller-r1",
    surface: "dont:overcaller-r1",
    onEnter: [
      { op: "setReg", path: "competition.mode", value: "contested" },
    ],
    eventTransitions: [
      ...interferenceTransitions("r1"),
      {
        transitionId: "r1-2h",
        when: { call: bid(2, BidSuit.Hearts) },
        goto: "wait-advancer-2h",
      },
      {
        transitionId: "r1-2d",
        when: { call: bid(2, BidSuit.Diamonds) },
        goto: "wait-advancer-2d",
      },
      {
        transitionId: "r1-2c",
        when: { call: bid(2, BidSuit.Clubs) },
        goto: "wait-advancer-2c",
      },
      {
        transitionId: "r1-2s",
        when: { call: bid(2, BidSuit.Spades) },
        goto: "wait-advancer-2s",
      },
      {
        transitionId: "r1-double",
        when: { callType: "double" },
        goto: "wait-advancer-double",
      },
      {
        transitionId: "r1-pass",
        when: { callType: "pass" },
        goto: "terminal",
      },
    ],
  },

  // ── Wait states: opponent (West) passes through ────────────

  "wait-advancer-2h": {
    id: "wait-advancer-2h",
    eventTransitions: [
      ...interferenceTransitions("wait-2h"),
      {
        transitionId: "wait-2h-pass",
        when: { callType: "pass" },
        goto: "advancer-after-2h",
      },
    ],
  },

  "wait-advancer-2d": {
    id: "wait-advancer-2d",
    eventTransitions: [
      ...interferenceTransitions("wait-2d"),
      {
        transitionId: "wait-2d-pass",
        when: { callType: "pass" },
        goto: "advancer-after-2d",
      },
    ],
  },

  "wait-advancer-2c": {
    id: "wait-advancer-2c",
    eventTransitions: [
      ...interferenceTransitions("wait-2c"),
      {
        transitionId: "wait-2c-pass",
        when: { callType: "pass" },
        goto: "advancer-after-2c",
      },
    ],
  },

  "wait-advancer-2s": {
    id: "wait-advancer-2s",
    eventTransitions: [
      ...interferenceTransitions("wait-2s"),
      {
        transitionId: "wait-2s-pass",
        when: { callType: "pass" },
        goto: "advancer-after-2s",
      },
    ],
  },

  "wait-advancer-double": {
    id: "wait-advancer-double",
    eventTransitions: [
      ...interferenceTransitions("wait-dbl"),
      {
        transitionId: "wait-dbl-pass",
        when: { callType: "pass" },
        goto: "advancer-after-double",
      },
    ],
  },

  // ── Advancer responses (North) ─────────────────────────────

  // After 2H (both majors): Pass=accept hearts, 2S=prefer spades, 3C/3D=escape
  "advancer-after-2h": {
    id: "advancer-after-2h",
    surface: "dont:advancer-after-2h",
    onEnter: [setCaptain("responder")],
    eventTransitions: [
      ...interferenceTransitions("adv-2h"),
      {
        transitionId: "adv-2h-pass",
        when: { callType: "pass" },
        goto: "terminal",
        effects: [AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "adv-2h-2s",
        when: { call: bid(2, BidSuit.Spades) },
        goto: "terminal",
        effects: [AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "adv-2h-2nt",
        when: { call: bid(2, BidSuit.NoTrump) },
        goto: "terminal",
      },
      {
        transitionId: "adv-2h-3c",
        when: { call: bid(3, BidSuit.Clubs) },
        goto: "terminal",
        effects: [AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "adv-2h-3d",
        when: { call: bid(3, BidSuit.Diamonds) },
        goto: "terminal",
        effects: [AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "adv-2h-any",
        when: { callType: "bid" },
        goto: "terminal",
      },
    ],
  },

  // After 2D (diamonds + major): Pass=accept diamonds, 2H=relay asking for major
  "advancer-after-2d": {
    id: "advancer-after-2d",
    surface: "dont:advancer-after-2d",
    onEnter: [setCaptain("responder")],
    eventTransitions: [
      ...interferenceTransitions("adv-2d"),
      {
        transitionId: "adv-2d-pass",
        when: { callType: "pass" },
        goto: "terminal",
        effects: [AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "adv-2d-2h-relay",
        when: { call: bid(2, BidSuit.Hearts) },
        goto: "wait-2d-relay",
      },
      {
        transitionId: "adv-2d-any",
        when: { callType: "bid" },
        goto: "terminal",
      },
    ],
  },

  // After 2C (clubs + higher): Pass=accept clubs, 2D=relay asking for higher suit
  "advancer-after-2c": {
    id: "advancer-after-2c",
    surface: "dont:advancer-after-2c",
    onEnter: [setCaptain("responder")],
    eventTransitions: [
      ...interferenceTransitions("adv-2c"),
      {
        transitionId: "adv-2c-pass",
        when: { callType: "pass" },
        goto: "terminal",
        effects: [AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "adv-2c-2d-relay",
        when: { call: bid(2, BidSuit.Diamonds) },
        goto: "wait-2c-relay",
      },
      {
        transitionId: "adv-2c-any",
        when: { callType: "bid" },
        goto: "terminal",
      },
    ],
  },

  // After 2S (natural spades): Pass=accept spades
  "advancer-after-2s": {
    id: "advancer-after-2s",
    surface: "dont:advancer-after-2s",
    onEnter: [setCaptain("responder")],
    eventTransitions: [
      ...interferenceTransitions("adv-2s"),
      {
        transitionId: "adv-2s-pass",
        when: { callType: "pass" },
        goto: "terminal",
        effects: [AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "adv-2s-any",
        when: { callType: "bid" },
        goto: "terminal",
      },
    ],
  },

  // After X (single suited): 2C=forced relay, own suit escape, or pass
  "advancer-after-double": {
    id: "advancer-after-double",
    surface: "dont:advancer-after-double",
    onEnter: [setCaptain("responder")],
    eventTransitions: [
      ...interferenceTransitions("adv-dbl"),
      {
        transitionId: "adv-dbl-2c-relay",
        when: { call: bid(2, BidSuit.Clubs) },
        goto: "wait-reveal",
      },
      {
        transitionId: "adv-dbl-pass",
        when: { callType: "pass" },
        goto: "terminal",
      },
      {
        transitionId: "adv-dbl-any",
        when: { callType: "bid" },
        goto: "terminal",
      },
    ],
  },

  // ── Relay wait states (East passes through) ────────────────

  "wait-reveal": {
    id: "wait-reveal",
    eventTransitions: [
      ...interferenceTransitions("wait-reveal"),
      {
        transitionId: "wait-reveal-pass",
        when: { callType: "pass" },
        goto: "overcaller-reveal",
      },
    ],
  },

  "wait-2d-relay": {
    id: "wait-2d-relay",
    eventTransitions: [
      ...interferenceTransitions("wait-2d-relay"),
      {
        transitionId: "wait-2d-relay-pass",
        when: { callType: "pass" },
        goto: "overcaller-2d-relay",
      },
    ],
  },

  "wait-2c-relay": {
    id: "wait-2c-relay",
    eventTransitions: [
      ...interferenceTransitions("wait-2c-relay"),
      {
        transitionId: "wait-2c-relay-pass",
        when: { callType: "pass" },
        goto: "overcaller-2c-relay",
      },
    ],
  },

  // ── Overcaller reveal / relay response ─────────────────────

  // After X → 2C: Pass=clubs, 2D=diamonds, 2H=hearts
  "overcaller-reveal": {
    id: "overcaller-reveal",
    surface: "dont:overcaller-reveal",
    onEnter: [setCaptain("opener")],
    eventTransitions: [
      ...interferenceTransitions("reveal"),
      {
        transitionId: "reveal-pass",
        when: { callType: "pass" },
        goto: "terminal",
        effects: [AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "reveal-any",
        when: { callType: "bid" },
        goto: "terminal",
        effects: [AGREEMENT_FINAL_TAG],
      },
    ],
  },

  // After 2D → 2H relay: Pass=hearts (at 2H), 2S=spades
  "overcaller-2d-relay": {
    id: "overcaller-2d-relay",
    surface: "dont:overcaller-2d-relay",
    onEnter: [setCaptain("opener")],
    eventTransitions: [
      ...interferenceTransitions("2d-relay"),
      {
        transitionId: "2d-relay-pass",
        when: { callType: "pass" },
        goto: "terminal",
        effects: [AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "2d-relay-2s",
        when: { call: bid(2, BidSuit.Spades) },
        goto: "terminal",
        effects: [AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "2d-relay-any",
        when: { callType: "bid" },
        goto: "terminal",
        effects: [AGREEMENT_FINAL_TAG],
      },
    ],
  },

  // After 2C → 2D relay: Pass=diamonds (at 2D), 2H=hearts, 2S=spades
  "overcaller-2c-relay": {
    id: "overcaller-2c-relay",
    surface: "dont:overcaller-2c-relay",
    onEnter: [setCaptain("opener")],
    eventTransitions: [
      ...interferenceTransitions("2c-relay"),
      {
        transitionId: "2c-relay-pass",
        when: { callType: "pass" },
        goto: "terminal",
        effects: [AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "2c-relay-2h",
        when: { call: bid(2, BidSuit.Hearts) },
        goto: "terminal",
        effects: [AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "2c-relay-2s",
        when: { call: bid(2, BidSuit.Spades) },
        goto: "terminal",
        effects: [AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "2c-relay-any",
        when: { callType: "bid" },
        goto: "terminal",
        effects: [AGREEMENT_FINAL_TAG],
      },
    ],
  },

  // ── Terminal states ────────────────────────────────────────

  "terminal": {
    id: "terminal",
    eventTransitions: [],
  },

  "dont-contested": {
    id: "dont-contested",
    onEnter: [
      { op: "setReg", path: "competition.mode", value: "doubled" },
    ],
    eventTransitions: [
      {
        transitionId: "dont-contested-absorb",
        when: { callType: "pass" },
        goto: "STAY",
      },
    ],
  },
};

// ── Base Track Spec ──────────────────────────────────────────

/**
 * DONT base track.
 *
 * Activates when an opponent opens 1NT. The overcaller selects a DONT
 * action (two-suited overcall, natural 2S, single-suited double, or pass).
 * The track manages the multi-stage relay structure through advancer
 * responses and overcaller suit reveals.
 */
export const DONT_BASE_TRACK: BaseModuleSpec = {
  role: "base" as const,
  id: "dont",
  name: "DONT (Disturb Opponents' Notrump)",
  openingPatterns: [
    {
      prefix: [
        { actor: "opponent", call: bid(1, BidSuit.NoTrump) },
      ],
      startState: "overcaller-r1",
      priority: 0,
    },
  ],
  states: DONT_STATES,
  initialStateId: "overcaller-r1",
  facts: dontFacts,
};
