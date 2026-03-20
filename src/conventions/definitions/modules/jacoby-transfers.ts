import type { MeaningSurface } from "../../../core/contracts/meaning";
import type { MachineState, MachineTransition } from "../../core/runtime/machine-types";
import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
} from "../../../core/contracts/fact-catalog";
import { num, bool, fv } from "../../core/pipeline/fact-helpers";
import type { ExplanationEntry } from "../../../core/contracts/explanation-catalog";
import type { PedagogicalRelation } from "../../../core/contracts/teaching-projection";
import { BidSuit } from "../../../engine/types";
import type { SystemConfig } from "../../../core/contracts/system-config";
import { SAYC_SYSTEM_CONFIG } from "../../../core/contracts/system-config";
import {
  SYSTEM_RESPONDER_INVITE_VALUES,
  SYSTEM_RESPONDER_GAME_VALUES,
  SYSTEM_OPENER_NOT_MINIMUM,
} from "../../../core/contracts/system-fact-vocabulary";

import { bid } from "../../core/surface-helpers";

// ─── Semantic classes ────────────────────────────────────────

/** Jacoby Transfer semantic class IDs — module-local, not in the central registry. */
export const TRANSFER_CLASSES = {
  TO_HEARTS: "transfer:to-hearts",
  TO_SPADES: "transfer:to-spades",
  ACCEPT: "transfer:accept",
  ACCEPT_SPADES: "transfer:accept-spades",
} as const;

/** Transfer R3 semantic class IDs — responder continuations after opener accepts transfer. */
export const TRANSFER_R3_CLASSES = {
  SIGNOFF: "transfer:signoff",
  INVITE: "transfer:invite",
  GAME_IN_MAJOR: "transfer:game-in-major",
  NT_GAME: "transfer:nt-game",
} as const;

/** Opener placement semantic class IDs — opener's decision after responder's 3NT or 2NT. */
export const OPENER_PLACE_CLASSES = {
  CORRECT_TO_MAJOR: "transfer:correct-to-major",
  PASS_3NT: "transfer:pass-3nt",
  ACCEPT_INVITE: "transfer:accept-invite",
  DECLINE_INVITE: "transfer:decline-invite",
} as const;

// ─── R1 surfaces ─────────────────────────────────────────────

const TRANSFER_R1_SURFACES: readonly MeaningSurface[] = [
  {
    meaningId: "transfer:to-hearts",
    semanticClassId: TRANSFER_CLASSES.TO_HEARTS,
    moduleId: "jacoby-transfers",
    encoding: { defaultCall: bid(2, BidSuit.Diamonds) },
    clauses: [
      {
        clauseId: "hearts-5-plus",
        factId: "hand.suitLength.hearts",
        operator: "gte",
        value: 5,
        description: "5+ hearts for transfer",
      },
    ],
    ranking: {
      recommendationBand: "should",
      modulePrecedence: 0,
      intraModuleOrder: 1,
    },
    sourceIntent: { type: "TransferToHearts", params: {} },
    teachingLabel: "Transfer to hearts",
  },

  {
    meaningId: "transfer:to-spades",
    semanticClassId: TRANSFER_CLASSES.TO_SPADES,
    moduleId: "jacoby-transfers",
    encoding: { defaultCall: bid(2, BidSuit.Hearts) },
    clauses: [
      {
        clauseId: "spades-5-plus",
        factId: "hand.suitLength.spades",
        operator: "gte",
        value: 5,
        description: "5+ spades for transfer",
      },
    ],
    ranking: {
      recommendationBand: "should",
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "TransferToSpades", params: {} },
    teachingLabel: "Transfer to spades",
  },
];

// ─── Opener transfer accept surfaces ─────────────────────────

export const OPENER_TRANSFER_HEARTS_SURFACES: readonly MeaningSurface[] = [
  {
    meaningId: "transfer:accept",
    semanticClassId: TRANSFER_CLASSES.ACCEPT,
    moduleId: "jacoby-transfers",
    encoding: { defaultCall: bid(2, BidSuit.Hearts) },
    clauses: [],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "AcceptTransfer", params: { suit: "hearts" } },
    teachingLabel: "Accept transfer to hearts",
  },
];

