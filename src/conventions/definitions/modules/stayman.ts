import type { MeaningSurface } from "../../../core/contracts/meaning";
import type { MachineState, MachineTransition } from "../../core/runtime/machine-types";
import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
} from "../../../core/contracts/fact-catalog";
import { num, bool, fv } from "../../core/pipeline/fact-helpers";
import { createPosteriorFactEvaluators } from "../../../inference/posterior";
import type { ExplanationEntry } from "../../../core/contracts/explanation-catalog";
import type { PedagogicalRelation } from "../../../core/contracts/teaching-projection";
import { BidSuit } from "../../../engine/types";
import type { SystemConfig } from "../../../core/contracts/system-config";
import { SAYC_SYSTEM_CONFIG } from "../../../core/contracts/system-config";
import {
  SYSTEM_RESPONDER_INVITE_VALUES,
  SYSTEM_RESPONDER_GAME_VALUES,
} from "../../../core/contracts/system-fact-vocabulary";

import { bid } from "../../core/surface-helpers";

// ─── Semantic classes ────────────────────────────────────────

/** Stayman semantic class IDs — module-local, not in the central registry. */
export const STAYMAN_CLASSES = {
  ASK: "stayman:ask-major",
  SHOW_HEARTS: "stayman:show-hearts",
  SHOW_SPADES: "stayman:show-spades",
  DENY_MAJOR: "stayman:deny-major",
} as const;

/** Stayman R3 semantic class IDs — responder continuations after opener's Stayman response. */
export const STAYMAN_R3_CLASSES = {
  RAISE_GAME: "stayman:raise-game",
  RAISE_INVITE: "stayman:raise-invite",
  NT_GAME_NO_FIT: "stayman:nt-game-no-fit",
  NT_INVITE_NO_FIT: "stayman:nt-invite-no-fit",
  NT_GAME_DENIAL: "stayman:nt-game-denial",
  NT_INVITE_DENIAL: "stayman:nt-invite-denial",
} as const;

/** Interference semantic class IDs — module-local. */
export const INTERFERENCE_CLASSES = {
  REDOUBLE_STRENGTH: "interference:redouble-strength",
} as const;

// ─── R1 surface ──────────────────────────────────────────────

/** Factory: creates the Stayman R1 surface parameterized by system config. */
export function createStaymanR1Surface(sys: SystemConfig): MeaningSurface {
  const minHcp = sys.responderThresholds.inviteMin;
  return {
    meaningId: "stayman:ask-major",
    semanticClassId: STAYMAN_CLASSES.ASK,
    moduleId: "stayman",
    encoding: { defaultCall: bid(2, BidSuit.Clubs) },
    clauses: [
      {
        clauseId: "hcp-stayman-min",
        factId: "hand.hcp",
        operator: "gte",
        value: minHcp,
        description: `${minHcp}+ HCP for Stayman`,
      },
      {
        clauseId: "has-four-card-major",
        factId: "bridge.hasFourCardMajor",
        operator: "boolean",
        value: true,
        description: "At least one 4-card major",
        isPublic: true,
      },
      {
        clauseId: "no-five-card-major",
        factId: "bridge.hasFiveCardMajor",
        operator: "boolean",
        value: false,
        description: "No 5-card major (transfer instead)",
      },
    ],
    ranking: {
      recommendationBand: "should",
      modulePrecedence: 1,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "StaymanAsk", params: {} },
    teachingLabel: "Stayman 2♣",
  };
}

// ─── Opener Stayman response surfaces ────────────────────────

