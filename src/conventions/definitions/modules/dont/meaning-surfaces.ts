import { BidSuit } from "../../../../engine/types";
import { DONT_CLASSES } from "./semantic-classes";
import { bid } from "../../../core/surface-helpers";
import { createSurface } from "../../../core/surface-builder";
import type { ModuleContext } from "../../../core/surface-builder";
import {
  SYSTEM_DONT_OVERCALL_IN_RANGE,
} from "../../../../core/contracts/system-fact-vocabulary";
import { DONT_FACT_IDS } from "./fact-ids";
import { DONT_MEANING_IDS } from "./meaning-ids";

const DONT_CTX: ModuleContext = { moduleId: "dont" };

// ─── R1: Overcaller initial action (after opponent's 1NT) ───
//
// Priority order via specificity + declarationOrder:
//   2H (both majors, spec 3) > 2D (diamonds+major, spec 3) >
//   2C (clubs+higher, spec 3) > 2S (natural, spec 2) >
//   X (single suited, spec 2) > Pass (fallback, spec 0)
//
// Edge case: 6-4 hand → two-suited bid (spec 3) beats
// single-suited X (spec 2). 6S+4H → 2H (both majors, order 0)
// beats 2S (natural, order 3).

export const DONT_R1_SURFACES = [
  // 1. 2H — both majors (5-4+ either way)
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.BOTH_MAJORS_2H,
      semanticClassId: DONT_CLASSES.BOTH_MAJORS,
      encoding: { defaultCall: bid(2, BidSuit.Hearts) },
      clauses: [
        {
          factId: SYSTEM_DONT_OVERCALL_IN_RANGE,
          operator: "boolean",
          value: true,
        },
        {
          factId: DONT_FACT_IDS.BOTH_MAJORS,
          operator: "boolean",
          value: true,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 0,
      sourceIntent: { type: "DONTBothMajors", params: {} },
      disclosure: "alert",
      teachingLabel: "2H — both majors",
    },
    DONT_CTX,
  ),

  // 2. 2D — diamonds + a major
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.DIAMONDS_MAJOR_2D,
      semanticClassId: DONT_CLASSES.DIAMONDS_AND_MAJOR,
      encoding: { defaultCall: bid(2, BidSuit.Diamonds) },
      clauses: [
        {
          factId: SYSTEM_DONT_OVERCALL_IN_RANGE,
          operator: "boolean",
          value: true,
        },
        {
          factId: DONT_FACT_IDS.DIAMONDS_AND_MAJOR,
          operator: "boolean",
          value: true,
          isPublic: true,
          description: "D5+ and (H4+ or S4+)",
        },
      ],
      band: "must",
      declarationOrder: 1,
      sourceIntent: { type: "DONTDiamondsMajor", params: {} },
      disclosure: "alert",
      teachingLabel: "2D — diamonds + a major",
    },
    DONT_CTX,
  ),

  // 3. 2C — clubs + a higher suit
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.CLUBS_HIGHER_2C,
      semanticClassId: DONT_CLASSES.CLUBS_AND_HIGHER,
      encoding: { defaultCall: bid(2, BidSuit.Clubs) },
      clauses: [
        {
          factId: SYSTEM_DONT_OVERCALL_IN_RANGE,
          operator: "boolean",
          value: true,
        },
        {
          factId: DONT_FACT_IDS.CLUBS_AND_HIGHER,
          operator: "boolean",
          value: true,
          isPublic: true,
          description: "C5+ and (D4+ or H4+ or S4+)",
        },
      ],
      band: "must",
      declarationOrder: 2,
      sourceIntent: { type: "DONTClubsHigher", params: {} },
      disclosure: "alert",
      teachingLabel: "2C — clubs + higher suit",
    },
    DONT_CTX,
  ),

  // 4. 2S — natural 6+ spades
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.NATURAL_SPADES_2S,
      semanticClassId: DONT_CLASSES.NATURAL_SPADES,
      encoding: { defaultCall: bid(2, BidSuit.Spades) },
      clauses: [
        {
          factId: SYSTEM_DONT_OVERCALL_IN_RANGE,
          operator: "boolean",
          value: true,
        },
        {
          factId: DONT_FACT_IDS.NATURAL_SPADES,
          operator: "boolean",
          value: true,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 3,
      sourceIntent: { type: "DONTNaturalSpades", params: {} },
      disclosure: "alert",
      teachingLabel: "2S — natural spades",
    },
    DONT_CTX,
  ),

  // 5. X (double) — single suited, one suit 6+, not spades
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.SINGLE_SUITED_DOUBLE,
      semanticClassId: DONT_CLASSES.SINGLE_SUITED,
      encoding: { defaultCall: { type: "double" } },
      clauses: [
        {
          factId: SYSTEM_DONT_OVERCALL_IN_RANGE,
          operator: "boolean",
          value: true,
        },
        {
          factId: DONT_FACT_IDS.SINGLE_SUITED,
          operator: "boolean",
          value: true,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 4,
      sourceIntent: { type: "DONTSingleSuited", params: {} },
      disclosure: "alert",
      teachingLabel: "X — single suited (not spades)",
    },
    DONT_CTX,
  ),

  // 6. Pass — no DONT bid applies (fallback)
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.OVERCALLER_PASS,
      semanticClassId: DONT_CLASSES.OVERCALLER_PASS,
      encoding: { defaultCall: { type: "pass" } },
      clauses: [],
      band: "avoid",
      declarationOrder: 5,
      sourceIntent: { type: "DONTPass", params: {} },
      disclosure: "natural",
      teachingLabel: "Pass (no DONT bid)",
    },
    DONT_CTX,
  ),
] as const;

