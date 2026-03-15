import type { MeaningSurface } from "../../../core/contracts/meaning-surface";
import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import { BRIDGE_SEMANTIC_CLASSES } from "../../../core/contracts/semantic-classes";
import {
  STAYMAN_CLASSES,
  TRANSFER_CLASSES,
  INTERFERENCE_CLASSES,
  STAYMAN_R3_CLASSES,
  TRANSFER_R3_CLASSES,
  SMOLEN_CLASSES,
} from "./semantic-classes";

function bid(level: 1 | 2 | 3 | 4 | 5 | 6 | 7, strain: BidSuit): Call {
  return { type: "bid", level, strain };
}

// ═══════════════════════════════════════════════════════════════
// Responder surfaces (after 1NT-P, responder is South)
// ═══════════════════════════════════════════════════════════════

export const RESPONDER_SURFACES: readonly MeaningSurface[] = [
  // 1. Stayman ask — 2C with 4-card major, 8+ HCP, no 5-card major
  {
    meaningId: "stayman:ask-major",
    semanticClassId: STAYMAN_CLASSES.ASK,
    moduleId: "stayman",
    encoding: { defaultCall: bid(2, BidSuit.Clubs) },
    clauses: [
      {
        clauseId: "hcp-8-plus",
        factId: "hand.hcp",
        operator: "gte",
        value: 8,
        description: "8+ HCP for Stayman",
      },
      {
        clauseId: "has-four-card-major",
        factId: "bridge.hasFourCardMajor",
        operator: "boolean",
        value: true,
        description: "At least one 4-card major",
        isPublic: true,
      },
      {
        clauseId: "no-five-card-major",
        factId: "bridge.hasFiveCardMajor",
        operator: "boolean",
        value: false,
        description: "No 5-card major (prefer transfer)",
      },
    ],
    ranking: {
      recommendationBand: "should",
      specificity: 2,
      modulePrecedence: 1,
      intraModuleOrder: 0,
    },
    priorityClass: "preferredConventional",
    sourceIntent: { type: "StaymanAsk", params: {} },
    teachingLabel: "Stayman 2C",
  },

  // 2. Transfer to hearts — 2D with 5+ hearts
  //    Higher specificity than Stayman (5-card > 4-card), lower modulePrecedence (Jacoby wins ties)
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
      specificity: 3,
      modulePrecedence: 0,
      intraModuleOrder: 1,
    },
    priorityClass: "preferredConventional",
    sourceIntent: { type: "TransferToHearts", params: {} },
    teachingLabel: "Transfer to hearts",
  },

  // 3. Transfer to spades — 2H with 5+ spades
  //    intraModuleOrder 0: spades checked first (matches existing tree).
  //    With 5-5 majors, spades wins via lower intraModuleOrder.
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
      specificity: 3,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    priorityClass: "preferredConventional",
    sourceIntent: { type: "TransferToSpades", params: {} },
    teachingLabel: "Transfer to spades",
  },

  // 4. NT invite — 2NT with invite values, no 4-card or 5-card major
  {
    meaningId: "bridge:nt-invite",
    semanticClassId: BRIDGE_SEMANTIC_CLASSES.NT_INVITE,
    moduleId: "natural-nt",
    encoding: { defaultCall: bid(2, BidSuit.NoTrump) },
    clauses: [
      {
        clauseId: "invite-values",
        factId: "module.ntResponse.inviteValues",
        operator: "boolean",
        value: true,
        description: "Invite values opposite 1NT (8-9 HCP)",
      },
      {
        clauseId: "no-four-card-major",
        factId: "bridge.hasFourCardMajor",
        operator: "boolean",
        value: false,
        description: "No 4-card major",
      },
      {
        clauseId: "no-five-card-major",
        factId: "bridge.hasFiveCardMajor",
        operator: "boolean",
        value: false,
        description: "No 5-card major",
      },
    ],
    ranking: {
      recommendationBand: "may",
      specificity: 1,
      modulePrecedence: 2,
      intraModuleOrder: 0,
    },
    priorityClass: "neutralCorrect",
    sourceIntent: { type: "NTInvite", params: {} },
    teachingLabel: "NT invite",
  },

  // 5. NT game — 3NT with game values, no 4-card or 5-card major
  {
    meaningId: "bridge:to-3nt",
    semanticClassId: BRIDGE_SEMANTIC_CLASSES.NT_GAME,
    moduleId: "natural-nt",
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
        clauseId: "no-four-card-major",
        factId: "bridge.hasFourCardMajor",
        operator: "boolean",
        value: false,
        description: "No 4-card major",
      },
      {
        clauseId: "no-five-card-major",
        factId: "bridge.hasFiveCardMajor",
        operator: "boolean",
        value: false,
        description: "No 5-card major",
      },
    ],
    ranking: {
      recommendationBand: "may",
      specificity: 1,
      modulePrecedence: 2,
      intraModuleOrder: 1,
    },
    priorityClass: "neutralCorrect",
    sourceIntent: { type: "NTGame", params: {} },
    teachingLabel: "3NT game",
  },
];