export const OPENER_TRANSFER_SPADES_SURFACES: readonly MeaningSurface[] = [
  {
    meaningId: "transfer:accept-spades",
    semanticClassId: TRANSFER_CLASSES.ACCEPT_SPADES,
    moduleId: "jacoby-transfers",
    encoding: { defaultCall: bid(2, BidSuit.Spades) },
    clauses: [],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "AcceptTransfer", params: { suit: "spades" } },
    teachingLabel: "Accept transfer to spades",
  },
];

// ─── Transfer R3 surfaces ────────────────────────────────────

export const TRANSFER_R3_HEARTS_SURFACES: readonly MeaningSurface[] = [
  {
    meaningId: "transfer:signoff-hearts",
    semanticClassId: TRANSFER_R3_CLASSES.SIGNOFF,
    moduleId: "jacoby-transfers",
    encoding: { defaultCall: { type: "pass" } },
    clauses: [
      {
        clauseId: "weak-hand",
        factId: "hand.hcp",
        operator: "lte",
        value: 7,
        description: "Less than 8 HCP (weak hand, signoff)",
      },
    ],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "Signoff", params: { suit: "hearts" } },
    teachingLabel: "Pass (signoff in hearts)",
  },

  {
    meaningId: "transfer:game-hearts",
    semanticClassId: TRANSFER_R3_CLASSES.GAME_IN_MAJOR,
    moduleId: "jacoby-transfers",
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
        clauseId: "hearts-6-plus",
        factId: "hand.suitLength.hearts",
        operator: "gte",
        value: 6,
        description: "6+ hearts (game in major with guaranteed fit)",
      },
    ],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 0,
      intraModuleOrder: 1,
    },
    sourceIntent: { type: "GameInMajor", params: { suit: "hearts" } },
    teachingLabel: "4H game",
  },

  {
    meaningId: "transfer:nt-game-hearts",
    semanticClassId: TRANSFER_R3_CLASSES.NT_GAME,
    moduleId: "jacoby-transfers",
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
        clauseId: "hearts-exactly-5",
        factId: "hand.suitLength.hearts",
        operator: "eq",
        value: 5,
        description: "Exactly 5 hearts (offer 3NT as alternative to 4H)",
      },
    ],
    ranking: {
      recommendationBand: "should",
      modulePrecedence: 0,
      intraModuleOrder: 2,
    },
    sourceIntent: { type: "TransferNTGame", params: { suit: "hearts" } },
    teachingLabel: "3NT (5 hearts, let opener choose)",
  },

  {
    meaningId: "transfer:invite-hearts",
    semanticClassId: TRANSFER_R3_CLASSES.INVITE,
    moduleId: "jacoby-transfers",
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
      modulePrecedence: 0,
      intraModuleOrder: 3,
    },
    sourceIntent: { type: "Invite", params: { suit: "hearts" } },
    teachingLabel: "2NT invite",
  },
];

export const TRANSFER_R3_SPADES_SURFACES: readonly MeaningSurface[] = [
  {
    meaningId: "transfer:signoff-spades",
    semanticClassId: TRANSFER_R3_CLASSES.SIGNOFF,
    moduleId: "jacoby-transfers",
    encoding: { defaultCall: { type: "pass" } },
    clauses: [
      {
        clauseId: "weak-hand",
        factId: "hand.hcp",
        operator: "lte",
        value: 7,
        description: "Less than 8 HCP (weak hand, signoff)",
      },
    ],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "Signoff", params: { suit: "spades" } },
    teachingLabel: "Pass (signoff in spades)",
  },

  {
    meaningId: "transfer:game-spades",
    semanticClassId: TRANSFER_R3_CLASSES.GAME_IN_MAJOR,
    moduleId: "jacoby-transfers",
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
        clauseId: "spades-6-plus",
        factId: "hand.suitLength.spades",
        operator: "gte",
        value: 6,
        description: "6+ spades (game in major with guaranteed fit)",
      },
    ],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 0,
      intraModuleOrder: 1,
    },
    sourceIntent: { type: "GameInMajor", params: { suit: "spades" } },
    teachingLabel: "4S game",
  },

  {
    meaningId: "transfer:nt-game-spades",
    semanticClassId: TRANSFER_R3_CLASSES.NT_GAME,
    moduleId: "jacoby-transfers",
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
        clauseId: "spades-exactly-5",
        factId: "hand.suitLength.spades",
        operator: "eq",
        value: 5,
        description: "Exactly 5 spades (offer 3NT as alternative to 4S)",
      },
    ],
    ranking: {
      recommendationBand: "should",
      modulePrecedence: 0,
      intraModuleOrder: 2,
    },
    sourceIntent: { type: "TransferNTGame", params: { suit: "spades" } },
    teachingLabel: "3NT (5 spades, let opener choose)",
  },

  {
    meaningId: "transfer:invite-spades",
    semanticClassId: TRANSFER_R3_CLASSES.INVITE,
    moduleId: "jacoby-transfers",
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
      modulePrecedence: 0,
      intraModuleOrder: 3,
    },
    sourceIntent: { type: "Invite", params: { suit: "spades" } },
    teachingLabel: "2NT invite",
  },
];