// ─── Advancer after 2H (both majors) ───────────────────────
//
// Pass = accept hearts (3+ support)
// 2S = prefer spades (catch-all for no heart support)
// 3C = escape with long clubs
// 3D = escape with long diamonds

export const DONT_ADVANCER_2H_SURFACES = [
  // 1. Pass — accept hearts
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.ACCEPT_HEARTS_PASS,
      semanticClassId: DONT_CLASSES.ACCEPT_SUIT,
      encoding: { defaultCall: { type: "pass" } },
      clauses: [
        {
          factId: DONT_FACT_IDS.HAS_HEART_SUPPORT,
          operator: "boolean",
          value: true,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 0,
      sourceIntent: { type: "DONTAcceptHearts", params: {} },
      disclosure: "natural",
      teachingLabel: "Pass — accept hearts",
    },
    DONT_CTX,
  ),

  // 2. 2S — prefer spades (no heart support catch-all)
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.PREFER_SPADES_2S,
      semanticClassId: DONT_CLASSES.PREFER_SPADES,
      encoding: { defaultCall: bid(2, BidSuit.Spades) },
      clauses: [],
      band: "should",
      declarationOrder: 1,
      sourceIntent: { type: "DONTPreferSpades", params: {} },
      disclosure: "natural",
      teachingLabel: "2S — prefer spades",
    },
    DONT_CTX,
  ),

  // 3. 3C — escape with long clubs (only without spade support — prefer major fit)
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.ESCAPE_CLUBS_3C,
      semanticClassId: DONT_CLASSES.ESCAPE_MINOR,
      encoding: { defaultCall: bid(3, BidSuit.Clubs) },
      clauses: [
        {
          factId: DONT_FACT_IDS.LONG_MINOR_IS_CLUBS,
          operator: "boolean",
          value: true,
          isPublic: true,
          description: "6+ clubs (longer minor)",
        },
        {
          factId: DONT_FACT_IDS.HAS_SPADE_SUPPORT,
          operator: "boolean",
          value: false,
          description: "No spade tolerance — prefer major fit when 3+ spades",
        },
      ],
      band: "should",
      declarationOrder: 2,
      sourceIntent: { type: "DONTEscapeClubs", params: {} },
      disclosure: "alert",
      teachingLabel: "3C — minor escape",
    },
    DONT_CTX,
  ),

  // 4. 3D — escape with long diamonds (only without spade support — prefer major fit)
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.ESCAPE_DIAMONDS_3D,
      semanticClassId: DONT_CLASSES.ESCAPE_MINOR,
      encoding: { defaultCall: bid(3, BidSuit.Diamonds) },
      clauses: [
        {
          factId: DONT_FACT_IDS.LONG_MINOR_IS_DIAMONDS,
          operator: "boolean",
          value: true,
          isPublic: true,
          description: "6+ diamonds (longer minor)",
        },
        {
          factId: DONT_FACT_IDS.HAS_SPADE_SUPPORT,
          operator: "boolean",
          value: false,
          description: "No spade tolerance — prefer major fit when 3+ spades",
        },
      ],
      band: "should",
      declarationOrder: 3,
      sourceIntent: { type: "DONTEscapeDiamonds", params: {} },
      disclosure: "alert",
      teachingLabel: "3D — minor escape",
    },
    DONT_CTX,
  ),
] as const;

