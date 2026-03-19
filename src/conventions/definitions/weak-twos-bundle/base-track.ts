/**
 * Weak Two Bids — BaseTrackSpec for the protocol frame architecture.
 *
 * Converts the Weak Two skeleton + machine FSM into a single self-contained
 * base track with opening patterns, states, transitions, surface fragments,
 * and register effects.
 *
 * Opening patterns (three suits):
 *   2D → weak-2d-opened
 *   2H → weak-2h-opened
 *   2S → weak-2s-opened
 *
 * State flow (per suit):
 *   R1: opener bids weak two (opening pattern selects the track)
 *   Wait: weak-2{x}-opened — opponent pass or interference
 *   R2: responder-r2-{suit} — game raise, Ogust ask, invite, pass
 *   R3: ogust-response-{suit} — opener Ogust classification (5 responses)
 *   R4: responder-after-ogust-{suit} — post-Ogust natural rebid
 *   Terminal: terminal, weak-two-contested
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
import { weakTwoFacts } from "./facts";
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

// ── Effect helpers ───────────────────────────────────────────

/** Opponent-interference transitions shared by all active Weak Two states. */
function interferenceTransitions(prefix: string): TransitionSpec[] {
  return [
    {
      transitionId: `${prefix}-opp-double`,
      when: { actor: "opponent", callType: "double" },
      goto: "weak-two-contested",
    },
    {
      transitionId: `${prefix}-opp-bid`,
      when: { actor: "opponent", callType: "bid" },
      goto: "weak-two-contested",
    },
  ];
}

function setCaptain(side: "opener" | "responder"): EffectSpec {
  return { op: "setReg", path: "captain.side", value: side };
}

function setAgreedStrain(suit: string): EffectSpec {
  return { op: "setReg", path: "agreement.strain", value: { type: "suit", suit } };
}

function setAgreementStatus(status: "tentative" | "final"): EffectSpec {
  return { op: "setReg", path: "agreement.status", value: status };
}

const AGREEMENT_FINAL_TAG: EffectSpec = { op: "exportTag", tag: "agreement.final" };
const VERIFICATION_AVAILABLE_TAG: EffectSpec = { op: "exportTag", tag: "verification.available" };

// ── Surface Fragments ────────────────────────────────────────

/** All surface fragments for the Weak Two base track, keyed by fragment ID. */
export const WEAK_TWO_SURFACE_FRAGMENTS: Readonly<Record<string, SurfaceFragment>> = {
  "weak-two:opener-r1": {
    id: "weak-two:opener-r1",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: WEAK_TWO_R1_SURFACES,
  },
  "weak-two:responder-r2-hearts": {
    id: "weak-two:responder-r2-hearts",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: WEAK_TWO_R2_HEARTS_SURFACES,
  },
  "weak-two:responder-r2-spades": {
    id: "weak-two:responder-r2-spades",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: WEAK_TWO_R2_SPADES_SURFACES,
  },
  "weak-two:responder-r2-diamonds": {
    id: "weak-two:responder-r2-diamonds",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: WEAK_TWO_R2_DIAMONDS_SURFACES,
  },
  "weak-two:ogust-response-hearts": {
    id: "weak-two:ogust-response-hearts",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: WEAK_TWO_OGUST_HEARTS_SURFACES,
  },
  "weak-two:ogust-response-spades": {
    id: "weak-two:ogust-response-spades",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: WEAK_TWO_OGUST_SPADES_SURFACES,
  },
  "weak-two:ogust-response-diamonds": {
    id: "weak-two:ogust-response-diamonds",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: WEAK_TWO_OGUST_DIAMONDS_SURFACES,
  },
  "weak-two:responder-after-ogust-hearts": {
    id: "weak-two:responder-after-ogust-hearts",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: POST_OGUST_HEARTS_SURFACES,
  },
  "weak-two:responder-after-ogust-spades": {
    id: "weak-two:responder-after-ogust-spades",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: POST_OGUST_SPADES_SURFACES,
  },
  "weak-two:responder-after-ogust-diamonds": {
    id: "weak-two:responder-after-ogust-diamonds",
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: POST_OGUST_DIAMONDS_SURFACES,
  },
};

// ── States ───────────────────────────────────────────────────

