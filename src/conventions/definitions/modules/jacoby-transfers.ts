import type { MeaningSurface } from "../../../core/contracts/meaning";
import type { MachineState, MachineTransition } from "../../core/runtime/machine-types";
import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
} from "../../../core/contracts/fact-catalog";
import { num, bool, fv } from "../../core/pipeline/fact-helpers";
import type { ExplanationEntry } from "../../../core/contracts/explanation-catalog";

import { BidSuit } from "../../../engine/types";
import type { SystemConfig } from "../../../core/contracts/system-config";
import { SAYC_SYSTEM_CONFIG } from "../../../core/contracts/system-config";
import {
  SYSTEM_RESPONDER_WEAK_HAND,
  SYSTEM_RESPONDER_INVITE_VALUES,
  SYSTEM_RESPONDER_GAME_VALUES,
  SYSTEM_OPENER_NOT_MINIMUM,
} from "../../../core/contracts/system-fact-vocabulary";

import { bid } from "../../core/surface-helpers";
import { createSurface } from "../../core/surface-builder";
import type { ModuleContext } from "../../core/surface-builder";
import {
  SAME_FAMILY,
  STRONGER_THAN,
  CONTINUATION_OF,
  NEAR_MISS_OF,
  ALTERNATIVES,
} from "../pedagogical-vocabulary";

// ─── Module context ──────────────────────────────────────────

const TRANSFER_CTX: ModuleContext = { moduleId: "jacoby-transfers" };

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
  createSurface({
    meaningId: "transfer:to-hearts",
    semanticClassId: TRANSFER_CLASSES.TO_HEARTS,
    encoding: bid(2, BidSuit.Diamonds),
    clauses: [
      {
        factId: "hand.suitLength.hearts",
        operator: "gte",
        value: 5,
      },
    ],
    band: "should",
    intraModuleOrder: 1,
    sourceIntent: { type: "TransferToHearts", params: {} },
    teachingLabel: "Transfer to hearts",
    pedagogicalTags: [
      { tag: SAME_FAMILY, scope: "r1-major-fit" },
      { tag: ALTERNATIVES, scope: "NT response: transfer vs Stayman" },
      { tag: NEAR_MISS_OF, scope: "r1-ask-vs-transfer", role: "b" },
      { tag: CONTINUATION_OF, scope: "transfer:signoff-continues-r1-hearts", role: "b" },
    ],
  }, TRANSFER_CTX),

  createSurface({
    meaningId: "transfer:to-spades",
    semanticClassId: TRANSFER_CLASSES.TO_SPADES,
    encoding: bid(2, BidSuit.Hearts),
    clauses: [
      {
        factId: "hand.suitLength.spades",
        operator: "gte",
        value: 5,
      },
    ],
    band: "should",
    intraModuleOrder: 0,
    sourceIntent: { type: "TransferToSpades", params: {} },
    teachingLabel: "Transfer to spades",
    pedagogicalTags: [
      { tag: SAME_FAMILY, scope: "r1-major-fit" },
      { tag: ALTERNATIVES, scope: "NT response: transfer vs Stayman" },
    ],
  }, TRANSFER_CTX),
];

// ─── Opener transfer accept surfaces ─────────────────────────

export const OPENER_TRANSFER_HEARTS_SURFACES: readonly MeaningSurface[] = [
  createSurface({
    meaningId: "transfer:accept",
    semanticClassId: TRANSFER_CLASSES.ACCEPT,
    encoding: bid(2, BidSuit.Hearts),
    clauses: [],
    band: "must",
    intraModuleOrder: 0,
    sourceIntent: { type: "AcceptTransfer", params: { suit: "hearts" } },
    teachingLabel: "Accept transfer to hearts",
  }, TRANSFER_CTX),
];

