import type { BidMeaning } from "../../../pipeline/evaluation/meaning";

import { BidSuit } from "../../../../engine/types";
import type { SystemConfig } from "../../system-config";
import { bidName, bidSummary } from "../../../core/authored-text";
import {
  SYSTEM_RESPONDER_INVITE_VALUES,
  SYSTEM_RESPONDER_GAME_VALUES,
} from "../../system-fact-vocabulary";

import { bid } from "../../../core/surface-helpers";
import { createSurface, Disclosure } from "../../../core/surface-builder";
import type { ModuleContext } from "../../../core/surface-builder";

import { STAYMAN_CLASSES, STAYMAN_R3_CLASSES, STAYMAN_MEANING_IDS } from "./ids";
import { FactOperator, RecommendationBand } from "../../../pipeline/evaluation/meaning";
import { ObsSuit } from "../../../pipeline/bid-action";

// ─── Module context ──────────────────────────────────────────

const STAYMAN_CTX: ModuleContext = { moduleId: "stayman" };

// ─── R1 surface ──────────────────────────────────────────────

/** Factory: creates the Stayman R1 surface parameterized by system config. */
export function createStaymanR1Surface(sys: SystemConfig): BidMeaning {
  const minHcp = sys.responderThresholds.inviteMin;
  return createSurface({
    meaningId: STAYMAN_MEANING_IDS.ASK_MAJOR,
    semanticClassId: STAYMAN_CLASSES.ASK,
    encoding: bid(2, BidSuit.Clubs),
    clauses: [
      {
        factId: "hand.hcp",
        operator: FactOperator.Gte,
        value: minHcp,
        rationale: "for Stayman",
        isPublic: true,
      },
      {
        factId: "bridge.hasFourCardMajor",
        operator: FactOperator.Boolean,
        value: true,
        isPublic: true,
      },
      {
        factId: "bridge.hasFiveCardMajor",
        operator: FactOperator.Boolean,
        value: false,
        rationale: "transfer instead",
      },
    ],
    band: RecommendationBand.Should,
    declarationOrder: 0,
    sourceIntent: { type: "StaymanAsk", params: {} },
    disclosure: Disclosure.Standard,
    teachingLabel: { name: bidName("Stayman 2\u2663"), summary: bidSummary("Ask opener if they hold a 4-card major") },
  }, STAYMAN_CTX);
}

/** Factory: creates the Stayman R1 entry for 5-4 major invitational hands. */
export function createStaymanR1FiveFourSurface(_sys: SystemConfig): BidMeaning {
  return createSurface({
    meaningId: STAYMAN_MEANING_IDS.ASK_MAJOR,
    semanticClassId: STAYMAN_CLASSES.ASK,
    encoding: bid(2, BidSuit.Clubs),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "invite values",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: FactOperator.Gte,
        value: 4,
        isPublic: true,
      },
      {
        factId: "hand.suitLength.spades",
        operator: FactOperator.Gte,
        value: 4,
        isPublic: true,
      },
      {
        factId: "bridge.hasFiveCardMajor",
        operator: FactOperator.Boolean,
        value: true,
        rationale: "use Stayman to find the 4-4 fit",
        isPublic: true,
      },
    ],
    band: RecommendationBand.Should,
    declarationOrder: 1,
    sourceIntent: { type: "StaymanAsk", params: { reason: "five-four-majors" } },
    disclosure: Disclosure.Standard,
    teachingLabel: { name: bidName("Stayman 2\u2663"), summary: bidSummary("Seek a 4-4 major fit with 5-4 in both majors at invite strength") },
  }, STAYMAN_CTX);
}

// ─── Opener Stayman response surfaces ────────────────────────

