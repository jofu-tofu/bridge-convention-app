import { FactLayer } from "../../../core/contracts/fact-layer";
import type { BidMeaning } from "../../../core/contracts/meaning";
import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
} from "../../../core/contracts/fact-catalog";
import { num, fv } from "../../pipeline/fact-helpers";
import type { ExplanationEntry } from "../../../core/contracts/explanation-catalog";
import type { LocalFsm, StateEntry, RouteExpr } from "../../core/rule-module";
import type { NegotiationDelta } from "../../../core/contracts/committed-step";

import { BidSuit } from "../../../engine/types";
import type { SystemConfig } from "../../../core/contracts/system-config";
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
export function createSmolenEntrySurfaces(sys: SystemConfig): readonly BidMeaning[] {
  return [
    createSurface({
      meaningId: "smolen:stayman-entry-5h4s",
      semanticClassId: "smolen:stayman-entry",
      encoding: bid(2, BidSuit.Clubs),
      clauses: [
        {
          factId: SYSTEM_RESPONDER_GAME_VALUES,
          operator: "boolean",
          value: true,
          description: `Game values opposite 1NT (${sys.responderThresholds.gameMin}+ HCP)`,
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
      declarationOrder: 0,
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
          description: `Game values opposite 1NT (${sys.responderThresholds.gameMin}+ HCP)`,
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
      declarationOrder: 1,
      sourceIntent: { type: "StaymanAsk", params: { reason: "smolen" } },
      teachingLabel: "Stayman 2♣ (planning Smolen)",
      teachingTags: [
        { tag: SAME_FAMILY, scope: SCOPE_SMOLEN_ENTRY_VARIANTS },
      ],
    }, SMOLEN_CTX),
  ];
}

// ─── R3 Smolen surfaces (contributed to responder-r3-after-stayman-2d) ───

export function createSmolenR3Surfaces(sys: SystemConfig): readonly BidMeaning[] {
  return [
    createSurface({
      meaningId: "smolen:bid-short-hearts",
      semanticClassId: SMOLEN_CLASSES.BID_SHORT_HEARTS,
      encoding: bid(3, BidSuit.Hearts),
      clauses: [
        {
          factId: SYSTEM_RESPONDER_GAME_VALUES,
          operator: "boolean",
          value: true,
          description: `Game values opposite 1NT (${sys.responderThresholds.gameMin}+ HCP)`,
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
      declarationOrder: 0,
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
          description: `Game values opposite 1NT (${sys.responderThresholds.gameMin}+ HCP)`,
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
      declarationOrder: 1,
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
}

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
    declarationOrder: 0,
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
    declarationOrder: 1,
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
    declarationOrder: 0,
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
    declarationOrder: 1,
    sourceIntent: { type: "SmolenPlacement", params: { suit: "notrump" } },
    teachingLabel: "3NT (no spade fit)",
  }, SMOLEN_CTX),
];

// ─── Facts ───────────────────────────────────────────────────

const SMOLEN_FACTS: readonly FactDefinition[] = [
  {
    id: "module.smolen.hasFiveHearts",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Hand has exactly 5 hearts (for 3♠ Smolen showing long hearts)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.smolen.hasFiveSpades",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Hand has exactly 5 spades (for 3♥ Smolen showing long spades)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.smolen.hasFourSpades",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Hand has exactly 4 spades (short major for 3♠ Smolen: 4♠+5♥)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.smolen.hasFourHearts",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Hand has exactly 4 hearts (short major for 3♥ Smolen: 4♥+5♠)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.smolen.openerHasHeartFit",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Opener has 3+ hearts (heart fit for Smolen placement)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.smolen.openerHasSpadesFit",
    layer: FactLayer.ModuleDerived,
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

/** Factory: creates Smolen facts (no system-dependent thresholds currently,
 *  but accepts SystemConfig for DI consistency). */
export function createSmolenFacts(_sys: SystemConfig): FactCatalogExtension {
  return {
    definitions: SMOLEN_FACTS,
    evaluators: SMOLEN_EVALUATORS,
  };
}

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

// ─── Local FSM + States ──────────────────────────────────────

type SmolenPhase = "idle" | "post-r1" | "placing-hearts" | "placing-spades" | "done";

const SMOLEN_ENTRY_DELTA: NegotiationDelta = { forcing: "one-round", captain: "responder" };
const SMOLEN_3H_DELTA: NegotiationDelta = { forcing: "game", captain: "opener", fitAgreed: { strain: "spades", confidence: "tentative" } };
const SMOLEN_3S_DELTA: NegotiationDelta = { forcing: "game", captain: "opener", fitAgreed: { strain: "hearts", confidence: "tentative" } };

const AFTER_STAYMAN_DENIAL: RouteExpr = {
  kind: "subseq",
  steps: [
    { act: "inquire", feature: "majorSuit" },
    { act: "deny", feature: "majorSuit" },
  ],
};

export const smolenLocal: LocalFsm<SmolenPhase> = {
  initial: "idle",
  transitions: [
    { from: "idle", to: "post-r1", on: { act: "inquire" } },
    { from: "idle", to: "post-r1", on: { act: "transfer" } },
    { from: "idle", to: "post-r1", on: { act: "raise" } },
    { from: "idle", to: "post-r1", on: { act: "place" } },
    { from: "idle", to: "post-r1", on: { act: "signoff" } },
    { from: "idle", to: "post-r1", on: { act: "show" } },
    { from: "post-r1", to: "placing-hearts", on: { act: "show", feature: "shortMajor", suit: "hearts" } },
    { from: "post-r1", to: "placing-spades", on: { act: "show", feature: "shortMajor", suit: "spades" } },
    { from: "placing-hearts", to: "done", on: { act: "place" } },
    { from: "placing-spades", to: "done", on: { act: "place" } },
  ],
};

// Smolen R3: per-surface deltas (3H → spade fit, 3S → heart fit)

export function createSmolenStates(sys: SystemConfig): readonly StateEntry<SmolenPhase>[] {
  const smolenEntrySurfaces = createSmolenEntrySurfaces(sys);
  const smolenR3Surfaces = createSmolenR3Surfaces(sys);
  const smolenR3Hearts = smolenR3Surfaces.filter(s => s.meaningId === "smolen:bid-short-hearts");
  const smolenR3Spades = smolenR3Surfaces.filter(s => s.meaningId === "smolen:bid-short-spades");

  return [
    { phase: "idle", turn: "responder" as const, negotiationDelta: SMOLEN_ENTRY_DELTA, surfaces: smolenEntrySurfaces },
    // R3 Smolen 3H (short hearts → 5 spades): game-forcing, spade fit
    ...(smolenR3Hearts.length > 0 ? [{
      phase: "post-r1" as const, turn: "responder" as const,
      route: AFTER_STAYMAN_DENIAL, negotiationDelta: SMOLEN_3H_DELTA, surfaces: smolenR3Hearts,
    }] : []),
    // R3 Smolen 3S (short spades → 5 hearts): game-forcing, heart fit
    ...(smolenR3Spades.length > 0 ? [{
      phase: "post-r1" as const, turn: "responder" as const,
      route: AFTER_STAYMAN_DENIAL, negotiationDelta: SMOLEN_3S_DELTA, surfaces: smolenR3Spades,
    }] : []),
    { phase: "placing-hearts", turn: "opener" as const, surfaces: OPENER_SMOLEN_HEARTS_SURFACES },
    { phase: "placing-spades", turn: "opener" as const, surfaces: OPENER_SMOLEN_SPADES_SURFACES },
  ];
}

// ─── Module declarations ─────────────────────────────────────

/** Factory: creates Smolen declaration parts (facts + explanations).
 *  Full ConventionModule assembly happens in module-registry.ts. */
export function createSmolenDeclarations(_sys: SystemConfig) {
  return {
    facts: createSmolenFacts(_sys),
    explanationEntries: SMOLEN_EXPLANATION_ENTRIES,
  };
}

