import { FactLayer } from "../../../core/contracts/fact-catalog";
import type { BidMeaning } from "../../../core/contracts/meaning";
import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
} from "../../../core/contracts/fact-catalog";
import { num, bool, fv } from "../../core/pipeline/fact-helpers";
import { createPosteriorFactEvaluators } from "../../../inference/posterior";
import type { ExplanationEntry } from "../../../core/contracts/explanation-catalog";

import { BidSuit } from "../../../engine/types";
import type { SystemConfig } from "../../../core/contracts/system-config";
import { getSystemConfig } from "../../../core/contracts/system-config";
import { BASE_SYSTEM_SAYC } from "../../../core/contracts/base-system-vocabulary";
import {
  SYSTEM_RESPONDER_INVITE_VALUES,
  SYSTEM_RESPONDER_GAME_VALUES,
} from "../../../core/contracts/system-fact-vocabulary";

import { bid } from "../../core/surface-helpers";
import { createSurface } from "../../core/surface-builder";
import type { ModuleContext } from "../../core/surface-builder";
import {
  SAME_FAMILY,
  STRONGER_THAN,
  CONTINUATION_OF,
  NEAR_MISS_OF,
  FALLBACK_OF,
  ALTERNATIVES,
} from "../teaching-vocabulary";
import {
  SCOPE_R1_MAJOR_FIT,
  SCOPE_NT_RESPONSE_TRANSFER_VS_STAYMAN,
  SCOPE_R1_MAJOR_FIT_FALLBACK,
  SCOPE_R1_ASK_VS_TRANSFER,
  SCOPE_R3_GF_CONTINUES_ASK,
  SCOPE_R3_GF_VS_INVITE_DENIAL,
  SCOPE_R3_GF_VS_GAME_DENIAL,
  SCOPE_AFTER_DENIAL_SMOLEN_VS_3NT,
  SCOPE_STAYMAN_RAISE_CONTINUES_ASK,
  SCOPE_STAYMAN_R3_2H_STRENGTH,
  SCOPE_STAYMAN_R3_2S_STRENGTH,
  SCOPE_STAYMAN_R3_NO_FIT_STRENGTH,
  SCOPE_STAYMAN_R3_DENIAL_STRENGTH,
} from "../pedagogical-scope-vocabulary";

// ─── Module context ──────────────────────────────────────────

const STAYMAN_CTX: ModuleContext = { moduleId: "stayman" };

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

// ─── Closure policy (shared across opener Stayman response surfaces) ───

const OPENER_STAYMAN_CLOSURE_POLICY = {
  exclusive: true,
  exhaustive: true,
  mandatory: true,
  domain: {
    kind: "semantic-class-set" as const,
    ids: [
      STAYMAN_CLASSES.SHOW_HEARTS,
      STAYMAN_CLASSES.SHOW_SPADES,
      STAYMAN_CLASSES.DENY_MAJOR,
    ],
  },
};

// ─── R1 surface ──────────────────────────────────────────────

/** Factory: creates the Stayman R1 surface parameterized by system config. */
function createStaymanR1Surface(sys: SystemConfig): BidMeaning {
  const minHcp = sys.responderThresholds.inviteMin;
  return createSurface({
    meaningId: "stayman:ask-major",
    semanticClassId: STAYMAN_CLASSES.ASK,
    encoding: bid(2, BidSuit.Clubs),
    clauses: [
      {
        factId: "hand.hcp",
        operator: "gte",
        value: minHcp,
        description: `${minHcp}+ HCP for Stayman`,
      },
      {
        factId: "bridge.hasFourCardMajor",
        operator: "boolean",
        value: true,
        isPublic: true,
      },
      {
        factId: "bridge.hasFiveCardMajor",
        operator: "boolean",
        value: false,
        description: "No 5-card major (transfer instead)",
      },
    ],
    band: "should",
    declarationOrder: 0,
    sourceIntent: { type: "StaymanAsk", params: {} },
    teachingLabel: "Stayman 2♣",
    teachingTags: [
      { tag: SAME_FAMILY, scope: SCOPE_R1_MAJOR_FIT },
      { tag: ALTERNATIVES, scope: SCOPE_NT_RESPONSE_TRANSFER_VS_STAYMAN },
      { tag: FALLBACK_OF, scope: SCOPE_R1_MAJOR_FIT_FALLBACK, role: "b" },
      { tag: NEAR_MISS_OF, scope: SCOPE_R1_ASK_VS_TRANSFER, role: "a" },
      { tag: CONTINUATION_OF, scope: SCOPE_R3_GF_CONTINUES_ASK, role: "b" },
      { tag: CONTINUATION_OF, scope: SCOPE_STAYMAN_RAISE_CONTINUES_ASK, role: "b" },
    ],
  }, STAYMAN_CTX);
}