export const OPENER_STAYMAN_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: STAYMAN_MEANING_IDS.SHOW_HEARTS,
    semanticClassId: STAYMAN_CLASSES.SHOW_HEARTS,
    encoding: bid(2, BidSuit.Hearts),
    clauses: [
      {
        factId: "hand.suitLength.hearts",
        operator: FactOperator.Gte,
        value: 4,
        isPublic: true,
      },
    ],
    band: RecommendationBand.Must,
    declarationOrder: 0,
    sourceIntent: { type: "ShowHeldSuit", params: { suit: ObsSuit.Hearts } },
    disclosure: Disclosure.Standard,
    teachingLabel: { name: bidName("Show hearts"), summary: bidSummary("Reveal a 4-card heart suit in response to Stayman") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.SHOW_SPADES,
    semanticClassId: STAYMAN_CLASSES.SHOW_SPADES,
    encoding: bid(2, BidSuit.Spades),
    clauses: [
      {
        factId: "hand.suitLength.spades",
        operator: FactOperator.Gte,
        value: 4,
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: FactOperator.Lte,
        value: 3,
        rationale: "show hearts first with both",
      },
    ],
    band: RecommendationBand.Must,
    declarationOrder: 1,
    sourceIntent: { type: "ShowHeldSuit", params: { suit: ObsSuit.Spades } },
    disclosure: Disclosure.Standard,
    teachingLabel: { name: bidName("Show spades"), summary: bidSummary("Show a 4-card spade suit, denying 4 hearts") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.DENY_MAJOR,
    semanticClassId: STAYMAN_CLASSES.DENY_MAJOR,
    encoding: bid(2, BidSuit.Diamonds),
    clauses: [
      {
        factId: "bridge.hasFourCardMajor",
        operator: FactOperator.Boolean,
        value: false,
        isPublic: true,
      },
    ],
    band: RecommendationBand.Must,
    declarationOrder: 2,
    sourceIntent: { type: "DenyMajor", params: {} },
    disclosure: Disclosure.Standard,
    teachingLabel: { name: bidName("Deny major (2♦)"), summary: bidSummary("Deny holding a 4-card major in response to Stayman") },
  }, STAYMAN_CTX),
];

// ─── Stayman R3 surfaces ─────────────────────────────────────

