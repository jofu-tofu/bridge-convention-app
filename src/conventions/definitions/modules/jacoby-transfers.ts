import { FactLayer } from "../../../core/contracts/fact-layer";
import type { BidMeaning } from "../../../core/contracts/meaning";
import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
} from "../../../core/contracts/fact-catalog";
import { num, bool, fv } from "../../pipeline/fact-helpers";
import type { ExplanationEntry } from "../../../core/contracts/explanation-catalog";
import type { LocalFsm, StateEntry } from "../../core/rule-module";
import type { NegotiationDelta } from "../../../core/contracts/committed-step";

import { BidSuit } from "../../../engine/types";
import type { SystemConfig } from "../../../core/contracts/system-config";
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
} from "../teaching-vocabulary";
import {
  SCOPE_R1_MAJOR_FIT,
  SCOPE_NT_RESPONSE_TRANSFER_VS_STAYMAN,
  SCOPE_R1_ASK_VS_TRANSFER,
  SCOPE_TRANSFER_SIGNOFF_CONTINUES_R1_HEARTS,
  SCOPE_TRANSFER_R3_HEARTS_STRENGTH,
  SCOPE_TRANSFER_R3_SPADES_STRENGTH,
  SCOPE_TRANSFER_GAME_VS_NT_HEARTS,
} from "../pedagogical-scope-vocabulary";

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
  INVITE_RAISE: "transfer:invite-raise",
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

export const TRANSFER_R1_SURFACES: readonly BidMeaning[] = [
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
    declarationOrder: 1,
    sourceIntent: { type: "TransferToHearts", params: {} },
    teachingLabel: "Transfer to hearts",
    teachingTags: [
      { tag: SAME_FAMILY, scope: SCOPE_R1_MAJOR_FIT },
      { tag: ALTERNATIVES, scope: SCOPE_NT_RESPONSE_TRANSFER_VS_STAYMAN },
      { tag: NEAR_MISS_OF, scope: SCOPE_R1_ASK_VS_TRANSFER, role: "b" },
      { tag: CONTINUATION_OF, scope: SCOPE_TRANSFER_SIGNOFF_CONTINUES_R1_HEARTS, role: "b" },
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
    declarationOrder: 0,
    sourceIntent: { type: "TransferToSpades", params: {} },
    teachingLabel: "Transfer to spades",
    teachingTags: [
      { tag: SAME_FAMILY, scope: SCOPE_R1_MAJOR_FIT },
      { tag: ALTERNATIVES, scope: SCOPE_NT_RESPONSE_TRANSFER_VS_STAYMAN },
    ],
  }, TRANSFER_CTX),
];

// ─── Opener transfer accept surfaces ─────────────────────────

export const OPENER_TRANSFER_HEARTS_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: "transfer:accept",
    semanticClassId: TRANSFER_CLASSES.ACCEPT,
    encoding: bid(2, BidSuit.Hearts),
    clauses: [],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "AcceptTransfer", params: { suit: "hearts" } },
    teachingLabel: "Accept transfer to hearts",
  }, TRANSFER_CTX),
];

export const OPENER_TRANSFER_SPADES_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: "transfer:accept-spades",
    semanticClassId: TRANSFER_CLASSES.ACCEPT_SPADES,
    encoding: bid(2, BidSuit.Spades),
    clauses: [],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "AcceptTransfer", params: { suit: "spades" } },
    teachingLabel: "Accept transfer to spades",
  }, TRANSFER_CTX),
];

// ─── Transfer R3 surfaces ────────────────────────────────────