// ═══════════════════════════════════════════════════════════════
// Opener Stayman response surfaces (after 1NT-P-2C-P, opener is North)
// ═══════════════════════════════════════════════════════════════

export const OPENER_STAYMAN_SURFACES: readonly MeaningSurface[] = [
  // 6. Show hearts — 2H with 4+ hearts (checked first, like existing tree)
  {
    meaningId: "stayman:show-hearts",
    semanticClassId: STAYMAN_CLASSES.SHOW_HEARTS,
    moduleId: "stayman",
    encoding: { defaultCall: bid(2, BidSuit.Hearts) },
    clauses: [
      {
        clauseId: "hearts-4-plus",
        factId: "hand.suitLength.hearts",
        operator: "gte",
        value: 4,
        description: "4+ hearts to show",
      },
    ],
    ranking: {
      recommendationBand: "must",
      specificity: 2,
      modulePrecedence: 1,
      intraModuleOrder: 0,
    },
    priorityClass: "obligatory",
    sourceIntent: { type: "ShowHeldSuit", params: { suit: "hearts" } },
    teachingLabel: "Show hearts",
    closurePolicy: {
      exclusive: true,
      exhaustive: true,
      mandatory: true,
      domain: {
        kind: "semantic-class-set",
        ids: [
          STAYMAN_CLASSES.SHOW_HEARTS,
          STAYMAN_CLASSES.SHOW_SPADES,
          STAYMAN_CLASSES.DENY_MAJOR,
        ],
      },
    },
  },

  // 7. Show spades — 2S with 4+ spades
  {
    meaningId: "stayman:show-spades",
    semanticClassId: STAYMAN_CLASSES.SHOW_SPADES,
    moduleId: "stayman",
    encoding: { defaultCall: bid(2, BidSuit.Spades) },
    clauses: [
      {
        clauseId: "spades-4-plus",
        factId: "hand.suitLength.spades",
        operator: "gte",
        value: 4,
        description: "4+ spades to show",
      },
    ],
    ranking: {
      recommendationBand: "must",
      specificity: 2,
      modulePrecedence: 1,
      intraModuleOrder: 1,
    },
    priorityClass: "obligatory",
    sourceIntent: { type: "ShowHeldSuit", params: { suit: "spades" } },
    teachingLabel: "Show spades",
    closurePolicy: {
      exclusive: true,
      exhaustive: true,
      mandatory: true,
      domain: {
        kind: "semantic-class-set",
        ids: [
          STAYMAN_CLASSES.SHOW_HEARTS,
          STAYMAN_CLASSES.SHOW_SPADES,
          STAYMAN_CLASSES.DENY_MAJOR,
        ],
      },
    },
  },

  // 8. Deny major — 2D with no 4-card major
  {
    meaningId: "stayman:deny-major",
    semanticClassId: STAYMAN_CLASSES.DENY_MAJOR,
    moduleId: "stayman",
    encoding: { defaultCall: bid(2, BidSuit.Diamonds) },
    clauses: [
      {
        clauseId: "no-four-card-major",
        factId: "bridge.hasFourCardMajor",
        operator: "boolean",
        value: false,
        description: "No 4-card major to show",
      },
    ],
    ranking: {
      recommendationBand: "must",
      specificity: 1,
      modulePrecedence: 1,
      intraModuleOrder: 2,
    },
    priorityClass: "obligatory",
    sourceIntent: { type: "DenyMajor", params: {} },
    teachingLabel: "Deny major (2D)",
    closurePolicy: {
      exclusive: true,
      exhaustive: true,
      mandatory: true,
      domain: {
        kind: "semantic-class-set",
        ids: [
          STAYMAN_CLASSES.SHOW_HEARTS,
          STAYMAN_CLASSES.SHOW_SPADES,
          STAYMAN_CLASSES.DENY_MAJOR,
        ],
      },
    },
    denies: [
      { factId: "bridge.hasFourCardMajor", operator: "boolean", value: true },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// Opener transfer accept surface (after 1NT-P-2D-P, opener is North)
// ═══════════════════════════════════════════════════════════════

export const OPENER_TRANSFER_HEARTS_SURFACES: readonly MeaningSurface[] = [
  // 9. Accept transfer — 2H (mandatory, always)
  {
    meaningId: "transfer:accept",
    semanticClassId: TRANSFER_CLASSES.ACCEPT,
    moduleId: "jacoby-transfers",
    encoding: { defaultCall: bid(2, BidSuit.Hearts) },
    clauses: [],
    ranking: {
      recommendationBand: "must",
      specificity: 0,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    priorityClass: "obligatory",
    sourceIntent: { type: "AcceptTransfer", params: { suit: "hearts" } },
    teachingLabel: "Accept transfer to hearts",
  },
];

// ═══════════════════════════════════════════════════════════════
// Opener transfer accept — spades (after 1NT-P-2H-P, opener is North)
// ═══════════════════════════════════════════════════════════════

export const OPENER_TRANSFER_SPADES_SURFACES: readonly MeaningSurface[] = [
  {
    meaningId: "transfer:accept-spades",
    semanticClassId: TRANSFER_CLASSES.ACCEPT_SPADES,
    moduleId: "jacoby-transfers",
    encoding: { defaultCall: bid(2, BidSuit.Spades) },
    clauses: [],
    ranking: {
      recommendationBand: "must",
      specificity: 0,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    priorityClass: "obligatory",
    sourceIntent: { type: "AcceptTransfer", params: { suit: "spades" } },
    teachingLabel: "Accept transfer to spades",
  },
];

// ═══════════════════════════════════════════════════════════════
// Stayman R3 — After opener shows hearts (1NT-P-2C-P-2H-P)
// ═══════════════════════════════════════════════════════════════

export const STAYMAN_R3_AFTER_2H_SURFACES: readonly MeaningSurface[] = [
  // Game with heart fit: 10+ HCP, 4+ hearts
  {
    meaningId: "stayman:raise-game-hearts",
    semanticClassId: STAYMAN_R3_CLASSES.RAISE_GAME,
    moduleId: "stayman",
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
        clauseId: "hearts-4-plus",
        factId: "hand.suitLength.hearts",
        operator: "gte",
        value: 4,
        description: "4+ hearts (fit with opener)",
      },
    ],
    ranking: {
      recommendationBand: "must",
      specificity: 3,
      modulePrecedence: 1,
      intraModuleOrder: 0,
    },
    priorityClass: "obligatory",
    sourceIntent: { type: "RaiseGame", params: { suit: "hearts" } },
    teachingLabel: "Raise to game in hearts",
  },

  // Invite with heart fit: 8-9 HCP, 4+ hearts
  {
    meaningId: "stayman:raise-invite-hearts",
    semanticClassId: STAYMAN_R3_CLASSES.RAISE_INVITE,
    moduleId: "stayman",
    encoding: { defaultCall: bid(3, BidSuit.Hearts) },
    clauses: [
      {
        clauseId: "invite-values",
        factId: "module.ntResponse.inviteValues",
        operator: "boolean",
        value: true,
        description: "Invite values opposite 1NT (8-9 HCP)",
      },
      {
        clauseId: "hearts-4-plus",
        factId: "hand.suitLength.hearts",
        operator: "gte",
        value: 4,
        description: "4+ hearts (fit with opener)",
      },
    ],
    ranking: {
      recommendationBand: "should",
      specificity: 3,
      modulePrecedence: 1,
      intraModuleOrder: 1,
    },
    priorityClass: "preferredConventional",
    sourceIntent: { type: "RaiseInvite", params: { suit: "hearts" } },
    teachingLabel: "Invite in hearts",
  },

  // Game no fit: 10+ HCP, <4 hearts
  {
    meaningId: "stayman:nt-game-no-fit",
    semanticClassId: STAYMAN_R3_CLASSES.NT_GAME_NO_FIT,
    moduleId: "stayman",
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
        clauseId: "hearts-less-than-4",
        factId: "hand.suitLength.hearts",
        operator: "lte",
        value: 3,
        description: "Less than 4 hearts (no fit)",
      },
    ],
    ranking: {
      recommendationBand: "should",
      specificity: 2,
      modulePrecedence: 1,
      intraModuleOrder: 2,
    },
    priorityClass: "preferredConventional",
    sourceIntent: { type: "NTGame", params: { reason: "no-heart-fit" } },
    teachingLabel: "3NT (no heart fit)",
  },

  // Invite no fit: 8-9 HCP, <4 hearts
  {
    meaningId: "stayman:nt-invite-no-fit",
    semanticClassId: STAYMAN_R3_CLASSES.NT_INVITE_NO_FIT,
    moduleId: "stayman",
    encoding: { defaultCall: bid(2, BidSuit.NoTrump) },
    clauses: [
      {
        clauseId: "invite-values",
        factId: "module.ntResponse.inviteValues",
        operator: "boolean",
        value: true,
        description: "Invite values opposite 1NT (8-9 HCP)",
      },
      {
        clauseId: "hearts-less-than-4",
        factId: "hand.suitLength.hearts",
        operator: "lte",
        value: 3,
        description: "Less than 4 hearts (no fit)",
      },
    ],
    ranking: {
      recommendationBand: "may",
      specificity: 2,
      modulePrecedence: 1,
      intraModuleOrder: 3,
    },
    priorityClass: "neutralCorrect",
    sourceIntent: { type: "NTInvite", params: { reason: "no-heart-fit" } },
    teachingLabel: "2NT invite (no heart fit)",
  },
];

// ═══════════════════════════════════════════════════════════════
// Stayman R3 — After opener shows spades (1NT-P-2C-P-2S-P)
// ═══════════════════════════════════════════════════════════════

export const STAYMAN_R3_AFTER_2S_SURFACES: readonly MeaningSurface[] = [
  {
    meaningId: "stayman:raise-game-spades",
    semanticClassId: STAYMAN_R3_CLASSES.RAISE_GAME,
    moduleId: "stayman",
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
        clauseId: "spades-4-plus",
        factId: "hand.suitLength.spades",
        operator: "gte",
        value: 4,
        description: "4+ spades (fit with opener)",
      },
    ],
    ranking: {
      recommendationBand: "must",
      specificity: 3,
      modulePrecedence: 1,
      intraModuleOrder: 0,
    },
    priorityClass: "obligatory",
    sourceIntent: { type: "RaiseGame", params: { suit: "spades" } },
    teachingLabel: "Raise to game in spades",
  },

  {
    meaningId: "stayman:raise-invite-spades",
    semanticClassId: STAYMAN_R3_CLASSES.RAISE_INVITE,
    moduleId: "stayman",
    encoding: { defaultCall: bid(3, BidSuit.Spades) },
    clauses: [
      {
        clauseId: "invite-values",
        factId: "module.ntResponse.inviteValues",
        operator: "boolean",
        value: true,
        description: "Invite values opposite 1NT (8-9 HCP)",
      },
      {
        clauseId: "spades-4-plus",
        factId: "hand.suitLength.spades",
        operator: "gte",
        value: 4,
        description: "4+ spades (fit with opener)",
      },
    ],
    ranking: {
      recommendationBand: "should",
      specificity: 3,
      modulePrecedence: 1,
      intraModuleOrder: 1,
    },
    priorityClass: "preferredConventional",
    sourceIntent: { type: "RaiseInvite", params: { suit: "spades" } },
    teachingLabel: "Invite in spades",
  },

  {
    meaningId: "stayman:nt-game-no-fit-2s",
    semanticClassId: STAYMAN_R3_CLASSES.NT_GAME_NO_FIT,
    moduleId: "stayman",
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
        clauseId: "spades-less-than-4",
        factId: "hand.suitLength.spades",
        operator: "lte",
        value: 3,
        description: "Less than 4 spades (no fit)",
      },
    ],
    ranking: {
      recommendationBand: "should",
      specificity: 2,
      modulePrecedence: 1,
      intraModuleOrder: 2,
    },
    priorityClass: "preferredConventional",
    sourceIntent: { type: "NTGame", params: { reason: "no-spade-fit" } },
    teachingLabel: "3NT (no spade fit)",
  },

  {
    meaningId: "stayman:nt-invite-no-fit-2s",
    semanticClassId: STAYMAN_R3_CLASSES.NT_INVITE_NO_FIT,
    moduleId: "stayman",
    encoding: { defaultCall: bid(2, BidSuit.NoTrump) },
    clauses: [
      {
        clauseId: "invite-values",
        factId: "module.ntResponse.inviteValues",
        operator: "boolean",
        value: true,
        description: "Invite values opposite 1NT (8-9 HCP)",
      },
      {
        clauseId: "spades-less-than-4",
        factId: "hand.suitLength.spades",
        operator: "lte",
        value: 3,
        description: "Less than 4 spades (no fit)",
      },
    ],
    ranking: {
      recommendationBand: "may",
      specificity: 2,
      modulePrecedence: 1,
      intraModuleOrder: 3,
    },
    priorityClass: "neutralCorrect",
    sourceIntent: { type: "NTInvite", params: { reason: "no-spade-fit" } },
    teachingLabel: "2NT invite (no spade fit)",
  },
];