/** Factory: creates Stayman R3 surfaces after opener shows hearts, parameterized by system config. */
export function createStaymanR3After2HSurfaces(_sys: SystemConfig): readonly BidMeaning[] {
  return [
  createSurface({
    meaningId: STAYMAN_MEANING_IDS.RAISE_GAME_HEARTS,
    semanticClassId: STAYMAN_R3_CLASSES.RAISE_GAME,
    encoding: bid(4, BidSuit.Hearts),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "game values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: FactOperator.Gte,
        value: 4,
        rationale: "fit with opener",
        isPublic: true,
      },
    ],
    band: RecommendationBand.Must,
    declarationOrder: 0,
    sourceIntent: { type: "RaiseGame", params: { suit: ObsSuit.Hearts } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("Raise to game in hearts"), summary: bidSummary("Bid game in the confirmed 4-4 heart fit with game-going values") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.RAISE_INVITE_HEARTS,
    semanticClassId: STAYMAN_R3_CLASSES.RAISE_INVITE,
    encoding: bid(3, BidSuit.Hearts),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "invite values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: FactOperator.Gte,
        value: 4,
        rationale: "fit with opener",
        isPublic: true,
      },
    ],
    band: RecommendationBand.Should,
    declarationOrder: 1,
    sourceIntent: { type: "RaiseInvite", params: { suit: ObsSuit.Hearts } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("Invite in hearts"), summary: bidSummary("Invite game in the 4-4 heart fit, letting opener decide with minimum vs maximum") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.NT_GAME_NO_FIT,
    semanticClassId: STAYMAN_R3_CLASSES.NT_GAME_NO_FIT,
    encoding: bid(3, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "game values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: FactOperator.Lte,
        value: 3,
        rationale: "no fit",
        isPublic: true,
      },
    ],
    band: RecommendationBand.Should,
    declarationOrder: 2,
    sourceIntent: { type: "StaymanNTGame", params: { reason: "no-heart-fit" } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("3NT (no heart fit)"), summary: bidSummary("Place the contract in 3NT after opener shows hearts but responder lacks support") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.NT_INVITE_NO_FIT,
    semanticClassId: STAYMAN_R3_CLASSES.NT_INVITE_NO_FIT,
    encoding: bid(2, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "invite values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: FactOperator.Lte,
        value: 3,
        rationale: "no fit",
        isPublic: true,
      },
    ],
    band: RecommendationBand.May,
    declarationOrder: 3,
    sourceIntent: { type: "StaymanNTInvite", params: { reason: "no-heart-fit" } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("2NT invite (no heart fit)"), summary: bidSummary("Invite notrump game after opener shows hearts but responder lacks support") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.CROSS_MAJOR_INVITE_2S_AFTER_2H,
    semanticClassId: STAYMAN_R3_CLASSES.CROSS_MAJOR_INVITE,
    encoding: bid(2, BidSuit.Spades),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "invite values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.spades",
        operator: FactOperator.Gte,
        value: 5,
        rationale: "5-card spade suit",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: FactOperator.Gte,
        value: 4,
        rationale: "4 hearts (Stayman entry)",
        isPublic: true,
      },
    ],
    band: RecommendationBand.Should,
    declarationOrder: 4,
    sourceIntent: { type: "CrossMajorInvite", params: { suit: ObsSuit.Spades } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("2\u2660 invite (5\u2660 + 4\u2665)"), summary: bidSummary("Show 5 spades with invite values after opener's hearts miss the fit") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.MINOR_GF_3C_AFTER_2H,
    semanticClassId: STAYMAN_R3_CLASSES.MINOR_GF,
    encoding: bid(3, BidSuit.Clubs),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "game values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.clubs",
        operator: FactOperator.Gte,
        value: 5,
        rationale: "long club suit",
        isPublic: true,
      },
    ],
    band: RecommendationBand.May,
    declarationOrder: 5,
    sourceIntent: { type: "MinorSuitGF", params: { suit: ObsSuit.Clubs } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("3\u2663 GF (5+ clubs)"), summary: bidSummary("Force to game showing a long club suit after the heart response misses") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.MINOR_GF_3D_AFTER_2H,
    semanticClassId: STAYMAN_R3_CLASSES.MINOR_GF,
    encoding: bid(3, BidSuit.Diamonds),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "game values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.diamonds",
        operator: FactOperator.Gte,
        value: 5,
        rationale: "long diamond suit",
        isPublic: true,
      },
    ],
    band: RecommendationBand.May,
    declarationOrder: 6,
    sourceIntent: { type: "MinorSuitGF", params: { suit: ObsSuit.Diamonds } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("3\u2666 GF (5+ diamonds)"), summary: bidSummary("Force to game showing a long diamond suit after the heart response misses") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.CROSS_MAJOR_GF_3S_AFTER_2H,
    semanticClassId: STAYMAN_R3_CLASSES.CROSS_MAJOR_GF,
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
        factId: "hand.suitLength.spades",
        operator: FactOperator.Gte,
        value: 5,
        rationale: "5+ spades",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: FactOperator.Gte,
        value: 4,
        rationale: "4 hearts (Stayman entry)",
        isPublic: true,
      },
    ],
    band: RecommendationBand.Should,
    declarationOrder: 7,
    sourceIntent: { type: "CrossMajorGF", params: { suit: ObsSuit.Spades } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("3\u2660 GF (5\u2660 + 4\u2665)"), summary: bidSummary("Force to game showing 5 spades and 4 hearts after opener shows hearts") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.QUANTITATIVE_4NT_AFTER_2H,
    semanticClassId: STAYMAN_R3_CLASSES.QUANTITATIVE_4NT,
    encoding: bid(4, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "game+ values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: FactOperator.Lte,
        value: 3,
        rationale: "no heart fit",
        isPublic: true,
      },
    ],
    band: RecommendationBand.May,
    declarationOrder: 8,
    sourceIntent: { type: "Quantitative4NT", params: { reason: "no-heart-fit" } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("4NT quantitative"), summary: bidSummary("Invite slam in notrump after no heart fit is found") },
  }, STAYMAN_CTX),
  ];
}