export const OPENER_TRANSFER_SPADES_SURFACES: readonly MeaningSurface[] = [
  createSurface({
    meaningId: "transfer:accept-spades",
    semanticClassId: TRANSFER_CLASSES.ACCEPT_SPADES,
    encoding: bid(2, BidSuit.Spades),
    clauses: [],
    band: "must",
    intraModuleOrder: 0,
    sourceIntent: { type: "AcceptTransfer", params: { suit: "spades" } },
    teachingLabel: "Accept transfer to spades",
  }, TRANSFER_CTX),
];

// ─── Transfer R3 surfaces ────────────────────────────────────

export const TRANSFER_R3_HEARTS_SURFACES: readonly MeaningSurface[] = [
  createSurface({
    meaningId: "transfer:signoff-hearts",
    semanticClassId: TRANSFER_R3_CLASSES.SIGNOFF,
    encoding: { type: "pass" },
    clauses: [
      {
        factId: SYSTEM_RESPONDER_WEAK_HAND,
        operator: "boolean",
        value: true,
        description: "Below invite threshold (weak hand, signoff)",
      },
    ],
    band: "must",
    intraModuleOrder: 0,
    sourceIntent: { type: "Signoff", params: { suit: "hearts" } },
    teachingLabel: "Pass (signoff in hearts)",
    pedagogicalTags: [
      { tag: CONTINUATION_OF, scope: "transfer:signoff-continues-r1-hearts", role: "a" },
    ],
  }, TRANSFER_CTX),

  createSurface({
    meaningId: "transfer:game-hearts",
    semanticClassId: TRANSFER_R3_CLASSES.GAME_IN_MAJOR,
    encoding: bid(4, BidSuit.Hearts),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        description: "Game values opposite 1NT (10+ HCP)",
      },
      {
        factId: "hand.suitLength.hearts",
        operator: "gte",
        value: 6,
        description: "6+ hearts (game in major with guaranteed fit)",
      },
    ],
    band: "must",
    intraModuleOrder: 1,
    sourceIntent: { type: "GameInMajor", params: { suit: "hearts" } },
    teachingLabel: "4H game",
    pedagogicalTags: [
      { tag: STRONGER_THAN, scope: "transfer:r3-hearts-strength", ordinal: 0 },
      { tag: NEAR_MISS_OF, scope: "transfer:game-vs-nt-hearts", role: "a" },
    ],
  }, TRANSFER_CTX),

  createSurface({
    meaningId: "transfer:nt-game-hearts",
    semanticClassId: TRANSFER_R3_CLASSES.NT_GAME,
    encoding: bid(3, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        description: "Game values opposite 1NT (10+ HCP)",
      },
      {
        factId: "hand.suitLength.hearts",
        operator: "eq",
        value: 5,
        description: "Exactly 5 hearts (offer 3NT as alternative to 4H)",
      },
    ],
    band: "should",
    intraModuleOrder: 2,
    sourceIntent: { type: "TransferNTGame", params: { suit: "hearts" } },
    teachingLabel: "3NT (5 hearts, let opener choose)",
    pedagogicalTags: [
      { tag: NEAR_MISS_OF, scope: "transfer:game-vs-nt-hearts", role: "b" },
    ],
  }, TRANSFER_CTX),

  createSurface({
    meaningId: "transfer:invite-hearts",
    semanticClassId: TRANSFER_R3_CLASSES.INVITE,
    encoding: bid(2, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: "boolean",
        value: true,
        description: "Invite values opposite 1NT (8-9 HCP)",
      },
    ],
    band: "should",
    intraModuleOrder: 3,
    sourceIntent: { type: "Invite", params: { suit: "hearts" } },
    teachingLabel: "2NT invite",
    pedagogicalTags: [
      { tag: STRONGER_THAN, scope: "transfer:r3-hearts-strength", ordinal: 1 },
    ],
  }, TRANSFER_CTX),
];

