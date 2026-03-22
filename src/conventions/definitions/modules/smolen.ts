import type { BidMeaning } from "../../../core/contracts/meaning";
import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
} from "../../../core/contracts/fact-catalog";
import { num, fv } from "../../core/pipeline/fact-helpers";
import type { ExplanationEntry } from "../../../core/contracts/explanation-catalog";

import { BidSuit } from "../../../engine/types";
import type { SystemConfig } from "../../../core/contracts/system-config";
import { getSystemConfig } from "../../../core/contracts/system-config";
import { BASE_SYSTEM_SAYC } from "../../../core/contracts/base-system-vocabulary";
import { SYSTEM_RESPONDER_GAME_VALUES } from "../../../core/contracts/system-fact-vocabulary";

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
  SCOPE_SMOLEN_ENTRY_VARIANTS,
  SCOPE_SMOLEN_R3_BIDS,
  SCOPE_R3_GF_VS_INVITE_DENIAL,
  SCOPE_R3_GF_CONTINUES_ASK,
  SCOPE_R3_GF_VS_GAME_DENIAL,
  SCOPE_AFTER_DENIAL_SMOLEN_VS_3NT,
} from "../pedagogical-scope-vocabulary";

// ─── Module context ──────────────────────────────────────────

const SMOLEN_CTX: ModuleContext = { moduleId: "smolen" };

// ─── Semantic classes ────────────────────────────────────────

/** Smolen semantic class IDs — Stayman R3 continuation for 5-4 major hands. */
export const SMOLEN_CLASSES = {
  BID_SHORT_HEARTS: "smolen:bid-short-hearts",
  BID_SHORT_SPADES: "smolen:bid-short-spades",
  PLACE_FOUR_HEARTS: "smolen:place-four-hearts",
  PLACE_FOUR_SPADES: "smolen:place-four-spades",
  PLACE_THREE_NT: "smolen:place-three-nt",
} as const;

// ─── Entry surfaces (Stayman for Smolen) ─────────────────────

/**
 * Smolen entry: bid 2C (Stayman) with 5-4 in majors and game values.
 * These override the Jacoby Transfer entry for Smolen-eligible hands.
 * After opener's 2D denial, responder follows up with 3H/3S (Smolen).
 */
const SMOLEN_ENTRY_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: "smolen:stayman-entry-5h4s",
    semanticClassId: "smolen:stayman-entry",
    encoding: bid(2, BidSuit.Clubs),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        description: "Game values opposite 1NT (10+ HCP)",
      },
      {
        factId: "module.smolen.hasFiveHearts",
        operator: "boolean",
        value: true,
        description: "5+ hearts",
      },
      {
        factId: "module.smolen.hasFourSpades",
        operator: "boolean",
        value: true,
      },
    ],
    band: "must",
    intraModuleOrder: 0,
    sourceIntent: { type: "StaymanAsk", params: { reason: "smolen" } },
    teachingLabel: "Stayman 2♣ (planning Smolen)",
    teachingTags: [
      { tag: SAME_FAMILY, scope: SCOPE_SMOLEN_ENTRY_VARIANTS },
    ],
  }, SMOLEN_CTX),

  createSurface({
    meaningId: "smolen:stayman-entry-5s4h",
    semanticClassId: "smolen:stayman-entry",
    encoding: bid(2, BidSuit.Clubs),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        description: "Game values opposite 1NT (10+ HCP)",
      },
      {
        factId: "module.smolen.hasFiveSpades",
        operator: "boolean",
        value: true,
        description: "5+ spades",
      },
      {
        factId: "module.smolen.hasFourHearts",
        operator: "boolean",
        value: true,
      },
    ],
    band: "must",
    intraModuleOrder: 1,
    sourceIntent: { type: "StaymanAsk", params: { reason: "smolen" } },
    teachingLabel: "Stayman 2♣ (planning Smolen)",
    teachingTags: [
      { tag: SAME_FAMILY, scope: SCOPE_SMOLEN_ENTRY_VARIANTS },
    ],
  }, SMOLEN_CTX),
];