/** Factory: creates Stayman R3 surfaces after opener shows spades, parameterized by system config. */
export function createStaymanR3After2SSurfaces(_sys: SystemConfig): readonly BidMeaning[] {
  return [
  createSurface({
    meaningId: STAYMAN_MEANING_IDS.RAISE_GAME_SPADES,
    semanticClassId: STAYMAN_R3_CLASSES.RAISE_GAME,
    encoding: bid(4, BidSuit.Spades),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "game values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.spades",
        operator: FactOperator.Gte,
        value: 4,
        rationale: "fit with opener",
        isPublic: true,
      },
    ],
    band: RecommendationBand.Must,
    declarationOrder: 0,
    sourceIntent: { type: "RaiseGame", params: { suit: ObsSuit.Spades } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("Raise to game in spades"), summary: bidSummary("Bid game in the confirmed 4-4 spade fit with game-going values") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.RAISE_INVITE_SPADES,
    semanticClassId: STAYMAN_R3_CLASSES.RAISE_INVITE,
    encoding: bid(3, BidSuit.Spades),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "invite values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.spades",
        operator: FactOperator.Gte,
        value: 4,
        rationale: "fit with opener",
        isPublic: true,
      },
    ],
    band: RecommendationBand.Should,
    declarationOrder: 1,
    sourceIntent: { type: "RaiseInvite", params: { suit: ObsSuit.Spades } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("Invite in spades"), summary: bidSummary("Invite game in the 4-4 spade fit, letting opener decide with minimum vs maximum") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.NT_GAME_NO_FIT_2S,
    semanticClassId: STAYMAN_R3_CLASSES.NT_GAME_NO_FIT,
    encoding: bid(3, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "game values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.spades",
        operator: FactOperator.Lte,
        value: 3,
        rationale: "no fit",
        isPublic: true,
      },
    ],
    band: RecommendationBand.Should,
    declarationOrder: 2,
    sourceIntent: { type: "StaymanNTGame", params: { reason: "no-spade-fit" } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("3NT (no spade fit)"), summary: bidSummary("Place the contract in 3NT after opener shows spades but responder lacks support") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.NT_INVITE_NO_FIT_2S,
    semanticClassId: STAYMAN_R3_CLASSES.NT_INVITE_NO_FIT,
    encoding: bid(2, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "invite values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.spades",
        operator: FactOperator.Lte,
        value: 3,
        rationale: "no fit",
        isPublic: true,
      },
    ],
    band: RecommendationBand.May,
    declarationOrder: 3,
    sourceIntent: { type: "StaymanNTInvite", params: { reason: "no-spade-fit" } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("2NT invite (no spade fit)"), summary: bidSummary("Invite notrump game after opener shows spades but responder lacks support") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.MINOR_GF_3C_AFTER_2S,
    semanticClassId: STAYMAN_R3_CLASSES.MINOR_GF,
    encoding: bid(3, BidSuit.Clubs),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "game values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.clubs",
        operator: FactOperator.Gte,
        value: 5,
        rationale: "long club suit",
        isPublic: true,
      },
    ],
    band: RecommendationBand.May,
    declarationOrder: 4,
    sourceIntent: { type: "MinorSuitGF", params: { suit: ObsSuit.Clubs } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("3\u2663 GF (5+ clubs)"), summary: bidSummary("Force to game showing a long club suit after the spade response misses") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.MINOR_GF_3D_AFTER_2S,
    semanticClassId: STAYMAN_R3_CLASSES.MINOR_GF,
    encoding: bid(3, BidSuit.Diamonds),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "game values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.diamonds",
        operator: FactOperator.Gte,
        value: 5,
        rationale: "long diamond suit",
        isPublic: true,
      },
    ],
    band: RecommendationBand.May,
    declarationOrder: 5,
    sourceIntent: { type: "MinorSuitGF", params: { suit: ObsSuit.Diamonds } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("3\u2666 GF (5+ diamonds)"), summary: bidSummary("Force to game showing a long diamond suit after the spade response misses") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.CROSS_MAJOR_GF_3H_AFTER_2S,
    semanticClassId: STAYMAN_R3_CLASSES.CROSS_MAJOR_GF,
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
        factId: "hand.suitLength.hearts",
        operator: FactOperator.Gte,
        value: 5,
        rationale: "5+ hearts",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.spades",
        operator: FactOperator.Gte,
        value: 4,
        rationale: "4 spades (Stayman entry)",
        isPublic: true,
      },
    ],
    band: RecommendationBand.Should,
    declarationOrder: 6,
    sourceIntent: { type: "CrossMajorGF", params: { suit: ObsSuit.Hearts } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("3\u2665 GF (5\u2665 + 4\u2660)"), summary: bidSummary("Force to game showing 5 hearts and 4 spades after opener shows spades") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.QUANTITATIVE_4NT_AFTER_2S,
    semanticClassId: STAYMAN_R3_CLASSES.QUANTITATIVE_4NT,
    encoding: bid(4, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "game+ values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.spades",
        operator: FactOperator.Lte,
        value: 3,
        rationale: "no spade fit",
        isPublic: true,
      },
    ],
    band: RecommendationBand.May,
    declarationOrder: 7,
    sourceIntent: { type: "Quantitative4NT", params: { reason: "no-spade-fit" } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("4NT quantitative"), summary: bidSummary("Invite slam in notrump after no spade fit is found") },
  }, STAYMAN_CTX),
  ];
}