// ═══════════════════════════════════════════════════════════════
// Stayman R3 — After 2D denial (1NT-P-2C-P-2D-P)
// ═══════════════════════════════════════════════════════════════

export const STAYMAN_R3_AFTER_2D_SURFACES: readonly MeaningSurface[] = [
  {
    meaningId: "stayman:nt-game-after-denial",
    semanticClassId: STAYMAN_R3_CLASSES.NT_GAME_DENIAL,
    moduleId: "stayman",
    encoding: { defaultCall: bid(3, BidSuit.NoTrump) },
    clauses: [
      {
        clauseId: "game-values",
        factId: "module.ntResponse.gameValues",
        operator: "boolean",
        value: true,
        description: "Game values opposite 1NT (10+ HCP)",
      },
    ],
    ranking: {
      recommendationBand: "must",
      specificity: 1,
      modulePrecedence: 1,
      intraModuleOrder: 0,
    },
    priorityClass: "obligatory",
    sourceIntent: { type: "NTGame", params: { reason: "denial" } },
    teachingLabel: "3NT after denial",
  },

  {
    meaningId: "stayman:nt-invite-after-denial",
    semanticClassId: STAYMAN_R3_CLASSES.NT_INVITE_DENIAL,
    moduleId: "stayman",
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
      specificity: 1,
      modulePrecedence: 1,
      intraModuleOrder: 1,
    },
    priorityClass: "preferredConventional",
    sourceIntent: { type: "NTInvite", params: { reason: "denial" } },
    teachingLabel: "2NT invite after denial",
  },

  // Smolen 3H: 10+ HCP, 4 spades + 5 hearts (game-forcing, bids short major)
  {
    meaningId: "smolen:bid-short-hearts",
    semanticClassId: SMOLEN_CLASSES.BID_SHORT_HEARTS,
    moduleId: "smolen",
    encoding: { defaultCall: bid(3, BidSuit.Hearts) },
    clauses: [
      {
        clauseId: "game-values",
        factId: "module.ntResponse.gameValues",
        operator: "boolean",
        value: true,
        description: "Game values opposite 1NT (10+ HCP)",
      },
      {
        clauseId: "five-hearts",
        factId: "module.smolen.hasFiveHearts",
        operator: "boolean",
        value: true,
        description: "5+ hearts",
      },
      {
        clauseId: "four-spades",
        factId: "module.smolen.hasFourSpades",
        operator: "boolean",
        value: true,
        description: "Exactly 4 spades",
      },
    ],
    ranking: {
      recommendationBand: "must",
      specificity: 3,
      modulePrecedence: 1,
      intraModuleOrder: 0,
    },
    priorityClass: "preferredConventional",
    sourceIntent: { type: "Smolen", params: { longMajor: "hearts" } },
    teachingLabel: "Smolen 3H (5H + 4S, game force)",
  },

  // Smolen 3S: 10+ HCP, 5 spades + 4 hearts (game-forcing, bids short major)
  {
    meaningId: "smolen:bid-short-spades",
    semanticClassId: SMOLEN_CLASSES.BID_SHORT_SPADES,
    moduleId: "smolen",
    encoding: { defaultCall: bid(3, BidSuit.Spades) },
    clauses: [
      {
        clauseId: "game-values",
        factId: "module.ntResponse.gameValues",
        operator: "boolean",
        value: true,
        description: "Game values opposite 1NT (10+ HCP)",
      },
      {
        clauseId: "five-spades",
        factId: "module.smolen.hasFiveSpades",
        operator: "boolean",
        value: true,
        description: "5+ spades",
      },
      {
        clauseId: "four-hearts",
        factId: "module.smolen.hasFourHearts",
        operator: "boolean",
        value: true,
        description: "Exactly 4 hearts",
      },
    ],
    ranking: {
      recommendationBand: "must",
      specificity: 3,
      modulePrecedence: 1,
      intraModuleOrder: 1,
    },
    priorityClass: "preferredConventional",
    sourceIntent: { type: "Smolen", params: { longMajor: "spades" } },
    teachingLabel: "Smolen 3S (5S + 4H, game force)",
  },
];