// ─── Opener placement surfaces (after responder's 3NT "let opener choose") ──

export const OPENER_PLACE_HEARTS_SURFACES: readonly MeaningSurface[] = [
  {
    meaningId: "transfer:correct-to-4h",
    semanticClassId: OPENER_PLACE_CLASSES.CORRECT_TO_MAJOR,
    moduleId: "jacoby-transfers",
    encoding: { defaultCall: bid(4, BidSuit.Hearts) },
    clauses: [
      {
        clauseId: "heart-fit",
        factId: "module.transfer.openerHasHeartFit",
        operator: "boolean",
        value: true,
        description: "Opener has 3+ hearts (fit with responder's 5)",
      },
    ],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "PlacementCorrection", params: { suit: "hearts" } },
    teachingLabel: "4H (heart fit found)",
  },
  {
    meaningId: "transfer:pass-3nt-hearts",
    semanticClassId: OPENER_PLACE_CLASSES.PASS_3NT,
    moduleId: "jacoby-transfers",
    encoding: { defaultCall: { type: "pass" } },
    clauses: [
      {
        clauseId: "no-heart-fit",
        factId: "module.transfer.openerHasHeartFit",
        operator: "boolean",
        value: false,
        description: "Opener has fewer than 3 hearts (no fit)",
      },
    ],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 0,
      intraModuleOrder: 1,
    },
    sourceIntent: { type: "PlacementPass", params: { suit: "hearts" } },
    teachingLabel: "Pass (stay in 3NT, no heart fit)",
  },
];

export const OPENER_PLACE_SPADES_SURFACES: readonly MeaningSurface[] = [
  {
    meaningId: "transfer:correct-to-4s",
    semanticClassId: OPENER_PLACE_CLASSES.CORRECT_TO_MAJOR,
    moduleId: "jacoby-transfers",
    encoding: { defaultCall: bid(4, BidSuit.Spades) },
    clauses: [
      {
        clauseId: "spade-fit",
        factId: "module.transfer.openerHasSpadesFit",
        operator: "boolean",
        value: true,
        description: "Opener has 3+ spades (fit with responder's 5)",
      },
    ],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "PlacementCorrection", params: { suit: "spades" } },
    teachingLabel: "4S (spade fit found)",
  },
  {
    meaningId: "transfer:pass-3nt-spades",
    semanticClassId: OPENER_PLACE_CLASSES.PASS_3NT,
    moduleId: "jacoby-transfers",
    encoding: { defaultCall: { type: "pass" } },
    clauses: [
      {
        clauseId: "no-spade-fit",
        factId: "module.transfer.openerHasSpadesFit",
        operator: "boolean",
        value: false,
        description: "Opener has fewer than 3 spades (no fit)",
      },
    ],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 0,
      intraModuleOrder: 1,
    },
    sourceIntent: { type: "PlacementPass", params: { suit: "spades" } },
    teachingLabel: "Pass (stay in 3NT, no spade fit)",
  },
];

// ─── Opener invite acceptance surfaces (after responder's 2NT invite) ──