// ─── R3 Smolen surfaces (contributed to responder-r3-after-stayman-2d) ───

const SMOLEN_R3_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: "smolen:bid-short-hearts",
    semanticClassId: SMOLEN_CLASSES.BID_SHORT_HEARTS,
    encoding: bid(3, BidSuit.Hearts),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        description: "Game values opposite 1NT (10+ HCP)",
      },
      {
        factId: "module.smolen.hasFiveSpades",
        operator: "boolean",
        value: true,
        description: "5+ spades (long major)",
      },
      {
        factId: "module.smolen.hasFourHearts",
        operator: "boolean",
        value: true,
        description: "Exactly 4 hearts (short major, bid this suit)",
      },
    ],
    band: "must",
    intraModuleOrder: 0,
    sourceIntent: { type: "Smolen", params: { longMajor: "spades" } },
    teachingLabel: "Smolen 3♥ (4♥ + 5♠, game force)",
    teachingTags: [
      { tag: SAME_FAMILY, scope: SCOPE_SMOLEN_R3_BIDS },
      { tag: STRONGER_THAN, scope: SCOPE_R3_GF_VS_INVITE_DENIAL, role: "a" },
      { tag: CONTINUATION_OF, scope: SCOPE_R3_GF_CONTINUES_ASK, role: "a" },
      { tag: NEAR_MISS_OF, scope: SCOPE_R3_GF_VS_GAME_DENIAL, role: "a" },
      { tag: ALTERNATIVES, scope: SCOPE_AFTER_DENIAL_SMOLEN_VS_3NT },
    ],
  }, SMOLEN_CTX),

  createSurface({
    meaningId: "smolen:bid-short-spades",
    semanticClassId: SMOLEN_CLASSES.BID_SHORT_SPADES,
    encoding: bid(3, BidSuit.Spades),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        description: "Game values opposite 1NT (10+ HCP)",
      },
      {
        factId: "module.smolen.hasFiveHearts",
        operator: "boolean",
        value: true,
        description: "5+ hearts (long major)",
      },
      {
        factId: "module.smolen.hasFourSpades",
        operator: "boolean",
        value: true,
        description: "Exactly 4 spades (short major, bid this suit)",
      },
    ],
    band: "must",
    intraModuleOrder: 1,
    sourceIntent: { type: "Smolen", params: { longMajor: "hearts" } },
    teachingLabel: "Smolen 3♠ (4♠ + 5♥, game force)",
    teachingTags: [
      { tag: SAME_FAMILY, scope: SCOPE_SMOLEN_R3_BIDS },
      { tag: STRONGER_THAN, scope: SCOPE_R3_GF_VS_INVITE_DENIAL, role: "a" },
      { tag: CONTINUATION_OF, scope: SCOPE_R3_GF_CONTINUES_ASK, role: "a" },
      { tag: NEAR_MISS_OF, scope: SCOPE_R3_GF_VS_GAME_DENIAL, role: "a" },
      { tag: ALTERNATIVES, scope: SCOPE_AFTER_DENIAL_SMOLEN_VS_3NT },
    ],
  }, SMOLEN_CTX),
];

// ─── Opener Smolen placement surfaces ────────────────────────

export const OPENER_SMOLEN_HEARTS_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: "smolen:place-four-hearts",
    semanticClassId: SMOLEN_CLASSES.PLACE_FOUR_HEARTS,
    encoding: bid(4, BidSuit.Hearts),
    clauses: [
      {
        factId: "module.smolen.openerHasHeartFit",
        operator: "boolean",
        value: true,
        description: "Opener has 3+ hearts (fit with responder's 5)",
      },
    ],
    band: "must",
    intraModuleOrder: 0,
    sourceIntent: { type: "SmolenPlacement", params: { suit: "hearts" } },
    teachingLabel: "4H (heart fit found)",
  }, SMOLEN_CTX),
  createSurface({
    meaningId: "smolen:place-three-nt-no-heart-fit",
    semanticClassId: SMOLEN_CLASSES.PLACE_THREE_NT,
    encoding: bid(3, BidSuit.NoTrump),
    clauses: [
      {
        factId: "module.smolen.openerHasHeartFit",
        operator: "boolean",
        value: false,
        description: "Opener has fewer than 3 hearts (no fit)",
      },
    ],
    band: "must",
    intraModuleOrder: 1,
    sourceIntent: { type: "SmolenPlacement", params: { suit: "notrump" } },
    teachingLabel: "3NT (no heart fit)",
  }, SMOLEN_CTX),
];