// Stayman R3 after 2D — ONLY the 2 Stayman surfaces (not Smolen)
/** Factory: creates Stayman R3 surfaces after opener denies a major, parameterized by system config. */
export function createStaymanR3After2DSurfaces(_sys: SystemConfig): readonly BidMeaning[] {
  return [
  createSurface({
    meaningId: STAYMAN_MEANING_IDS.NT_GAME_AFTER_DENIAL,
    semanticClassId: STAYMAN_R3_CLASSES.NT_GAME_DENIAL,
    encoding: bid(3, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "game values opposite 1NT",
        isPublic: true,
      },
    ],
    band: RecommendationBand.Must,
    declarationOrder: 0,
    sourceIntent: { type: "StaymanNTGame", params: { reason: "denial" } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("3NT after denial"), summary: bidSummary("Place the contract in 3NT after opener denies a 4-card major") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.SHOW_FIVE_HEARTS_AFTER_DENIAL,
    semanticClassId: STAYMAN_R3_CLASSES.SHOW_FIVE_CARD_MAJOR,
    encoding: bid(2, BidSuit.Hearts),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "invite values",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: FactOperator.Gte,
        value: 5,
        rationale: "show the 5-card major after denial",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.spades",
        operator: FactOperator.Gte,
        value: 4,
        rationale: "had 5-4 pattern for Stayman entry",
        isPublic: true,
      },
    ],
    band: RecommendationBand.Should,
    declarationOrder: 1,
    sourceIntent: { type: "ShowFiveCardMajor", params: { suit: ObsSuit.Hearts } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("5-4 majors"), summary: bidSummary("Show 5 hearts after denial, seeking a 3-card heart fit from opener") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.SHOW_FIVE_SPADES_AFTER_DENIAL,
    semanticClassId: STAYMAN_R3_CLASSES.SHOW_FIVE_CARD_MAJOR,
    encoding: bid(2, BidSuit.Spades),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "invite values",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.spades",
        operator: FactOperator.Gte,
        value: 5,
        rationale: "show the 5-card major after denial",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: FactOperator.Gte,
        value: 4,
        rationale: "had 5-4 pattern for Stayman entry",
        isPublic: true,
      },
    ],
    band: RecommendationBand.Should,
    declarationOrder: 2,
    sourceIntent: { type: "ShowFiveCardMajor", params: { suit: ObsSuit.Spades } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("5-4 majors"), summary: bidSummary("Show 5 spades after denial, seeking a 3-card spade fit from opener") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.NT_INVITE_AFTER_DENIAL,
    semanticClassId: STAYMAN_R3_CLASSES.NT_INVITE_DENIAL,
    encoding: bid(2, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "invite values opposite 1NT",
        isPublic: true,
      },
    ],
    band: RecommendationBand.Should,
    declarationOrder: 3,
    sourceIntent: { type: "StaymanNTInvite", params: { reason: "denial" } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("2NT invite after denial"), summary: bidSummary("Invite notrump game after opener denies a 4-card major") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.MINOR_GF_3C_AFTER_2D,
    semanticClassId: STAYMAN_R3_CLASSES.MINOR_GF,
    encoding: bid(3, BidSuit.Clubs),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "game values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.clubs",
        operator: FactOperator.Gte,
        value: 5,
        rationale: "long club suit",
        isPublic: true,
      },
    ],
    band: RecommendationBand.May,
    declarationOrder: 4,
    sourceIntent: { type: "MinorSuitGF", params: { suit: ObsSuit.Clubs } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("3\u2663 GF (5+ clubs)"), summary: bidSummary("Force to game showing a long club suit after opener denies a major") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.MINOR_GF_3D_AFTER_2D,
    semanticClassId: STAYMAN_R3_CLASSES.MINOR_GF,
    encoding: bid(3, BidSuit.Diamonds),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "game values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.diamonds",
        operator: FactOperator.Gte,
        value: 5,
        rationale: "long diamond suit",
        isPublic: true,
      },
    ],
    band: RecommendationBand.May,
    declarationOrder: 5,
    sourceIntent: { type: "MinorSuitGF", params: { suit: ObsSuit.Diamonds } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("3\u2666 GF (5+ diamonds)"), summary: bidSummary("Force to game showing a long diamond suit after opener denies a major") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.MAJOR_SIGNOFF_4H_AFTER_2D,
    semanticClassId: STAYMAN_R3_CLASSES.MAJOR_SIGNOFF_64,
    encoding: bid(4, BidSuit.Hearts),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "game values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: FactOperator.Gte,
        value: 6,
        rationale: "6-card heart suit",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.spades",
        operator: FactOperator.Gte,
        value: 4,
        rationale: "4 spades (6-4 major pattern)",
        isPublic: true,
      },
    ],
    band: RecommendationBand.Should,
    declarationOrder: 6,
    sourceIntent: { type: "MajorSignoff64", params: { suit: ObsSuit.Hearts } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("4\u2665 signoff (6-4 majors)"), summary: bidSummary("Sign off in 4H with 6 hearts and 4 spades after opener denies a major") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.MAJOR_SIGNOFF_4S_AFTER_2D,
    semanticClassId: STAYMAN_R3_CLASSES.MAJOR_SIGNOFF_64,
    encoding: bid(4, BidSuit.Spades),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "game values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.spades",
        operator: FactOperator.Gte,
        value: 6,
        rationale: "6-card spade suit",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: FactOperator.Gte,
        value: 4,
        rationale: "4 hearts (6-4 major pattern)",
        isPublic: true,
      },
    ],
    band: RecommendationBand.Should,
    declarationOrder: 7,
    sourceIntent: { type: "MajorSignoff64", params: { suit: ObsSuit.Spades } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("4\u2660 signoff (6-4 majors)"), summary: bidSummary("Sign off in 4S with 6 spades and 4 hearts after opener denies a major") },
  }, STAYMAN_CTX),

  createSurface({
    meaningId: STAYMAN_MEANING_IDS.QUANTITATIVE_4NT_AFTER_2D,
    semanticClassId: STAYMAN_R3_CLASSES.QUANTITATIVE_4NT,
    encoding: bid(4, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "game+ values opposite 1NT",
        isPublic: true,
      },
    ],
    band: RecommendationBand.May,
    declarationOrder: 8,
    sourceIntent: { type: "Quantitative4NT", params: { reason: "denial" } },
    disclosure: Disclosure.Alert,
    teachingLabel: { name: bidName("4NT quantitative"), summary: bidSummary("Invite slam in notrump after opener denies a 4-card major") },
  }, STAYMAN_CTX),
  ];
}
