import { BidSuit } from "../../../../engine/types";
import { DONT_CLASSES } from "./semantic-classes";
import { bid } from "../../../core/surface-helpers";
import { createSurface } from "../../../core/surface-builder";
import type { ModuleContext } from "../../../core/surface-builder";
import {
  SAME_FAMILY,
  CONTINUATION_OF,
  NEAR_MISS_OF,
  ALTERNATIVES,
} from "../../pedagogical-vocabulary";

const DONT_CTX: ModuleContext = { moduleId: "dont" };

// ─── R1: Overcaller initial action (after opponent's 1NT) ───
//
// Priority order via specificity + intraModuleOrder:
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
      meaningId: "dont:both-majors-2h",
      semanticClassId: DONT_CLASSES.BOTH_MAJORS,
      encoding: { defaultCall: bid(2, BidSuit.Hearts) },
      clauses: [
        {
          factId: "module.dont.bothMajors",
          operator: "boolean",
          value: true,
        },
      ],
      band: "must",
      intraModuleOrder: 0,
      sourceIntent: { type: "DONTBothMajors", params: {} },
      teachingLabel: "2H — both majors",
      pedagogicalTags: [
        { tag: SAME_FAMILY, scope: "dont:overcaller-r1-actions" },
        { tag: ALTERNATIVES, scope: "DONT overcaller two-suited actions" },
        { tag: NEAR_MISS_OF, scope: "dont:2h-vs-2d", role: "a" },
      ],
    },
    DONT_CTX,
  ),

  // 2. 2D — diamonds + a major
  createSurface(
    {
      meaningId: "dont:diamonds-major-2d",
      semanticClassId: DONT_CLASSES.DIAMONDS_AND_MAJOR,
      encoding: { defaultCall: bid(2, BidSuit.Diamonds) },
      clauses: [
        {
          factId: "module.dont.diamondsAndMajor",
          operator: "boolean",
          value: true,
          description: "D5+ and (H4+ or S4+)",
        },
      ],
      band: "must",
      intraModuleOrder: 1,
      sourceIntent: { type: "DONTDiamondsMajor", params: {} },
      teachingLabel: "2D — diamonds + a major",
      pedagogicalTags: [
        { tag: SAME_FAMILY, scope: "dont:overcaller-r1-actions" },
        { tag: ALTERNATIVES, scope: "DONT overcaller two-suited actions" },
        { tag: NEAR_MISS_OF, scope: "dont:2h-vs-2d", role: "b" },
        { tag: NEAR_MISS_OF, scope: "dont:2c-vs-2d", role: "b" },
        { tag: CONTINUATION_OF, scope: "dont:show-after-2d-relay", role: "b" },
      ],
    },
    DONT_CTX,
  ),

  // 3. 2C — clubs + a higher suit
  createSurface(
    {
      meaningId: "dont:clubs-higher-2c",
      semanticClassId: DONT_CLASSES.CLUBS_AND_HIGHER,
      encoding: { defaultCall: bid(2, BidSuit.Clubs) },
      clauses: [
        {
          factId: "module.dont.clubsAndHigher",
          operator: "boolean",
          value: true,
          description: "C5+ and (D4+ or H4+ or S4+)",
        },
      ],
      band: "must",
      intraModuleOrder: 2,
      sourceIntent: { type: "DONTClubsHigher", params: {} },
      teachingLabel: "2C — clubs + higher suit",
      pedagogicalTags: [
        { tag: SAME_FAMILY, scope: "dont:overcaller-r1-actions" },
        { tag: ALTERNATIVES, scope: "DONT overcaller two-suited actions" },
        { tag: NEAR_MISS_OF, scope: "dont:2c-vs-2d", role: "a" },
        { tag: CONTINUATION_OF, scope: "dont:show-after-2c-relay", role: "b" },
      ],
    },
    DONT_CTX,
  ),

  // 4. 2S — natural 6+ spades
  createSurface(
    {
      meaningId: "dont:natural-spades-2s",
      semanticClassId: DONT_CLASSES.NATURAL_SPADES,
      encoding: { defaultCall: bid(2, BidSuit.Spades) },
      clauses: [
        {
          factId: "module.dont.naturalSpades",
          operator: "boolean",
          value: true,
        },
      ],
      band: "must",
      intraModuleOrder: 3,
      sourceIntent: { type: "DONTNaturalSpades", params: {} },
      teachingLabel: "2S — natural spades",
      pedagogicalTags: [
        { tag: SAME_FAMILY, scope: "dont:overcaller-r1-actions" },
        { tag: ALTERNATIVES, scope: "DONT overcaller long-suit actions" },
        { tag: NEAR_MISS_OF, scope: "dont:2s-vs-double", role: "a" },
      ],
    },
    DONT_CTX,
  ),

  // 5. X (double) — single suited, one suit 6+, not spades
  createSurface(
    {
      meaningId: "dont:single-suited-double",
      semanticClassId: DONT_CLASSES.SINGLE_SUITED,
      encoding: { defaultCall: { type: "double" } },
      clauses: [
        {
          factId: "module.dont.singleSuited",
          operator: "boolean",
          value: true,
        },
      ],
      band: "must",
      intraModuleOrder: 4,
      sourceIntent: { type: "DONTSingleSuited", params: {} },
      teachingLabel: "X — single suited (not spades)",
      pedagogicalTags: [
        { tag: SAME_FAMILY, scope: "dont:overcaller-r1-actions" },
        { tag: ALTERNATIVES, scope: "DONT overcaller long-suit actions" },
        { tag: NEAR_MISS_OF, scope: "dont:2s-vs-double", role: "b" },
        { tag: CONTINUATION_OF, scope: "dont:reveal-after-double", role: "b" },
      ],
    },
    DONT_CTX,
  ),

  // 6. Pass — no DONT bid applies (fallback)
  createSurface(
    {
      meaningId: "dont:overcaller-pass",
      semanticClassId: DONT_CLASSES.OVERCALLER_PASS,
      encoding: { defaultCall: { type: "pass" } },
      clauses: [],
      band: "avoid",
      intraModuleOrder: 5,
      sourceIntent: { type: "DONTPass", params: {} },
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
      meaningId: "dont:accept-hearts-pass",
      semanticClassId: DONT_CLASSES.ACCEPT_SUIT,
      encoding: { defaultCall: { type: "pass" } },
      clauses: [
        {
          factId: "module.dont.hasHeartSupport",
          operator: "boolean",
          value: true,
        },
      ],
      band: "must",
      intraModuleOrder: 0,
      sourceIntent: { type: "DONTAcceptHearts", params: {} },
      teachingLabel: "Pass — accept hearts",
    },
    DONT_CTX,
  ),

  // 2. 2S — prefer spades (no heart support catch-all)
  createSurface(
    {
      meaningId: "dont:prefer-spades-2s",
      semanticClassId: DONT_CLASSES.PREFER_SPADES,
      encoding: { defaultCall: bid(2, BidSuit.Spades) },
      clauses: [],
      band: "should",
      intraModuleOrder: 1,
      sourceIntent: { type: "DONTPreferSpades", params: {} },
      teachingLabel: "2S — prefer spades",
    },
    DONT_CTX,
  ),

  // 3. 3C — escape with long clubs
  createSurface(
    {
      meaningId: "dont:escape-clubs-3c",
      semanticClassId: DONT_CLASSES.ESCAPE_MINOR,
      encoding: { defaultCall: bid(3, BidSuit.Clubs) },
      clauses: [
        {
          factId: "module.dont.longMinorIsClubs",
          operator: "boolean",
          value: true,
          description: "6+ clubs (longer minor)",
        },
      ],
      band: "should",
      intraModuleOrder: 2,
      sourceIntent: { type: "DONTEscapeClubs", params: {} },
      teachingLabel: "3C — minor escape",
    },
    DONT_CTX,
  ),

  // 4. 3D — escape with long diamonds
  createSurface(
    {
      meaningId: "dont:escape-diamonds-3d",
      semanticClassId: DONT_CLASSES.ESCAPE_MINOR,
      encoding: { defaultCall: bid(3, BidSuit.Diamonds) },
      clauses: [
        {
          factId: "module.dont.longMinorIsDiamonds",
          operator: "boolean",
          value: true,
          description: "6+ diamonds (longer minor)",
        },
      ],
      band: "should",
      intraModuleOrder: 3,
      sourceIntent: { type: "DONTEscapeDiamonds", params: {} },
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
      meaningId: "dont:accept-diamonds-pass",
      semanticClassId: DONT_CLASSES.ACCEPT_SUIT,
      encoding: { defaultCall: { type: "pass" } },
      clauses: [
        {
          factId: "module.dont.hasDiamondSupport",
          operator: "boolean",
          value: true,
        },
      ],
      band: "must",
      intraModuleOrder: 0,
      sourceIntent: { type: "DONTAcceptDiamonds", params: {} },
      teachingLabel: "Pass — accept diamonds",
    },
    DONT_CTX,
  ),

  // 2. 2H — relay asking for the major
  createSurface(
    {
      meaningId: "dont:relay-2h-after-2d",
      semanticClassId: DONT_CLASSES.RELAY_ASK,
      encoding: { defaultCall: bid(2, BidSuit.Hearts) },
      clauses: [],
      band: "should",
      intraModuleOrder: 1,
      sourceIntent: { type: "DONTRelayAskMajor", params: {} },
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
      meaningId: "dont:accept-clubs-pass",
      semanticClassId: DONT_CLASSES.ACCEPT_SUIT,
      encoding: { defaultCall: { type: "pass" } },
      clauses: [
        {
          factId: "module.dont.hasClubSupport",
          operator: "boolean",
          value: true,
        },
      ],
      band: "must",
      intraModuleOrder: 0,
      sourceIntent: { type: "DONTAcceptClubs", params: {} },
      teachingLabel: "Pass — accept clubs",
    },
    DONT_CTX,
  ),

  // 2. 2D — relay asking for higher suit
  createSurface(
    {
      meaningId: "dont:relay-2d-after-2c",
      semanticClassId: DONT_CLASSES.RELAY_ASK,
      encoding: { defaultCall: bid(2, BidSuit.Diamonds) },
      clauses: [],
      band: "should",
      intraModuleOrder: 1,
      sourceIntent: { type: "DONTRelayAskHigher", params: {} },
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
      meaningId: "dont:accept-spades-pass",
      semanticClassId: DONT_CLASSES.ACCEPT_SUIT,
      encoding: { defaultCall: { type: "pass" } },
      clauses: [
        {
          factId: "module.dont.hasSpadeSupport",
          operator: "boolean",
          value: true,
        },
      ],
      band: "must",
      intraModuleOrder: 0,
      sourceIntent: { type: "DONTAcceptSpades", params: {} },
      teachingLabel: "Pass — accept spades",
    },
    DONT_CTX,
  ),

  // 2. Pass fallback — no alternative
  createSurface(
    {
      meaningId: "dont:accept-spades-fallback",
      semanticClassId: DONT_CLASSES.ACCEPT_SUIT,
      encoding: { defaultCall: { type: "pass" } },
      clauses: [],
      band: "avoid",
      intraModuleOrder: 1,
      sourceIntent: { type: "DONTAcceptSpadesFallback", params: {} },
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
      meaningId: "dont:forced-relay-2c",
      semanticClassId: DONT_CLASSES.FORCED_RELAY,
      encoding: { defaultCall: bid(2, BidSuit.Clubs) },
      clauses: [],
      band: "must",
      intraModuleOrder: 0,
      sourceIntent: { type: "DONTForcedRelay", params: {} },
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
      meaningId: "dont:reveal-clubs-pass",
      semanticClassId: DONT_CLASSES.REVEAL_CLUBS,
      encoding: { defaultCall: { type: "pass" } },
      clauses: [
        {
          factId: "module.dont.singleSuitClubs",
          operator: "boolean",
          value: true,
        },
      ],
      band: "must",
      intraModuleOrder: 0,
      sourceIntent: { type: "DONTRevealClubs", params: {} },
      teachingLabel: "Pass — clubs",
      pedagogicalTags: [
        { tag: SAME_FAMILY, scope: "dont:overcaller-reveals" },
        { tag: CONTINUATION_OF, scope: "dont:reveal-after-double", role: "a" },
      ],
    },
    DONT_CTX,
  ),

  // 2. 2D — reveal diamonds
  createSurface(
    {
      meaningId: "dont:reveal-diamonds-2d",
      semanticClassId: DONT_CLASSES.REVEAL_DIAMONDS,
      encoding: { defaultCall: bid(2, BidSuit.Diamonds) },
      clauses: [
        {
          factId: "module.dont.singleSuitDiamonds",
          operator: "boolean",
          value: true,
        },
      ],
      band: "must",
      intraModuleOrder: 1,
      sourceIntent: { type: "DONTRevealDiamonds", params: {} },
      teachingLabel: "2D — diamonds",
      pedagogicalTags: [
        { tag: SAME_FAMILY, scope: "dont:overcaller-reveals" },
        { tag: CONTINUATION_OF, scope: "dont:reveal-after-double", role: "a" },
      ],
    },
    DONT_CTX,
  ),

  // 3. 2H — reveal hearts
  createSurface(
    {
      meaningId: "dont:reveal-hearts-2h",
      semanticClassId: DONT_CLASSES.REVEAL_HEARTS,
      encoding: { defaultCall: bid(2, BidSuit.Hearts) },
      clauses: [
        {
          factId: "module.dont.singleSuitHearts",
          operator: "boolean",
          value: true,
        },
      ],
      band: "must",
      intraModuleOrder: 2,
      sourceIntent: { type: "DONTRevealHearts", params: {} },
      teachingLabel: "2H — hearts",
      pedagogicalTags: [
        { tag: SAME_FAMILY, scope: "dont:overcaller-reveals" },
        { tag: CONTINUATION_OF, scope: "dont:reveal-after-double", role: "a" },
      ],
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
      meaningId: "dont:clubs-higher-diamonds-pass",
      semanticClassId: DONT_CLASSES.SHOW_HIGHER_SUIT,
      encoding: { defaultCall: { type: "pass" } },
      clauses: [
        {
          factId: "module.dont.clubsHigherDiamonds",
          operator: "boolean",
          value: true,
        },
      ],
      band: "must",
      intraModuleOrder: 0,
      sourceIntent: { type: "DONTShowDiamonds", params: {} },
      teachingLabel: "Pass — diamonds (from 2C+higher)",
      pedagogicalTags: [
        { tag: CONTINUATION_OF, scope: "dont:show-after-2c-relay", role: "a" },
      ],
    },
    DONT_CTX,
  ),

  // 2. 2H — higher suit is hearts
  createSurface(
    {
      meaningId: "dont:clubs-higher-hearts-2h",
      semanticClassId: DONT_CLASSES.SHOW_HIGHER_SUIT,
      encoding: { defaultCall: bid(2, BidSuit.Hearts) },
      clauses: [
        {
          factId: "module.dont.clubsHigherHearts",
          operator: "boolean",
          value: true,
        },
      ],
      band: "must",
      intraModuleOrder: 1,
      sourceIntent: { type: "DONTShowHearts", params: {} },
      teachingLabel: "2H — hearts (from 2C+higher)",
      pedagogicalTags: [
        { tag: CONTINUATION_OF, scope: "dont:show-after-2c-relay", role: "a" },
      ],
    },
    DONT_CTX,
  ),

  // 3. 2S — higher suit is spades
  createSurface(
    {
      meaningId: "dont:clubs-higher-spades-2s",
      semanticClassId: DONT_CLASSES.SHOW_HIGHER_SUIT,
      encoding: { defaultCall: bid(2, BidSuit.Spades) },
      clauses: [
        {
          factId: "module.dont.clubsHigherSpades",
          operator: "boolean",
          value: true,
        },
      ],
      band: "must",
      intraModuleOrder: 2,
      sourceIntent: { type: "DONTShowSpades", params: {} },
      teachingLabel: "2S — spades (from 2C+higher)",
      pedagogicalTags: [
        { tag: CONTINUATION_OF, scope: "dont:show-after-2c-relay", role: "a" },
      ],
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
      meaningId: "dont:diamonds-major-hearts-pass",
      semanticClassId: DONT_CLASSES.SHOW_HIGHER_SUIT,
      encoding: { defaultCall: { type: "pass" } },
      clauses: [
        {
          factId: "module.dont.diamondsMajorHearts",
          operator: "boolean",
          value: true,
        },
      ],
      band: "must",
      intraModuleOrder: 0,
      sourceIntent: { type: "DONTShowHeartsFromDiamonds", params: {} },
      teachingLabel: "Pass — hearts (from 2D+major)",
      pedagogicalTags: [
        { tag: CONTINUATION_OF, scope: "dont:show-after-2d-relay", role: "a" },
      ],
    },
    DONT_CTX,
  ),

  // 2. 2S — major is spades
  createSurface(
    {
      meaningId: "dont:diamonds-major-spades-2s",
      semanticClassId: DONT_CLASSES.SHOW_HIGHER_SUIT,
      encoding: { defaultCall: bid(2, BidSuit.Spades) },
      clauses: [
        {
          factId: "module.dont.diamondsMajorSpades",
          operator: "boolean",
          value: true,
        },
      ],
      band: "must",
      intraModuleOrder: 1,
      sourceIntent: { type: "DONTShowSpadesFromDiamonds", params: {} },
      teachingLabel: "2S — spades (from 2D+major)",
      pedagogicalTags: [
        { tag: CONTINUATION_OF, scope: "dont:show-after-2d-relay", role: "a" },
      ],
    },
    DONT_CTX,
  ),
] as const;