// ═══════════════════════════════════════════════════════════════
// Smolen R4 — Opener placement after Smolen (1NT-P-2C-P-2D-P-3H/3S-P)
// ═══════════════════════════════════════════════════════════════

export const OPENER_SMOLEN_HEARTS_SURFACES: readonly MeaningSurface[] = [
  // Opener has 3+ hearts → place 4H (major fit)
  {
    meaningId: "smolen:place-four-hearts",
    semanticClassId: SMOLEN_CLASSES.PLACE_FOUR_HEARTS,
    moduleId: "smolen",
    encoding: { defaultCall: bid(4, BidSuit.Hearts) },
    clauses: [
      {
        clauseId: "heart-fit",
        factId: "module.smolen.openerHasHeartFit",
        operator: "boolean",
        value: true,
        description: "Opener has 3+ hearts (fit with responder's 5)",
      },
    ],
    ranking: {
      recommendationBand: "must",
      specificity: 2,
      modulePrecedence: 1,
      intraModuleOrder: 0,
    },
    priorityClass: "obligatory",
    sourceIntent: { type: "SmolenPlacement", params: { suit: "hearts" } },
    teachingLabel: "4H (heart fit found)",
  },
  // Opener has <3 hearts → place 3NT (no fit)
  {
    meaningId: "smolen:place-three-nt-no-heart-fit",
    semanticClassId: SMOLEN_CLASSES.PLACE_THREE_NT,
    moduleId: "smolen",
    encoding: { defaultCall: bid(3, BidSuit.NoTrump) },
    clauses: [
      {
        clauseId: "no-heart-fit",
        factId: "module.smolen.openerHasHeartFit",
        operator: "boolean",
        value: false,
        description: "Opener has fewer than 3 hearts (no fit)",
      },
    ],
    ranking: {
      recommendationBand: "must",
      specificity: 1,
      modulePrecedence: 1,
      intraModuleOrder: 1,
    },
    priorityClass: "obligatory",
    sourceIntent: { type: "SmolenPlacement", params: { suit: "notrump" } },
    teachingLabel: "3NT (no heart fit)",
  },
];

