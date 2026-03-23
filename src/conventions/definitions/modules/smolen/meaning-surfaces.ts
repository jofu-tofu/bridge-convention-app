import type { BidMeaning } from "../../../../core/contracts/meaning";
import type { SystemConfig } from "../../../../core/contracts/system-config";
import { SYSTEM_RESPONDER_GAME_VALUES } from "../../../../core/contracts/system-fact-vocabulary";
import { BidSuit } from "../../../../engine/types";
import { bid } from "../../../core/surface-helpers";
import { createSurface } from "../../../core/surface-builder";
import type { ModuleContext } from "../../../core/surface-builder";

import { SMOLEN_FACT_IDS } from "./fact-ids";
import { SMOLEN_MEANING_IDS } from "./meaning-ids";
import { SMOLEN_CLASSES } from "./semantic-classes";

// ─── Module context ──────────────────────────────────────────

export const SMOLEN_CTX: ModuleContext = { moduleId: "smolen" };

// ─── Entry surfaces (Stayman for Smolen) ─────────────────────

/**
 * Smolen entry: bid 2C (Stayman) with 5-4 in majors and game values.
 * These override the Jacoby Transfer entry for Smolen-eligible hands.
 * After opener's 2D denial, responder follows up with 3H/3S (Smolen).
 */