export const TRANSFER_R3_HEARTS_SURFACES: readonly BidMeaning[] = [
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
    declarationOrder: 0,
    sourceIntent: { type: "Signoff", params: { suit: "hearts" } },
    teachingLabel: "Pass (signoff in hearts)",
    teachingTags: [
      { tag: CONTINUATION_OF, scope: SCOPE_TRANSFER_SIGNOFF_CONTINUES_R1_HEARTS, role: "a" },
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
    declarationOrder: 1,
    sourceIntent: { type: "GameInMajor", params: { suit: "hearts" } },
    teachingLabel: "4H game",
    teachingTags: [
      { tag: STRONGER_THAN, scope: SCOPE_TRANSFER_R3_HEARTS_STRENGTH, ordinal: 0 },
      { tag: NEAR_MISS_OF, scope: SCOPE_TRANSFER_GAME_VS_NT_HEARTS, role: "a" },
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
    declarationOrder: 2,
    sourceIntent: { type: "TransferNTGame", params: { suit: "hearts" } },
    teachingLabel: "3NT (5 hearts, let opener choose)",
    teachingTags: [
      { tag: NEAR_MISS_OF, scope: SCOPE_TRANSFER_GAME_VS_NT_HEARTS, role: "b" },
    ],
  }, TRANSFER_CTX),

  createSurface({
    meaningId: "transfer:invite-raise-hearts",
    semanticClassId: TRANSFER_R3_CLASSES.INVITE_RAISE,
    encoding: bid(3, BidSuit.Hearts),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: "boolean",
        value: true,
        description: "Invite values opposite 1NT (8-9 HCP)",
      },
      {
        factId: "hand.suitLength.hearts",
        operator: "gte",
        value: 6,
        description: "6+ hearts (invite in major with long suit)",
      },
    ],
    band: "should",
    declarationOrder: 3,
    sourceIntent: { type: "InviteRaise", params: { suit: "hearts" } },
    teachingLabel: "3H invite (6+ hearts)",
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
    declarationOrder: 4,
    sourceIntent: { type: "Invite", params: { suit: "hearts" } },
    teachingLabel: "2NT invite",
    teachingTags: [
      { tag: STRONGER_THAN, scope: SCOPE_TRANSFER_R3_HEARTS_STRENGTH, ordinal: 1 },
    ],
  }, TRANSFER_CTX),
];

export const TRANSFER_R3_SPADES_SURFACES: readonly BidMeaning[] = [
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
    declarationOrder: 0,
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
    declarationOrder: 1,
    sourceIntent: { type: "GameInMajor", params: { suit: "spades" } },
    teachingLabel: "4S game",
    teachingTags: [
      { tag: STRONGER_THAN, scope: SCOPE_TRANSFER_R3_SPADES_STRENGTH, ordinal: 0 },
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
    declarationOrder: 2,
    sourceIntent: { type: "TransferNTGame", params: { suit: "spades" } },
    teachingLabel: "3NT (5 spades, let opener choose)",
  }, TRANSFER_CTX),

  createSurface({
    meaningId: "transfer:invite-raise-spades",
    semanticClassId: TRANSFER_R3_CLASSES.INVITE_RAISE,
    encoding: bid(3, BidSuit.Spades),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: "boolean",
        value: true,
        description: "Invite values opposite 1NT (8-9 HCP)",
      },
      {
        factId: "hand.suitLength.spades",
        operator: "gte",
        value: 6,
        description: "6+ spades (invite in major with long suit)",
      },
    ],
    band: "should",
    declarationOrder: 3,
    sourceIntent: { type: "InviteRaise", params: { suit: "spades" } },
    teachingLabel: "3S invite (6+ spades)",
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
    declarationOrder: 4,
    sourceIntent: { type: "Invite", params: { suit: "spades" } },
    teachingLabel: "2NT invite",
    teachingTags: [
      { tag: STRONGER_THAN, scope: SCOPE_TRANSFER_R3_SPADES_STRENGTH, ordinal: 1 },
    ],
  }, TRANSFER_CTX),
];

// ─── Opener placement surfaces (after responder's 3NT "let opener choose") ──

export const OPENER_PLACE_HEARTS_SURFACES: readonly BidMeaning[] = [
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
    declarationOrder: 0,
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
    declarationOrder: 1,
    sourceIntent: { type: "PlacementPass", params: { suit: "hearts" } },
    teachingLabel: "Pass (stay in 3NT, no heart fit)",
  }, TRANSFER_CTX),
];

export const OPENER_PLACE_SPADES_SURFACES: readonly BidMeaning[] = [
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
    declarationOrder: 0,
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
    declarationOrder: 1,
    sourceIntent: { type: "PlacementPass", params: { suit: "spades" } },
    teachingLabel: "Pass (stay in 3NT, no spade fit)",
  }, TRANSFER_CTX),
];

// ─── Opener invite acceptance surfaces (after responder's 2NT invite) ──

export const OPENER_ACCEPT_INVITE_HEARTS_SURFACES: readonly BidMeaning[] = [
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
    declarationOrder: 0,
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
    declarationOrder: 1,
    sourceIntent: { type: "DeclineInvite", params: {} },
    teachingLabel: "Pass (decline invite, minimum)",
  }, TRANSFER_CTX),
];

export const OPENER_ACCEPT_INVITE_SPADES_SURFACES: readonly BidMeaning[] = [
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
    declarationOrder: 0,
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
    declarationOrder: 1,
    sourceIntent: { type: "DeclineInvite", params: {} },
    teachingLabel: "Pass (decline invite, minimum)",
  }, TRANSFER_CTX),
];