export const OPENER_STAYMAN_SURFACES: readonly MeaningSurface[] = [
  {
    meaningId: "stayman:show-hearts",
    semanticClassId: STAYMAN_CLASSES.SHOW_HEARTS,
    moduleId: "stayman",
    encoding: { defaultCall: bid(2, BidSuit.Hearts) },
    clauses: [
      {
        clauseId: "hearts-4-plus",
        factId: "hand.suitLength.hearts",
        operator: "gte",
        value: 4,
        description: "4+ hearts to show",
      },
    ],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 1,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "ShowHeldSuit", params: { suit: "hearts" } },
    teachingLabel: "Show hearts",
    closurePolicy: {
      exclusive: true,
      exhaustive: true,
      mandatory: true,
      domain: {
        kind: "semantic-class-set",
        ids: [
          STAYMAN_CLASSES.SHOW_HEARTS,
          STAYMAN_CLASSES.SHOW_SPADES,
          STAYMAN_CLASSES.DENY_MAJOR,
        ],
      },
    },
  },

  {
    meaningId: "stayman:show-spades",
    semanticClassId: STAYMAN_CLASSES.SHOW_SPADES,
    moduleId: "stayman",
    encoding: { defaultCall: bid(2, BidSuit.Spades) },
    clauses: [
      {
        clauseId: "spades-4-plus",
        factId: "hand.suitLength.spades",
        operator: "gte",
        value: 4,
        description: "4+ spades to show",
      },
    ],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 1,
      intraModuleOrder: 1,
    },
    sourceIntent: { type: "ShowHeldSuit", params: { suit: "spades" } },
    teachingLabel: "Show spades",
    closurePolicy: {
      exclusive: true,
      exhaustive: true,
      mandatory: true,
      domain: {
        kind: "semantic-class-set",
        ids: [
          STAYMAN_CLASSES.SHOW_HEARTS,
          STAYMAN_CLASSES.SHOW_SPADES,
          STAYMAN_CLASSES.DENY_MAJOR,
        ],
      },
    },
  },

  {
    meaningId: "stayman:deny-major",
    semanticClassId: STAYMAN_CLASSES.DENY_MAJOR,
    moduleId: "stayman",
    encoding: { defaultCall: bid(2, BidSuit.Diamonds) },
    clauses: [
      {
        clauseId: "no-four-card-major",
        factId: "bridge.hasFourCardMajor",
        operator: "boolean",
        value: false,
        description: "No 4-card major to show",
      },
    ],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 1,
      intraModuleOrder: 2,
    },
    sourceIntent: { type: "DenyMajor", params: {} },
    teachingLabel: "Deny major (2♦)",
    closurePolicy: {
      exclusive: true,
      exhaustive: true,
      mandatory: true,
      domain: {
        kind: "semantic-class-set",
        ids: [
          STAYMAN_CLASSES.SHOW_HEARTS,
          STAYMAN_CLASSES.SHOW_SPADES,
          STAYMAN_CLASSES.DENY_MAJOR,
        ],
      },
    },
  },
];

// ─── Stayman R3 surfaces ─────────────────────────────────────

export const STAYMAN_R3_AFTER_2H_SURFACES: readonly MeaningSurface[] = [
  {
    meaningId: "stayman:raise-game-hearts",
    semanticClassId: STAYMAN_R3_CLASSES.RAISE_GAME,
    moduleId: "stayman",
    encoding: { defaultCall: bid(4, BidSuit.Hearts) },
    clauses: [
      {
        clauseId: "game-values",
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        description: "Game values opposite 1NT (10+ HCP)",
      },
      {
        clauseId: "hearts-4-plus",
        factId: "hand.suitLength.hearts",
        operator: "gte",
        value: 4,
        description: "4+ hearts (fit with opener)",
      },
    ],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 1,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "RaiseGame", params: { suit: "hearts" } },
    teachingLabel: "Raise to game in hearts",
  },

  {
    meaningId: "stayman:raise-invite-hearts",
    semanticClassId: STAYMAN_R3_CLASSES.RAISE_INVITE,
    moduleId: "stayman",
    encoding: { defaultCall: bid(3, BidSuit.Hearts) },
    clauses: [
      {
        clauseId: "invite-values",
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: "boolean",
        value: true,
        description: "Invite values opposite 1NT (8-9 HCP)",
      },
      {
        clauseId: "hearts-4-plus",
        factId: "hand.suitLength.hearts",
        operator: "gte",
        value: 4,
        description: "4+ hearts (fit with opener)",
      },
    ],
    ranking: {
      recommendationBand: "should",
      modulePrecedence: 1,
      intraModuleOrder: 1,
    },
    sourceIntent: { type: "RaiseInvite", params: { suit: "hearts" } },
    teachingLabel: "Invite in hearts",
  },

  {
    meaningId: "stayman:nt-game-no-fit",
    semanticClassId: STAYMAN_R3_CLASSES.NT_GAME_NO_FIT,
    moduleId: "stayman",
    encoding: { defaultCall: bid(3, BidSuit.NoTrump) },
    clauses: [
      {
        clauseId: "game-values",
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        description: "Game values opposite 1NT (10+ HCP)",
      },
      {
        clauseId: "hearts-less-than-4",
        factId: "hand.suitLength.hearts",
        operator: "lte",
        value: 3,
        description: "Less than 4 hearts (no fit)",
      },
    ],
    ranking: {
      recommendationBand: "should",
      modulePrecedence: 1,
      intraModuleOrder: 2,
    },
    sourceIntent: { type: "StaymanNTGame", params: { reason: "no-heart-fit" } },
    teachingLabel: "3NT (no heart fit)",
  },

  {
    meaningId: "stayman:nt-invite-no-fit",
    semanticClassId: STAYMAN_R3_CLASSES.NT_INVITE_NO_FIT,
    moduleId: "stayman",
    encoding: { defaultCall: bid(2, BidSuit.NoTrump) },
    clauses: [
      {
        clauseId: "invite-values",
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: "boolean",
        value: true,
        description: "Invite values opposite 1NT (8-9 HCP)",
      },
      {
        clauseId: "hearts-less-than-4",
        factId: "hand.suitLength.hearts",
        operator: "lte",
        value: 3,
        description: "Less than 4 hearts (no fit)",
      },
    ],
    ranking: {
      recommendationBand: "may",
      modulePrecedence: 1,
      intraModuleOrder: 3,
    },
    sourceIntent: { type: "StaymanNTInvite", params: { reason: "no-heart-fit" } },
    teachingLabel: "2NT invite (no heart fit)",
  },
];