export const TRANSFER_R3_SPADES_SURFACES: readonly MeaningSurface[] = [
  createSurface({
    meaningId: "transfer:signoff-spades",
    semanticClassId: TRANSFER_R3_CLASSES.SIGNOFF,
    encoding: { type: "pass" },
    clauses: [
      {
        factId: SYSTEM_RESPONDER_WEAK_HAND,
        operator: "boolean",
        value: true,
        description: "Below invite threshold (weak hand, signoff)",
      },
    ],
    band: "must",
    intraModuleOrder: 0,
    sourceIntent: { type: "Signoff", params: { suit: "spades" } },
    teachingLabel: "Pass (signoff in spades)",
  }, TRANSFER_CTX),

  createSurface({
    meaningId: "transfer:game-spades",
    semanticClassId: TRANSFER_R3_CLASSES.GAME_IN_MAJOR,
    encoding: bid(4, BidSuit.Spades),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        description: "Game values opposite 1NT (10+ HCP)",
      },
      {
        factId: "hand.suitLength.spades",
        operator: "gte",
        value: 6,
        description: "6+ spades (game in major with guaranteed fit)",
      },
    ],
    band: "must",
    intraModuleOrder: 1,
    sourceIntent: { type: "GameInMajor", params: { suit: "spades" } },
    teachingLabel: "4S game",
    pedagogicalTags: [
      { tag: STRONGER_THAN, scope: "transfer:r3-spades-strength", ordinal: 0 },
    ],
  }, TRANSFER_CTX),

  createSurface({
    meaningId: "transfer:nt-game-spades",
    semanticClassId: TRANSFER_R3_CLASSES.NT_GAME,
    encoding: bid(3, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        description: "Game values opposite 1NT (10+ HCP)",
      },
      {
        factId: "hand.suitLength.spades",
        operator: "eq",
        value: 5,
        description: "Exactly 5 spades (offer 3NT as alternative to 4S)",
      },
    ],
    band: "should",
    intraModuleOrder: 2,
    sourceIntent: { type: "TransferNTGame", params: { suit: "spades" } },
    teachingLabel: "3NT (5 spades, let opener choose)",
  }, TRANSFER_CTX),

  createSurface({
    meaningId: "transfer:invite-spades",
    semanticClassId: TRANSFER_R3_CLASSES.INVITE,
    encoding: bid(2, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: "boolean",
        value: true,
        description: "Invite values opposite 1NT (8-9 HCP)",
      },
    ],
    band: "should",
    intraModuleOrder: 3,
    sourceIntent: { type: "Invite", params: { suit: "spades" } },
    teachingLabel: "2NT invite",
    pedagogicalTags: [
      { tag: STRONGER_THAN, scope: "transfer:r3-spades-strength", ordinal: 1 },
    ],
  }, TRANSFER_CTX),
];

// ─── Opener placement surfaces (after responder's 3NT "let opener choose") ──

export const OPENER_PLACE_HEARTS_SURFACES: readonly MeaningSurface[] = [
  createSurface({
    meaningId: "transfer:correct-to-4h",
    semanticClassId: OPENER_PLACE_CLASSES.CORRECT_TO_MAJOR,
    encoding: bid(4, BidSuit.Hearts),
    clauses: [
      {
        factId: "module.transfer.openerHasHeartFit",
        operator: "boolean",
        value: true,
        description: "Opener has 3+ hearts (fit with responder's 5)",
      },
    ],
    band: "must",
    intraModuleOrder: 0,
    sourceIntent: { type: "PlacementCorrection", params: { suit: "hearts" } },
    teachingLabel: "4H (heart fit found)",
  }, TRANSFER_CTX),
  createSurface({
    meaningId: "transfer:pass-3nt-hearts",
    semanticClassId: OPENER_PLACE_CLASSES.PASS_3NT,
    encoding: { type: "pass" },
    clauses: [
      {
        factId: "module.transfer.openerHasHeartFit",
        operator: "boolean",
        value: false,
        description: "Opener has fewer than 3 hearts (no fit)",
      },
    ],
    band: "must",
    intraModuleOrder: 1,
    sourceIntent: { type: "PlacementPass", params: { suit: "hearts" } },
    teachingLabel: "Pass (stay in 3NT, no heart fit)",
  }, TRANSFER_CTX),
];

