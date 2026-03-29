import type { BidMeaning } from "../../../pipeline/evaluation/meaning";
import { BidSuit } from "../../../../engine/types";
import { BRIDGE_SEMANTIC_CLASSES } from "../../../pipeline/evaluation/meaning";
import type { SystemConfig } from "../../system-config";
import {
  SYSTEM_RESPONDER_INVITE_VALUES,
  SYSTEM_RESPONDER_GAME_VALUES,
} from "../../system-fact-vocabulary";

import { bid } from "../../../core/surface-helpers";
import { createSurface, Disclosure } from "../../../core/surface-builder";
import type { ModuleContext } from "../../../core/surface-builder";
import { bidName, bidSummary } from "../../../core/authored-text";

import { NATURAL_NT_MEANING_IDS } from "./ids";
import { FactOperator, RecommendationBand } from "../../../pipeline/evaluation/meaning";
import { ObsSuit } from "../../../pipeline/bid-action";

// ─── Thresholds ─────────────────────────────────────────────

/** Convention-intrinsic opening thresholds (standard across SAYC/2-over-1/Acol). */
export const NATURAL_BIDS_THRESHOLDS = {
  minClubLength: 3,
  minDiamondLength: 4,
  minOpeningHcp: 12,
} as const;

// ─── Module context ──────────────────────────────────────────

const NATURAL_BIDS_CTX: ModuleContext = { moduleId: "natural-bids" };

// ─── R1 surfaces ─────────────────────────────────────────────

export function createNtR1Surfaces(_sys: SystemConfig): readonly BidMeaning[] {
  return [
    createSurface({
      meaningId: NATURAL_NT_MEANING_IDS.NT_INVITE,
      semanticClassId: BRIDGE_SEMANTIC_CLASSES.NT_INVITE,
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
          factId: "bridge.hasFourCardMajor",
          operator: FactOperator.Boolean,
          value: false,
          isPublic: true,
        },
        {
          factId: "bridge.hasFiveCardMajor",
          operator: FactOperator.Boolean,
          value: false,
          isPublic: true,
        },
      ],
      band: RecommendationBand.May,
      declarationOrder: 0,
      sourceIntent: { type: "NTInvite", params: {} },
      disclosure: Disclosure.Natural,
      teachingLabel: { name: bidName("NT invite"), summary: bidSummary("Invite game in notrump with no 4-card or 5-card major") },
    }, NATURAL_BIDS_CTX),

    createSurface({
      meaningId: NATURAL_NT_MEANING_IDS.TO_3NT,
      semanticClassId: BRIDGE_SEMANTIC_CLASSES.NT_GAME,
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
          factId: "bridge.hasFourCardMajor",
          operator: FactOperator.Boolean,
          value: false,
          isPublic: true,
        },
        {
          factId: "bridge.hasFiveCardMajor",
          operator: FactOperator.Boolean,
          value: false,
          isPublic: true,
        },
      ],
      band: RecommendationBand.May,
      declarationOrder: 1,
      sourceIntent: { type: "NTGame", params: {} },
      disclosure: Disclosure.Natural,
      teachingLabel: { name: bidName("3NT game"), summary: bidSummary("Bid game in notrump with game-forcing values and no 4-card or 5-card major") },
    }, NATURAL_BIDS_CTX),
  ];
}

// ─── Opener 1NT surface (used as surface group for idle state) ───
// Declares the 1NT opening promise (HCP range, balanced) so that the
// commitment extractor produces public constraints for the posterior sampler.

export function createOpener1NtSurface(sys: SystemConfig): readonly BidMeaning[] {
  return [
    createSurface({
      meaningId: NATURAL_NT_MEANING_IDS.NT_OPENING,
      semanticClassId: BRIDGE_SEMANTIC_CLASSES.NT_OPENING,
      encoding: bid(1, BidSuit.NoTrump),
      clauses: [
        {
          factId: "hand.hcp",
          operator: FactOperator.Gte,
          value: sys.ntOpening.minHcp,
          isPublic: true,
        },
        {
          factId: "hand.hcp",
          operator: FactOperator.Lte,
          value: sys.ntOpening.maxHcp,
          isPublic: true,
        },
        {
          factId: "hand.isBalanced",
          operator: FactOperator.Boolean,
          value: true,
          isPublic: true,
        },
      ],
      band: RecommendationBand.Must,
      declarationOrder: 0,
      sourceIntent: { type: "NTOpening", params: {} },
      disclosure: Disclosure.Natural,
      teachingLabel: { name: bidName(`${sys.ntOpening.minHcp} to ${sys.ntOpening.maxHcp}`), summary: bidSummary("Open 1NT showing a balanced hand within the system HCP range") },
    }, NATURAL_BIDS_CTX),
  ];
}