// ─── Advancer after 2D (diamonds + major) ───────────────────
//
// Pass = accept diamonds (3+ support)
// 2H = relay asking for the major (catch-all)

export const DONT_ADVANCER_2D_SURFACES = [
  // 1. Pass — accept diamonds
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.ACCEPT_DIAMONDS_PASS,
      semanticClassId: DONT_CLASSES.ACCEPT_SUIT,
      encoding: { defaultCall: { type: "pass" } },
      clauses: [
        {
          factId: DONT_FACT_IDS.HAS_DIAMOND_SUPPORT,
          operator: "boolean",
          value: true,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 0,
      sourceIntent: { type: "DONTAcceptDiamonds", params: {} },
      disclosure: "natural",
      teachingLabel: "Pass — accept diamonds",
    },
    DONT_CTX,
  ),

  // 2. 2H — relay asking for the major
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.RELAY_2H_AFTER_2D,
      semanticClassId: DONT_CLASSES.RELAY_ASK,
      encoding: { defaultCall: bid(2, BidSuit.Hearts) },
      clauses: [],
      band: "should",
      declarationOrder: 1,
      sourceIntent: { type: "DONTRelayAskMajor", params: {} },
      disclosure: "alert",
      teachingLabel: "2H — relay (ask for major)",
    },
    DONT_CTX,
  ),
] as const;

// ─── Advancer after 2C (clubs + higher) ─────────────────────
//
// Pass = accept clubs (3+ support)
// 2D = relay asking for higher suit (catch-all)

export const DONT_ADVANCER_2C_SURFACES = [
  // 1. Pass — accept clubs
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.ACCEPT_CLUBS_PASS,
      semanticClassId: DONT_CLASSES.ACCEPT_SUIT,
      encoding: { defaultCall: { type: "pass" } },
      clauses: [
        {
          factId: DONT_FACT_IDS.HAS_CLUB_SUPPORT,
          operator: "boolean",
          value: true,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 0,
      sourceIntent: { type: "DONTAcceptClubs", params: {} },
      disclosure: "natural",
      teachingLabel: "Pass — accept clubs",
    },
    DONT_CTX,
  ),

  // 2. 2D — relay asking for higher suit
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.RELAY_2D_AFTER_2C,
      semanticClassId: DONT_CLASSES.RELAY_ASK,
      encoding: { defaultCall: bid(2, BidSuit.Diamonds) },
      clauses: [],
      band: "should",
      declarationOrder: 1,
      sourceIntent: { type: "DONTRelayAskHigher", params: {} },
      disclosure: "alert",
      teachingLabel: "2D — relay (ask for higher suit)",
    },
    DONT_CTX,
  ),
] as const;