export const OPENER_SMOLEN_SPADES_SURFACES: readonly MeaningSurface[] = [
  // Opener has 3+ spades → place 4S (major fit)
  {
    meaningId: "smolen:place-four-spades",
    semanticClassId: SMOLEN_CLASSES.PLACE_FOUR_SPADES,
    moduleId: "smolen",
    encoding: { defaultCall: bid(4, BidSuit.Spades) },
    clauses: [
      {
        clauseId: "spade-fit",
        factId: "module.smolen.openerHasSpadesFit",
        operator: "boolean",
        value: true,
        description: "Opener has 3+ spades (fit with responder's 5)",
      },
    ],
    ranking: {
      recommendationBand: "must",
      specificity: 2,
      modulePrecedence: 1,
      intraModuleOrder: 0,
    },
    priorityClass: "obligatory",
    sourceIntent: { type: "SmolenPlacement", params: { suit: "spades" } },
    teachingLabel: "4S (spade fit found)",
  },
  // Opener has <3 spades → place 3NT (no fit)
  {
    meaningId: "smolen:place-three-nt-no-spade-fit",
    semanticClassId: SMOLEN_CLASSES.PLACE_THREE_NT,
    moduleId: "smolen",
    encoding: { defaultCall: bid(3, BidSuit.NoTrump) },
    clauses: [
      {
        clauseId: "no-spade-fit",
        factId: "module.smolen.openerHasSpadesFit",
        operator: "boolean",
        value: false,
        description: "Opener has fewer than 3 spades (no fit)",
      },
    ],
    ranking: {
      recommendationBand: "must",
      specificity: 1,
      modulePrecedence: 1,
      intraModuleOrder: 1,
    },
    priorityClass: "obligatory",
    sourceIntent: { type: "SmolenPlacement", params: { suit: "notrump" } },
    teachingLabel: "3NT (no spade fit)",
  },
];