export const STAYMAN_R3_AFTER_2S_SURFACES: readonly MeaningSurface[] = [
  {
    meaningId: "stayman:raise-game-spades",
    semanticClassId: STAYMAN_R3_CLASSES.RAISE_GAME,
    moduleId: "stayman",
    encoding: { defaultCall: bid(4, BidSuit.Spades) },
    clauses: [
      {
        clauseId: "game-values",
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        description: "Game values opposite 1NT (10+ HCP)",
      },
      {
        clauseId: "spades-4-plus",
        factId: "hand.suitLength.spades",
        operator: "gte",
        value: 4,
        description: "4+ spades (fit with opener)",
      },
    ],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 1,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "RaiseGame", params: { suit: "spades" } },
    teachingLabel: "Raise to game in spades",
  },

  {
    meaningId: "stayman:raise-invite-spades",
    semanticClassId: STAYMAN_R3_CLASSES.RAISE_INVITE,
    moduleId: "stayman",
    encoding: { defaultCall: bid(3, BidSuit.Spades) },
    clauses: [
      {
        clauseId: "invite-values",
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: "boolean",
        value: true,
        description: "Invite values opposite 1NT (8-9 HCP)",
      },
      {
        clauseId: "spades-4-plus",
        factId: "hand.suitLength.spades",
        operator: "gte",
        value: 4,
        description: "4+ spades (fit with opener)",
      },
    ],
    ranking: {
      recommendationBand: "should",
      modulePrecedence: 1,
      intraModuleOrder: 1,
    },
    sourceIntent: { type: "RaiseInvite", params: { suit: "spades" } },
    teachingLabel: "Invite in spades",
  },

  {
    meaningId: "stayman:nt-game-no-fit-2s",
    semanticClassId: STAYMAN_R3_CLASSES.NT_GAME_NO_FIT,
    moduleId: "stayman",
    encoding: { defaultCall: bid(3, BidSuit.NoTrump) },
    clauses: [
      {
        clauseId: "game-values",
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        description: "Game values opposite 1NT (10+ HCP)",
      },
      {
        clauseId: "spades-less-than-4",
        factId: "hand.suitLength.spades",
        operator: "lte",
        value: 3,
        description: "Less than 4 spades (no fit)",
      },
    ],
    ranking: {
      recommendationBand: "should",
      modulePrecedence: 1,
      intraModuleOrder: 2,
    },
    sourceIntent: { type: "StaymanNTGame", params: { reason: "no-spade-fit" } },
    teachingLabel: "3NT (no spade fit)",
  },

  {
    meaningId: "stayman:nt-invite-no-fit-2s",
    semanticClassId: STAYMAN_R3_CLASSES.NT_INVITE_NO_FIT,
    moduleId: "stayman",
    encoding: { defaultCall: bid(2, BidSuit.NoTrump) },
    clauses: [
      {
        clauseId: "invite-values",
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: "boolean",
        value: true,
        description: "Invite values opposite 1NT (8-9 HCP)",
      },
      {
        clauseId: "spades-less-than-4",
        factId: "hand.suitLength.spades",
        operator: "lte",
        value: 3,
        description: "Less than 4 spades (no fit)",
      },
    ],
    ranking: {
      recommendationBand: "may",
      modulePrecedence: 1,
      intraModuleOrder: 3,
    },
    sourceIntent: { type: "StaymanNTInvite", params: { reason: "no-spade-fit" } },
    teachingLabel: "2NT invite (no spade fit)",
  },
];