// ─── Advancer after 2S (natural spades) ─────────────────────
//
// Pass = accept spades (with or without support — default)
// Pass fallback = no alternative action

export const DONT_ADVANCER_2S_SURFACES = [
  // 1. Pass — accept spades (with support)
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.ACCEPT_SPADES_PASS,
      semanticClassId: DONT_CLASSES.ACCEPT_SUIT,
      encoding: { defaultCall: { type: "pass" } },
      clauses: [
        {
          factId: DONT_FACT_IDS.HAS_SPADE_SUPPORT,
          operator: "boolean",
          value: true,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 0,
      sourceIntent: { type: "DONTAcceptSpades", params: {} },
      disclosure: "natural",
      teachingLabel: "Pass — accept spades",
    },
    DONT_CTX,
  ),

  // 2. Pass fallback — no alternative
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.ACCEPT_SPADES_FALLBACK,
      semanticClassId: DONT_CLASSES.ACCEPT_SUIT,
      encoding: { defaultCall: { type: "pass" } },
      clauses: [],
      band: "avoid",
      declarationOrder: 1,
      sourceIntent: { type: "DONTAcceptSpadesFallback", params: {} },
      disclosure: "natural",
      teachingLabel: "Pass (no alternative)",
    },
    DONT_CTX,
  ),
] as const;

// ─── Advancer after X (double — single suited) ─────────────
//
// 2C = forced relay (must bid, unconditional)

export const DONT_ADVANCER_DOUBLE_SURFACES = [
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.FORCED_RELAY_2C,
      semanticClassId: DONT_CLASSES.FORCED_RELAY,
      encoding: { defaultCall: bid(2, BidSuit.Clubs) },
      clauses: [],
      band: "must",
      declarationOrder: 0,
      sourceIntent: { type: "DONTForcedRelay", params: {} },
      disclosure: "alert",
      teachingLabel: "2C — forced relay after double",
    },
    DONT_CTX,
  ),
] as const;

// ─── Overcaller reveal after X → 2C ────────────────────────
//
// Pass = clubs (the 6+ suit is clubs)
// 2D = diamonds
// 2H = hearts

export const DONT_REVEAL_SURFACES = [
  // 1. Pass — reveal clubs
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.REVEAL_CLUBS_PASS,
      semanticClassId: DONT_CLASSES.REVEAL_CLUBS,
      encoding: { defaultCall: { type: "pass" } },
      clauses: [
        {
          factId: DONT_FACT_IDS.SINGLE_SUIT_CLUBS,
          operator: "boolean",
          value: true,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 0,
      sourceIntent: { type: "DONTRevealClubs", params: {} },
      disclosure: "alert",
      teachingLabel: "Pass — clubs",
    },
    DONT_CTX,
  ),

  // 2. 2D — reveal diamonds
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.REVEAL_DIAMONDS_2D,
      semanticClassId: DONT_CLASSES.REVEAL_DIAMONDS,
      encoding: { defaultCall: bid(2, BidSuit.Diamonds) },
      clauses: [
        {
          factId: DONT_FACT_IDS.SINGLE_SUIT_DIAMONDS,
          operator: "boolean",
          value: true,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 1,
      sourceIntent: { type: "DONTRevealDiamonds", params: {} },
      disclosure: "alert",
      teachingLabel: "2D — diamonds",
    },
    DONT_CTX,
  ),

  // 3. 2H — reveal hearts
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.REVEAL_HEARTS_2H,
      semanticClassId: DONT_CLASSES.REVEAL_HEARTS,
      encoding: { defaultCall: bid(2, BidSuit.Hearts) },
      clauses: [
        {
          factId: DONT_FACT_IDS.SINGLE_SUIT_HEARTS,
          operator: "boolean",
          value: true,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 2,
      sourceIntent: { type: "DONTRevealHearts", params: {} },
      disclosure: "alert",
      teachingLabel: "2H — hearts",
    },
    DONT_CTX,
  ),
] as const;