/** Legacy default — uses SAYC system config. */
export const STAYMAN_R1_SURFACE: BidMeaning =
  createStaymanR1Surface(getSystemConfig(BASE_SYSTEM_SAYC));

// ─── Opener Stayman response surfaces ────────────────────────

export const OPENER_STAYMAN_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: "stayman:show-hearts",
    semanticClassId: STAYMAN_CLASSES.SHOW_HEARTS,
    encoding: bid(2, BidSuit.Hearts),
    clauses: [
      {
        factId: "hand.suitLength.hearts",
        operator: "gte",
        value: 4,
      },
    ],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "ShowHeldSuit", params: { suit: "hearts" } },
    teachingLabel: "Show hearts",
    closurePolicy: OPENER_STAYMAN_CLOSURE_POLICY,
  }, STAYMAN_CTX),

  createSurface({
    meaningId: "stayman:show-spades",
    semanticClassId: STAYMAN_CLASSES.SHOW_SPADES,
    encoding: bid(2, BidSuit.Spades),
    clauses: [
      {
        factId: "hand.suitLength.spades",
        operator: "gte",
        value: 4,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: "lte",
        value: 3,
        description: "Denies 4+ hearts (show hearts first with both)",
      },
    ],
    band: "must",
    declarationOrder: 1,
    sourceIntent: { type: "ShowHeldSuit", params: { suit: "spades" } },
    teachingLabel: "Show spades",
    closurePolicy: OPENER_STAYMAN_CLOSURE_POLICY,
  }, STAYMAN_CTX),

  createSurface({
    meaningId: "stayman:deny-major",
    semanticClassId: STAYMAN_CLASSES.DENY_MAJOR,
    encoding: bid(2, BidSuit.Diamonds),
    clauses: [
      {
        factId: "bridge.hasFourCardMajor",
        operator: "boolean",
        value: false,
      },
    ],
    band: "must",
    declarationOrder: 2,
    sourceIntent: { type: "DenyMajor", params: {} },
    teachingLabel: "Deny major (2♦)",
    closurePolicy: OPENER_STAYMAN_CLOSURE_POLICY,
  }, STAYMAN_CTX),
];

// ─── Stayman R3 surfaces ─────────────────────────────────────

export const STAYMAN_R3_AFTER_2H_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: "stayman:raise-game-hearts",
    semanticClassId: STAYMAN_R3_CLASSES.RAISE_GAME,
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
        value: 4,
        description: "4+ hearts (fit with opener)",
      },
    ],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "RaiseGame", params: { suit: "hearts" } },
    teachingLabel: "Raise to game in hearts",
    teachingTags: [
      { tag: STRONGER_THAN, scope: SCOPE_STAYMAN_R3_2H_STRENGTH, ordinal: 0 },
      { tag: CONTINUATION_OF, scope: SCOPE_STAYMAN_RAISE_CONTINUES_ASK, role: "a" },
    ],
  }, STAYMAN_CTX),

  createSurface({
    meaningId: "stayman:raise-invite-hearts",
    semanticClassId: STAYMAN_R3_CLASSES.RAISE_INVITE,
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
        value: 4,
        description: "4+ hearts (fit with opener)",
      },
    ],
    band: "should",
    declarationOrder: 1,
    sourceIntent: { type: "RaiseInvite", params: { suit: "hearts" } },
    teachingLabel: "Invite in hearts",
    teachingTags: [
      { tag: STRONGER_THAN, scope: SCOPE_STAYMAN_R3_2H_STRENGTH, ordinal: 1 },
    ],
  }, STAYMAN_CTX),

  createSurface({
    meaningId: "stayman:nt-game-no-fit",
    semanticClassId: STAYMAN_R3_CLASSES.NT_GAME_NO_FIT,
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
        operator: "lte",
        value: 3,
        description: "Less than 4 hearts (no fit)",
      },
    ],
    band: "should",
    declarationOrder: 2,
    sourceIntent: { type: "StaymanNTGame", params: { reason: "no-heart-fit" } },
    teachingLabel: "3NT (no heart fit)",
    teachingTags: [
      { tag: STRONGER_THAN, scope: SCOPE_STAYMAN_R3_NO_FIT_STRENGTH, ordinal: 0 },
    ],
  }, STAYMAN_CTX),

  createSurface({
    meaningId: "stayman:nt-invite-no-fit",
    semanticClassId: STAYMAN_R3_CLASSES.NT_INVITE_NO_FIT,
    encoding: bid(2, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: "boolean",
        value: true,
        description: "Invite values opposite 1NT (8-9 HCP)",
      },
      {
        factId: "hand.suitLength.hearts",
        operator: "lte",
        value: 3,
        description: "Less than 4 hearts (no fit)",
      },
    ],
    band: "may",
    declarationOrder: 3,
    sourceIntent: { type: "StaymanNTInvite", params: { reason: "no-heart-fit" } },
    teachingLabel: "2NT invite (no heart fit)",
    teachingTags: [
      { tag: STRONGER_THAN, scope: SCOPE_STAYMAN_R3_NO_FIT_STRENGTH, ordinal: 1 },
    ],
  }, STAYMAN_CTX),
];

