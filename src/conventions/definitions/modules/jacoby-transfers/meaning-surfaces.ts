import type { BidMeaning } from "../../../pipeline/evaluation/meaning";
import type { SystemConfig } from "../../system-config";
import { bidName, bidSummary } from "../../../core/authored-text";
import {
  SYSTEM_RESPONDER_WEAK_HAND,
  SYSTEM_RESPONDER_INVITE_VALUES,
  SYSTEM_RESPONDER_GAME_VALUES,
  SYSTEM_RESPONDER_SLAM_VALUES,
  SYSTEM_OPENER_NOT_MINIMUM,
} from "../../system-fact-vocabulary";
import { BidSuit } from "../../../../engine/types";
import { bid } from "../../../core/surface-helpers";
import { createSurface } from "../../../core/surface-builder";
import type { ModuleContext } from "../../../core/surface-builder";
import { TRANSFER_CLASSES, TRANSFER_R3_CLASSES, OPENER_PLACE_CLASSES, TRANSFER_MEANING_IDS, TRANSFER_FACT_IDS } from "./ids";

// ─── Module context ──────────────────────────────────────────

const TRANSFER_CTX: ModuleContext = { moduleId: "jacoby-transfers" };

// ─── R1 surfaces ─────────────────────────────────────────────

export const TRANSFER_R1_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: TRANSFER_MEANING_IDS.TO_HEARTS,
    semanticClassId: TRANSFER_CLASSES.TO_HEARTS,
    encoding: bid(2, BidSuit.Diamonds),
    clauses: [
      {
        factId: "hand.suitLength.hearts",
        operator: "gte",
        value: 5,
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 1,
    sourceIntent: { type: "TransferToHearts", params: {} },
    disclosure: "announcement",
    teachingLabel: { name: bidName("Transfer to hearts"), summary: bidSummary("Bid 2D to ask opener to bid 2H, keeping the strong hand as declarer") },
  }, TRANSFER_CTX),

  createSurface({
    meaningId: TRANSFER_MEANING_IDS.TO_SPADES,
    semanticClassId: TRANSFER_CLASSES.TO_SPADES,
    encoding: bid(2, BidSuit.Hearts),
    clauses: [
      {
        factId: "hand.suitLength.spades",
        operator: "gte",
        value: 5,
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 0,
    sourceIntent: { type: "TransferToSpades", params: {} },
    disclosure: "announcement",
    teachingLabel: { name: bidName("Transfer to spades"), summary: bidSummary("Bid 2H to ask opener to bid 2S, keeping the strong hand as declarer") },
  }, TRANSFER_CTX),
];

// ─── Opener transfer accept surfaces ─────────────────────────

export const OPENER_TRANSFER_HEARTS_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: TRANSFER_MEANING_IDS.ACCEPT,
    semanticClassId: TRANSFER_CLASSES.ACCEPT,
    encoding: bid(2, BidSuit.Hearts),
    clauses: [],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "AcceptTransfer", params: { suit: "hearts" } },
    disclosure: "standard",
    teachingLabel: { name: bidName("Accept transfer to hearts"), summary: bidSummary("Complete the transfer by bidding 2H as requested") },
  }, TRANSFER_CTX),
];

export const OPENER_TRANSFER_SPADES_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: TRANSFER_MEANING_IDS.ACCEPT_SPADES,
    semanticClassId: TRANSFER_CLASSES.ACCEPT_SPADES,
    encoding: bid(2, BidSuit.Spades),
    clauses: [],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "AcceptTransfer", params: { suit: "spades" } },
    disclosure: "standard",
    teachingLabel: { name: bidName("Accept transfer to spades"), summary: bidSummary("Complete the transfer by bidding 2S as requested") },
  }, TRANSFER_CTX),
];

// ─── Transfer R3 surfaces ────────────────────────────────────