export const OPENER_SMOLEN_SPADES_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: "smolen:place-four-spades",
    semanticClassId: SMOLEN_CLASSES.PLACE_FOUR_SPADES,
    encoding: bid(4, BidSuit.Spades),
    clauses: [
      {
        factId: "module.smolen.openerHasSpadesFit",
        operator: "boolean",
        value: true,
        description: "Opener has 3+ spades (fit with responder's 5)",
      },
    ],
    band: "must",
    intraModuleOrder: 0,
    sourceIntent: { type: "SmolenPlacement", params: { suit: "spades" } },
    teachingLabel: "4S (spade fit found)",
  }, SMOLEN_CTX),
  createSurface({
    meaningId: "smolen:place-three-nt-no-spade-fit",
    semanticClassId: SMOLEN_CLASSES.PLACE_THREE_NT,
    encoding: bid(3, BidSuit.NoTrump),
    clauses: [
      {
        factId: "module.smolen.openerHasSpadesFit",
        operator: "boolean",
        value: false,
        description: "Opener has fewer than 3 spades (no fit)",
      },
    ],
    band: "must",
    intraModuleOrder: 1,
    sourceIntent: { type: "SmolenPlacement", params: { suit: "notrump" } },
    teachingLabel: "3NT (no spade fit)",
  }, SMOLEN_CTX),
];

// ─── Facts ───────────────────────────────────────────────────

