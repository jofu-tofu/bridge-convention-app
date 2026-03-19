import type { MeaningSurface } from "../../../../core/contracts/meaning";
import { FORCED_CONVENTIONAL, PREFERRED_CONVENTIONAL, ACCEPTABLE_NATURAL, RESIDUAL_NATURAL } from "../../../../core/contracts/agreement-module";
import { BidSuit } from "../../../../engine/types";
import { bid } from "../../../core/surface-helpers";

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

// ─── R1 surface ──────────────────────────────────────────────

export const STAYMAN_R1_SURFACE: MeaningSurface = {
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
      description: "No 5-card major",
    },
  ],
  ranking: {
    recommendationBand: "should",
    specificity: 2,
    modulePrecedence: 1,
    intraModuleOrder: 0,
  },
  prioritySpec: PREFERRED_CONVENTIONAL,
  priorityClass: "preferredConventional",
  sourceIntent: { type: "StaymanAsk", params: {} },
  teachingLabel: "Stayman 2♣",
};

// ─── Opener Stayman response surfaces ────────────────────────

export const OPENER_STAYMAN_SURFACES: readonly MeaningSurface[] = [
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
    prioritySpec: FORCED_CONVENTIONAL,
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
    prioritySpec: FORCED_CONVENTIONAL,
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
    prioritySpec: FORCED_CONVENTIONAL,
    priorityClass: "obligatory",
    sourceIntent: { type: "DenyMajor", params: {} },
    teachingLabel: "Deny major (2♦)",
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
];

// ─── Stayman R3 surfaces ─────────────────────────────────────

export const STAYMAN_R3_AFTER_2H_SURFACES: readonly MeaningSurface[] = [
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
    prioritySpec: FORCED_CONVENTIONAL,
    priorityClass: "obligatory",
    sourceIntent: { type: "RaiseGame", params: { suit: "hearts" } },
    teachingLabel: "Raise to game in hearts",
  },

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
    prioritySpec: PREFERRED_CONVENTIONAL,
    priorityClass: "preferredConventional",
    sourceIntent: { type: "RaiseInvite", params: { suit: "hearts" } },
    teachingLabel: "Invite in hearts",
  },

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
    prioritySpec: PREFERRED_CONVENTIONAL,
    priorityClass: "preferredConventional",
    sourceIntent: { type: "NTGame", params: { reason: "no-heart-fit" } },
    teachingLabel: "3NT (no heart fit)",
  },

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
    prioritySpec: ACCEPTABLE_NATURAL,
    priorityClass: "neutralCorrect",
    sourceIntent: { type: "NTInvite", params: { reason: "no-heart-fit" } },
    teachingLabel: "2NT invite (no heart fit)",
  },
];

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
    prioritySpec: FORCED_CONVENTIONAL,
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
    prioritySpec: PREFERRED_CONVENTIONAL,
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
    prioritySpec: PREFERRED_CONVENTIONAL,
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
    prioritySpec: ACCEPTABLE_NATURAL,
    priorityClass: "neutralCorrect",
    sourceIntent: { type: "NTInvite", params: { reason: "no-spade-fit" } },
    teachingLabel: "2NT invite (no spade fit)",
  },
];

// Stayman R3 after 2D — ONLY the 2 Stayman surfaces (not Smolen)
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
    prioritySpec: FORCED_CONVENTIONAL,
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
    prioritySpec: PREFERRED_CONVENTIONAL,
    priorityClass: "preferredConventional",
    sourceIntent: { type: "NTInvite", params: { reason: "denial" } },
    teachingLabel: "2NT invite after denial",
  },
];

// ─── Interference surface ────────────────────────────────────

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
  ],
  ranking: {
    recommendationBand: "must",
    specificity: 3,
    modulePrecedence: 0,
    intraModuleOrder: 0,
  },
  prioritySpec: FORCED_CONVENTIONAL,
  priorityClass: "obligatory",
  sourceIntent: { type: "RedoubleStrength", params: {} },
  teachingLabel: "Redouble (showing 10+ HCP)",
};