export const OPENER_ACCEPT_INVITE_HEARTS_SURFACES: readonly MeaningSurface[] = [
  {
    meaningId: "transfer:accept-invite-hearts",
    semanticClassId: OPENER_PLACE_CLASSES.ACCEPT_INVITE,
    moduleId: "jacoby-transfers",
    encoding: { defaultCall: bid(3, BidSuit.NoTrump) },
    clauses: [
      {
        clauseId: "not-minimum",
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: true,
        description: "Opener has 16-17 HCP (not minimum)",
      },
    ],
    ranking: {
      recommendationBand: "should",
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "AcceptInvite", params: {} },
    teachingLabel: "3NT (accept invite)",
  },
  {
    meaningId: "transfer:decline-invite-hearts",
    semanticClassId: OPENER_PLACE_CLASSES.DECLINE_INVITE,
    moduleId: "jacoby-transfers",
    encoding: { defaultCall: { type: "pass" } },
    clauses: [
      {
        clauseId: "minimum",
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: false,
        description: "Opener has 15 HCP (minimum)",
      },
    ],
    ranking: {
      recommendationBand: "should",
      modulePrecedence: 0,
      intraModuleOrder: 1,
    },
    sourceIntent: { type: "DeclineInvite", params: {} },
    teachingLabel: "Pass (decline invite, minimum)",
  },
];

export const OPENER_ACCEPT_INVITE_SPADES_SURFACES: readonly MeaningSurface[] = [
  {
    meaningId: "transfer:accept-invite-spades",
    semanticClassId: OPENER_PLACE_CLASSES.ACCEPT_INVITE,
    moduleId: "jacoby-transfers",
    encoding: { defaultCall: bid(3, BidSuit.NoTrump) },
    clauses: [
      {
        clauseId: "not-minimum",
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: true,
        description: "Opener has 16-17 HCP (not minimum)",
      },
    ],
    ranking: {
      recommendationBand: "should",
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "AcceptInvite", params: {} },
    teachingLabel: "3NT (accept invite)",
  },
  {
    meaningId: "transfer:decline-invite-spades",
    semanticClassId: OPENER_PLACE_CLASSES.DECLINE_INVITE,
    moduleId: "jacoby-transfers",
    encoding: { defaultCall: { type: "pass" } },
    clauses: [
      {
        clauseId: "minimum",
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: false,
        description: "Opener has 15 HCP (minimum)",
      },
    ],
    ranking: {
      recommendationBand: "should",
      modulePrecedence: 0,
      intraModuleOrder: 1,
    },
    sourceIntent: { type: "DeclineInvite", params: {} },
    teachingLabel: "Pass (decline invite, minimum)",
  },
];

// ─── R1 transitions ──────────────────────────────────────────

const TRANSFER_R1_TRANSITIONS: readonly MachineTransition[] = [
  {
    transitionId: "r1-transfer-hearts",
    match: { kind: "call", level: 2, strain: BidSuit.Diamonds },
    target: "opener-transfer-hearts",
  },
  {
    transitionId: "r1-transfer-spades",
    match: { kind: "call", level: 2, strain: BidSuit.Hearts },
    target: "opener-transfer-spades",
  },
];

// ─── Machine states ──────────────────────────────────────────

