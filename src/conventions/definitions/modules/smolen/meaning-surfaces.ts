import type { BidMeaning } from "../../../pipeline/evaluation/meaning";
import type { SystemConfig } from "../../system-config";
import { SYSTEM_RESPONDER_GAME_VALUES } from "../../system-fact-vocabulary";
import { BidSuit } from "../../../../engine/types";
import { bid } from "../../../core/surface-helpers";
import { createSurface, Disclosure } from "../../../core/surface-builder";
import type { ModuleContext } from "../../../core/surface-builder";
import { bidName, bidSummary } from "../../../core/authored-text";

import { SMOLEN_FACT_IDS, SMOLEN_MEANING_IDS, SMOLEN_CLASSES } from "./ids";
import { FactOperator, RecommendationBand } from "../../../pipeline/evaluation/meaning";
import { ObsSuit } from "../../../pipeline/bid-action";

// ─── Module context ──────────────────────────────────────────

const SMOLEN_CTX: ModuleContext = { moduleId: "smolen" };

// ─── Entry surfaces (Stayman for Smolen) ─────────────────────

/**
 * Smolen entry: bid 2C (Stayman) with 5-4 in majors and game values.
 * These override the Jacoby Transfer entry for Smolen-eligible hands.
 * After opener's 2D denial, responder follows up with 3H/3S (Smolen).
 */
export function createSmolenEntrySurfaces(_sys: SystemConfig): readonly BidMeaning[] {
  return [
    createSurface({
      meaningId: SMOLEN_MEANING_IDS.STAYMAN_ENTRY_5H4S,
      semanticClassId: "smolen:stayman-entry",
      encoding: bid(2, BidSuit.Clubs),
      clauses: [
        {
          factId: SYSTEM_RESPONDER_GAME_VALUES,
          operator: FactOperator.Boolean,
          value: true,
          rationale: "game values opposite 1NT",
          isPublic: true,
        },
        {
          factId: SMOLEN_FACT_IDS.HAS_FIVE_HEARTS,
          operator: FactOperator.Boolean,
          value: true,
          isPublic: true,
        },
        {
          factId: SMOLEN_FACT_IDS.HAS_FOUR_SPADES,
          operator: FactOperator.Boolean,
          value: true,
          isPublic: true,
        },
      ],
      band: RecommendationBand.Must,
      declarationOrder: 0,
      sourceIntent: { type: "StaymanAsk", params: { reason: "smolen" } },
      disclosure: Disclosure.Alert,
      teachingLabel: { name: bidName("Stayman 2♣"), summary: bidSummary("Initiate Stayman with 5 hearts and 4 spades, planning a Smolen jump if opener denies") },
    }, SMOLEN_CTX),

    createSurface({
      meaningId: SMOLEN_MEANING_IDS.STAYMAN_ENTRY_5S4H,
      semanticClassId: "smolen:stayman-entry",
      encoding: bid(2, BidSuit.Clubs),
      clauses: [
        {
          factId: SYSTEM_RESPONDER_GAME_VALUES,
          operator: FactOperator.Boolean,
          value: true,
          rationale: "game values opposite 1NT",
          isPublic: true,
        },
        {
          factId: SMOLEN_FACT_IDS.HAS_FIVE_SPADES,
          operator: FactOperator.Boolean,
          value: true,
          isPublic: true,
        },
        {
          factId: SMOLEN_FACT_IDS.HAS_FOUR_HEARTS,
          operator: FactOperator.Boolean,
          value: true,
          isPublic: true,
        },
      ],
      band: RecommendationBand.Must,
      declarationOrder: 1,
      sourceIntent: { type: "StaymanAsk", params: { reason: "smolen" } },
      disclosure: Disclosure.Alert,
      teachingLabel: { name: bidName("Stayman 2♣"), summary: bidSummary("Initiate Stayman with 5 spades and 4 hearts, planning a Smolen jump if opener denies") },
    }, SMOLEN_CTX),
  ];
}

// ─── R3 Smolen surfaces (contributed to responder-r3-after-stayman-2d) ───

export function createSmolenR3Surfaces(_sys: SystemConfig): readonly BidMeaning[] {
  return [
    createSurface({
      meaningId: SMOLEN_MEANING_IDS.BID_SHORT_HEARTS,
      semanticClassId: SMOLEN_CLASSES.BID_SHORT_HEARTS,
      encoding: bid(3, BidSuit.Hearts),
      clauses: [
        {
          factId: SYSTEM_RESPONDER_GAME_VALUES,
          operator: FactOperator.Boolean,
          value: true,
          rationale: "game values opposite 1NT",
          isPublic: true,
        },
        {
          factId: SMOLEN_FACT_IDS.HAS_FIVE_SPADES,
          operator: FactOperator.Boolean,
          value: true,
          rationale: "long major",
          isPublic: true,
        },
        {
          factId: SMOLEN_FACT_IDS.HAS_FOUR_HEARTS,
          operator: FactOperator.Boolean,
          value: true,
          rationale: "short major, bid this suit",
          isPublic: true,
        },
      ],
      band: RecommendationBand.Must,
      declarationOrder: 0,
      sourceIntent: { type: "Smolen", params: { longMajor: "spades" } },
      disclosure: Disclosure.Alert,
      teachingLabel: { name: bidName("Smolen 3♥"), summary: bidSummary("Show 5 spades and 4 hearts with game-forcing values after Stayman denial") },
    }, SMOLEN_CTX),

    createSurface({
      meaningId: SMOLEN_MEANING_IDS.BID_SHORT_SPADES,
      semanticClassId: SMOLEN_CLASSES.BID_SHORT_SPADES,
      encoding: bid(3, BidSuit.Spades),
      clauses: [
        {
          factId: SYSTEM_RESPONDER_GAME_VALUES,
          operator: FactOperator.Boolean,
          value: true,
          rationale: "game values opposite 1NT",
          isPublic: true,
        },
        {
          factId: SMOLEN_FACT_IDS.HAS_FIVE_HEARTS,
          operator: FactOperator.Boolean,
          value: true,
          rationale: "long major",
          isPublic: true,
        },
        {
          factId: SMOLEN_FACT_IDS.HAS_FOUR_SPADES,
          operator: FactOperator.Boolean,
          value: true,
          rationale: "short major, bid this suit",
          isPublic: true,
        },
      ],
      band: RecommendationBand.Must,
      declarationOrder: 1,
      sourceIntent: { type: "Smolen", params: { longMajor: "hearts" } },
      disclosure: Disclosure.Alert,
      teachingLabel: { name: bidName("Smolen 3♠"), summary: bidSummary("Show 5 hearts and 4 spades with game-forcing values after Stayman denial") },
    }, SMOLEN_CTX),
  ];
}