const WEAK_TWO_STATES: Readonly<Record<string, FrameStateSpec>> = {
  // ── Wait states: opponent pass or interference after opening ──

  "weak-2h-opened": {
    id: "weak-2h-opened",
    onEnter: [setAgreedStrain("hearts"), setAgreementStatus("tentative")],
    eventTransitions: [
      ...interferenceTransitions("opened-h"),
      {
        transitionId: "opened-h-pass-to-responder",
        when: { callType: "pass" },
        goto: "responder-r2-h",
      },
    ],
  },

  "weak-2s-opened": {
    id: "weak-2s-opened",
    onEnter: [setAgreedStrain("spades"), setAgreementStatus("tentative")],
    eventTransitions: [
      ...interferenceTransitions("opened-s"),
      {
        transitionId: "opened-s-pass-to-responder",
        when: { callType: "pass" },
        goto: "responder-r2-s",
      },
    ],
  },

  "weak-2d-opened": {
    id: "weak-2d-opened",
    onEnter: [setAgreedStrain("diamonds"), setAgreementStatus("tentative")],
    eventTransitions: [
      ...interferenceTransitions("opened-d"),
      {
        transitionId: "opened-d-pass-to-responder",
        when: { callType: "pass" },
        goto: "responder-r2-d",
      },
    ],
  },

  // ── R2: Responder actions ──────────────────────────────────

  "responder-r2-h": {
    id: "responder-r2-h",
    surface: "weak-two:responder-r2-hearts",
    onEnter: [setCaptain("responder")],
    eventTransitions: [
      ...interferenceTransitions("r2-h"),
      {
        transitionId: "r2-h-game-raise",
        when: { call: bid(4, BidSuit.Hearts) },
        goto: "terminal",
        effects: [setAgreementStatus("final"), AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "r2-h-ogust-ask",
        when: { call: bid(2, BidSuit.NoTrump) },
        goto: "ogust-response-h",
        effects: [VERIFICATION_AVAILABLE_TAG],
      },
      {
        transitionId: "r2-h-invite-raise",
        when: { call: bid(3, BidSuit.Hearts) },
        goto: "terminal",
        effects: [setAgreementStatus("final"), AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "r2-h-pass",
        when: { callType: "pass" },
        goto: "terminal",
      },
    ],
  },

  "responder-r2-s": {
    id: "responder-r2-s",
    surface: "weak-two:responder-r2-spades",
    onEnter: [setCaptain("responder")],
    eventTransitions: [
      ...interferenceTransitions("r2-s"),
      {
        transitionId: "r2-s-game-raise",
        when: { call: bid(4, BidSuit.Spades) },
        goto: "terminal",
        effects: [setAgreementStatus("final"), AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "r2-s-ogust-ask",
        when: { call: bid(2, BidSuit.NoTrump) },
        goto: "ogust-response-s",
        effects: [VERIFICATION_AVAILABLE_TAG],
      },
      {
        transitionId: "r2-s-invite-raise",
        when: { call: bid(3, BidSuit.Spades) },
        goto: "terminal",
        effects: [setAgreementStatus("final"), AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "r2-s-pass",
        when: { callType: "pass" },
        goto: "terminal",
      },
    ],
  },

  "responder-r2-d": {
    id: "responder-r2-d",
    surface: "weak-two:responder-r2-diamonds",
    onEnter: [setCaptain("responder")],
    eventTransitions: [
      ...interferenceTransitions("r2-d"),
      {
        transitionId: "r2-d-game-raise",
        when: { call: bid(5, BidSuit.Diamonds) },
        goto: "terminal",
        effects: [setAgreementStatus("final"), AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "r2-d-ogust-ask",
        when: { call: bid(2, BidSuit.NoTrump) },
        goto: "ogust-response-d",
        effects: [VERIFICATION_AVAILABLE_TAG],
      },
      {
        transitionId: "r2-d-invite-raise",
        when: { call: bid(3, BidSuit.Diamonds) },
        goto: "terminal",
        effects: [setAgreementStatus("final"), AGREEMENT_FINAL_TAG],
      },
      {
        transitionId: "r2-d-pass",
        when: { callType: "pass" },
        goto: "terminal",
      },
    ],
  },

  // ── R3: Ogust response — opener classifies hand ────────────

  "ogust-response-h": {
    id: "ogust-response-h",
    surface: "weak-two:ogust-response-hearts",
    onEnter: [setCaptain("opener")],
    eventTransitions: [
      ...interferenceTransitions("ogust-h"),
      {
        transitionId: "ogust-h-pass",
        when: { callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "ogust-h-any-bid",
        when: { callType: "bid" },
        goto: "responder-after-ogust-h",
      },
    ],
  },

  "ogust-response-s": {
    id: "ogust-response-s",
    surface: "weak-two:ogust-response-spades",
    onEnter: [setCaptain("opener")],
    eventTransitions: [
      ...interferenceTransitions("ogust-s"),
      {
        transitionId: "ogust-s-pass",
        when: { callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "ogust-s-any-bid",
        when: { callType: "bid" },
        goto: "responder-after-ogust-s",
      },
    ],
  },

  "ogust-response-d": {
    id: "ogust-response-d",
    surface: "weak-two:ogust-response-diamonds",
    onEnter: [setCaptain("opener")],
    eventTransitions: [
      ...interferenceTransitions("ogust-d"),
      {
        transitionId: "ogust-d-pass",
        when: { callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "ogust-d-any-bid",
        when: { callType: "bid" },
        goto: "responder-after-ogust-d",
      },
    ],
  },

  // ── R4: Responder rebid after Ogust (natural) ─────────────

  "responder-after-ogust-h": {
    id: "responder-after-ogust-h",
    surface: "weak-two:responder-after-ogust-hearts",
    onEnter: [setCaptain("responder")],
    eventTransitions: [
      ...interferenceTransitions("post-ogust-h"),
      {
        transitionId: "post-ogust-h-pass",
        when: { callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "post-ogust-h-any-bid",
        when: { callType: "bid" },
        goto: "terminal",
        effects: [setAgreementStatus("final"), AGREEMENT_FINAL_TAG],
      },
    ],
  },

  "responder-after-ogust-s": {
    id: "responder-after-ogust-s",
    surface: "weak-two:responder-after-ogust-spades",
    onEnter: [setCaptain("responder")],
    eventTransitions: [
      ...interferenceTransitions("post-ogust-s"),
      {
        transitionId: "post-ogust-s-pass",
        when: { callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "post-ogust-s-any-bid",
        when: { callType: "bid" },
        goto: "terminal",
        effects: [setAgreementStatus("final"), AGREEMENT_FINAL_TAG],
      },
    ],
  },

  "responder-after-ogust-d": {
    id: "responder-after-ogust-d",
    surface: "weak-two:responder-after-ogust-diamonds",
    onEnter: [setCaptain("responder")],
    eventTransitions: [
      ...interferenceTransitions("post-ogust-d"),
      {
        transitionId: "post-ogust-d-pass",
        when: { callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "post-ogust-d-any-bid",
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

  "weak-two-contested": {
    id: "weak-two-contested",
    onEnter: [
      { op: "setReg", path: "competition.mode", value: "contested" },
    ],
    eventTransitions: [
      {
        transitionId: "weak-two-contested-absorb",
        when: { callType: "pass" },
        goto: "STAY",
      },
    ],
  },
};

// ── Base Track Spec ──────────────────────────────────────────

/**
 * Weak Two Bids base track.
 *
 * Activates on 2D, 2H, or 2S openings. Each pattern selects a
 * suit-specific wait state that handles opponent pass or interference.
 * The track manages the full auction through R2-R4 including the
 * Ogust 2NT convention for hand classification.
 */
export const WEAK_TWO_BASE_TRACK: BaseModuleSpec = {
  role: "base" as const,
  id: "weak-two-bids",
  name: "Weak Two Bids",
  openingPatterns: [
    {
      prefix: [{ call: bid(2, BidSuit.Hearts) }],
      startState: "weak-2h-opened",
      priority: 0,
    },
    {
      prefix: [{ call: bid(2, BidSuit.Spades) }],
      startState: "weak-2s-opened",
      priority: 0,
    },
    {
      prefix: [{ call: bid(2, BidSuit.Diamonds) }],
      startState: "weak-2d-opened",
      priority: 0,
    },
  ],
  openingSurface: "weak-two:opener-r1",
  states: WEAK_TWO_STATES,
  initialStateId: "weak-2h-opened",
  facts: weakTwoFacts,
};