// ─── 1-level suit opening surfaces ──────────────────────────────

export function createSuitOpeningSurfaces(sys: SystemConfig): readonly BidMeaning[] {
  const { minClubLength, minDiamondLength, minOpeningHcp } = NATURAL_BIDS_THRESHOLDS;
  const majorMin = sys.openingRequirements.majorSuitMinLength;

  return [
    createSurface({
      meaningId: NATURAL_NT_MEANING_IDS.OPEN_1C,
      semanticClassId: BRIDGE_SEMANTIC_CLASSES.SUIT_OPENING_1C,
      encoding: bid(1, BidSuit.Clubs),
      clauses: [
        { factId: "hand.hcp", operator: FactOperator.Gte, value: minOpeningHcp, isPublic: true },
        { factId: "hand.clubs", operator: FactOperator.Gte, value: minClubLength, isPublic: true },
      ],
      band: RecommendationBand.Must,
      declarationOrder: 1,
      sourceIntent: { type: "SuitOpen", params: { suit: ObsSuit.Clubs } },
      disclosure: Disclosure.Natural,
      teachingLabel: { name: bidName("1♣ opening"), summary: bidSummary("Open 1♣ with 12+ HCP and 3+ clubs") },
    }, NATURAL_BIDS_CTX),

    createSurface({
      meaningId: NATURAL_NT_MEANING_IDS.OPEN_1D,
      semanticClassId: BRIDGE_SEMANTIC_CLASSES.SUIT_OPENING_1D,
      encoding: bid(1, BidSuit.Diamonds),
      clauses: [
        { factId: "hand.hcp", operator: FactOperator.Gte, value: minOpeningHcp, isPublic: true },
        { factId: "hand.diamonds", operator: FactOperator.Gte, value: minDiamondLength, isPublic: true },
      ],
      band: RecommendationBand.Must,
      declarationOrder: 2,
      sourceIntent: { type: "SuitOpen", params: { suit: ObsSuit.Diamonds } },
      disclosure: Disclosure.Natural,
      teachingLabel: { name: bidName("1♦ opening"), summary: bidSummary("Open 1♦ with 12+ HCP and 4+ diamonds") },
    }, NATURAL_BIDS_CTX),

    createSurface({
      meaningId: NATURAL_NT_MEANING_IDS.OPEN_1H,
      semanticClassId: BRIDGE_SEMANTIC_CLASSES.SUIT_OPENING_1H,
      encoding: bid(1, BidSuit.Hearts),
      clauses: [
        { factId: "hand.hcp", operator: FactOperator.Gte, value: minOpeningHcp, isPublic: true },
        { factId: "hand.hearts", operator: FactOperator.Gte, value: majorMin, isPublic: true },
      ],
      band: RecommendationBand.Must,
      declarationOrder: 3,
      sourceIntent: { type: "SuitOpen", params: { suit: ObsSuit.Hearts } },
      disclosure: Disclosure.Natural,
      teachingLabel: { name: bidName("1♥ opening"), summary: bidSummary("Open 1♥ with 12+ HCP and a 5-card or longer heart suit") },
    }, NATURAL_BIDS_CTX),

    createSurface({
      meaningId: NATURAL_NT_MEANING_IDS.OPEN_1S,
      semanticClassId: BRIDGE_SEMANTIC_CLASSES.SUIT_OPENING_1S,
      encoding: bid(1, BidSuit.Spades),
      clauses: [
        { factId: "hand.hcp", operator: FactOperator.Gte, value: minOpeningHcp, isPublic: true },
        { factId: "hand.spades", operator: FactOperator.Gte, value: majorMin, isPublic: true },
      ],
      band: RecommendationBand.Must,
      declarationOrder: 4,
      sourceIntent: { type: "SuitOpen", params: { suit: ObsSuit.Spades } },
      disclosure: Disclosure.Natural,
      teachingLabel: { name: bidName("1♠ opening"), summary: bidSummary("Open 1♠ with 12+ HCP and a 5-card or longer spade suit") },
    }, NATURAL_BIDS_CTX),
  ];
}
