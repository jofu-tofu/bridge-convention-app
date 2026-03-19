import type { MeaningSurface } from "../../../../core/contracts/meaning";
import type { MachineState, MachineTransition } from "../../../core/runtime/machine-types";
import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
} from "../../../../core/contracts/fact-catalog";
import { num, bool, fv } from "../../../../core/contracts/fact-catalog";
import type { ExplanationEntry } from "../../../../core/contracts/explanation-catalog";
import type { PedagogicalRelation } from "../../../../core/contracts/teaching-projection";
import { BidSuit } from "../../../../engine/types";

import { bid } from "../../../core/surface-helpers";

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
        factId: "module.ntResponse.gameValues",
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
        factId: "module.ntResponse.gameValues",
        operator: "boolean",
        value: true,
        description: "Game values opposite 1NT (10+ HCP)",
      },
      {
        clauseId: "hearts-exactly-5",
        factId: "hand.suitLength.hearts",
        operator: "lte",
        value: 5,
        description: "5 hearts (offer 3NT as alternative to 4H)",
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
        factId: "module.ntResponse.inviteValues",
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
        factId: "module.ntResponse.gameValues",
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
        factId: "module.ntResponse.gameValues",
        operator: "boolean",
        value: true,
        description: "Game values opposite 1NT (10+ HCP)",
      },
      {
        clauseId: "spades-exactly-5",
        factId: "hand.suitLength.spades",
        operator: "lte",
        value: 5,
        description: "5 spades (offer 3NT as alternative to 4S)",
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
        factId: "module.ntResponse.inviteValues",
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
        target: "terminal",
      },
      {
        transitionId: "r3-2nt-invite-hearts",
        match: { kind: "call", level: 2, strain: BidSuit.NoTrump },
        target: "terminal",
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
        target: "terminal",
      },
      {
        transitionId: "r3-2nt-invite-spades",
        match: { kind: "call", level: 2, strain: BidSuit.NoTrump },
        target: "terminal",
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
];

const TRANSFER_EVALUATORS = new Map<string, FactEvaluatorFn>([
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
]);

export const transferFacts: FactCatalogExtension = {
  definitions: TRANSFER_FACTS,
  evaluators: TRANSFER_EVALUATORS,
};

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

export const jacobyTransfersModule = {
  moduleId: "jacoby-transfers",

  entrySurfaces: TRANSFER_R1_SURFACES,

  surfaceGroups: [
    { groupId: "opener-transfer-accept", surfaces: OPENER_TRANSFER_HEARTS_SURFACES },
    { groupId: "opener-transfer-accept-spades", surfaces: OPENER_TRANSFER_SPADES_SURFACES },
    { groupId: "responder-r3-after-transfer-hearts", surfaces: TRANSFER_R3_HEARTS_SURFACES },
    { groupId: "responder-r3-after-transfer-spades", surfaces: TRANSFER_R3_SPADES_SURFACES },
  ],

  entryTransitions: TRANSFER_R1_TRANSITIONS,

  machineStates: TRANSFER_MACHINE_STATES,

  facts: transferFacts,

  explanationEntries: TRANSFER_EXPLANATION_ENTRIES,

  pedagogicalRelations: TRANSFER_PEDAGOGICAL_RELATIONS,
};