const TRANSFER_MACHINE_STATES: readonly MachineState[] = [
  {
    stateId: "transfers-scope",
    parentId: "nt-opened",
    transitions: [
      {
        transitionId: "transfers-opponent-interrupt",
        match: { kind: "opponent-action" },
        target: "transfers-interrupted",
      },
    ],
    allowedParentTransitions: ["nt-opened-opponent-interrupt", "nt-opened-pass"],
  },
  {
    stateId: "transfers-interrupted",
    parentId: "transfers-scope",
    transitions: [
      {
        transitionId: "transfers-interrupted-absorb",
        match: { kind: "pass" },
        target: "transfers-interrupted",
      },
    ],
    surfaceGroupId: "transfers-interrupted",
    entryEffects: { setCompetitionMode: "Contested" },
    allowedParentTransitions: ["transfers-opponent-interrupt", "nt-opened-opponent-interrupt"],
  },
  {
    stateId: "opener-transfer-hearts",
    parentId: "transfers-scope",
    allowedParentTransitions: ["transfers-opponent-interrupt", "nt-opened-opponent-interrupt"],
    transitions: [
      {
        transitionId: "transfer-h-pass",
        match: { kind: "pass" },
        target: "opener-transfer-hearts",
      },
      {
        transitionId: "transfer-h-accept",
        match: { kind: "call", level: 2, strain: BidSuit.Hearts },
        target: "responder-r3-transfer-hearts",
      },
    ],
    surfaceGroupId: "opener-transfer-accept",
    entryEffects: {
      setAgreedStrain: {
        type: "suit",
        suit: "hearts",
        confidence: "tentative",
      },
    },
  },

  {
    stateId: "opener-transfer-spades",
    parentId: "transfers-scope",
    allowedParentTransitions: ["transfers-opponent-interrupt", "nt-opened-opponent-interrupt"],
    transitions: [
      {
        transitionId: "transfer-s-pass",
        match: { kind: "pass" },
        target: "opener-transfer-spades",
      },
      {
        transitionId: "transfer-s-accept",
        match: { kind: "call", level: 2, strain: BidSuit.Spades },
        target: "responder-r3-transfer-spades",
      },
    ],
    surfaceGroupId: "opener-transfer-accept-spades",
    entryEffects: {
      setAgreedStrain: {
        type: "suit",
        suit: "spades",
        confidence: "tentative",
      },
    },
  },

  {
    stateId: "responder-r3-transfer-hearts",
    parentId: "transfers-scope",
    allowedParentTransitions: ["transfers-opponent-interrupt", "nt-opened-opponent-interrupt"],
    transitions: [
      {
        transitionId: "r3-4h-game",
        match: { kind: "call", level: 4, strain: BidSuit.Hearts },
        target: "terminal",
      },
      {
        transitionId: "r3-3nt-hearts",
        match: { kind: "call", level: 3, strain: BidSuit.NoTrump },
        target: "opener-place-after-transfer-hearts",
      },
      {
        transitionId: "r3-2nt-invite-hearts",
        match: { kind: "call", level: 2, strain: BidSuit.NoTrump },
        target: "opener-accept-invite-hearts",
      },
      {
        transitionId: "r3-self-pass-th",
        match: { kind: "pass", seatRole: "self" },
        target: "terminal",
      },
      {
        transitionId: "r3-opp-pass-wait-th",
        match: { kind: "pass", seatRole: "opponent" },
        target: "responder-r3-transfer-hearts",
      },
      {
        transitionId: "r3-partner-pass-th",
        match: { kind: "pass", seatRole: "partner" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "responder-r3-after-transfer-hearts",
  },

  {
    stateId: "responder-r3-transfer-spades",
    parentId: "transfers-scope",
    allowedParentTransitions: ["transfers-opponent-interrupt", "nt-opened-opponent-interrupt"],
    transitions: [
      {
        transitionId: "r3-4s-game",
        match: { kind: "call", level: 4, strain: BidSuit.Spades },
        target: "terminal",
      },
      {
        transitionId: "r3-3nt-spades",
        match: { kind: "call", level: 3, strain: BidSuit.NoTrump },
        target: "opener-place-after-transfer-spades",
      },
      {
        transitionId: "r3-2nt-invite-spades",
        match: { kind: "call", level: 2, strain: BidSuit.NoTrump },
        target: "opener-accept-invite-spades",
      },
      {
        transitionId: "r3-self-pass-ts",
        match: { kind: "pass", seatRole: "self" },
        target: "terminal",
      },
      {
        transitionId: "r3-opp-pass-wait-ts",
        match: { kind: "pass", seatRole: "opponent" },
        target: "responder-r3-transfer-spades",
      },
      {
        transitionId: "r3-partner-pass-ts",
        match: { kind: "pass", seatRole: "partner" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "responder-r3-after-transfer-spades",
  },

  // ─── Opener placement states (after responder's 3NT "let opener choose") ──

  {
    stateId: "opener-place-after-transfer-hearts",
    parentId: "transfers-scope",
    allowedParentTransitions: ["transfers-opponent-interrupt", "nt-opened-opponent-interrupt"],
    transitions: [
      {
        transitionId: "place-th-correct-4h",
        match: { kind: "call", level: 4, strain: BidSuit.Hearts },
        target: "terminal",
      },
      {
        transitionId: "place-th-pass",
        match: { kind: "pass" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "opener-place-after-transfer-hearts",
    entryEffects: { setCaptain: "opener" },
  },

  {
    stateId: "opener-place-after-transfer-spades",
    parentId: "transfers-scope",
    allowedParentTransitions: ["transfers-opponent-interrupt", "nt-opened-opponent-interrupt"],
    transitions: [
      {
        transitionId: "place-ts-correct-4s",
        match: { kind: "call", level: 4, strain: BidSuit.Spades },
        target: "terminal",
      },
      {
        transitionId: "place-ts-pass",
        match: { kind: "pass" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "opener-place-after-transfer-spades",
    entryEffects: { setCaptain: "opener" },
  },

  // ─── Opener invite acceptance states (after responder's 2NT invite) ──

  {
    stateId: "opener-accept-invite-hearts",
    parentId: "transfers-scope",
    allowedParentTransitions: ["transfers-opponent-interrupt", "nt-opened-opponent-interrupt"],
    transitions: [
      {
        transitionId: "accept-invite-h-bid",
        match: { kind: "any-bid" },
        target: "terminal",
      },
      {
        transitionId: "accept-invite-h-pass",
        match: { kind: "pass" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "opener-accept-invite-hearts",
    entryEffects: { setCaptain: "opener" },
  },

  {
    stateId: "opener-accept-invite-spades",
    parentId: "transfers-scope",
    allowedParentTransitions: ["transfers-opponent-interrupt", "nt-opened-opponent-interrupt"],
    transitions: [
      {
        transitionId: "accept-invite-s-bid",
        match: { kind: "any-bid" },
        target: "terminal",
      },
      {
        transitionId: "accept-invite-s-pass",
        match: { kind: "pass" },
        target: "terminal",
      },
    ],
    surfaceGroupId: "opener-accept-invite-spades",
    entryEffects: { setCaptain: "opener" },
  },
];

// ─── Facts ───────────────────────────────────────────────────

const TRANSFER_FACTS: readonly FactDefinition[] = [
  {
    id: "module.transfer.targetSuit",
    layer: "module-derived",
    world: "acting-hand",
    description: "Transfer target suit (hearts, spades, or none)",
    valueType: "string",
    derivesFrom: ["hand.suitLength.hearts", "hand.suitLength.spades"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.transfer.eligible",
    layer: "module-derived",
    world: "acting-hand",
    description: "Eligible for Jacoby transfer (5+ card major)",
    valueType: "boolean",
    derivesFrom: ["bridge.hasFiveCardMajor"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.transfer.preferred",
    layer: "module-derived",
    world: "acting-hand",
    description: "Transfer preferred (eligible with 5+ card suit)",
    valueType: "boolean",
    derivesFrom: ["module.transfer.eligible"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.transfer.openerHasHeartFit",
    layer: "module-derived",
    world: "acting-hand",
    description: "Opener has 3+ hearts (fit with responder's 5-card suit)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.transfer.openerHasSpadesFit",
    layer: "module-derived",
    world: "acting-hand",
    description: "Opener has 3+ spades (fit with responder's 5-card suit)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
];

/** Factory: creates transfer fact evaluators parameterized by system config. */
export function createTransferEvaluators(sys: SystemConfig): Map<string, FactEvaluatorFn> {
  return new Map<string, FactEvaluatorFn>([
    ["module.transfer.targetSuit", (_h, _ev, m) => {
      const spades = num(m, "hand.suitLength.spades");
      const hearts = num(m, "hand.suitLength.hearts");
      if (spades >= 5 && hearts >= 5) return fv("module.transfer.targetSuit", "spades");
      if (spades >= 5) return fv("module.transfer.targetSuit", "spades");
      if (hearts >= 5) return fv("module.transfer.targetSuit", "hearts");
      return fv("module.transfer.targetSuit", "none");
    }],
    ["module.transfer.eligible", (_h, _ev, m) =>
      fv("module.transfer.eligible", bool(m, "bridge.hasFiveCardMajor"))],
    ["module.transfer.preferred", (_h, _ev, m) =>
      fv("module.transfer.preferred", bool(m, "module.transfer.eligible"))],
    ["module.transfer.openerHasHeartFit", (_h, _ev, m) =>
      fv("module.transfer.openerHasHeartFit", num(m, "hand.suitLength.hearts") >= 3)],
    ["module.transfer.openerHasSpadesFit", (_h, _ev, m) =>
      fv("module.transfer.openerHasSpadesFit", num(m, "hand.suitLength.spades") >= 3)],
  ]);
}

/** Factory: creates transfer facts parameterized by system config. */
export function createTransferFacts(sys: SystemConfig): FactCatalogExtension {
  return {
    definitions: TRANSFER_FACTS,
    evaluators: createTransferEvaluators(sys),
  };
}

/** Legacy default — uses SAYC system config. */
export const transferFacts: FactCatalogExtension =
  createTransferFacts(SAYC_SYSTEM_CONFIG);

// ─── Explanation entries ─────────────────────────────────────

const TRANSFER_EXPLANATION_ENTRIES: readonly ExplanationEntry[] = [
  {
    explanationId: "nt.transfer.eligible",
    factId: "module.transfer.eligible",
    templateKey: "nt.transfer.eligible.supporting",
    displayText: "Eligible for Jacoby Transfer",
    contrastiveTemplateKey: "nt.transfer.eligible.whyNot",
    contrastiveDisplayText: "Not eligible for transfer",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking", "pedagogical"],
  },
  {
    explanationId: "nt.transfer.preferred",
    factId: "module.transfer.preferred",
    templateKey: "nt.transfer.preferred.supporting",
    displayText: "Transfer is the preferred convention",
    preferredLevel: "semantic",
    roles: ["supporting", "inferential"],
  },
  {
    explanationId: "nt.transfer.toHearts",
    meaningId: "transfer:to-hearts",
    templateKey: "nt.transfer.toHearts.semantic",
    displayText: "Transfer to hearts: bid 2♦ to show 5+ hearts",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "nt.transfer.toSpades",
    meaningId: "transfer:to-spades",
    templateKey: "nt.transfer.toSpades.semantic",
    displayText: "Transfer to spades: bid 2♥ to show 5+ spades",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
];

// ─── Pedagogical relations ───────────────────────────────────

const TRANSFER_PEDAGOGICAL_RELATIONS: readonly PedagogicalRelation[] = [
  // Same-family: both transfers serve the same purpose
  {
    kind: "same-family",
    a: "transfer:to-hearts",
    b: "transfer:to-spades",
  },
  // Stronger-than within R3
  {
    kind: "stronger-than",
    a: "transfer:game-hearts",
    b: "transfer:invite-hearts",
  },
  {
    kind: "stronger-than",
    a: "transfer:game-spades",
    b: "transfer:invite-spades",
  },
  // Continuation-of: signoff continues the transfer dialogue
  {
    kind: "continuation-of",
    a: "transfer:signoff-hearts",
    b: "transfer:to-hearts",
  },
  // Near-miss: learners confuse 4H game with 3NT game
  {
    kind: "near-miss-of",
    a: "transfer:game-hearts",
    b: "transfer:nt-game-hearts",
  },
];

// ─── Module assembly ─────────────────────────────────────────

/** Factory: creates the jacoby-transfers module parameterized by system config. */
export function createJacobyTransfersModule(sys: SystemConfig) {
  return {
    moduleId: "jacoby-transfers",

    entrySurfaces: TRANSFER_R1_SURFACES,

    surfaceGroups: [
      { groupId: "opener-transfer-accept", surfaces: OPENER_TRANSFER_HEARTS_SURFACES },
      { groupId: "opener-transfer-accept-spades", surfaces: OPENER_TRANSFER_SPADES_SURFACES },
      { groupId: "responder-r3-after-transfer-hearts", surfaces: TRANSFER_R3_HEARTS_SURFACES },
      { groupId: "responder-r3-after-transfer-spades", surfaces: TRANSFER_R3_SPADES_SURFACES },
      { groupId: "opener-place-after-transfer-hearts", surfaces: OPENER_PLACE_HEARTS_SURFACES },
      { groupId: "opener-place-after-transfer-spades", surfaces: OPENER_PLACE_SPADES_SURFACES },
      { groupId: "opener-accept-invite-hearts", surfaces: OPENER_ACCEPT_INVITE_HEARTS_SURFACES },
      { groupId: "opener-accept-invite-spades", surfaces: OPENER_ACCEPT_INVITE_SPADES_SURFACES },
    ],

    entryTransitions: TRANSFER_R1_TRANSITIONS,

    machineStates: TRANSFER_MACHINE_STATES,

    facts: createTransferFacts(sys),

    explanationEntries: TRANSFER_EXPLANATION_ENTRIES,

    pedagogicalRelations: TRANSFER_PEDAGOGICAL_RELATIONS,

    alternatives: [],

    intentFamilies: [],
  };
}

/** Legacy default — uses SAYC system config. */
export const jacobyTransfersModule = createJacobyTransfersModule(SAYC_SYSTEM_CONFIG);