// ─── Opener invite-raise acceptance surfaces (after responder's 3M invite raise) ──
// After 3H/3S (6+ cards, invitational), opener knows there's a guaranteed
// major fit (opener has 2-3+ in the suit from 1NT balanced). Accept = 4M, decline = Pass.

export const OPENER_ACCEPT_INVITE_RAISE_HEARTS_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: "transfer:accept-invite-raise-hearts",
    semanticClassId: OPENER_PLACE_CLASSES.ACCEPT_INVITE,
    encoding: bid(4, BidSuit.Hearts),
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: true,
        description: "Opener has 16-17 HCP (not minimum)",
      },
    ],
    band: "should",
    declarationOrder: 0,
    sourceIntent: { type: "AcceptInvite", params: { suit: "hearts" } },
    teachingLabel: "4H (accept invite, heart fit guaranteed)",
  }, TRANSFER_CTX),
  createSurface({
    meaningId: "transfer:decline-invite-raise-hearts",
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
    declarationOrder: 1,
    sourceIntent: { type: "DeclineInvite", params: {} },
    teachingLabel: "Pass (decline invite, minimum)",
  }, TRANSFER_CTX),
];

export const OPENER_ACCEPT_INVITE_RAISE_SPADES_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: "transfer:accept-invite-raise-spades",
    semanticClassId: OPENER_PLACE_CLASSES.ACCEPT_INVITE,
    encoding: bid(4, BidSuit.Spades),
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: true,
        description: "Opener has 16-17 HCP (not minimum)",
      },
    ],
    band: "should",
    declarationOrder: 0,
    sourceIntent: { type: "AcceptInvite", params: { suit: "spades" } },
    teachingLabel: "4S (accept invite, spade fit guaranteed)",
  }, TRANSFER_CTX),
  createSurface({
    meaningId: "transfer:decline-invite-raise-spades",
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
    declarationOrder: 1,
    sourceIntent: { type: "DeclineInvite", params: {} },
    teachingLabel: "Pass (decline invite, minimum)",
  }, TRANSFER_CTX),
];

// ─── Facts ───────────────────────────────────────────────────