// Stayman R3 after 2D — ONLY the 2 Stayman surfaces (not Smolen)
export const STAYMAN_R3_AFTER_2D_SURFACES: readonly MeaningSurface[] = [
  {
    meaningId: "stayman:nt-game-after-denial",
    semanticClassId: STAYMAN_R3_CLASSES.NT_GAME_DENIAL,
    moduleId: "stayman",
    encoding: { defaultCall: bid(3, BidSuit.NoTrump) },
    clauses: [
      {
        clauseId: "game-values",
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        description: "Game values opposite 1NT (10+ HCP)",
      },
    ],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 1,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "StaymanNTGame", params: { reason: "denial" } },
    teachingLabel: "3NT after denial",
  },

  {
    meaningId: "stayman:nt-invite-after-denial",
    semanticClassId: STAYMAN_R3_CLASSES.NT_INVITE_DENIAL,
    moduleId: "stayman",
    encoding: { defaultCall: bid(2, BidSuit.NoTrump) },
    clauses: [
      {
        clauseId: "invite-values",
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: "boolean",
        value: true,
        description: "Invite values opposite 1NT (8-9 HCP)",
      },
    ],
    ranking: {
      recommendationBand: "should",
      modulePrecedence: 1,
      intraModuleOrder: 1,
    },
    sourceIntent: { type: "StaymanNTInvite", params: { reason: "denial" } },
    teachingLabel: "2NT invite after denial",
  },
];

// ─── Interference surface ────────────────────────────────────

/** Factory: creates the interference redouble surface parameterized by system config. */
export function createInterferenceRedoubleSurface(sys: SystemConfig): MeaningSurface {
  const minHcp = sys.interference.redoubleMin;
  return {
    meaningId: "interference:redouble-strength",
    semanticClassId: INTERFERENCE_CLASSES.REDOUBLE_STRENGTH,
    moduleId: "stayman",
    encoding: { defaultCall: { type: "redouble" } },
    clauses: [
      {
        clauseId: "hcp-redouble-min",
        factId: "hand.hcp",
        operator: "gte",
        value: minHcp,
        description: `${minHcp}+ HCP to redouble after opponent doubles 1NT`,
      },
    ],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "RedoubleStrength", params: {} },
    teachingLabel: `Redouble (showing ${minHcp}+ HCP)`,
  };
}

/** Legacy default — uses SAYC system config. */
export const INTERFERENCE_REDOUBLE_SURFACE: MeaningSurface =
  createInterferenceRedoubleSurface(SAYC_SYSTEM_CONFIG);

// ─── R1 transition ───────────────────────────────────────────

const STAYMAN_R1_TRANSITION: MachineTransition = {
  transitionId: "r1-stayman",
  match: { kind: "call", level: 2, strain: BidSuit.Clubs },
  target: "opener-stayman",
};

// ─── Machine states ──────────────────────────────────────────