// ─── Opener Smolen placement surfaces ────────────────────────

export const OPENER_SMOLEN_HEARTS_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: SMOLEN_MEANING_IDS.PLACE_FOUR_HEARTS,
    semanticClassId: SMOLEN_CLASSES.PLACE_FOUR_HEARTS,
    encoding: bid(4, BidSuit.Hearts),
    clauses: [
      {
        factId: SMOLEN_FACT_IDS.OPENER_HAS_HEART_FIT,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "fit with responder's 5",
        isPublic: true,
      },
    ],
    band: RecommendationBand.Must,
    declarationOrder: 0,
    sourceIntent: { type: "SmolenPlacement", params: { suit: ObsSuit.Hearts } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("4H (heart fit found)"), summary: bidSummary("Place the contract in 4♥ after confirming a fit with responder's 5-card heart suit") },
  }, SMOLEN_CTX),
  createSurface({
    meaningId: SMOLEN_MEANING_IDS.PLACE_THREE_NT_NO_HEART_FIT,
    semanticClassId: SMOLEN_CLASSES.PLACE_THREE_NT,
    encoding: bid(3, BidSuit.NoTrump),
    clauses: [
      {
        factId: SMOLEN_FACT_IDS.OPENER_HAS_HEART_FIT,
        operator: FactOperator.Boolean,
        value: false,
        rationale: "no fit",
        isPublic: true,
      },
    ],
    band: RecommendationBand.Must,
    declarationOrder: 1,
    sourceIntent: { type: "SmolenPlacement", params: { suit: "notrump" } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("3NT (no heart fit)"), summary: bidSummary("Sign off in 3NT when opener lacks 3-card heart support for responder's 5-card suit") },
  }, SMOLEN_CTX),
];

export const OPENER_SMOLEN_SPADES_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: SMOLEN_MEANING_IDS.ACCEPT_SPADES_3S,
    semanticClassId: SMOLEN_CLASSES.ACCEPT_SPADES_3S,
    encoding: bid(3, BidSuit.Spades),
    clauses: [
      {
        factId: SMOLEN_FACT_IDS.OPENER_HAS_SPADES_FIT,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "fit with responder's 5",
        isPublic: true,
      },
    ],
    band: RecommendationBand.Must,
    declarationOrder: 0,
    sourceIntent: { type: "SmolenAcceptance", params: { suit: ObsSuit.Spades } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("3S (spade fit found)"), summary: bidSummary("Confirm a spade fit after responder's Smolen 3♥ showed 5 spades") },
  }, SMOLEN_CTX),
  createSurface({
    meaningId: SMOLEN_MEANING_IDS.PLACE_THREE_NT_NO_SPADE_FIT,
    semanticClassId: SMOLEN_CLASSES.PLACE_THREE_NT,
    encoding: bid(3, BidSuit.NoTrump),
    clauses: [
      {
        factId: SMOLEN_FACT_IDS.OPENER_HAS_SPADES_FIT,
        operator: FactOperator.Boolean,
        value: false,
        rationale: "no fit",
        isPublic: true,
      },
    ],
    band: RecommendationBand.Must,
    declarationOrder: 1,
    sourceIntent: { type: "SmolenPlacement", params: { suit: "notrump" } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("3NT (no spade fit)"), summary: bidSummary("Sign off in 3NT when opener lacks 3-card spade support for responder's 5-card suit") },
  }, SMOLEN_CTX),
];

// ─── Responder completion surface (after opener's 3S acceptance) ──

export const RESPONDER_SMOLEN_COMPLETE_SPADES_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: SMOLEN_MEANING_IDS.RESPONDER_PLACE_FOUR_SPADES,
    semanticClassId: SMOLEN_CLASSES.RESPONDER_PLACE_FOUR_SPADES,
    encoding: bid(4, BidSuit.Spades),
    clauses: [],
    band: RecommendationBand.Must,
    declarationOrder: 0,
    sourceIntent: { type: "SmolenPlacement", params: { suit: ObsSuit.Spades } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("4S (complete to game)"), summary: bidSummary("Raise opener's 3♠ acceptance to the 4♠ game contract") },
  }, SMOLEN_CTX),
];
