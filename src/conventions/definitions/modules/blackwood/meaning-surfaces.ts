import type { BidMeaning } from "../../../pipeline/evaluation/meaning";

import { BidSuit } from "../../../../engine/types";
import type { SystemConfig } from "../../system-config";
import {
  SYSTEM_RESPONDER_SLAM_VALUES,
} from "../../system-fact-vocabulary";
import { bidName, bidSummary } from "../../../core/authored-text";

import { bid } from "../../../core/surface-helpers";
import { createSurface, Disclosure } from "../../../core/surface-builder";
import type { ModuleContext } from "../../../core/surface-builder";

import { BLACKWOOD_CLASSES, BLACKWOOD_MEANING_IDS, BLACKWOOD_FACT_IDS } from "./ids";
import { FactOperator, RecommendationBand } from "../../../pipeline/evaluation/meaning";

// ─── Module context ──────────────────────────────────────────

const BLACKWOOD_CTX: ModuleContext = { moduleId: "blackwood" };

// ─── R1 surface: 4NT ace ask ─────────────────────────────────

/** Factory: creates the Blackwood 4NT ace-asking surface. */
export function createBlackwood4NTSurface(_sys: SystemConfig): BidMeaning {
  return createSurface({
    meaningId: BLACKWOOD_MEANING_IDS.ASK_ACES,
    semanticClassId: BLACKWOOD_CLASSES.ASK_ACES,
    encoding: bid(4, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_SLAM_VALUES,
        operator: FactOperator.Boolean,
        value: true,
        rationale: "slam interest",
        isPublic: true,
      },
    ],
    band: RecommendationBand.Should,
    declarationOrder: 0,
    sourceIntent: { type: "BlackwoodAsk", params: { feature: "aces" } },
    disclosure: Disclosure.Standard,
    teachingLabel: { name: bidName("Blackwood 4NT"), summary: bidSummary("Ask partner how many aces they hold to evaluate slam potential") },
  }, BLACKWOOD_CTX);
}

// ─── R2 surfaces: ace count step responses ───────────────────

/** Ace count step responses to 4NT: 5C=0/4, 5D=1, 5H=2, 5S=3. */
export const ACE_RESPONSE_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: BLACKWOOD_MEANING_IDS.RESPONSE_0_ACES,
    semanticClassId: BLACKWOOD_CLASSES.ACE_RESPONSE,
    encoding: bid(5, BidSuit.Clubs),
    clauses: [
      {
        factId: BLACKWOOD_FACT_IDS.ACE_COUNT,
        operator: FactOperator.Eq,
        value: 0,
        isPublic: true,
      },
    ],
    band: RecommendationBand.Must,
    declarationOrder: 0,
    sourceIntent: { type: "ShowAceCount", params: { count: 0 } },
    disclosure: Disclosure.Standard,
    teachingLabel: { name: bidName("5♣ — 0 (or 4) aces"), summary: bidSummary("Show zero aces in response to partner's Blackwood ask") },
  }, BLACKWOOD_CTX),

  createSurface({
    meaningId: BLACKWOOD_MEANING_IDS.RESPONSE_4_ACES,
    semanticClassId: BLACKWOOD_CLASSES.ACE_RESPONSE,
    encoding: bid(5, BidSuit.Clubs),
    clauses: [
      {
        factId: BLACKWOOD_FACT_IDS.ACE_COUNT,
        operator: FactOperator.Eq,
        value: 4,
        isPublic: true,
      },
    ],
    band: RecommendationBand.Must,
    declarationOrder: 0,
    sourceIntent: { type: "ShowAceCount", params: { count: 4 } },
    disclosure: Disclosure.Standard,
    teachingLabel: { name: bidName("5♣ — 0 (or 4) aces"), summary: bidSummary("Show all four aces in response to partner's Blackwood ask") },
  }, BLACKWOOD_CTX),

  createSurface({
    meaningId: BLACKWOOD_MEANING_IDS.RESPONSE_1_ACE,
    semanticClassId: BLACKWOOD_CLASSES.ACE_RESPONSE,
    encoding: bid(5, BidSuit.Diamonds),
    clauses: [
      {
        factId: BLACKWOOD_FACT_IDS.ACE_COUNT,
        operator: FactOperator.Eq,
        value: 1,
        isPublic: true,
      },
    ],
    band: RecommendationBand.Must,
    declarationOrder: 1,
    sourceIntent: { type: "ShowAceCount", params: { count: 1 } },
    disclosure: Disclosure.Standard,
    teachingLabel: { name: bidName("5♦ — 1 ace"), summary: bidSummary("Show exactly one ace in response to partner's Blackwood ask") },
  }, BLACKWOOD_CTX),

  createSurface({
    meaningId: BLACKWOOD_MEANING_IDS.RESPONSE_2_ACES,
    semanticClassId: BLACKWOOD_CLASSES.ACE_RESPONSE,
    encoding: bid(5, BidSuit.Hearts),
    clauses: [
      {
        factId: BLACKWOOD_FACT_IDS.ACE_COUNT,
        operator: FactOperator.Eq,
        value: 2,
        isPublic: true,
      },
    ],
    band: RecommendationBand.Must,
    declarationOrder: 2,
    sourceIntent: { type: "ShowAceCount", params: { count: 2 } },
    disclosure: Disclosure.Standard,
    teachingLabel: { name: bidName("5♥ — 2 aces"), summary: bidSummary("Show exactly two aces in response to partner's Blackwood ask") },
  }, BLACKWOOD_CTX),

  createSurface({
    meaningId: BLACKWOOD_MEANING_IDS.RESPONSE_3_ACES,
    semanticClassId: BLACKWOOD_CLASSES.ACE_RESPONSE,
    encoding: bid(5, BidSuit.Spades),
    clauses: [
      {
        factId: BLACKWOOD_FACT_IDS.ACE_COUNT,
        operator: FactOperator.Eq,
        value: 3,
        isPublic: true,
      },
    ],
    band: RecommendationBand.Must,
    declarationOrder: 3,
    sourceIntent: { type: "ShowAceCount", params: { count: 3 } },
    disclosure: Disclosure.Standard,
    teachingLabel: { name: bidName("5♠ — 3 aces"), summary: bidSummary("Show exactly three aces in response to partner's Blackwood ask") },
  }, BLACKWOOD_CTX),
];