const TRANSFER_FACTS: readonly FactDefinition[] = [
  {
    id: "module.transfer.targetSuit",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Transfer target suit (hearts, spades, or none)",
    valueType: "string",
    derivesFrom: ["hand.suitLength.hearts", "hand.suitLength.spades"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.transfer.eligible",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Eligible for Jacoby transfer (5+ card major)",
    valueType: "boolean",
    derivesFrom: ["bridge.hasFiveCardMajor"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.transfer.preferred",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Transfer preferred (eligible with 5+ card suit)",
    valueType: "boolean",
    derivesFrom: ["module.transfer.eligible"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.transfer.openerHasHeartFit",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Opener has 3+ hearts (fit with responder's 5-card suit)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.transfer.openerHasSpadesFit",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Opener has 3+ spades (fit with responder's 5-card suit)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
];

/** Factory: creates transfer fact evaluators parameterized by system config. */
function createTransferEvaluators(_sys: SystemConfig): Map<string, FactEvaluatorFn> {
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

// ─── Local FSM + States ──────────────────────────────────────

type TransferPhase = "idle" | "inactive" | "transferred-hearts" | "transferred-spades"
  | "accepted-hearts" | "accepted-spades" | "placing-hearts" | "placing-spades"
  | "invited-hearts" | "invited-spades" | "invite-raised-hearts" | "invite-raised-spades";

const TRANSFER_BID_DELTA: NegotiationDelta = { forcing: "one-round", captain: "responder" };
const ACCEPT_HEARTS_DELTA: NegotiationDelta = { forcing: "none", fitAgreed: { strain: "hearts", confidence: "tentative" } };
const ACCEPT_SPADES_DELTA: NegotiationDelta = { forcing: "none", fitAgreed: { strain: "spades", confidence: "tentative" } };
const CAPTAIN_TO_OPENER_DELTA: NegotiationDelta = { captain: "opener" };

export const jacobyTransfersLocal: LocalFsm<TransferPhase> = {
  initial: "idle",
  transitions: [
    { from: "idle", to: "transferred-hearts", on: { act: "transfer", suit: "hearts" } },
    { from: "idle", to: "transferred-spades", on: { act: "transfer", suit: "spades" } },
    { from: "idle", to: "inactive", on: { act: "inquire" } },
    { from: "idle", to: "inactive", on: { act: "raise" } },
    { from: "idle", to: "inactive", on: { act: "place" } },
    { from: "idle", to: "inactive", on: { act: "signoff" } },
    { from: "transferred-hearts", to: "accepted-hearts", on: { act: "accept", feature: "heldSuit", suit: "hearts" } },
    { from: "transferred-spades", to: "accepted-spades", on: { act: "accept", feature: "heldSuit", suit: "spades" } },
    { from: "accepted-hearts", to: "placing-hearts", on: { act: "place", strain: "notrump" } },
    { from: "accepted-spades", to: "placing-spades", on: { act: "place", strain: "notrump" } },
    { from: "accepted-hearts", to: "invite-raised-hearts", on: { act: "raise", strength: "invitational", feature: "heldSuit" } },
    { from: "accepted-spades", to: "invite-raised-spades", on: { act: "raise", strength: "invitational", feature: "heldSuit" } },
    { from: "accepted-hearts", to: "invited-hearts", on: { act: "raise", strength: "invitational" } },
    { from: "accepted-spades", to: "invited-spades", on: { act: "raise", strength: "invitational" } },
  ],
};

/** Split R3 surfaces by whether they transfer captaincy. */
function splitR3(surfaces: readonly BidMeaning[]): { captainTransfer: BidMeaning[]; terminal: BidMeaning[] } {
  const captainTransfer: BidMeaning[] = [];
  const terminal: BidMeaning[] = [];
  for (const s of surfaces) {
    if (s.sourceIntent.type === "TransferNTGame" || s.sourceIntent.type === "Invite") captainTransfer.push(s);
    else terminal.push(s);
  }
  return { captainTransfer, terminal };
}

const r3H = splitR3(TRANSFER_R3_HEARTS_SURFACES);
const r3S = splitR3(TRANSFER_R3_SPADES_SURFACES);

export const jacobyTransfersStates: readonly StateEntry<TransferPhase>[] = [
  { phase: "idle", turn: "responder" as const, negotiationDelta: TRANSFER_BID_DELTA, surfaces: TRANSFER_R1_SURFACES },
  { phase: "transferred-hearts", turn: "opener" as const, negotiationDelta: ACCEPT_HEARTS_DELTA, surfaces: OPENER_TRANSFER_HEARTS_SURFACES },
  { phase: "transferred-spades", turn: "opener" as const, negotiationDelta: ACCEPT_SPADES_DELTA, surfaces: OPENER_TRANSFER_SPADES_SURFACES },
  ...(r3H.captainTransfer.length > 0 ? [{ phase: "accepted-hearts" as const, turn: "responder" as const, negotiationDelta: CAPTAIN_TO_OPENER_DELTA, surfaces: r3H.captainTransfer }] : []),
  ...(r3H.terminal.length > 0 ? [{ phase: "accepted-hearts" as const, turn: "responder" as const, surfaces: r3H.terminal }] : []),
  ...(r3S.captainTransfer.length > 0 ? [{ phase: "accepted-spades" as const, turn: "responder" as const, negotiationDelta: CAPTAIN_TO_OPENER_DELTA, surfaces: r3S.captainTransfer }] : []),
  ...(r3S.terminal.length > 0 ? [{ phase: "accepted-spades" as const, turn: "responder" as const, surfaces: r3S.terminal }] : []),
  { phase: "placing-hearts", turn: "opener" as const, surfaces: OPENER_PLACE_HEARTS_SURFACES },
  { phase: "placing-spades", turn: "opener" as const, surfaces: OPENER_PLACE_SPADES_SURFACES },
  { phase: "invited-hearts", turn: "opener" as const, surfaces: OPENER_ACCEPT_INVITE_HEARTS_SURFACES },
  { phase: "invited-spades", turn: "opener" as const, surfaces: OPENER_ACCEPT_INVITE_SPADES_SURFACES },
  { phase: "invite-raised-hearts", turn: "opener" as const, surfaces: OPENER_ACCEPT_INVITE_RAISE_HEARTS_SURFACES },
  { phase: "invite-raised-spades", turn: "opener" as const, surfaces: OPENER_ACCEPT_INVITE_RAISE_SPADES_SURFACES },
];

// ─── Module declarations ─────────────────────────────────────

/** Factory: creates jacoby-transfers declaration parts (facts + explanations).
 *  Full ConventionModule assembly happens in module-registry.ts. */
export function createJacobyTransfersDeclarations(sys: SystemConfig) {
  return {
    facts: createTransferFacts(sys),
    explanationEntries: TRANSFER_EXPLANATION_ENTRIES,
  };
}