export function createSmolenEntrySurfaces(sys: SystemConfig): readonly BidMeaning[] {
  return [
    createSurface({
      meaningId: SMOLEN_MEANING_IDS.STAYMAN_ENTRY_5H4S,
      semanticClassId: "smolen:stayman-entry",
      encoding: bid(2, BidSuit.Clubs),
      clauses: [
        {
          factId: SYSTEM_RESPONDER_GAME_VALUES,
          operator: "boolean",
          value: true,
          description: `Game values opposite 1NT (${sys.responderThresholds.gameMin}+ HCP)`,
          isPublic: true,
        },
        {
          factId: SMOLEN_FACT_IDS.HAS_FIVE_HEARTS,
          operator: "boolean",
          value: true,
          description: "5+ hearts",
          isPublic: true,
        },
        {
          factId: SMOLEN_FACT_IDS.HAS_FOUR_SPADES,
          operator: "boolean",
          value: true,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 0,
      sourceIntent: { type: "StaymanAsk", params: { reason: "smolen" } },
      disclosure: "alert",
      teachingLabel: "Stayman 2♣ (planning Smolen)",
    }, SMOLEN_CTX),

    createSurface({
      meaningId: SMOLEN_MEANING_IDS.STAYMAN_ENTRY_5S4H,
      semanticClassId: "smolen:stayman-entry",
      encoding: bid(2, BidSuit.Clubs),
      clauses: [
        {
          factId: SYSTEM_RESPONDER_GAME_VALUES,
          operator: "boolean",
          value: true,
          description: `Game values opposite 1NT (${sys.responderThresholds.gameMin}+ HCP)`,
          isPublic: true,
        },
        {
          factId: SMOLEN_FACT_IDS.HAS_FIVE_SPADES,
          operator: "boolean",
          value: true,
          description: "5+ spades",
          isPublic: true,
        },
        {
          factId: SMOLEN_FACT_IDS.HAS_FOUR_HEARTS,
          operator: "boolean",
          value: true,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 1,
      sourceIntent: { type: "StaymanAsk", params: { reason: "smolen" } },
      disclosure: "alert",
      teachingLabel: "Stayman 2♣ (planning Smolen)",
    }, SMOLEN_CTX),
  ];
}

// ─── R3 Smolen surfaces (contributed to responder-r3-after-stayman-2d) ───

export function createSmolenR3Surfaces(sys: SystemConfig): readonly BidMeaning[] {
  return [
    createSurface({
      meaningId: SMOLEN_MEANING_IDS.BID_SHORT_HEARTS,
      semanticClassId: SMOLEN_CLASSES.BID_SHORT_HEARTS,
      encoding: bid(3, BidSuit.Hearts),
      clauses: [
        {
          factId: SYSTEM_RESPONDER_GAME_VALUES,
          operator: "boolean",
          value: true,
          description: `Game values opposite 1NT (${sys.responderThresholds.gameMin}+ HCP)`,
          isPublic: true,
        },
        {
          factId: SMOLEN_FACT_IDS.HAS_FIVE_SPADES,
          operator: "boolean",
          value: true,
          description: "5+ spades (long major)",
          isPublic: true,
        },
        {
          factId: SMOLEN_FACT_IDS.HAS_FOUR_HEARTS,
          operator: "boolean",
          value: true,
          description: "Exactly 4 hearts (short major, bid this suit)",
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 0,
      sourceIntent: { type: "Smolen", params: { longMajor: "spades" } },
      disclosure: "alert",
      teachingLabel: "Smolen 3♥ (4♥ + 5♠, game force)",
    }, SMOLEN_CTX),

    createSurface({
      meaningId: SMOLEN_MEANING_IDS.BID_SHORT_SPADES,
      semanticClassId: SMOLEN_CLASSES.BID_SHORT_SPADES,
      encoding: bid(3, BidSuit.Spades),
      clauses: [
        {
          factId: SYSTEM_RESPONDER_GAME_VALUES,
          operator: "boolean",
          value: true,
          description: `Game values opposite 1NT (${sys.responderThresholds.gameMin}+ HCP)`,
          isPublic: true,
        },
        {
          factId: SMOLEN_FACT_IDS.HAS_FIVE_HEARTS,
          operator: "boolean",
          value: true,
          description: "5+ hearts (long major)",
          isPublic: true,
        },
        {
          factId: SMOLEN_FACT_IDS.HAS_FOUR_SPADES,
          operator: "boolean",
          value: true,
          description: "Exactly 4 spades (short major, bid this suit)",
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 1,
      sourceIntent: { type: "Smolen", params: { longMajor: "hearts" } },
      disclosure: "alert",
      teachingLabel: "Smolen 3♠ (4♠ + 5♥, game force)",
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
        operator: "boolean",
        value: true,
        description: "Opener has 3+ hearts (fit with responder's 5)",
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "SmolenPlacement", params: { suit: "hearts" } },
    disclosure: "alert",
    teachingLabel: "4H (heart fit found)",
  }, SMOLEN_CTX),
  createSurface({
    meaningId: SMOLEN_MEANING_IDS.PLACE_THREE_NT_NO_HEART_FIT,
    semanticClassId: SMOLEN_CLASSES.PLACE_THREE_NT,
    encoding: bid(3, BidSuit.NoTrump),
    clauses: [
      {
        factId: SMOLEN_FACT_IDS.OPENER_HAS_HEART_FIT,
        operator: "boolean",
        value: false,
        description: "Opener has fewer than 3 hearts (no fit)",
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 1,
    sourceIntent: { type: "SmolenPlacement", params: { suit: "notrump" } },
    disclosure: "alert",
    teachingLabel: "3NT (no heart fit)",
  }, SMOLEN_CTX),
];

export const OPENER_SMOLEN_SPADES_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: SMOLEN_MEANING_IDS.PLACE_FOUR_SPADES,
    semanticClassId: SMOLEN_CLASSES.PLACE_FOUR_SPADES,
    encoding: bid(4, BidSuit.Spades),
    clauses: [
      {
        factId: SMOLEN_FACT_IDS.OPENER_HAS_SPADES_FIT,
        operator: "boolean",
        value: true,
        description: "Opener has 3+ spades (fit with responder's 5)",
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "SmolenPlacement", params: { suit: "spades" } },
    disclosure: "alert",
    teachingLabel: "4S (spade fit found)",
  }, SMOLEN_CTX),
  createSurface({
    meaningId: SMOLEN_MEANING_IDS.PLACE_THREE_NT_NO_SPADE_FIT,
    semanticClassId: SMOLEN_CLASSES.PLACE_THREE_NT,
    encoding: bid(3, BidSuit.NoTrump),
    clauses: [
      {
        factId: SMOLEN_FACT_IDS.OPENER_HAS_SPADES_FIT,
        operator: "boolean",
        value: false,
        description: "Opener has fewer than 3 spades (no fit)",
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 1,
    sourceIntent: { type: "SmolenPlacement", params: { suit: "notrump" } },
    disclosure: "alert",
    teachingLabel: "3NT (no spade fit)",
  }, SMOLEN_CTX),
];