const STAYMAN_MACHINE_STATES: readonly MachineState[] = [
  {
    stateId: "stayman-scope",
    parentId: "nt-opened",
    transitions: [
      {
        transitionId: "stayman-opponent-interrupt",
        match: { kind: "opponent-action" },
        target: "stayman-interrupted",
      },
    ],
    allowedParentTransitions: ["nt-opened-opponent-interrupt", "nt-opened-pass"],
  },
  {
    stateId: "stayman-interrupted",
    parentId: "stayman-scope",
    transitions: [
      {
        transitionId: "stayman-interrupted-absorb",
        match: { kind: "pass" },
        target: "stayman-interrupted",
      },
    ],
    surfaceGroupId: "stayman-interrupted",
    entryEffects: { setCompetitionMode: "Contested" },
    allowedParentTransitions: ["stayman-opponent-interrupt", "nt-opened-opponent-interrupt"],
  },
  {
    stateId: "opener-stayman",
    parentId: "stayman-scope",
    allowedParentTransitions: ["stayman-opponent-interrupt", "nt-opened-opponent-interrupt"],
    transitions: [
      {
        transitionId: "stayman-pass",
        match: { kind: "pass" },
        target: "opener-stayman",
      },
      {
        transitionId: "stayman-2h",
        match: { kind: "call", level: 2, strain: BidSuit.Hearts },
        target: "responder-r3-stayman-2h",
      },
      {
        transitionId: "stayman-2s",
        match: { kind: "call", level: 2, strain: BidSuit.Spades },
        target: "responder-r3-stayman-2s",
      },
      {
        transitionId: "stayman-2d",
        match: { kind: "call", level: 2, strain: BidSuit.Diamonds },
        target: "responder-r3-stayman-2d",
      },
    ],
    surfaceGroupId: "opener-stayman-response",
    entryEffects: {
      setObligation: { kind: "ShowMajor", obligatedSide: "opener" },
    },
  },
  {
    stateId: "responder-r3-stayman-2h",
    parentId: "stayman-scope",
    allowedParentTransitions: ["stayman-opponent-interrupt", "nt-opened-opponent-interrupt"],
    transitions: [
      {
        transitionId: "r3-4h-game",
        match: { kind: "call", level: 4, strain: BidSuit.Hearts },
        target: "terminal",
      },
      {
        transitionId: "r3-3h-invite",
        match: { kind: "call", level: 3, strain: BidSuit.Hearts },
        target: "terminal",
      },
      {
        transitionId: "r3-3nt-no-fit",
        match: { kind: "call", level: 3, strain: BidSuit.NoTrump },
        target: "terminal",
      },
      {
        transitionId: "r3-2nt-invite-no-fit",
        match: { kind: "call", level: 2, strain: BidSuit.NoTrump },
        target: "terminal",
      },
      {
        transitionId: "r3-self-pass-2h",
        match: { kind: "pass", seatRole: "self" },
        target: "terminal",
      },
      {
        transitionId: "r3-opp-pass-wait-2h",
        match: { kind: "pass", seatRole: "opponent" },
        target: "responder-r3-stayman-2h",
      },
      {
        transitionId: "r3-partner-pass-2h",
        match: { kind: "pass", seatRole: "partner" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "responder-r3-after-stayman-2h",
  },
  {
    stateId: "responder-r3-stayman-2s",
    parentId: "stayman-scope",
    allowedParentTransitions: ["stayman-opponent-interrupt", "nt-opened-opponent-interrupt"],
    transitions: [
      {
        transitionId: "r3-4s-game",
        match: { kind: "call", level: 4, strain: BidSuit.Spades },
        target: "terminal",
      },
      {
        transitionId: "r3-3s-invite",
        match: { kind: "call", level: 3, strain: BidSuit.Spades },
        target: "terminal",
      },
      {
        transitionId: "r3-3nt-no-fit-s",
        match: { kind: "call", level: 3, strain: BidSuit.NoTrump },
        target: "terminal",
      },
      {
        transitionId: "r3-2nt-invite-no-fit-s",
        match: { kind: "call", level: 2, strain: BidSuit.NoTrump },
        target: "terminal",
      },
      {
        transitionId: "r3-self-pass-2s",
        match: { kind: "pass", seatRole: "self" },
        target: "terminal",
      },
      {
        transitionId: "r3-opp-pass-wait-2s",
        match: { kind: "pass", seatRole: "opponent" },
        target: "responder-r3-stayman-2s",
      },
      {
        transitionId: "r3-partner-pass-2s",
        match: { kind: "pass", seatRole: "partner" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "responder-r3-after-stayman-2s",
  },
  // responder-r3-stayman-2d: Smolen transitions removed — added via hookTransitions
  {
    stateId: "responder-r3-stayman-2d",
    parentId: "stayman-scope",
    allowedParentTransitions: ["stayman-opponent-interrupt", "nt-opened-opponent-interrupt"],
    transitions: [
      {
        transitionId: "r3-3nt-after-denial",
        match: { kind: "call", level: 3, strain: BidSuit.NoTrump },
        target: "terminal",
      },
      {
        transitionId: "r3-2nt-after-denial",
        match: { kind: "call", level: 2, strain: BidSuit.NoTrump },
        target: "terminal",
      },
      {
        transitionId: "r3-self-pass-2d",
        match: { kind: "pass", seatRole: "self" },
        target: "terminal",
      },
      {
        transitionId: "r3-opp-pass-wait-2d",
        match: { kind: "pass", seatRole: "opponent" },
        target: "responder-r3-stayman-2d",
      },
      {
        transitionId: "r3-partner-pass-2d",
        match: { kind: "pass", seatRole: "partner" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "responder-r3-after-stayman-2d",
  },
];

// ─── Facts ───────────────────────────────────────────────────

const NT_POSTERIOR_FACTS: readonly FactDefinition[] = [
  {
    id: "bridge.nsHaveEightCardFitLikely",
    layer: "module-derived",
    world: "acting-hand",
    description: "Posterior probability that N/S have an 8+ card major fit",
    valueType: "number",
    metadata: { inferable: true, explainable: true },
    constrainsDimensions: [],
  },
  {
    id: "bridge.openerStillBalancedLikely",
    layer: "module-derived",
    world: "acting-hand",
    description: "Posterior probability that opener has balanced shape",
    valueType: "number",
    metadata: { inferable: true, explainable: true },
    constrainsDimensions: [],
  },
  {
    id: "bridge.openerHasSecondMajorLikely",
    layer: "module-derived",
    world: "acting-hand",
    description: "Posterior probability that opener has a second 4-card major",
    valueType: "number",
    metadata: { inferable: true, explainable: true },
    constrainsDimensions: [],
  },
];

const STAYMAN_FACTS: readonly FactDefinition[] = [
  {
    id: "module.stayman.eligible",
    layer: "module-derived",
    world: "acting-hand",
    description: "Eligible for Stayman (4+ card major AND 8+ HCP)",
    valueType: "boolean",
    derivesFrom: ["bridge.hasFourCardMajor", "hand.hcp"],
    constrainsDimensions: ["suitIdentity"],
  },
  {
    id: "module.stayman.preferred",
    layer: "module-derived",
    world: "acting-hand",
    description: "Stayman preferred (eligible AND no 5-card major)",
    valueType: "boolean",
    derivesFrom: ["module.stayman.eligible", "bridge.hasFiveCardMajor"],
    constrainsDimensions: ["suitIdentity"],
  },
];

/** Factory: creates Stayman fact evaluators parameterized by system config. */
export function createStaymanEvaluators(sys: SystemConfig): Map<string, FactEvaluatorFn> {
  const minHcp = sys.responderThresholds.inviteMin;
  return new Map<string, FactEvaluatorFn>([
    ["module.stayman.eligible", (_h, _ev, m) =>
      fv("module.stayman.eligible", bool(m, "bridge.hasFourCardMajor") && num(m, "hand.hcp") >= minHcp)],
    ["module.stayman.preferred", (_h, _ev, m) =>
      fv("module.stayman.preferred", bool(m, "module.stayman.eligible") && !bool(m, "bridge.hasFiveCardMajor"))],
  ]);
}

const posteriorEvaluators = createPosteriorFactEvaluators([
  "bridge.partnerHas4HeartsLikely",
  "bridge.partnerHas4SpadesLikely",
  "bridge.partnerHas4DiamondsLikely",
  "bridge.partnerHas4ClubsLikely",
  "bridge.combinedHcpInRangeLikely",
  "bridge.nsHaveEightCardFitLikely",
  "bridge.openerStillBalancedLikely",
  "bridge.openerHasSecondMajorLikely",
], new Map([
  ["bridge.partnerHas4HeartsLikely", ["H"]],
  ["bridge.partnerHas4SpadesLikely", ["S"]],
  ["bridge.partnerHas4DiamondsLikely", ["D"]],
  ["bridge.partnerHas4ClubsLikely", ["C"]],
  ["bridge.combinedHcpInRangeLikely", ["25", "40"]],
]));

/** Factory: creates Stayman facts parameterized by system config. */
export function createStaymanFacts(sys: SystemConfig): FactCatalogExtension {
  return {
    definitions: [...STAYMAN_FACTS, ...NT_POSTERIOR_FACTS],
    evaluators: createStaymanEvaluators(sys),
    posteriorEvaluators,
  };
}

/** Legacy default — uses SAYC system config. */
export const staymanFacts: FactCatalogExtension =
  createStaymanFacts(SAYC_SYSTEM_CONFIG);

// ─── Explanation entries ─────────────────────────────────────

const STAYMAN_EXPLANATION_ENTRIES: readonly ExplanationEntry[] = [
  {
    explanationId: "nt.stayman.eligible",
    factId: "module.stayman.eligible",
    templateKey: "nt.stayman.eligible.supporting",
    displayText: "Eligible for Stayman",
    contrastiveTemplateKey: "nt.stayman.eligible.whyNot",
    contrastiveDisplayText: "Not eligible for Stayman",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking", "pedagogical"],
  },
  {
    explanationId: "nt.stayman.preferred",
    factId: "module.stayman.preferred",
    templateKey: "nt.stayman.preferred.supporting",
    displayText: "Stayman is the preferred convention",
    preferredLevel: "semantic",
    roles: ["supporting", "inferential"],
  },
  {
    explanationId: "nt.stayman.askMajor",
    meaningId: "stayman:ask-major",
    templateKey: "nt.stayman.askMajor.semantic",
    displayText: "Stayman: asks opener for a 4-card major",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
];

// ─── Pedagogical relations ───────────────────────────────────

const STAYMAN_PEDAGOGICAL_RELATIONS: readonly PedagogicalRelation[] = [
  // Stronger-than within Stayman R3
  {
    kind: "stronger-than",
    a: "stayman:raise-game-hearts",
    b: "stayman:raise-invite-hearts",
  },
  {
    kind: "stronger-than",
    a: "stayman:raise-game-spades",
    b: "stayman:raise-invite-spades",
  },
  {
    kind: "stronger-than",
    a: "stayman:nt-game-no-fit",
    b: "stayman:nt-invite-no-fit",
  },
  {
    kind: "stronger-than",
    a: "stayman:nt-game-after-denial",
    b: "stayman:nt-invite-after-denial",
  },
  // Continuation-of: raise game hearts → ask major
  {
    kind: "continuation-of",
    a: "stayman:raise-game-hearts",
    b: "stayman:ask-major",
  },
];

// ─── Module assembly ─────────────────────────────────────────

/** Factory: creates the stayman module parameterized by system config. */
export function createStaymanModule(sys: SystemConfig) {
  return {
    moduleId: "stayman",

    exposedStates: {
      afterOpener2D: "responder-r3-stayman-2d",
    },

    entrySurfaces: [createStaymanR1Surface(sys)],

    surfaceGroups: [
      { groupId: "opener-stayman-response", surfaces: OPENER_STAYMAN_SURFACES },
      { groupId: "responder-r3-after-stayman-2h", surfaces: STAYMAN_R3_AFTER_2H_SURFACES },
      { groupId: "responder-r3-after-stayman-2s", surfaces: STAYMAN_R3_AFTER_2S_SURFACES },
      { groupId: "responder-r3-after-stayman-2d", surfaces: STAYMAN_R3_AFTER_2D_SURFACES },
      { groupId: "nt-interrupted", surfaces: [createInterferenceRedoubleSurface(sys)] },
    ],

    entryTransitions: [STAYMAN_R1_TRANSITION],

    machineStates: STAYMAN_MACHINE_STATES,

    facts: createStaymanFacts(sys),

    explanationEntries: STAYMAN_EXPLANATION_ENTRIES,

    pedagogicalRelations: STAYMAN_PEDAGOGICAL_RELATIONS,

    alternatives: [],

    intentFamilies: [],
  };
}

/** Legacy default — uses SAYC system config. */
export const staymanModule = createStaymanModule(SAYC_SYSTEM_CONFIG);