export const STAYMAN_R3_AFTER_2S_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: "stayman:raise-game-spades",
    semanticClassId: STAYMAN_R3_CLASSES.RAISE_GAME,
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
        value: 4,
        description: "4+ spades (fit with opener)",
      },
    ],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "RaiseGame", params: { suit: "spades" } },
    teachingLabel: "Raise to game in spades",
    teachingTags: [
      { tag: STRONGER_THAN, scope: SCOPE_STAYMAN_R3_2S_STRENGTH, ordinal: 0 },
    ],
  }, STAYMAN_CTX),

  createSurface({
    meaningId: "stayman:raise-invite-spades",
    semanticClassId: STAYMAN_R3_CLASSES.RAISE_INVITE,
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
        value: 4,
        description: "4+ spades (fit with opener)",
      },
    ],
    band: "should",
    declarationOrder: 1,
    sourceIntent: { type: "RaiseInvite", params: { suit: "spades" } },
    teachingLabel: "Invite in spades",
    teachingTags: [
      { tag: STRONGER_THAN, scope: SCOPE_STAYMAN_R3_2S_STRENGTH, ordinal: 1 },
    ],
  }, STAYMAN_CTX),

  createSurface({
    meaningId: "stayman:nt-game-no-fit-2s",
    semanticClassId: STAYMAN_R3_CLASSES.NT_GAME_NO_FIT,
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
        operator: "lte",
        value: 3,
        description: "Less than 4 spades (no fit)",
      },
    ],
    band: "should",
    declarationOrder: 2,
    sourceIntent: { type: "StaymanNTGame", params: { reason: "no-spade-fit" } },
    teachingLabel: "3NT (no spade fit)",
  }, STAYMAN_CTX),

  createSurface({
    meaningId: "stayman:nt-invite-no-fit-2s",
    semanticClassId: STAYMAN_R3_CLASSES.NT_INVITE_NO_FIT,
    encoding: bid(2, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: "boolean",
        value: true,
        description: "Invite values opposite 1NT (8-9 HCP)",
      },
      {
        factId: "hand.suitLength.spades",
        operator: "lte",
        value: 3,
        description: "Less than 4 spades (no fit)",
      },
    ],
    band: "may",
    declarationOrder: 3,
    sourceIntent: { type: "StaymanNTInvite", params: { reason: "no-spade-fit" } },
    teachingLabel: "2NT invite (no spade fit)",
  }, STAYMAN_CTX),
];

// Stayman R3 after 2D — ONLY the 2 Stayman surfaces (not Smolen)
export const STAYMAN_R3_AFTER_2D_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: "stayman:nt-game-after-denial",
    semanticClassId: STAYMAN_R3_CLASSES.NT_GAME_DENIAL,
    encoding: bid(3, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        description: "Game values opposite 1NT (10+ HCP)",
      },
    ],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "StaymanNTGame", params: { reason: "denial" } },
    teachingLabel: "3NT after denial",
    teachingTags: [
      { tag: STRONGER_THAN, scope: SCOPE_STAYMAN_R3_DENIAL_STRENGTH, ordinal: 0 },
      { tag: NEAR_MISS_OF, scope: SCOPE_R3_GF_VS_GAME_DENIAL, role: "b" },
      { tag: ALTERNATIVES, scope: SCOPE_AFTER_DENIAL_SMOLEN_VS_3NT },
    ],
  }, STAYMAN_CTX),

  createSurface({
    meaningId: "stayman:nt-invite-after-denial",
    semanticClassId: STAYMAN_R3_CLASSES.NT_INVITE_DENIAL,
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
    declarationOrder: 1,
    sourceIntent: { type: "StaymanNTInvite", params: { reason: "denial" } },
    teachingLabel: "2NT invite after denial",
    teachingTags: [
      { tag: STRONGER_THAN, scope: SCOPE_STAYMAN_R3_DENIAL_STRENGTH, ordinal: 1 },
      { tag: STRONGER_THAN, scope: SCOPE_R3_GF_VS_INVITE_DENIAL, role: "b" },
    ],
  }, STAYMAN_CTX),
];