const SMOLEN_FACTS: readonly FactDefinition[] = [
  {
    id: "module.smolen.hasFiveHearts",
    layer: "module-derived",
    world: "acting-hand",
    description: "Hand has exactly 5 hearts (for 3♠ Smolen showing long hearts)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.smolen.hasFiveSpades",
    layer: "module-derived",
    world: "acting-hand",
    description: "Hand has exactly 5 spades (for 3♥ Smolen showing long spades)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.smolen.hasFourSpades",
    layer: "module-derived",
    world: "acting-hand",
    description: "Hand has exactly 4 spades (short major for 3♠ Smolen: 4♠+5♥)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.smolen.hasFourHearts",
    layer: "module-derived",
    world: "acting-hand",
    description: "Hand has exactly 4 hearts (short major for 3♥ Smolen: 4♥+5♠)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.smolen.openerHasHeartFit",
    layer: "module-derived",
    world: "acting-hand",
    description: "Opener has 3+ hearts (heart fit for Smolen placement)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.smolen.openerHasSpadesFit",
    layer: "module-derived",
    world: "acting-hand",
    description: "Opener has 3+ spades (spade fit for Smolen placement)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
];

const SMOLEN_EVALUATORS = new Map<string, FactEvaluatorFn>([
  ["module.smolen.hasFiveHearts", (_h, _ev, m) =>
    fv("module.smolen.hasFiveHearts", num(m, "hand.suitLength.hearts") === 5)],
  ["module.smolen.hasFiveSpades", (_h, _ev, m) =>
    fv("module.smolen.hasFiveSpades", num(m, "hand.suitLength.spades") === 5)],
  ["module.smolen.hasFourSpades", (_h, _ev, m) =>
    fv("module.smolen.hasFourSpades", num(m, "hand.suitLength.spades") === 4)],
  ["module.smolen.hasFourHearts", (_h, _ev, m) =>
    fv("module.smolen.hasFourHearts", num(m, "hand.suitLength.hearts") === 4)],
  ["module.smolen.openerHasHeartFit", (_h, _ev, m) =>
    fv("module.smolen.openerHasHeartFit", num(m, "hand.suitLength.hearts") >= 3)],
  ["module.smolen.openerHasSpadesFit", (_h, _ev, m) =>
    fv("module.smolen.openerHasSpadesFit", num(m, "hand.suitLength.spades") >= 3)],
]);

export const smolenFacts: FactCatalogExtension = {
  definitions: SMOLEN_FACTS,
  evaluators: SMOLEN_EVALUATORS,
};

// ─── Explanation entries ─────────────────────────────────────

const SMOLEN_EXPLANATION_ENTRIES: readonly ExplanationEntry[] = [
  {
    explanationId: "nt.smolen.fiveHearts",
    factId: "module.smolen.hasFiveHearts",
    templateKey: "nt.smolen.fiveHearts.supporting",
    displayText: "Has 5+ hearts for Smolen",
    contrastiveTemplateKey: "nt.smolen.fiveHearts.whyNot",
    contrastiveDisplayText: "Does not have 5+ hearts",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "nt.smolen.fiveSpades",
    factId: "module.smolen.hasFiveSpades",
    templateKey: "nt.smolen.fiveSpades.supporting",
    displayText: "Has 5+ spades for Smolen",
    contrastiveTemplateKey: "nt.smolen.fiveSpades.whyNot",
    contrastiveDisplayText: "Does not have 5+ spades",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "nt.smolen.bidShortHearts",
    meaningId: "smolen:bid-short-hearts",
    templateKey: "nt.smolen.bidShortHearts.semantic",
    displayText: "Smolen 3♥: shows 4 hearts and 5+ spades, game-forcing",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "nt.smolen.bidShortSpades",
    meaningId: "smolen:bid-short-spades",
    templateKey: "nt.smolen.bidShortSpades.semantic",
    displayText: "Smolen 3♠: shows 4 spades and 5+ hearts, game-forcing",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "nt.smolen.openerHeartFit",
    factId: "module.smolen.openerHasHeartFit",
    templateKey: "nt.smolen.openerHeartFit.supporting",
    displayText: "Opener has 3+ hearts (fit for Smolen)",
    contrastiveTemplateKey: "nt.smolen.openerHeartFit.whyNot",
    contrastiveDisplayText: "Opener has fewer than 3 hearts",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "nt.smolen.openerSpadesFit",
    factId: "module.smolen.openerHasSpadesFit",
    templateKey: "nt.smolen.openerSpadesFit.supporting",
    displayText: "Opener has 3+ spades (fit for Smolen)",
    contrastiveTemplateKey: "nt.smolen.openerSpadesFit.whyNot",
    contrastiveDisplayText: "Opener has fewer than 3 spades",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "nt.smolen.staymanEntry5h4s",
    meaningId: "smolen:stayman-entry-5h4s",
    templateKey: "nt.smolen.staymanEntry5h4s.semantic",
    displayText: "Stayman 2♣ with 5 hearts + 4 spades, planning Smolen",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "nt.smolen.staymanEntry5s4h",
    meaningId: "smolen:stayman-entry-5s4h",
    templateKey: "nt.smolen.staymanEntry5s4h.semantic",
    displayText: "Stayman 2♣ with 5 spades + 4 hearts, planning Smolen",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
];

// ─── Module assembly ─────────────────────────────────────────

/** Factory: creates the smolen module parameterized by system config.
 *  Smolen currently has no system-dependent thresholds (inherits from
 *  natural-nt gameValues fact), but accepts SystemConfig for DI consistency. */
export function createSmolenModule(_sys: SystemConfig) {
  return {
    moduleId: "smolen",

    entrySurfaces: SMOLEN_ENTRY_SURFACES,

    surfaceGroups: [
      { groupId: "responder-r3-after-stayman-2d", surfaces: SMOLEN_R3_SURFACES },
      { groupId: "opener-smolen-hearts", surfaces: OPENER_SMOLEN_HEARTS_SURFACES },
      { groupId: "opener-smolen-spades", surfaces: OPENER_SMOLEN_SPADES_SURFACES },
    ],

    facts: smolenFacts,

    explanationEntries: SMOLEN_EXPLANATION_ENTRIES,
  };
}

/** Legacy default — uses SAYC system config. */
export const smolenModule = createSmolenModule(getSystemConfig(BASE_SYSTEM_SAYC));
