import type { BidMeaning } from "../../../../core/contracts/meaning";

import { BidSuit } from "../../../../engine/types";
import type { SystemConfig } from "../../../../core/contracts/system-config";
import {
  SYSTEM_RESPONDER_INVITE_VALUES,
  SYSTEM_RESPONDER_GAME_VALUES,
} from "../../../../core/contracts/system-fact-vocabulary";

import { bid } from "../../../core/surface-helpers";
import { createSurface } from "../../../core/surface-builder";
import type { ModuleContext } from "../../../core/surface-builder";

import { STAYMAN_CLASSES, STAYMAN_R3_CLASSES } from "./semantic-classes";

// ─── Module context ──────────────────────────────────────────

const STAYMAN_CTX: ModuleContext = { moduleId: "stayman" };

// ─── R1 surface ──────────────────────────────────────────────

/** Factory: creates the Stayman R1 surface parameterized by system config. */
export function createStaymanR1Surface(sys: SystemConfig): BidMeaning {
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
        isPublic: true,
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
    disclosure: "standard",
    teachingLabel: "Stayman 2♣",
  }, STAYMAN_CTX);
}

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
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "ShowHeldSuit", params: { suit: "hearts" } },
    disclosure: "standard",
    teachingLabel: "Show hearts",
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
        isPublic: true,
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
    disclosure: "standard",
    teachingLabel: "Show spades",
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
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 2,
    sourceIntent: { type: "DenyMajor", params: {} },
    disclosure: "standard",
    teachingLabel: "Deny major (2♦)",
  }, STAYMAN_CTX),
];

// ─── Stayman R3 surfaces ─────────────────────────────────────

/** Factory: creates Stayman R3 surfaces after opener shows hearts, parameterized by system config. */
export function createStaymanR3After2HSurfaces(sys: SystemConfig): readonly BidMeaning[] {
  return [
  createSurface({
    meaningId: "stayman:raise-game-hearts",
    semanticClassId: STAYMAN_R3_CLASSES.RAISE_GAME,
    encoding: bid(4, BidSuit.Hearts),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        description: `Game values opposite 1NT (${sys.responderThresholds.gameMin}+ HCP)`,
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: "gte",
        value: 4,
        description: "4+ hearts (fit with opener)",
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "RaiseGame", params: { suit: "hearts" } },
    disclosure: "alert",
    teachingLabel: "Raise to game in hearts",
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
        description: `Invite values opposite 1NT (${sys.responderThresholds.inviteMin}-${sys.responderThresholds.inviteMax} HCP)`,
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: "gte",
        value: 4,
        description: "4+ hearts (fit with opener)",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 1,
    sourceIntent: { type: "RaiseInvite", params: { suit: "hearts" } },
    disclosure: "alert",
    teachingLabel: "Invite in hearts",
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
        description: `Game values opposite 1NT (${sys.responderThresholds.gameMin}+ HCP)`,
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: "lte",
        value: 3,
        description: "Less than 4 hearts (no fit)",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 2,
    sourceIntent: { type: "StaymanNTGame", params: { reason: "no-heart-fit" } },
    disclosure: "alert",
    teachingLabel: "3NT (no heart fit)",
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
        description: `Invite values opposite 1NT (${sys.responderThresholds.inviteMin}-${sys.responderThresholds.inviteMax} HCP)`,
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: "lte",
        value: 3,
        description: "Less than 4 hearts (no fit)",
        isPublic: true,
      },
    ],
    band: "may",
    declarationOrder: 3,
    sourceIntent: { type: "StaymanNTInvite", params: { reason: "no-heart-fit" } },
    disclosure: "alert",
    teachingLabel: "2NT invite (no heart fit)",
  }, STAYMAN_CTX),
  ];
}

/** Factory: creates Stayman R3 surfaces after opener shows spades, parameterized by system config. */
export function createStaymanR3After2SSurfaces(sys: SystemConfig): readonly BidMeaning[] {
  return [
  createSurface({
    meaningId: "stayman:raise-game-spades",
    semanticClassId: STAYMAN_R3_CLASSES.RAISE_GAME,
    encoding: bid(4, BidSuit.Spades),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        description: `Game values opposite 1NT (${sys.responderThresholds.gameMin}+ HCP)`,
        isPublic: true,
      },
      {
        factId: "hand.suitLength.spades",
        operator: "gte",
        value: 4,
        description: "4+ spades (fit with opener)",
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "RaiseGame", params: { suit: "spades" } },
    disclosure: "alert",
    teachingLabel: "Raise to game in spades",
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
        description: `Invite values opposite 1NT (${sys.responderThresholds.inviteMin}-${sys.responderThresholds.inviteMax} HCP)`,
        isPublic: true,
      },
      {
        factId: "hand.suitLength.spades",
        operator: "gte",
        value: 4,
        description: "4+ spades (fit with opener)",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 1,
    sourceIntent: { type: "RaiseInvite", params: { suit: "spades" } },
    disclosure: "alert",
    teachingLabel: "Invite in spades",
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
        description: `Game values opposite 1NT (${sys.responderThresholds.gameMin}+ HCP)`,
        isPublic: true,
      },
      {
        factId: "hand.suitLength.spades",
        operator: "lte",
        value: 3,
        description: "Less than 4 spades (no fit)",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 2,
    sourceIntent: { type: "StaymanNTGame", params: { reason: "no-spade-fit" } },
    disclosure: "alert",
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
        description: `Invite values opposite 1NT (${sys.responderThresholds.inviteMin}-${sys.responderThresholds.inviteMax} HCP)`,
        isPublic: true,
      },
      {
        factId: "hand.suitLength.spades",
        operator: "lte",
        value: 3,
        description: "Less than 4 spades (no fit)",
        isPublic: true,
      },
    ],
    band: "may",
    declarationOrder: 3,
    sourceIntent: { type: "StaymanNTInvite", params: { reason: "no-spade-fit" } },
    disclosure: "alert",
    teachingLabel: "2NT invite (no spade fit)",
  }, STAYMAN_CTX),
  ];
}

// Stayman R3 after 2D — ONLY the 2 Stayman surfaces (not Smolen)
/** Factory: creates Stayman R3 surfaces after opener denies a major, parameterized by system config. */
export function createStaymanR3After2DSurfaces(sys: SystemConfig): readonly BidMeaning[] {
  return [
  createSurface({
    meaningId: "stayman:nt-game-after-denial",
    semanticClassId: STAYMAN_R3_CLASSES.NT_GAME_DENIAL,
    encoding: bid(3, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        description: `Game values opposite 1NT (${sys.responderThresholds.gameMin}+ HCP)`,
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "StaymanNTGame", params: { reason: "denial" } },
    disclosure: "alert",
    teachingLabel: "3NT after denial",
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
        description: `Invite values opposite 1NT (${sys.responderThresholds.inviteMin}-${sys.responderThresholds.inviteMax} HCP)`,
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 1,
    sourceIntent: { type: "StaymanNTInvite", params: { reason: "denial" } },
    disclosure: "alert",
    teachingLabel: "2NT invite after denial",
  }, STAYMAN_CTX),
  ];
}