// ═══════════════════════════════════════════════════════════════
// Transfer R3 — After hearts accept (1NT-P-2D-P-2H-P)
// ═══════════════════════════════════════════════════════════════

export const TRANSFER_R3_HEARTS_SURFACES: readonly MeaningSurface[] = [
  // Signoff: <8 HCP (weak, completed transfer)
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
      specificity: 1,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    priorityClass: "obligatory",
    sourceIntent: { type: "Signoff", params: { suit: "hearts" } },
    teachingLabel: "Pass (signoff in hearts)",
  },

  // Game in major: 10+ HCP, 6+ hearts
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
      specificity: 3,
      modulePrecedence: 0,
      intraModuleOrder: 1,
    },
    priorityClass: "obligatory",
    sourceIntent: { type: "GameInMajor", params: { suit: "hearts" } },
    teachingLabel: "4H game",
  },

  // Game in NT: 10+ HCP, exactly 5 hearts
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
      specificity: 2,
      modulePrecedence: 0,
      intraModuleOrder: 2,
    },
    priorityClass: "preferredConventional",
    sourceIntent: { type: "NTGame", params: { suit: "hearts" } },
    teachingLabel: "3NT (5 hearts, let opener choose)",
  },

  // Invite: 8-9 HCP
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
      specificity: 1,
      modulePrecedence: 0,
      intraModuleOrder: 3,
    },
    priorityClass: "preferredConventional",
    sourceIntent: { type: "Invite", params: { suit: "hearts" } },
    teachingLabel: "2NT invite",
  },
];