// ─── R3 surfaces: asker follow-up after ace response ─────────

/** Factory: creates Blackwood R3 surfaces (5NT king ask or signoff). */
export function createBlackwoodR3Surfaces(_sys: SystemConfig): readonly BidMeaning[] {
  return [
    createSurface({
      meaningId: BLACKWOOD_MEANING_IDS.ASK_KINGS,
      semanticClassId: BLACKWOOD_CLASSES.ASK_KINGS,
      encoding: bid(5, BidSuit.NoTrump),
      clauses: [],
      band: RecommendationBand.Should,
      declarationOrder: 0,
      sourceIntent: { type: "BlackwoodAsk", params: { feature: "kings" } },
      disclosure: Disclosure.Standard,
      teachingLabel: { name: bidName("Ask for kings"), summary: bidSummary("Confirm all aces are held and ask partner how many kings they have") },
    }, BLACKWOOD_CTX),

    createSurface({
      meaningId: BLACKWOOD_MEANING_IDS.SIGNOFF_SMALL_SLAM,
      semanticClassId: BLACKWOOD_CLASSES.SIGNOFF,
      encoding: bid(6, BidSuit.NoTrump),
      clauses: [],
      band: RecommendationBand.Should,
      declarationOrder: 1,
      sourceIntent: { type: "BlackwoodSignoff", params: { level: "small-slam" } },
      disclosure: Disclosure.Natural,
      teachingLabel: { name: bidName("6NT — small slam signoff"), summary: bidSummary("Bid small slam after confirming sufficient aces for twelve tricks") },
    }, BLACKWOOD_CTX),

    createSurface({
      meaningId: BLACKWOOD_MEANING_IDS.SIGNOFF_5_LEVEL,
      semanticClassId: BLACKWOOD_CLASSES.SIGNOFF,
      encoding: bid(5, BidSuit.NoTrump),
      clauses: [],
      band: RecommendationBand.May,
      declarationOrder: 2,
      sourceIntent: { type: "BlackwoodSignoff", params: { level: "five" } },
      disclosure: Disclosure.Natural,
      teachingLabel: { name: bidName("Sign off"), summary: bidSummary("Stop below slam after learning the partnership is missing too many aces") },
    }, BLACKWOOD_CTX),
  ];
}

// ─── R4 surfaces: king count step responses ──────────────────