export function createTransferR3HeartsSurfaces(_sys: SystemConfig): readonly BidMeaning[] {
  return [
  createSurface({
    meaningId: TRANSFER_MEANING_IDS.SIGNOFF_HEARTS,
    semanticClassId: TRANSFER_R3_CLASSES.SIGNOFF,
    encoding: { type: "pass" },
    clauses: [
      {
        factId: SYSTEM_RESPONDER_WEAK_HAND,
        operator: "boolean",
        value: true,
        rationale: "weak hand, signoff",
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "Signoff", params: { suit: "hearts" } },
    disclosure: "natural",
    teachingLabel: { name: bidName("Signoff"), summary: bidSummary("Pass to play in 2H with a weak hand, ending the auction") },
  }, TRANSFER_CTX),

  createSurface({
    meaningId: TRANSFER_MEANING_IDS.GAME_HEARTS,
    semanticClassId: TRANSFER_R3_CLASSES.GAME_IN_MAJOR,
    encoding: bid(4, BidSuit.Hearts),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        rationale: "game values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: "gte",
        value: 6,
        rationale: "game in major with long suit",
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 1,
    sourceIntent: { type: "GameInMajor", params: { suit: "hearts" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("4H game"), summary: bidSummary("Jump to 4H with game values and 6+ hearts to play in the major") },
  }, TRANSFER_CTX),

  createSurface({
    meaningId: TRANSFER_MEANING_IDS.NT_GAME_HEARTS,
    semanticClassId: TRANSFER_R3_CLASSES.NT_GAME,
    encoding: bid(3, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        rationale: "game values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: "eq",
        value: 5,
        rationale: "offer 3NT as alternative to 4H",
        isPublic: true,
      },
      {
        factId: "bridge.hasShortage",
        operator: "boolean",
        value: false,
        rationale: "balanced enough for NT",
        isPublic: true,
      },
      {
        factId: SYSTEM_RESPONDER_SLAM_VALUES,
        operator: "boolean",
        value: false,
        rationale: "game values, not slam (use 4NT for slam invite)",
      },
    ],
    band: "must",
    declarationOrder: 2,
    sourceIntent: { type: "TransferNTGame", params: { suit: "hearts" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("3NT choice"), summary: bidSummary("Offer opener a choice between 3NT and 4H with exactly 5 balanced hearts") },
  }, TRANSFER_CTX),

  createSurface({
    meaningId: TRANSFER_MEANING_IDS.INVITE_RAISE_HEARTS,
    semanticClassId: TRANSFER_R3_CLASSES.INVITE_RAISE,
    encoding: bid(3, BidSuit.Hearts),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: "boolean",
        value: true,
        rationale: "invite values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: "gte",
        value: 6,
        rationale: "invite in major with long suit",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 3,
    sourceIntent: { type: "InviteRaise", params: { suit: "hearts" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("3H invite (6+ hearts)"), summary: bidSummary("Invite game in hearts with 6+ cards and invitational values") },
  }, TRANSFER_CTX),

  createSurface({
    meaningId: TRANSFER_MEANING_IDS.INVITE_HEARTS,
    semanticClassId: TRANSFER_R3_CLASSES.INVITE,
    encoding: bid(2, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: "boolean",
        value: true,
        rationale: "invite values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "bridge.hasShortage",
        operator: "boolean",
        value: false,
        rationale: "balanced enough for NT invite",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 4,
    sourceIntent: { type: "Invite", params: { suit: "hearts" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("2NT invite"), summary: bidSummary("Invite game with a balanced hand, letting opener choose between 3NT and hearts") },
  }, TRANSFER_CTX),

  // ─── New continuations (hearts track) ────────────────────────

  createSurface({
    meaningId: TRANSFER_MEANING_IDS.INVITE_MAJORS_HEARTS,
    semanticClassId: TRANSFER_R3_CLASSES.INVITE_MAJORS,
    encoding: bid(2, BidSuit.Spades),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: "boolean",
        value: true,
        rationale: "invitational values",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.spades",
        operator: "gte",
        value: 5,
        rationale: "5-5 in the majors",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 5,
    sourceIntent: { type: "InviteMajorMajor", params: { suit: "spades" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("2S invite (5-5 majors)"), summary: bidSummary("Show 5-5 in both majors with invitational values after a heart transfer") },
  }, TRANSFER_CTX),

  createSurface({
    meaningId: TRANSFER_MEANING_IDS.NEW_SUIT_CLUBS_HEARTS,
    semanticClassId: TRANSFER_R3_CLASSES.NEW_SUIT_GF,
    encoding: bid(3, BidSuit.Clubs),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        rationale: "game forcing",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.clubs",
        operator: "gte",
        value: 4,
        rationale: "4+ clubs, second suit",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 6,
    sourceIntent: { type: "NewSuitGameForce", params: { suit: "clubs" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("3C game force"), summary: bidSummary("Show a 4+ club side suit with game-forcing values to explore the best contract") },
  }, TRANSFER_CTX),

  createSurface({
    meaningId: TRANSFER_MEANING_IDS.NEW_SUIT_DIAMONDS_HEARTS,
    semanticClassId: TRANSFER_R3_CLASSES.NEW_SUIT_GF,
    encoding: bid(3, BidSuit.Diamonds),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        rationale: "game forcing",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.diamonds",
        operator: "gte",
        value: 4,
        rationale: "4+ diamonds, second suit",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 7,
    sourceIntent: { type: "NewSuitGameForce", params: { suit: "diamonds" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("3D game force"), summary: bidSummary("Show a 4+ diamond side suit with game-forcing values to explore the best contract") },
  }, TRANSFER_CTX),

  createSurface({
    meaningId: TRANSFER_MEANING_IDS.SPLINTER_SPADES,
    semanticClassId: TRANSFER_R3_CLASSES.SPLINTER_SLAM_TRY,
    encoding: bid(3, BidSuit.Spades),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_SLAM_VALUES,
        operator: "boolean",
        value: true,
        rationale: "slam interest",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.spades",
        operator: "lte",
        value: 1,
        rationale: "singleton or void in spades",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 8,
    sourceIntent: { type: "ShortageSlamTry", params: { suit: "spades" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("3S splinter (slam try)"), summary: bidSummary("Show shortness in spades with slam interest in hearts") },
  }, TRANSFER_CTX),

  createSurface({
    meaningId: TRANSFER_MEANING_IDS.QUANTITATIVE_HEARTS,
    semanticClassId: TRANSFER_R3_CLASSES.QUANTITATIVE,
    encoding: bid(4, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_SLAM_VALUES,
        operator: "boolean",
        value: true,
        rationale: "slam invite values",
        isPublic: true,
      },
      {
        factId: "bridge.hasShortage",
        operator: "boolean",
        value: false,
        rationale: "balanced for quantitative",
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 9,
    sourceIntent: { type: "QuantitativeSlam", params: { suit: "hearts" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("4NT quantitative"), summary: bidSummary("Invite slam with balanced slam values, asking opener to bid 6 with a maximum") },
  }, TRANSFER_CTX),
  ];
}

export function createTransferR3SpadesSurfaces(_sys: SystemConfig): readonly BidMeaning[] {
  return [
  createSurface({
    meaningId: TRANSFER_MEANING_IDS.SIGNOFF_SPADES,
    semanticClassId: TRANSFER_R3_CLASSES.SIGNOFF,
    encoding: { type: "pass" },
    clauses: [
      {
        factId: SYSTEM_RESPONDER_WEAK_HAND,
        operator: "boolean",
        value: true,
        rationale: "weak hand, signoff",
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "Signoff", params: { suit: "spades" } },
    disclosure: "natural",
    teachingLabel: { name: bidName("Signoff"), summary: bidSummary("Pass to play in 2S with a weak hand, ending the auction") },
  }, TRANSFER_CTX),

  createSurface({
    meaningId: TRANSFER_MEANING_IDS.GAME_SPADES,
    semanticClassId: TRANSFER_R3_CLASSES.GAME_IN_MAJOR,
    encoding: bid(4, BidSuit.Spades),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        rationale: "game values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.spades",
        operator: "gte",
        value: 6,
        rationale: "game in major with long suit",
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 1,
    sourceIntent: { type: "GameInMajor", params: { suit: "spades" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("4S game"), summary: bidSummary("Jump to 4S with game values and 6+ spades to play in the major") },
  }, TRANSFER_CTX),

  createSurface({
    meaningId: TRANSFER_MEANING_IDS.NT_GAME_SPADES,
    semanticClassId: TRANSFER_R3_CLASSES.NT_GAME,
    encoding: bid(3, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        rationale: "game values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.spades",
        operator: "eq",
        value: 5,
        rationale: "offer 3NT as alternative to 4S",
        isPublic: true,
      },
      {
        factId: "bridge.hasShortage",
        operator: "boolean",
        value: false,
        rationale: "balanced enough for NT",
        isPublic: true,
      },
      {
        factId: SYSTEM_RESPONDER_SLAM_VALUES,
        operator: "boolean",
        value: false,
        rationale: "game values, not slam (use 4NT for slam invite)",
      },
    ],
    band: "must",
    declarationOrder: 2,
    sourceIntent: { type: "TransferNTGame", params: { suit: "spades" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("3NT choice"), summary: bidSummary("Offer opener a choice between 3NT and 4S with exactly 5 balanced spades") },
  }, TRANSFER_CTX),

  createSurface({
    meaningId: TRANSFER_MEANING_IDS.INVITE_RAISE_SPADES,
    semanticClassId: TRANSFER_R3_CLASSES.INVITE_RAISE,
    encoding: bid(3, BidSuit.Spades),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: "boolean",
        value: true,
        rationale: "invite values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.spades",
        operator: "gte",
        value: 6,
        rationale: "invite in major with long suit",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 3,
    sourceIntent: { type: "InviteRaise", params: { suit: "spades" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("3S invite (6+ spades)"), summary: bidSummary("Invite game in spades with 6+ cards and invitational values") },
  }, TRANSFER_CTX),

  createSurface({
    meaningId: TRANSFER_MEANING_IDS.INVITE_SPADES,
    semanticClassId: TRANSFER_R3_CLASSES.INVITE,
    encoding: bid(2, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: "boolean",
        value: true,
        rationale: "invite values opposite 1NT",
        isPublic: true,
      },
      {
        factId: "bridge.hasShortage",
        operator: "boolean",
        value: false,
        rationale: "balanced enough for NT invite",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 4,
    sourceIntent: { type: "Invite", params: { suit: "spades" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("2NT invite"), summary: bidSummary("Invite game with a balanced hand, letting opener choose between 3NT and spades") },
  }, TRANSFER_CTX),

  // ─── New continuations (spades track) ────────────────────────

  createSurface({
    meaningId: TRANSFER_MEANING_IDS.NEW_SUIT_CLUBS_SPADES,
    semanticClassId: TRANSFER_R3_CLASSES.NEW_SUIT_GF,
    encoding: bid(3, BidSuit.Clubs),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        rationale: "game forcing",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.clubs",
        operator: "gte",
        value: 4,
        rationale: "4+ clubs, second suit",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 5,
    sourceIntent: { type: "NewSuitGameForce", params: { suit: "clubs" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("3C game force"), summary: bidSummary("Show a 4+ club side suit with game-forcing values after a spade transfer") },
  }, TRANSFER_CTX),

  createSurface({
    meaningId: TRANSFER_MEANING_IDS.NEW_SUIT_DIAMONDS_SPADES,
    semanticClassId: TRANSFER_R3_CLASSES.NEW_SUIT_GF,
    encoding: bid(3, BidSuit.Diamonds),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        rationale: "game forcing",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.diamonds",
        operator: "gte",
        value: 4,
        rationale: "4+ diamonds, second suit",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 6,
    sourceIntent: { type: "NewSuitGameForce", params: { suit: "diamonds" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("3D game force"), summary: bidSummary("Show a 4+ diamond side suit with game-forcing values after a spade transfer") },
  }, TRANSFER_CTX),

  createSurface({
    meaningId: TRANSFER_MEANING_IDS.SLAM_TRY_HEARTS,
    semanticClassId: TRANSFER_R3_CLASSES.SLAM_TRY_SECOND_MAJOR,
    encoding: bid(3, BidSuit.Hearts),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_SLAM_VALUES,
        operator: "boolean",
        value: true,
        rationale: "slam interest (stronger than 4H)",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: "gte",
        value: 5,
        rationale: "5+ hearts with 5+ spades",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 7,
    sourceIntent: { type: "SlamTrySecondMajor", params: { suit: "hearts" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("3H slam try (5-5 majors)"), summary: bidSummary("Show 5-5 majors with slam interest, distinguishing from a game-only 4H bid") },
  }, TRANSFER_CTX),

  createSurface({
    meaningId: TRANSFER_MEANING_IDS.GAME_OTHER_MAJOR_SPADES,
    semanticClassId: TRANSFER_R3_CLASSES.GAME_OTHER_MAJOR,
    encoding: bid(4, BidSuit.Hearts),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        rationale: "game values",
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: "gte",
        value: 5,
        rationale: "5+ hearts with 5+ spades",
        isPublic: true,
      },
      {
        factId: SYSTEM_RESPONDER_SLAM_VALUES,
        operator: "boolean",
        value: false,
        rationale: "game values, not slam (use 3H for slam interest)",
      },
    ],
    band: "should",
    declarationOrder: 8,
    sourceIntent: { type: "GameInOtherMajor", params: { suit: "hearts" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("4H game (5-5 majors)"), summary: bidSummary("Bid game in hearts with 5-5 majors and game values but no slam interest") },
  }, TRANSFER_CTX),

  createSurface({
    meaningId: TRANSFER_MEANING_IDS.QUANTITATIVE_SPADES,
    semanticClassId: TRANSFER_R3_CLASSES.QUANTITATIVE,
    encoding: bid(4, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_SLAM_VALUES,
        operator: "boolean",
        value: true,
        rationale: "slam invite values",
        isPublic: true,
      },
      {
        factId: "bridge.hasShortage",
        operator: "boolean",
        value: false,
        rationale: "balanced for quantitative",
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 9,
    sourceIntent: { type: "QuantitativeSlam", params: { suit: "spades" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("4NT quantitative"), summary: bidSummary("Invite slam with balanced slam values after a spade transfer") },
  }, TRANSFER_CTX),
  ];
}

// ─── Opener placement surfaces (after responder's 3NT "let opener choose") ──

export const OPENER_PLACE_HEARTS_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: TRANSFER_MEANING_IDS.CORRECT_TO_4H,
    semanticClassId: OPENER_PLACE_CLASSES.CORRECT_TO_MAJOR,
    encoding: bid(4, BidSuit.Hearts),
    clauses: [
      {
        factId: TRANSFER_FACT_IDS.OPENER_HAS_HEART_FIT,
        operator: "boolean",
        value: true,
        rationale: "fit with responder's 5",
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "PlacementCorrection", params: { suit: "hearts" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("4\u2665 heart fit"), summary: bidSummary("Correct to 4H with 3+ hearts, choosing the major fit over 3NT") },
  }, TRANSFER_CTX),
  createSurface({
    meaningId: TRANSFER_MEANING_IDS.PASS_3NT_HEARTS,
    semanticClassId: OPENER_PLACE_CLASSES.PASS_3NT,
    encoding: { type: "pass" },
    clauses: [
      {
        factId: TRANSFER_FACT_IDS.OPENER_HAS_HEART_FIT,
        operator: "boolean",
        value: false,
        rationale: "no fit",
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 1,
    sourceIntent: { type: "PlacementPass", params: { suit: "hearts" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("Stay in 3NT"), summary: bidSummary("Pass 3NT with only a doubleton in hearts, preferring notrump") },
  }, TRANSFER_CTX),
];

export const OPENER_PLACE_SPADES_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: TRANSFER_MEANING_IDS.CORRECT_TO_4S,
    semanticClassId: OPENER_PLACE_CLASSES.CORRECT_TO_MAJOR,
    encoding: bid(4, BidSuit.Spades),
    clauses: [
      {
        factId: TRANSFER_FACT_IDS.OPENER_HAS_SPADES_FIT,
        operator: "boolean",
        value: true,
        rationale: "fit with responder's 5",
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "PlacementCorrection", params: { suit: "spades" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("4\u2660 spade fit"), summary: bidSummary("Correct to 4S with 3+ spades, choosing the major fit over 3NT") },
  }, TRANSFER_CTX),
  createSurface({
    meaningId: TRANSFER_MEANING_IDS.PASS_3NT_SPADES,
    semanticClassId: OPENER_PLACE_CLASSES.PASS_3NT,
    encoding: { type: "pass" },
    clauses: [
      {
        factId: TRANSFER_FACT_IDS.OPENER_HAS_SPADES_FIT,
        operator: "boolean",
        value: false,
        rationale: "no fit",
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 1,
    sourceIntent: { type: "PlacementPass", params: { suit: "spades" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("Stay in 3NT"), summary: bidSummary("Pass 3NT with only a doubleton in spades, preferring notrump") },
  }, TRANSFER_CTX),
];

// ─── Opener invite acceptance surfaces (after responder's 2NT invite) ──

export function createOpenerAcceptInviteHeartsSurfaces(_sys: SystemConfig): readonly BidMeaning[] {
  return [
  createSurface({
    meaningId: TRANSFER_MEANING_IDS.ACCEPT_INVITE_GAME_HEARTS,
    semanticClassId: OPENER_PLACE_CLASSES.ACCEPT_INVITE,
    encoding: bid(4, BidSuit.Hearts),
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: true,
        rationale: "not minimum",
        isPublic: true,
      },
      {
        factId: TRANSFER_FACT_IDS.OPENER_HAS_HEART_FIT,
        operator: "boolean",
        value: true,
        rationale: "fit with responder's 5",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 0,
    sourceIntent: { type: "AcceptInvite", params: { suit: "hearts" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("Accept invite"), summary: bidSummary("Raise to 4H with a non-minimum hand and a heart fit") },
  }, TRANSFER_CTX),
  createSurface({
    meaningId: TRANSFER_MEANING_IDS.ACCEPT_INVITE_HEARTS,
    semanticClassId: OPENER_PLACE_CLASSES.ACCEPT_INVITE,
    encoding: bid(3, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: true,
        rationale: "not minimum",
        isPublic: true,
      },
      {
        factId: TRANSFER_FACT_IDS.OPENER_HAS_HEART_FIT,
        operator: "boolean",
        value: false,
        rationale: "no fit",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 1,
    sourceIntent: { type: "AcceptInvite", params: {} },
    disclosure: "alert",
    teachingLabel: { name: bidName("Accept invite"), summary: bidSummary("Accept in 3NT with a non-minimum hand but no heart fit") },
  }, TRANSFER_CTX),
  createSurface({
    meaningId: TRANSFER_MEANING_IDS.SIGNOFF_WITH_FIT_HEARTS,
    semanticClassId: OPENER_PLACE_CLASSES.SIGNOFF_WITH_FIT,
    encoding: bid(3, BidSuit.Hearts),
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: false,
        rationale: "minimum",
        isPublic: true,
      },
      {
        factId: TRANSFER_FACT_IDS.OPENER_HAS_HEART_FIT,
        operator: "boolean",
        value: true,
        rationale: "fit with responder's 5",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 1,
    sourceIntent: { type: "SignoffWithFit", params: { suit: "hearts" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("Sign off"), summary: bidSummary("Decline the invite but correct to 3H with a minimum hand and heart fit") },
  }, TRANSFER_CTX),
  createSurface({
    meaningId: TRANSFER_MEANING_IDS.DECLINE_INVITE_HEARTS,
    semanticClassId: OPENER_PLACE_CLASSES.DECLINE_INVITE,
    encoding: { type: "pass" },
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: false,
        rationale: "minimum",
        isPublic: true,
      },
      {
        factId: TRANSFER_FACT_IDS.OPENER_HAS_HEART_FIT,
        operator: "boolean",
        value: false,
        rationale: "no fit",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 3,
    sourceIntent: { type: "DeclineInvite", params: {} },
    disclosure: "alert",
    teachingLabel: { name: bidName("Decline invite"), summary: bidSummary("Pass 2NT with a minimum hand and no heart fit") },
  }, TRANSFER_CTX),
  ];
}

export function createOpenerAcceptInviteSpadesSurfaces(_sys: SystemConfig): readonly BidMeaning[] {
  return [
  createSurface({
    meaningId: TRANSFER_MEANING_IDS.ACCEPT_INVITE_GAME_SPADES,
    semanticClassId: OPENER_PLACE_CLASSES.ACCEPT_INVITE,
    encoding: bid(4, BidSuit.Spades),
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: true,
        rationale: "not minimum",
        isPublic: true,
      },
      {
        factId: TRANSFER_FACT_IDS.OPENER_HAS_SPADES_FIT,
        operator: "boolean",
        value: true,
        rationale: "fit with responder's 5",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 0,
    sourceIntent: { type: "AcceptInvite", params: { suit: "spades" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("Accept invite"), summary: bidSummary("Raise to 4S with a non-minimum hand and a spade fit") },
  }, TRANSFER_CTX),
  createSurface({
    meaningId: TRANSFER_MEANING_IDS.ACCEPT_INVITE_SPADES,
    semanticClassId: OPENER_PLACE_CLASSES.ACCEPT_INVITE,
    encoding: bid(3, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: true,
        rationale: "not minimum",
        isPublic: true,
      },
      {
        factId: TRANSFER_FACT_IDS.OPENER_HAS_SPADES_FIT,
        operator: "boolean",
        value: false,
        rationale: "no fit",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 1,
    sourceIntent: { type: "AcceptInvite", params: {} },
    disclosure: "alert",
    teachingLabel: { name: bidName("Accept invite"), summary: bidSummary("Accept in 3NT with a non-minimum hand but no spade fit") },
  }, TRANSFER_CTX),
  createSurface({
    meaningId: TRANSFER_MEANING_IDS.SIGNOFF_WITH_FIT_SPADES,
    semanticClassId: OPENER_PLACE_CLASSES.SIGNOFF_WITH_FIT,
    encoding: bid(3, BidSuit.Spades),
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: false,
        rationale: "minimum",
        isPublic: true,
      },
      {
        factId: TRANSFER_FACT_IDS.OPENER_HAS_SPADES_FIT,
        operator: "boolean",
        value: true,
        rationale: "fit with responder's 5",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 2,
    sourceIntent: { type: "SignoffWithFit", params: { suit: "spades" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("Sign off"), summary: bidSummary("Decline the invite but correct to 3S with a minimum hand and spade fit") },
  }, TRANSFER_CTX),
  createSurface({
    meaningId: TRANSFER_MEANING_IDS.DECLINE_INVITE_SPADES,
    semanticClassId: OPENER_PLACE_CLASSES.DECLINE_INVITE,
    encoding: { type: "pass" },
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: false,
        rationale: "minimum",
        isPublic: true,
      },
      {
        factId: TRANSFER_FACT_IDS.OPENER_HAS_SPADES_FIT,
        operator: "boolean",
        value: false,
        rationale: "no fit",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 3,
    sourceIntent: { type: "DeclineInvite", params: {} },
    disclosure: "alert",
    teachingLabel: { name: bidName("Decline invite"), summary: bidSummary("Pass 2NT with a minimum hand and no spade fit") },
  }, TRANSFER_CTX),
  ];
}

// ─── Opener invite-raise acceptance surfaces (after responder's 3M invite raise) ──
// After 3H/3S (6+ cards, invitational), opener knows there's a guaranteed
// major fit (opener has 2-3+ in the suit from 1NT balanced). Accept = 4M, decline = Pass.

export function createOpenerAcceptInviteRaiseHeartsSurfaces(_sys: SystemConfig): readonly BidMeaning[] {
  return [
  createSurface({
    meaningId: TRANSFER_MEANING_IDS.ACCEPT_INVITE_RAISE_HEARTS,
    semanticClassId: OPENER_PLACE_CLASSES.ACCEPT_INVITE,
    encoding: bid(4, BidSuit.Hearts),
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: true,
        rationale: "not minimum",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 0,
    sourceIntent: { type: "AcceptInvite", params: { suit: "hearts" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("Accept invite"), summary: bidSummary("Raise to 4H with a non-minimum hand opposite responder's 6+ hearts") },
  }, TRANSFER_CTX),
  createSurface({
    meaningId: TRANSFER_MEANING_IDS.DECLINE_INVITE_RAISE_HEARTS,
    semanticClassId: OPENER_PLACE_CLASSES.DECLINE_INVITE,
    encoding: { type: "pass" },
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: false,
        rationale: "minimum",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 1,
    sourceIntent: { type: "DeclineInvite", params: {} },
    disclosure: "alert",
    teachingLabel: { name: bidName("Decline invite"), summary: bidSummary("Pass 3H with a minimum hand, settling for partscore in the major fit") },
  }, TRANSFER_CTX),
  ];
}

export function createOpenerAcceptInviteRaiseSpadesSurfaces(_sys: SystemConfig): readonly BidMeaning[] {
  return [
  createSurface({
    meaningId: TRANSFER_MEANING_IDS.ACCEPT_INVITE_RAISE_SPADES,
    semanticClassId: OPENER_PLACE_CLASSES.ACCEPT_INVITE,
    encoding: bid(4, BidSuit.Spades),
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: true,
        rationale: "not minimum",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 0,
    sourceIntent: { type: "AcceptInvite", params: { suit: "spades" } },
    disclosure: "alert",
    teachingLabel: { name: bidName("Accept invite"), summary: bidSummary("Raise to 4S with a non-minimum hand opposite responder's 6+ spades") },
  }, TRANSFER_CTX),
  createSurface({
    meaningId: TRANSFER_MEANING_IDS.DECLINE_INVITE_RAISE_SPADES,
    semanticClassId: OPENER_PLACE_CLASSES.DECLINE_INVITE,
    encoding: { type: "pass" },
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: false,
        rationale: "minimum",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 1,
    sourceIntent: { type: "DeclineInvite", params: {} },
    disclosure: "alert",
    teachingLabel: { name: bidName("Decline invite"), summary: bidSummary("Pass 3S with a minimum hand, settling for partscore in the major fit") },
  }, TRANSFER_CTX),
  ];
}