export const OPENER_PLACE_SPADES_SURFACES: readonly MeaningSurface[] = [
  createSurface({
    meaningId: "transfer:correct-to-4s",
    semanticClassId: OPENER_PLACE_CLASSES.CORRECT_TO_MAJOR,
    encoding: bid(4, BidSuit.Spades),
    clauses: [
      {
        factId: "module.transfer.openerHasSpadesFit",
        operator: "boolean",
        value: true,
        description: "Opener has 3+ spades (fit with responder's 5)",
      },
    ],
    band: "must",
    intraModuleOrder: 0,
    sourceIntent: { type: "PlacementCorrection", params: { suit: "spades" } },
    teachingLabel: "4S (spade fit found)",
  }, TRANSFER_CTX),
  createSurface({
    meaningId: "transfer:pass-3nt-spades",
    semanticClassId: OPENER_PLACE_CLASSES.PASS_3NT,
    encoding: { type: "pass" },
    clauses: [
      {
        factId: "module.transfer.openerHasSpadesFit",
        operator: "boolean",
        value: false,
        description: "Opener has fewer than 3 spades (no fit)",
      },
    ],
    band: "must",
    intraModuleOrder: 1,
    sourceIntent: { type: "PlacementPass", params: { suit: "spades" } },
    teachingLabel: "Pass (stay in 3NT, no spade fit)",
  }, TRANSFER_CTX),
];

// ─── Opener invite acceptance surfaces (after responder's 2NT invite) ──

export const OPENER_ACCEPT_INVITE_HEARTS_SURFACES: readonly MeaningSurface[] = [
  createSurface({
    meaningId: "transfer:accept-invite-hearts",
    semanticClassId: OPENER_PLACE_CLASSES.ACCEPT_INVITE,
    encoding: bid(3, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: true,
        description: "Opener has 16-17 HCP (not minimum)",
      },
    ],
    band: "should",
    intraModuleOrder: 0,
    sourceIntent: { type: "AcceptInvite", params: {} },
    teachingLabel: "3NT (accept invite)",
  }, TRANSFER_CTX),
  createSurface({
    meaningId: "transfer:decline-invite-hearts",
    semanticClassId: OPENER_PLACE_CLASSES.DECLINE_INVITE,
    encoding: { type: "pass" },
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: false,
        description: "Opener has 15 HCP (minimum)",
      },
    ],
    band: "should",
    intraModuleOrder: 1,
    sourceIntent: { type: "DeclineInvite", params: {} },
    teachingLabel: "Pass (decline invite, minimum)",
  }, TRANSFER_CTX),
];

export const OPENER_ACCEPT_INVITE_SPADES_SURFACES: readonly MeaningSurface[] = [
  createSurface({
    meaningId: "transfer:accept-invite-spades",
    semanticClassId: OPENER_PLACE_CLASSES.ACCEPT_INVITE,
    encoding: bid(3, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: true,
        description: "Opener has 16-17 HCP (not minimum)",
      },
    ],
    band: "should",
    intraModuleOrder: 0,
    sourceIntent: { type: "AcceptInvite", params: {} },
    teachingLabel: "3NT (accept invite)",
  }, TRANSFER_CTX),
  createSurface({
    meaningId: "transfer:decline-invite-spades",
    semanticClassId: OPENER_PLACE_CLASSES.DECLINE_INVITE,
    encoding: { type: "pass" },
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: false,
        description: "Opener has 15 HCP (minimum)",
      },
    ],
    band: "should",
    intraModuleOrder: 1,
    sourceIntent: { type: "DeclineInvite", params: {} },
    teachingLabel: "Pass (decline invite, minimum)",
  }, TRANSFER_CTX),
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
    exportTags: ["agreement.tentative"],
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
    exportTags: ["agreement.tentative"],
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
    exportTags: ["agreement.final"],
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
    exportTags: ["agreement.final"],
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
    exportTags: ["agreement.final"],
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
    exportTags: ["agreement.final"],
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
  };
}

/** Legacy default — uses SAYC system config. */
export const jacobyTransfersModule = createJacobyTransfersModule(SAYC_SYSTEM_CONFIG);