// ─── Overcaller reply after 2C → 2D relay ──────────────────
//
// Pass = diamonds (since relay was at 2D, pass to play there)
// 2H = hearts
// 2S = spades

export const DONT_2C_RELAY_SURFACES = [
  // 1. Pass — higher suit is diamonds
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.CLUBS_HIGHER_DIAMONDS_PASS,
      semanticClassId: DONT_CLASSES.SHOW_HIGHER_SUIT,
      encoding: { defaultCall: { type: "pass" } },
      clauses: [
        {
          factId: DONT_FACT_IDS.CLUBS_HIGHER_DIAMONDS,
          operator: "boolean",
          value: true,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 0,
      sourceIntent: { type: "DONTShowDiamonds", params: {} },
      disclosure: "alert",
      teachingLabel: "Pass — diamonds (from 2C+higher)",
    },
    DONT_CTX,
  ),

  // 2. 2H — higher suit is hearts
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.CLUBS_HIGHER_HEARTS_2H,
      semanticClassId: DONT_CLASSES.SHOW_HIGHER_SUIT,
      encoding: { defaultCall: bid(2, BidSuit.Hearts) },
      clauses: [
        {
          factId: DONT_FACT_IDS.CLUBS_HIGHER_HEARTS,
          operator: "boolean",
          value: true,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 1,
      sourceIntent: { type: "DONTShowHearts", params: {} },
      disclosure: "alert",
      teachingLabel: "2H — hearts (from 2C+higher)",
    },
    DONT_CTX,
  ),

  // 3. 2S — higher suit is spades
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.CLUBS_HIGHER_SPADES_2S,
      semanticClassId: DONT_CLASSES.SHOW_HIGHER_SUIT,
      encoding: { defaultCall: bid(2, BidSuit.Spades) },
      clauses: [
        {
          factId: DONT_FACT_IDS.CLUBS_HIGHER_SPADES,
          operator: "boolean",
          value: true,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 2,
      sourceIntent: { type: "DONTShowSpades", params: {} },
      disclosure: "alert",
      teachingLabel: "2S — spades (from 2C+higher)",
    },
    DONT_CTX,
  ),
] as const;

// ─── Overcaller reply after 2D → 2H relay ──────────────────
//
// Pass = hearts (since relay was at 2H, pass to play there)
// 2S = spades

export const DONT_2D_RELAY_SURFACES = [
  // 1. Pass — major is hearts
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.DIAMONDS_MAJOR_HEARTS_PASS,
      semanticClassId: DONT_CLASSES.SHOW_HIGHER_SUIT,
      encoding: { defaultCall: { type: "pass" } },
      clauses: [
        {
          factId: DONT_FACT_IDS.DIAMONDS_MAJOR_HEARTS,
          operator: "boolean",
          value: true,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 0,
      sourceIntent: { type: "DONTShowHeartsFromDiamonds", params: {} },
      disclosure: "alert",
      teachingLabel: "Pass — hearts (from 2D+major)",
    },
    DONT_CTX,
  ),

  // 2. 2S — major is spades
  createSurface(
    {
      meaningId: DONT_MEANING_IDS.DIAMONDS_MAJOR_SPADES_2S,
      semanticClassId: DONT_CLASSES.SHOW_HIGHER_SUIT,
      encoding: { defaultCall: bid(2, BidSuit.Spades) },
      clauses: [
        {
          factId: DONT_FACT_IDS.DIAMONDS_MAJOR_SPADES,
          operator: "boolean",
          value: true,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 1,
      sourceIntent: { type: "DONTShowSpadesFromDiamonds", params: {} },
      disclosure: "alert",
      teachingLabel: "2S — spades (from 2D+major)",
    },
    DONT_CTX,
  ),
] as const;