// ─── Interference surface ────────────────────────────────────

/** Factory: creates the interference redouble surface parameterized by system config. */
function createInterferenceRedoubleSurface(sys: SystemConfig): BidMeaning {
  const minHcp = sys.interference.redoubleMin;
  return createSurface({
    meaningId: "interference:redouble-strength",
    semanticClassId: INTERFERENCE_CLASSES.REDOUBLE_STRENGTH,
    encoding: { type: "redouble" },
    clauses: [
      {
        factId: "hand.hcp",
        operator: "gte",
        value: minHcp,
        description: `${minHcp}+ HCP to redouble after opponent doubles 1NT`,
      },
    ],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "RedoubleStrength", params: {} },
    teachingLabel: `Redouble (showing ${minHcp}+ HCP)`,
  }, STAYMAN_CTX);
}

/** Legacy default — uses SAYC system config. */
export const INTERFERENCE_REDOUBLE_SURFACE: BidMeaning =
  createInterferenceRedoubleSurface(getSystemConfig(BASE_SYSTEM_SAYC));

// ─── Facts ───────────────────────────────────────────────────

const NT_POSTERIOR_FACTS: readonly FactDefinition[] = [
  {
    id: "module.stayman.nsHaveEightCardFitLikely",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Posterior probability that N/S have an 8+ card major fit",
    valueType: "number",
    metadata: { inferable: true, explainable: true },
    constrainsDimensions: [],
  },
  {
    id: "module.stayman.openerStillBalancedLikely",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Posterior probability that opener has balanced shape",
    valueType: "number",
    metadata: { inferable: true, explainable: true },
    constrainsDimensions: [],
  },
  {
    id: "module.stayman.openerHasSecondMajorLikely",
    layer: FactLayer.ModuleDerived,
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
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Eligible for Stayman (4+ card major AND 8+ HCP)",
    valueType: "boolean",
    derivesFrom: ["bridge.hasFourCardMajor", "hand.hcp"],
    constrainsDimensions: ["suitIdentity"],
  },
  {
    id: "module.stayman.preferred",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Stayman preferred (eligible AND no 5-card major)",
    valueType: "boolean",
    derivesFrom: ["module.stayman.eligible", "bridge.hasFiveCardMajor"],
    constrainsDimensions: ["suitIdentity"],
  },
];

/** Factory: creates Stayman fact evaluators parameterized by system config. */
function createStaymanEvaluators(sys: SystemConfig): Map<string, FactEvaluatorFn> {
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
  "module.stayman.nsHaveEightCardFitLikely",
  "module.stayman.openerStillBalancedLikely",
  "module.stayman.openerHasSecondMajorLikely",
], new Map([
  ["bridge.partnerHas4HeartsLikely", ["H"]],
  ["bridge.partnerHas4SpadesLikely", ["S"]],
  ["bridge.partnerHas4DiamondsLikely", ["D"]],
  ["bridge.partnerHas4ClubsLikely", ["C"]],
  ["bridge.combinedHcpInRangeLikely", ["25", "40"]],
]));

/** Factory: creates Stayman facts parameterized by system config. */
function createStaymanFacts(sys: SystemConfig): FactCatalogExtension {
  return {
    definitions: [...STAYMAN_FACTS, ...NT_POSTERIOR_FACTS],
    evaluators: createStaymanEvaluators(sys),
    posteriorEvaluators,
  };
}

/** Legacy default — uses SAYC system config. */
export const staymanFacts: FactCatalogExtension =
  createStaymanFacts(getSystemConfig(BASE_SYSTEM_SAYC));

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

// ─── Module assembly ─────────────────────────────────────────

/** Factory: creates the stayman module parameterized by system config. */
export function createStaymanModule(sys: SystemConfig) {
  return {
    moduleId: "stayman",

    surfaces: [
      createStaymanR1Surface(sys),
      ...OPENER_STAYMAN_SURFACES,
      ...STAYMAN_R3_AFTER_2H_SURFACES,
      ...STAYMAN_R3_AFTER_2S_SURFACES,
      ...STAYMAN_R3_AFTER_2D_SURFACES,
      createInterferenceRedoubleSurface(sys),
    ],

    facts: createStaymanFacts(sys),

    explanationEntries: STAYMAN_EXPLANATION_ENTRIES,
  };
}

/** Legacy default — uses SAYC system config. */
export const staymanModule = createStaymanModule(getSystemConfig(BASE_SYSTEM_SAYC));