/** King count step responses to 5NT: 6C=0, 6D=1, 6H=2, 6S=3. */
export const KING_RESPONSE_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: BLACKWOOD_MEANING_IDS.KING_RESPONSE_0,
    semanticClassId: BLACKWOOD_CLASSES.KING_RESPONSE,
    encoding: bid(6, BidSuit.Clubs),
    clauses: [
      {
        factId: BLACKWOOD_FACT_IDS.KING_COUNT,
        operator: FactOperator.Eq,
        value: 0,
        isPublic: true,
      },
    ],
    band: RecommendationBand.Must,
    declarationOrder: 0,
    sourceIntent: { type: "ShowKingCount", params: { count: 0 } },
    disclosure: Disclosure.Standard,
    teachingLabel: { name: bidName("6♣ — 0 (or 4) kings"), summary: bidSummary("Show zero kings in response to partner's king ask") },
  }, BLACKWOOD_CTX),

  createSurface({
    meaningId: BLACKWOOD_MEANING_IDS.KING_RESPONSE_4,
    semanticClassId: BLACKWOOD_CLASSES.KING_RESPONSE,
    encoding: bid(6, BidSuit.Clubs),
    clauses: [
      {
        factId: BLACKWOOD_FACT_IDS.KING_COUNT,
        operator: FactOperator.Eq,
        value: 4,
        isPublic: true,
      },
    ],
    band: RecommendationBand.Must,
    declarationOrder: 0,
    sourceIntent: { type: "ShowKingCount", params: { count: 4 } },
    disclosure: Disclosure.Standard,
    teachingLabel: { name: bidName("6♣ — 0 (or 4) kings"), summary: bidSummary("Show all four kings in response to partner's king ask") },
  }, BLACKWOOD_CTX),

  createSurface({
    meaningId: BLACKWOOD_MEANING_IDS.KING_RESPONSE_1,
    semanticClassId: BLACKWOOD_CLASSES.KING_RESPONSE,
    encoding: bid(6, BidSuit.Diamonds),
    clauses: [
      {
        factId: BLACKWOOD_FACT_IDS.KING_COUNT,
        operator: FactOperator.Eq,
        value: 1,
        isPublic: true,
      },
    ],
    band: RecommendationBand.Must,
    declarationOrder: 1,
    sourceIntent: { type: "ShowKingCount", params: { count: 1 } },
    disclosure: Disclosure.Standard,
    teachingLabel: { name: bidName("6♦ — 1 king"), summary: bidSummary("Show exactly one king in response to partner's king ask") },
  }, BLACKWOOD_CTX),

  createSurface({
    meaningId: BLACKWOOD_MEANING_IDS.KING_RESPONSE_2,
    semanticClassId: BLACKWOOD_CLASSES.KING_RESPONSE,
    encoding: bid(6, BidSuit.Hearts),
    clauses: [
      {
        factId: BLACKWOOD_FACT_IDS.KING_COUNT,
        operator: FactOperator.Eq,
        value: 2,
        isPublic: true,
      },
    ],
    band: RecommendationBand.Must,
    declarationOrder: 2,
    sourceIntent: { type: "ShowKingCount", params: { count: 2 } },
    disclosure: Disclosure.Standard,
    teachingLabel: { name: bidName("6♥ — 2 kings"), summary: bidSummary("Show exactly two kings in response to partner's king ask") },
  }, BLACKWOOD_CTX),

  createSurface({
    meaningId: BLACKWOOD_MEANING_IDS.KING_RESPONSE_3,
    semanticClassId: BLACKWOOD_CLASSES.KING_RESPONSE,
    encoding: bid(6, BidSuit.Spades),
    clauses: [
      {
        factId: BLACKWOOD_FACT_IDS.KING_COUNT,
        operator: FactOperator.Eq,
        value: 3,
        isPublic: true,
      },
    ],
    band: RecommendationBand.Must,
    declarationOrder: 3,
    sourceIntent: { type: "ShowKingCount", params: { count: 3 } },
    disclosure: Disclosure.Standard,
    teachingLabel: { name: bidName("6♠ — 3 kings"), summary: bidSummary("Show exactly three kings in response to partner's king ask") },
  }, BLACKWOOD_CTX),
];

// ─── R5 surfaces: asker signoff after king response ──────────

export function createBlackwoodR5Surfaces(_sys: SystemConfig): readonly BidMeaning[] {
  return [
    createSurface({
      meaningId: BLACKWOOD_MEANING_IDS.SIGNOFF_GRAND_SLAM,
      semanticClassId: BLACKWOOD_CLASSES.SIGNOFF,
      encoding: bid(7, BidSuit.NoTrump),
      clauses: [],
      band: RecommendationBand.Should,
      declarationOrder: 0,
      sourceIntent: { type: "BlackwoodSignoff", params: { level: "grand-slam" } },
      disclosure: Disclosure.Natural,
      teachingLabel: { name: bidName("7NT — grand slam"), summary: bidSummary("Bid grand slam after confirming all aces and sufficient kings") },
    }, BLACKWOOD_CTX),

    createSurface({
      meaningId: BLACKWOOD_MEANING_IDS.SIGNOFF_SMALL_SLAM,
      semanticClassId: BLACKWOOD_CLASSES.SIGNOFF,
      encoding: bid(6, BidSuit.NoTrump),
      clauses: [],
      band: RecommendationBand.Should,
      declarationOrder: 1,
      sourceIntent: { type: "BlackwoodSignoff", params: { level: "small-slam" } },
      disclosure: Disclosure.Natural,
      teachingLabel: { name: bidName("6NT — small slam signoff"), summary: bidSummary("Settle for small slam after learning the partnership is missing a king") },
    }, BLACKWOOD_CTX),
  ];
}