// ═══════════════════════════════════════════════════════════════
// Transfer R3 — After spades accept (1NT-P-2H-P-2S-P)
// ═══════════════════════════════════════════════════════════════

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
      specificity: 1,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    priorityClass: "obligatory",
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
      specificity: 3,
      modulePrecedence: 0,
      intraModuleOrder: 1,
    },
    priorityClass: "obligatory",
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
      specificity: 2,
      modulePrecedence: 0,
      intraModuleOrder: 2,
    },
    priorityClass: "preferredConventional",
    sourceIntent: { type: "NTGame", params: { suit: "spades" } },
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
      specificity: 1,
      modulePrecedence: 0,
      intraModuleOrder: 3,
    },
    priorityClass: "preferredConventional",
    sourceIntent: { type: "Invite", params: { suit: "spades" } },
    teachingLabel: "2NT invite",
  },
];

// ═══════════════════════════════════════════════════════════════
// Interference surfaces (injected via CandidateTransform)
// ═══════════════════════════════════════════════════════════════

export const INTERFERENCE_REDOUBLE_SURFACE: MeaningSurface = {
  meaningId: "interference:redouble-strength",
  semanticClassId: INTERFERENCE_CLASSES.REDOUBLE_STRENGTH,
  moduleId: "stayman",
  encoding: { defaultCall: { type: "redouble" } },
  clauses: [
    {
      clauseId: "hcp-10-plus",
      factId: "hand.hcp",
      operator: "gte",
      value: 10,
      description: "10+ HCP to redouble after opponent doubles 1NT",
    },
    {
      clauseId: "has-four-card-major",
      factId: "bridge.hasFourCardMajor",
      operator: "boolean",
      value: true,
      description: "At least one 4-card major (Stayman-like hand)",
    },
  ],
  ranking: {
    recommendationBand: "must",
    specificity: 3,
    modulePrecedence: 0,
    intraModuleOrder: 0,
  },
  priorityClass: "obligatory",
  sourceIntent: { type: "RedoubleStrength", params: {} },
  teachingLabel: "Redouble (showing 10+ HCP)",
};
