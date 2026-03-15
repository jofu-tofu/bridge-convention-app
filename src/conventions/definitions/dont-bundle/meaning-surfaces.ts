import type { MeaningSurface } from "../../../core/contracts/meaning-surface";
import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import { DONT_CLASSES } from "./semantic-classes";

function bid(level: 1 | 2 | 3 | 4 | 5 | 6 | 7, strain: BidSuit): Call {
  return { type: "bid", level, strain };
}

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

export const DONT_R1_SURFACES: readonly MeaningSurface[] = [
  // 1. 2H — both majors (5-4+ either way)
  {
    meaningId: "dont:both-majors-2h",
    semanticClassId: DONT_CLASSES.BOTH_MAJORS,
    moduleId: "dont",
    encoding: { defaultCall: bid(2, BidSuit.Hearts) },
    clauses: [
      {
        clauseId: "both-majors",
        factId: "module.dont.bothMajors",
        operator: "boolean" as const,
        value: true,
        description: "H5+S4+ or S5+H4+",
      },
    ],
    ranking: {
      recommendationBand: "must" as const,
      specificity: 3,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    priorityClass: "obligatory" as const,
    sourceIntent: { type: "DONTBothMajors", params: {} },
    teachingLabel: "2H — both majors",
  },

  // 2. 2D — diamonds + a major
  {
    meaningId: "dont:diamonds-major-2d",
    semanticClassId: DONT_CLASSES.DIAMONDS_AND_MAJOR,
    moduleId: "dont",
    encoding: { defaultCall: bid(2, BidSuit.Diamonds) },
    clauses: [
      {
        clauseId: "diamonds-and-major",
        factId: "module.dont.diamondsAndMajor",
        operator: "boolean" as const,
        value: true,
        description: "D5+ and (H4+ or S4+)",
      },
    ],
    ranking: {
      recommendationBand: "must" as const,
      specificity: 3,
      modulePrecedence: 0,
      intraModuleOrder: 1,
    },
    priorityClass: "obligatory" as const,
    sourceIntent: { type: "DONTDiamondsMajor", params: {} },
    teachingLabel: "2D — diamonds + a major",
  },

  // 3. 2C — clubs + a higher suit
  {
    meaningId: "dont:clubs-higher-2c",
    semanticClassId: DONT_CLASSES.CLUBS_AND_HIGHER,
    moduleId: "dont",
    encoding: { defaultCall: bid(2, BidSuit.Clubs) },
    clauses: [
      {
        clauseId: "clubs-and-higher",
        factId: "module.dont.clubsAndHigher",
        operator: "boolean" as const,
        value: true,
        description: "C5+ and (D4+ or H4+ or S4+)",
      },
    ],
    ranking: {
      recommendationBand: "must" as const,
      specificity: 3,
      modulePrecedence: 0,
      intraModuleOrder: 2,
    },
    priorityClass: "obligatory" as const,
    sourceIntent: { type: "DONTClubsHigher", params: {} },
    teachingLabel: "2C — clubs + higher suit",
  },

  // 4. 2S — natural 6+ spades
  {
    meaningId: "dont:natural-spades-2s",
    semanticClassId: DONT_CLASSES.NATURAL_SPADES,
    moduleId: "dont",
    encoding: { defaultCall: bid(2, BidSuit.Spades) },
    clauses: [
      {
        clauseId: "natural-spades",
        factId: "module.dont.naturalSpades",
        operator: "boolean" as const,
        value: true,
        description: "S6+",
      },
    ],
    ranking: {
      recommendationBand: "must" as const,
      specificity: 2,
      modulePrecedence: 0,
      intraModuleOrder: 3,
    },
    priorityClass: "obligatory" as const,
    sourceIntent: { type: "DONTNaturalSpades", params: {} },
    teachingLabel: "2S — natural spades",
  },

  // 5. X (double) — single suited, one suit 6+, not spades
  {
    meaningId: "dont:single-suited-double",
    semanticClassId: DONT_CLASSES.SINGLE_SUITED,
    moduleId: "dont",
    encoding: { defaultCall: { type: "double" } },
    clauses: [
      {
        clauseId: "single-suited",
        factId: "module.dont.singleSuited",
        operator: "boolean" as const,
        value: true,
        description: "One suit 6+, no other 4+, not spades",
      },
    ],
    ranking: {
      recommendationBand: "must" as const,
      specificity: 2,
      modulePrecedence: 0,
      intraModuleOrder: 4,
    },
    priorityClass: "obligatory" as const,
    sourceIntent: { type: "DONTSingleSuited", params: {} },
    teachingLabel: "X — single suited (not spades)",
  },

  // 6. Pass — no DONT bid applies (fallback)
  {
    meaningId: "dont:overcaller-pass",
    semanticClassId: DONT_CLASSES.OVERCALLER_PASS,
    moduleId: "dont",
    encoding: { defaultCall: { type: "pass" } },
    clauses: [],
    ranking: {
      recommendationBand: "avoid" as const,
      specificity: 0,
      modulePrecedence: 0,
      intraModuleOrder: 5,
    },
    priorityClass: "fallbackCorrect" as const,
    sourceIntent: { type: "DONTPass", params: {} },
    teachingLabel: "Pass (no DONT bid)",
  },
];

// ─── Advancer after 2H (both majors) ───────────────────────
//
// Pass = accept hearts (3+ support)
// 2S = prefer spades (catch-all for no heart support)
// 3C = escape with long clubs
// 3D = escape with long diamonds

export const DONT_ADVANCER_2H_SURFACES: readonly MeaningSurface[] = [
  // 1. Pass — accept hearts
  {
    meaningId: "dont:accept-hearts-pass",
    semanticClassId: DONT_CLASSES.ACCEPT_SUIT,
    moduleId: "dont",
    encoding: { defaultCall: { type: "pass" } },
    clauses: [
      {
        clauseId: "heart-support",
        factId: "module.dont.hasHeartSupport",
        operator: "boolean" as const,
        value: true,
        description: "3+ hearts",
      },
    ],
    ranking: {
      recommendationBand: "must" as const,
      specificity: 2,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    priorityClass: "obligatory" as const,
    sourceIntent: { type: "DONTAcceptHearts", params: {} },
    teachingLabel: "Pass — accept hearts",
  },

  // 2. 2S — prefer spades (no heart support catch-all)
  {
    meaningId: "dont:prefer-spades-2s",
    semanticClassId: DONT_CLASSES.PREFER_SPADES,
    moduleId: "dont",
    encoding: { defaultCall: bid(2, BidSuit.Spades) },
    clauses: [],
    ranking: {
      recommendationBand: "should" as const,
      specificity: 0,
      modulePrecedence: 0,
      intraModuleOrder: 1,
    },
    priorityClass: "preferredConventional" as const,
    sourceIntent: { type: "DONTPreferSpades", params: {} },
    teachingLabel: "2S — prefer spades",
  },

  // 3. 3C — escape with long clubs
  {
    meaningId: "dont:escape-clubs-3c",
    semanticClassId: DONT_CLASSES.ESCAPE_MINOR,
    moduleId: "dont",
    encoding: { defaultCall: bid(3, BidSuit.Clubs) },
    clauses: [
      {
        clauseId: "long-minor-clubs",
        factId: "module.dont.longMinorIsClubs",
        operator: "boolean" as const,
        value: true,
        description: "6+ clubs (longer minor)",
      },
    ],
    ranking: {
      recommendationBand: "should" as const,
      specificity: 3,
      modulePrecedence: 0,
      intraModuleOrder: 2,
    },
    priorityClass: "preferredConventional" as const,
    sourceIntent: { type: "DONTEscapeClubs", params: {} },
    teachingLabel: "3C — minor escape",
  },

  // 4. 3D — escape with long diamonds
  {
    meaningId: "dont:escape-diamonds-3d",
    semanticClassId: DONT_CLASSES.ESCAPE_MINOR,
    moduleId: "dont",
    encoding: { defaultCall: bid(3, BidSuit.Diamonds) },
    clauses: [
      {
        clauseId: "long-minor-diamonds",
        factId: "module.dont.longMinorIsDiamonds",
        operator: "boolean" as const,
        value: true,
        description: "6+ diamonds (longer minor)",
      },
    ],
    ranking: {
      recommendationBand: "should" as const,
      specificity: 3,
      modulePrecedence: 0,
      intraModuleOrder: 3,
    },
    priorityClass: "preferredConventional" as const,
    sourceIntent: { type: "DONTEscapeDiamonds", params: {} },
    teachingLabel: "3D — minor escape",
  },
];

// ─── Advancer after 2D (diamonds + major) ───────────────────
//
// Pass = accept diamonds (3+ support)
// 2H = relay asking for the major (catch-all)

export const DONT_ADVANCER_2D_SURFACES: readonly MeaningSurface[] = [
  // 1. Pass — accept diamonds
  {
    meaningId: "dont:accept-diamonds-pass",
    semanticClassId: DONT_CLASSES.ACCEPT_SUIT,
    moduleId: "dont",
    encoding: { defaultCall: { type: "pass" } },
    clauses: [
      {
        clauseId: "diamond-support",
        factId: "module.dont.hasDiamondSupport",
        operator: "boolean" as const,
        value: true,
        description: "3+ diamonds",
      },
    ],
    ranking: {
      recommendationBand: "must" as const,
      specificity: 2,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    priorityClass: "obligatory" as const,
    sourceIntent: { type: "DONTAcceptDiamonds", params: {} },
    teachingLabel: "Pass — accept diamonds",
  },

  // 2. 2H — relay asking for the major
  {
    meaningId: "dont:relay-2h-after-2d",
    semanticClassId: DONT_CLASSES.RELAY_ASK,
    moduleId: "dont",
    encoding: { defaultCall: bid(2, BidSuit.Hearts) },
    clauses: [],
    ranking: {
      recommendationBand: "should" as const,
      specificity: 0,
      modulePrecedence: 0,
      intraModuleOrder: 1,
    },
    priorityClass: "preferredConventional" as const,
    sourceIntent: { type: "DONTRelayAskMajor", params: {} },
    teachingLabel: "2H — relay (ask for major)",
  },
];

// ─── Advancer after 2C (clubs + higher) ─────────────────────
//
// Pass = accept clubs (3+ support)
// 2D = relay asking for higher suit (catch-all)

export const DONT_ADVANCER_2C_SURFACES: readonly MeaningSurface[] = [
  // 1. Pass — accept clubs
  {
    meaningId: "dont:accept-clubs-pass",
    semanticClassId: DONT_CLASSES.ACCEPT_SUIT,
    moduleId: "dont",
    encoding: { defaultCall: { type: "pass" } },
    clauses: [
      {
        clauseId: "club-support",
        factId: "module.dont.hasClubSupport",
        operator: "boolean" as const,
        value: true,
        description: "3+ clubs",
      },
    ],
    ranking: {
      recommendationBand: "must" as const,
      specificity: 2,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    priorityClass: "obligatory" as const,
    sourceIntent: { type: "DONTAcceptClubs", params: {} },
    teachingLabel: "Pass — accept clubs",
  },

  // 2. 2D — relay asking for higher suit
  {
    meaningId: "dont:relay-2d-after-2c",
    semanticClassId: DONT_CLASSES.RELAY_ASK,
    moduleId: "dont",
    encoding: { defaultCall: bid(2, BidSuit.Diamonds) },
    clauses: [],
    ranking: {
      recommendationBand: "should" as const,
      specificity: 0,
      modulePrecedence: 0,
      intraModuleOrder: 1,
    },
    priorityClass: "preferredConventional" as const,
    sourceIntent: { type: "DONTRelayAskHigher", params: {} },
    teachingLabel: "2D — relay (ask for higher suit)",
  },
];

// ─── Advancer after 2S (natural spades) ─────────────────────
//
// Pass = accept spades (with or without support — default)
// Pass fallback = no alternative action

export const DONT_ADVANCER_2S_SURFACES: readonly MeaningSurface[] = [
  // 1. Pass — accept spades (with support)
  {
    meaningId: "dont:accept-spades-pass",
    semanticClassId: DONT_CLASSES.ACCEPT_SUIT,
    moduleId: "dont",
    encoding: { defaultCall: { type: "pass" } },
    clauses: [
      {
        clauseId: "spade-support",
        factId: "module.dont.hasSpadeSupport",
        operator: "boolean" as const,
        value: true,
        description: "3+ spades",
      },
    ],
    ranking: {
      recommendationBand: "must" as const,
      specificity: 2,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    priorityClass: "obligatory" as const,
    sourceIntent: { type: "DONTAcceptSpades", params: {} },
    teachingLabel: "Pass — accept spades",
  },

  // 2. Pass fallback — no alternative
  {
    meaningId: "dont:accept-spades-fallback",
    semanticClassId: DONT_CLASSES.ACCEPT_SUIT,
    moduleId: "dont",
    encoding: { defaultCall: { type: "pass" } },
    clauses: [],
    ranking: {
      recommendationBand: "avoid" as const,
      specificity: 0,
      modulePrecedence: 0,
      intraModuleOrder: 1,
    },
    priorityClass: "fallbackCorrect" as const,
    sourceIntent: { type: "DONTAcceptSpadesFallback", params: {} },
    teachingLabel: "Pass (no alternative)",
  },
];

// ─── Advancer after X (double — single suited) ─────────────
//
// 2C = forced relay (must bid, unconditional)

export const DONT_ADVANCER_DOUBLE_SURFACES: readonly MeaningSurface[] = [
  {
    meaningId: "dont:forced-relay-2c",
    semanticClassId: DONT_CLASSES.FORCED_RELAY,
    moduleId: "dont",
    encoding: { defaultCall: bid(2, BidSuit.Clubs) },
    clauses: [],
    ranking: {
      recommendationBand: "must" as const,
      specificity: 0,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    priorityClass: "obligatory" as const,
    sourceIntent: { type: "DONTForcedRelay", params: {} },
    teachingLabel: "2C — forced relay after double",
  },
];

// ─── Overcaller reveal after X → 2C ────────────────────────
//
// Pass = clubs (the 6+ suit is clubs)
// 2D = diamonds
// 2H = hearts

export const DONT_REVEAL_SURFACES: readonly MeaningSurface[] = [
  // 1. Pass — reveal clubs
  {
    meaningId: "dont:reveal-clubs-pass",
    semanticClassId: DONT_CLASSES.REVEAL_CLUBS,
    moduleId: "dont",
    encoding: { defaultCall: { type: "pass" } },
    clauses: [
      {
        clauseId: "single-suit-clubs",
        factId: "module.dont.singleSuitClubs",
        operator: "boolean" as const,
        value: true,
        description: "6+ suit is clubs",
      },
    ],
    ranking: {
      recommendationBand: "must" as const,
      specificity: 2,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    priorityClass: "obligatory" as const,
    sourceIntent: { type: "DONTRevealClubs", params: {} },
    teachingLabel: "Pass — clubs",
  },

  // 2. 2D — reveal diamonds
  {
    meaningId: "dont:reveal-diamonds-2d",
    semanticClassId: DONT_CLASSES.REVEAL_DIAMONDS,
    moduleId: "dont",
    encoding: { defaultCall: bid(2, BidSuit.Diamonds) },
    clauses: [
      {
        clauseId: "single-suit-diamonds",
        factId: "module.dont.singleSuitDiamonds",
        operator: "boolean" as const,
        value: true,
        description: "6+ suit is diamonds",
      },
    ],
    ranking: {
      recommendationBand: "must" as const,
      specificity: 2,
      modulePrecedence: 0,
      intraModuleOrder: 1,
    },
    priorityClass: "obligatory" as const,
    sourceIntent: { type: "DONTRevealDiamonds", params: {} },
    teachingLabel: "2D — diamonds",
  },

  // 3. 2H — reveal hearts
  {
    meaningId: "dont:reveal-hearts-2h",
    semanticClassId: DONT_CLASSES.REVEAL_HEARTS,
    moduleId: "dont",
    encoding: { defaultCall: bid(2, BidSuit.Hearts) },
    clauses: [
      {
        clauseId: "single-suit-hearts",
        factId: "module.dont.singleSuitHearts",
        operator: "boolean" as const,
        value: true,
        description: "6+ suit is hearts",
      },
    ],
    ranking: {
      recommendationBand: "must" as const,
      specificity: 2,
      modulePrecedence: 0,
      intraModuleOrder: 2,
    },
    priorityClass: "obligatory" as const,
    sourceIntent: { type: "DONTRevealHearts", params: {} },
    teachingLabel: "2H — hearts",
  },
];

// ─── Overcaller reply after 2C → 2D relay ──────────────────
//
// Pass = diamonds (since relay was at 2D, pass to play there)
// 2H = hearts
// 2S = spades

export const DONT_2C_RELAY_SURFACES: readonly MeaningSurface[] = [
  // 1. Pass — higher suit is diamonds
  {
    meaningId: "dont:clubs-higher-diamonds-pass",
    semanticClassId: DONT_CLASSES.SHOW_HIGHER_SUIT,
    moduleId: "dont",
    encoding: { defaultCall: { type: "pass" } },
    clauses: [
      {
        clauseId: "clubs-higher-diamonds",
        factId: "module.dont.clubsHigherDiamonds",
        operator: "boolean" as const,
        value: true,
        description: "Higher suit is diamonds",
      },
    ],
    ranking: {
      recommendationBand: "must" as const,
      specificity: 2,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    priorityClass: "obligatory" as const,
    sourceIntent: { type: "DONTShowDiamonds", params: {} },
    teachingLabel: "Pass — diamonds (from 2C+higher)",
  },

  // 2. 2H — higher suit is hearts
  {
    meaningId: "dont:clubs-higher-hearts-2h",
    semanticClassId: DONT_CLASSES.SHOW_HIGHER_SUIT,
    moduleId: "dont",
    encoding: { defaultCall: bid(2, BidSuit.Hearts) },
    clauses: [
      {
        clauseId: "clubs-higher-hearts",
        factId: "module.dont.clubsHigherHearts",
        operator: "boolean" as const,
        value: true,
        description: "Higher suit is hearts",
      },
    ],
    ranking: {
      recommendationBand: "must" as const,
      specificity: 2,
      modulePrecedence: 0,
      intraModuleOrder: 1,
    },
    priorityClass: "obligatory" as const,
    sourceIntent: { type: "DONTShowHearts", params: {} },
    teachingLabel: "2H — hearts (from 2C+higher)",
  },

  // 3. 2S — higher suit is spades
  {
    meaningId: "dont:clubs-higher-spades-2s",
    semanticClassId: DONT_CLASSES.SHOW_HIGHER_SUIT,
    moduleId: "dont",
    encoding: { defaultCall: bid(2, BidSuit.Spades) },
    clauses: [
      {
        clauseId: "clubs-higher-spades",
        factId: "module.dont.clubsHigherSpades",
        operator: "boolean" as const,
        value: true,
        description: "Higher suit is spades",
      },
    ],
    ranking: {
      recommendationBand: "must" as const,
      specificity: 2,
      modulePrecedence: 0,
      intraModuleOrder: 2,
    },
    priorityClass: "obligatory" as const,
    sourceIntent: { type: "DONTShowSpades", params: {} },
    teachingLabel: "2S — spades (from 2C+higher)",
  },
];

// ─── Overcaller reply after 2D → 2H relay ──────────────────
//
// Pass = hearts (since relay was at 2H, pass to play there)
// 2S = spades

export const DONT_2D_RELAY_SURFACES: readonly MeaningSurface[] = [
  // 1. Pass — major is hearts
  {
    meaningId: "dont:diamonds-major-hearts-pass",
    semanticClassId: DONT_CLASSES.SHOW_HIGHER_SUIT,
    moduleId: "dont",
    encoding: { defaultCall: { type: "pass" } },
    clauses: [
      {
        clauseId: "diamonds-major-hearts",
        factId: "module.dont.diamondsMajorHearts",
        operator: "boolean" as const,
        value: true,
        description: "The major is hearts",
      },
    ],
    ranking: {
      recommendationBand: "must" as const,
      specificity: 2,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    priorityClass: "obligatory" as const,
    sourceIntent: { type: "DONTShowHeartsFromDiamonds", params: {} },
    teachingLabel: "Pass — hearts (from 2D+major)",
  },

  // 2. 2S — major is spades
  {
    meaningId: "dont:diamonds-major-spades-2s",
    semanticClassId: DONT_CLASSES.SHOW_HIGHER_SUIT,
    moduleId: "dont",
    encoding: { defaultCall: bid(2, BidSuit.Spades) },
    clauses: [
      {
        clauseId: "diamonds-major-spades",
        factId: "module.dont.diamondsMajorSpades",
        operator: "boolean" as const,
        value: true,
        description: "The major is spades",
      },
    ],
    ranking: {
      recommendationBand: "must" as const,
      specificity: 2,
      modulePrecedence: 0,
      intraModuleOrder: 1,
    },
    priorityClass: "obligatory" as const,
    sourceIntent: { type: "DONTShowSpadesFromDiamonds", params: {} },
    teachingLabel: "2S — spades (from 2D+major)",
  },
];
