import type { BidMeaning } from "../../../pipeline/evaluation/meaning";
import { BidSuit } from "../../../../engine/types";
import { WEAK_TWO_CLASSES, WEAK_TWO_FACT_IDS, WEAK_TWO_MEANING_IDS } from "./ids";
import { bid, suitToBidSuit } from "../../../core/surface-helpers";
import { createSurface, Disclosure } from "../../../core/surface-builder";
import type { ModuleContext } from "../../../core/surface-builder";
import { bidName, bidSummary } from "../../../core/authored-text";
import { FactOperator, RecommendationBand } from "../../../pipeline/evaluation/meaning";
import { ObsSuit } from "../../../pipeline/bid-action";

type WeakTwoSuit = ObsSuit.Hearts | ObsSuit.Spades | ObsSuit.Diamonds;

const WEAK_TWOS_CTX: ModuleContext = { moduleId: "weak-twos" };

// ─── Per-suit meaning ID lookups ─────────────────────────────

const R1_MEANING_ID: Record<WeakTwoSuit, string> = {
  [ObsSuit.Hearts]: WEAK_TWO_MEANING_IDS.OPEN_2H,
  [ObsSuit.Spades]: WEAK_TWO_MEANING_IDS.OPEN_2S,
  [ObsSuit.Diamonds]: WEAK_TWO_MEANING_IDS.OPEN_2D,
};

const R2_GAME_RAISE_ID: Record<WeakTwoSuit, string> = {
  [ObsSuit.Hearts]: WEAK_TWO_MEANING_IDS.GAME_RAISE_HEARTS,
  [ObsSuit.Spades]: WEAK_TWO_MEANING_IDS.GAME_RAISE_SPADES,
  [ObsSuit.Diamonds]: WEAK_TWO_MEANING_IDS.GAME_RAISE_DIAMONDS,
};

const R2_OGUST_ASK_ID: Record<WeakTwoSuit, string> = {
  [ObsSuit.Hearts]: WEAK_TWO_MEANING_IDS.OGUST_ASK_HEARTS,
  [ObsSuit.Spades]: WEAK_TWO_MEANING_IDS.OGUST_ASK_SPADES,
  [ObsSuit.Diamonds]: WEAK_TWO_MEANING_IDS.OGUST_ASK_DIAMONDS,
};

const R2_INVITE_RAISE_ID: Record<WeakTwoSuit, string> = {
  [ObsSuit.Hearts]: WEAK_TWO_MEANING_IDS.INVITE_RAISE_HEARTS,
  [ObsSuit.Spades]: WEAK_TWO_MEANING_IDS.INVITE_RAISE_SPADES,
  [ObsSuit.Diamonds]: WEAK_TWO_MEANING_IDS.INVITE_RAISE_DIAMONDS,
};

const R2_PREEMPTIVE_RAISE_ID: Record<WeakTwoSuit, string> = {
  [ObsSuit.Hearts]: WEAK_TWO_MEANING_IDS.PREEMPTIVE_RAISE_HEARTS,
  [ObsSuit.Spades]: WEAK_TWO_MEANING_IDS.PREEMPTIVE_RAISE_SPADES,
  [ObsSuit.Diamonds]: WEAK_TWO_MEANING_IDS.PREEMPTIVE_RAISE_DIAMONDS,
};

const R2_NEW_SUIT_FORCING_ID: Record<WeakTwoSuit, string> = {
  [ObsSuit.Hearts]: WEAK_TWO_MEANING_IDS.NEW_SUIT_FORCING_HEARTS,
  [ObsSuit.Spades]: WEAK_TWO_MEANING_IDS.NEW_SUIT_FORCING_SPADES,
  [ObsSuit.Diamonds]: WEAK_TWO_MEANING_IDS.NEW_SUIT_FORCING_DIAMONDS,
};

const R2_WEAK_PASS_ID: Record<WeakTwoSuit, string> = {
  [ObsSuit.Hearts]: WEAK_TWO_MEANING_IDS.WEAK_PASS_HEARTS,
  [ObsSuit.Spades]: WEAK_TWO_MEANING_IDS.WEAK_PASS_SPADES,
  [ObsSuit.Diamonds]: WEAK_TWO_MEANING_IDS.WEAK_PASS_DIAMONDS,
};

const NSF_SUPPORT_ID: Record<WeakTwoSuit, string> = {
  [ObsSuit.Hearts]: WEAK_TWO_MEANING_IDS.NSF_SUPPORT_HEARTS,
  [ObsSuit.Spades]: WEAK_TWO_MEANING_IDS.NSF_SUPPORT_SPADES,
  [ObsSuit.Diamonds]: WEAK_TWO_MEANING_IDS.NSF_SUPPORT_DIAMONDS,
};

const NSF_REBID_ID: Record<WeakTwoSuit, string> = {
  [ObsSuit.Hearts]: WEAK_TWO_MEANING_IDS.NSF_REBID_HEARTS,
  [ObsSuit.Spades]: WEAK_TWO_MEANING_IDS.NSF_REBID_SPADES,
  [ObsSuit.Diamonds]: WEAK_TWO_MEANING_IDS.NSF_REBID_DIAMONDS,
};

const OGUST_SOLID_ID: Record<WeakTwoSuit, string> = {
  [ObsSuit.Hearts]: WEAK_TWO_MEANING_IDS.OGUST_SOLID_HEARTS,
  [ObsSuit.Spades]: WEAK_TWO_MEANING_IDS.OGUST_SOLID_SPADES,
  [ObsSuit.Diamonds]: WEAK_TWO_MEANING_IDS.OGUST_SOLID_DIAMONDS,
};

const OGUST_MIN_BAD_ID: Record<WeakTwoSuit, string> = {
  [ObsSuit.Hearts]: WEAK_TWO_MEANING_IDS.OGUST_MIN_BAD_HEARTS,
  [ObsSuit.Spades]: WEAK_TWO_MEANING_IDS.OGUST_MIN_BAD_SPADES,
  [ObsSuit.Diamonds]: WEAK_TWO_MEANING_IDS.OGUST_MIN_BAD_DIAMONDS,
};

const OGUST_MIN_GOOD_ID: Record<WeakTwoSuit, string> = {
  [ObsSuit.Hearts]: WEAK_TWO_MEANING_IDS.OGUST_MIN_GOOD_HEARTS,
  [ObsSuit.Spades]: WEAK_TWO_MEANING_IDS.OGUST_MIN_GOOD_SPADES,
  [ObsSuit.Diamonds]: WEAK_TWO_MEANING_IDS.OGUST_MIN_GOOD_DIAMONDS,
};

const OGUST_MAX_BAD_ID: Record<WeakTwoSuit, string> = {
  [ObsSuit.Hearts]: WEAK_TWO_MEANING_IDS.OGUST_MAX_BAD_HEARTS,
  [ObsSuit.Spades]: WEAK_TWO_MEANING_IDS.OGUST_MAX_BAD_SPADES,
  [ObsSuit.Diamonds]: WEAK_TWO_MEANING_IDS.OGUST_MAX_BAD_DIAMONDS,
};

const OGUST_MAX_GOOD_ID: Record<WeakTwoSuit, string> = {
  [ObsSuit.Hearts]: WEAK_TWO_MEANING_IDS.OGUST_MAX_GOOD_HEARTS,
  [ObsSuit.Spades]: WEAK_TWO_MEANING_IDS.OGUST_MAX_GOOD_SPADES,
  [ObsSuit.Diamonds]: WEAK_TWO_MEANING_IDS.OGUST_MAX_GOOD_DIAMONDS,
};

const POST_OGUST_GAME_ID: Record<WeakTwoSuit, string> = {
  [ObsSuit.Hearts]: WEAK_TWO_MEANING_IDS.POST_OGUST_GAME_HEARTS,
  [ObsSuit.Spades]: WEAK_TWO_MEANING_IDS.POST_OGUST_GAME_SPADES,
  [ObsSuit.Diamonds]: WEAK_TWO_MEANING_IDS.POST_OGUST_GAME_DIAMONDS,
};

const POST_OGUST_SIGNOFF_ID: Record<WeakTwoSuit, string> = {
  [ObsSuit.Hearts]: WEAK_TWO_MEANING_IDS.POST_OGUST_SIGNOFF_HEARTS,
  [ObsSuit.Spades]: WEAK_TWO_MEANING_IDS.POST_OGUST_SIGNOFF_SPADES,
  [ObsSuit.Diamonds]: WEAK_TWO_MEANING_IDS.POST_OGUST_SIGNOFF_DIAMONDS,
};

const POST_OGUST_PASS_ID: Record<WeakTwoSuit, string> = {
  [ObsSuit.Hearts]: WEAK_TWO_MEANING_IDS.POST_OGUST_PASS_HEARTS,
  [ObsSuit.Spades]: WEAK_TWO_MEANING_IDS.POST_OGUST_PASS_SPADES,
  [ObsSuit.Diamonds]: WEAK_TWO_MEANING_IDS.POST_OGUST_PASS_DIAMONDS,
};

// ─── Convention-intrinsic thresholds ────────────────────────
//
// Weak Two thresholds are convention-intrinsic (same in all bidding
// systems). Named constants prevent magic numbers and make the
// values discoverable by enforcement tests.

export const WEAK_TWO_THRESHOLDS = {
  // R1: Opener minimum suit length
  MIN_SUIT_LENGTH: 6,

  // R2: Responder actions (total points = HCP + shortage)
  GAME_RAISE_MIN: 16,
  OGUST_ASK_MIN: 15,
  INVITE_RAISE_MIN: 14,
  INVITE_RAISE_MAX: 15,

  // R2: Responder support requirements
  GAME_RAISE_FIT: 3,
  OGUST_FIT: 2,
  INVITE_FIT: 3,
  PREEMPTIVE_RAISE_FIT: 3,

  // R2: Preemptive raise total points
  PREEMPTIVE_RAISE_MIN: 6,
  PREEMPTIVE_RAISE_MAX: 13,

  // R2: New suit forcing requirements
  NEW_SUIT_FORCING_MIN_HCP: 16,
  NEW_SUIT_FORCING_MIN_LENGTH: 5,

  // R3: Opener rebid after new suit forcing
  NSF_SUPPORT_FIT: 3,

  // R4: Post-Ogust responder rebid
  POST_OGUST_GAME_MIN: 17,
} as const;

function suitLabel(suit: WeakTwoSuit): string {
  switch (suit) {
    case ObsSuit.Hearts: return "H";
    case ObsSuit.Spades: return "S";
    case ObsSuit.Diamonds: return "D";
  }
}

function gameRaiseBid(suit: WeakTwoSuit) {
  if (suit === ObsSuit.Diamonds) return bid(5, BidSuit.Diamonds);
  return bid(4, suitToBidSuit(suit));
}

/** Cheapest new suit bid available after a weak two opening. */
function cheapestNewSuitBid(suit: WeakTwoSuit) {
  // After 2D: 2H is cheapest new suit
  // After 2H: 2S is cheapest new suit
  // After 2S: 3C is cheapest new suit
  switch (suit) {
    case ObsSuit.Diamonds: return bid(2, BidSuit.Hearts);
    case ObsSuit.Hearts: return bid(2, BidSuit.Spades);
    case ObsSuit.Spades: return bid(3, BidSuit.Clubs);
  }
}

// ─── Round 1: Opener weak two bid ───────────────────────────
//
// Priority: hearts (0) > spades (1) > diamonds (2).
// Surfaces use $suit binding — clauses reference hand.suitLength.$suit
// which resolves via surfaceBindings in the meaning evaluator.

function createWeakTwoR1Surfaces(): readonly BidMeaning[] {
  const suits: readonly { suit: WeakTwoSuit; order: number; cls: string }[] = [
    { suit: ObsSuit.Hearts, order: 0, cls: WEAK_TWO_CLASSES.OPEN_2H },
    { suit: ObsSuit.Spades, order: 1, cls: WEAK_TWO_CLASSES.OPEN_2S },
    { suit: ObsSuit.Diamonds, order: 2, cls: WEAK_TWO_CLASSES.OPEN_2D },
  ];

  return suits.map(({ suit, order, cls }) => createSurface({
    meaningId: R1_MEANING_ID[suit],
    semanticClassId: cls,
    encoding: { defaultCall: bid(2, suitToBidSuit(suit)) },
    clauses: [
      {
        factId: "hand.suitLength.$suit",
        operator: FactOperator.Gte,
        value: WEAK_TWO_THRESHOLDS.MIN_SUIT_LENGTH,
        isPublic: true,
      },
      {
        factId: WEAK_TWO_FACT_IDS.IN_OPENING_HCP_RANGE,
        operator: FactOperator.Boolean,
        value: true,
        isPublic: true,
        rationale: "6-11 vul, 5-11 NV",
      },
    ],
    band: RecommendationBand.Must,
    declarationOrder: order,
    sourceIntent: { type: "WeakTwoOpen", params: { suit } },
    disclosure: Disclosure.Standard,
    teachingLabel: { name: bidName(`Open 2${suitLabel(suit)}`), summary: bidSummary("Open preemptively showing a 6+ card suit and weak hand strength") },
    surfaceBindings: { suit },
  }, WEAK_TWOS_CTX));
}

// ─── Round 2: Responder actions after weak two ──────────────
//
// Parameterized by which suit opener showed. Uses surfaceBindings
// so clause factIds resolve to the correct suit.
//
// Game raise: 16+ HCP, 3+ fit → 4M for majors, 5D for diamonds
// Ogust ask: 15+ HCP → 2NT (lower specificity than game raise)
// Invite raise: 14-15 HCP, 3+ fit → 3 of opener's suit
// Preemptive raise: 6-13 total points, 3+ fit → 3 of opener's suit
// New suit forcing: 16+ HCP, 5+ in new suit → cheapest new suit
// Pass: fallback (no action)

function createWeakTwoR2Surfaces(
  suit: WeakTwoSuit,
): readonly BidMeaning[] {
  const bindings = { suit } as const;
  const sl = suitLabel(suit);
  const gameCall = gameRaiseBid(suit);
  const gameLevel = suit === ObsSuit.Diamonds ? 5 : 4;

  return [
    // 1. Game raise: 16+ total points (HCP + shortage), 3+ fit (highest priority)
    createSurface({
      meaningId: R2_GAME_RAISE_ID[suit],
      semanticClassId: WEAK_TWO_CLASSES.GAME_RAISE,
      encoding: { defaultCall: gameCall },
      clauses: [
        {
          factId: "bridge.totalPointsForRaise",
          operator: FactOperator.Gte,
          value: WEAK_TWO_THRESHOLDS.GAME_RAISE_MIN,
          isPublic: true,
          rationale: "HCP + shortage",
        },
        {
          factId: "hand.suitLength.$suit",
          operator: FactOperator.Gte,
          value: WEAK_TWO_THRESHOLDS.GAME_RAISE_FIT,
          isPublic: true,
        },
      ],
      band: RecommendationBand.Must,
      declarationOrder: 0,
      sourceIntent: { type: "GameRaise", params: { suit } },
      disclosure: Disclosure.Natural,
      teachingLabel: { name: bidName(`Game raise (${gameLevel}${sl})`), summary: bidSummary("Raise directly to game with 16+ total points and 3+ card fit") },
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),

    // 2. Ogust ask: 15+ total points → 2NT (lower specificity than game raise)
    createSurface({
      meaningId: R2_OGUST_ASK_ID[suit],
      semanticClassId: WEAK_TWO_CLASSES.OGUST_ASK,
      encoding: { defaultCall: bid(2, BidSuit.NoTrump) },
      clauses: [
        {
          factId: "bridge.totalPointsForRaise",
          operator: FactOperator.Gte,
          value: WEAK_TWO_THRESHOLDS.OGUST_ASK_MIN,
          isPublic: true,
        },
        {
          factId: `hand.suitLength.$suit`,
          operator: FactOperator.Gte,
          value: WEAK_TWO_THRESHOLDS.OGUST_FIT,
          rationale: "usually shows fit",
        },
      ],
      band: RecommendationBand.Should,
      declarationOrder: 1,
      sourceIntent: { type: "OgustAsk", params: { suit } },
      disclosure: Disclosure.Alert,
      teachingLabel: { name: bidName("Ogust ask (2NT)"), summary: bidSummary("Ask opener to describe hand strength and suit quality via Ogust responses") },
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),

    // 3. Invite raise: 14-15 total points, 3+ fit → 3 of opener's suit
    createSurface({
      meaningId: R2_INVITE_RAISE_ID[suit],
      semanticClassId: WEAK_TWO_CLASSES.INVITE_RAISE,
      encoding: { defaultCall: bid(3, suitToBidSuit(suit)) },
      clauses: [
        {
          factId: "bridge.totalPointsForRaise",
          operator: FactOperator.Range,
          value: { min: WEAK_TWO_THRESHOLDS.INVITE_RAISE_MIN, max: WEAK_TWO_THRESHOLDS.INVITE_RAISE_MAX },
          isPublic: true,
          rationale: "HCP + shortage",
        },
        {
          factId: "hand.suitLength.$suit",
          operator: FactOperator.Gte,
          value: WEAK_TWO_THRESHOLDS.INVITE_FIT,
          isPublic: true,
        },
      ],
      band: RecommendationBand.Should,
      declarationOrder: 2,
      sourceIntent: { type: "InviteRaise", params: { suit } },
      disclosure: Disclosure.Natural,
      teachingLabel: { name: bidName(`Invite raise (3${sl})`), summary: bidSummary("Invite game with 14-15 total points and 3+ card support") },
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),

    // 3.5. Preemptive raise: 6-13 total points, 3+ fit → 3 of opener's suit
    createSurface({
      meaningId: R2_PREEMPTIVE_RAISE_ID[suit],
      semanticClassId: WEAK_TWO_CLASSES.PREEMPTIVE_RAISE,
      encoding: { defaultCall: bid(3, suitToBidSuit(suit)) },
      clauses: [
        {
          factId: "bridge.totalPointsForRaise",
          operator: FactOperator.Range,
          value: { min: WEAK_TWO_THRESHOLDS.PREEMPTIVE_RAISE_MIN, max: WEAK_TWO_THRESHOLDS.PREEMPTIVE_RAISE_MAX },
          isPublic: true,
          rationale: "HCP + shortage",
        },
        {
          factId: "hand.suitLength.$suit",
          operator: FactOperator.Gte,
          value: WEAK_TWO_THRESHOLDS.PREEMPTIVE_RAISE_FIT,
          isPublic: true,
        },
      ],
      band: RecommendationBand.Should,
      declarationOrder: 3,
      sourceIntent: { type: "PreemptiveRaise", params: { suit } },
      disclosure: Disclosure.Natural,
      teachingLabel: { name: bidName(`Preemptive raise (3${sl})`), summary: bidSummary("Raise preemptively with 3+ fit to block opponents despite weak values") },
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),

    // 4. New suit forcing: 16+ HCP, 5+ in new suit → cheapest new suit bid
    createSurface({
      meaningId: R2_NEW_SUIT_FORCING_ID[suit],
      semanticClassId: WEAK_TWO_CLASSES.NEW_SUIT_FORCING,
      encoding: { defaultCall: cheapestNewSuitBid(suit) },
      clauses: [
        {
          factId: "hand.hcp",
          operator: FactOperator.Gte,
          value: WEAK_TWO_THRESHOLDS.NEW_SUIT_FORCING_MIN_HCP,
          isPublic: true,
        },
        {
          factId: `module.weakTwo.hasNewSuit.$suit`,
          operator: FactOperator.Boolean,
          value: true,
          isPublic: true,
          rationale: "5+ in a non-opener suit",
        },
      ],
      band: RecommendationBand.Should,
      declarationOrder: 4,
      sourceIntent: { type: "NewSuitForcing", params: { suit } },
      disclosure: Disclosure.Natural,
      teachingLabel: { name: bidName("New suit forcing"), summary: bidSummary("Bid a new 5+ card suit forcing opener to rebid, exploring for a better fit") },
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),

    // 5. Pass (fallback — no convention bid applies)
    createSurface({
      meaningId: R2_WEAK_PASS_ID[suit],
      semanticClassId: WEAK_TWO_CLASSES.WEAK_PASS,
      encoding: { defaultCall: { type: "pass" } },
      clauses: [],
      band: RecommendationBand.Avoid,
      declarationOrder: 5,
      sourceIntent: { type: "WeakPass", params: { suit } },
      disclosure: Disclosure.Natural,
      teachingLabel: { name: bidName("Pass (no action)"), summary: bidSummary("Decline to act with insufficient values or fit for any conventional response") },
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),
  ];
}

// ─── Round 3: Ogust rebid (opener describes hand) ───────────
//
// After 2NT Ogust ask, opener classifies hand along two dimensions:
//   1. Strength: minimum (5-7 NV / 6-7 vul) vs maximum (8-11 HCP)
//   2. Quality: bad (0-1 top honors) vs good (2+ top honors)
// Special case: solid (AKQ in suit) → 3NT
//
// Responses are fixed bids (not suit-parameterized):
//   3NT = solid (AKQ), 3C = min/bad, 3D = min/good,
//   3H = max/bad, 3S = max/good

function createWeakTwoOgustSurfaces(
  suit: WeakTwoSuit,
): readonly BidMeaning[] {
  const bindings = { suit } as const;

  return [
    // 1. Solid: AKQ in suit → 3NT (highest priority — checked first)
    createSurface({
      meaningId: OGUST_SOLID_ID[suit],
      semanticClassId: WEAK_TWO_CLASSES.OGUST_SOLID,
      encoding: { defaultCall: bid(3, BidSuit.NoTrump) },
      clauses: [
        {
          factId: "module.weakTwo.isSolid.$suit",
          operator: FactOperator.Boolean,
          value: true,
          isPublic: true,
          rationale: "solid",
        },
      ],
      band: RecommendationBand.Must,
      declarationOrder: 0,
      sourceIntent: { type: "OgustSolid", params: { suit } },
      disclosure: Disclosure.Alert,
      teachingLabel: { name: bidName("Ogust solid (3NT)"), summary: bidSummary("Show a solid suit headed by AKQ, suggesting 3NT as the final contract") },
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),

    // 2. Min bad: 5-7 NV / 6-7 vul HCP, 0-1 top honors → 3C
    createSurface({
      meaningId: OGUST_MIN_BAD_ID[suit],
      semanticClassId: WEAK_TWO_CLASSES.OGUST_MIN_BAD,
      encoding: { defaultCall: bid(3, BidSuit.Clubs) },
      clauses: [
        {
          factId: WEAK_TWO_FACT_IDS.IS_MINIMUM,
          operator: FactOperator.Boolean,
          value: true,
          isPublic: true,
          rationale: "5-7 NV, 6-7 vul",
        },
        {
          factId: "module.weakTwo.topHonorCount.$suit",
          operator: FactOperator.Lte,
          value: 1,
          isPublic: true,
          rationale: "bad suit",
        },
      ],
      band: RecommendationBand.Must,
      declarationOrder: 1,
      sourceIntent: { type: "OgustMinBad", params: { suit } },
      disclosure: Disclosure.Alert,
      teachingLabel: { name: bidName("Ogust min/bad (3C)"), summary: bidSummary("Show minimum strength with a bad suit (0-1 top honors)") },
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),

    // 3. Min good: 5-7 NV / 6-7 vul HCP, 2+ top honors → 3D
    createSurface({
      meaningId: OGUST_MIN_GOOD_ID[suit],
      semanticClassId: WEAK_TWO_CLASSES.OGUST_MIN_GOOD,
      encoding: { defaultCall: bid(3, BidSuit.Diamonds) },
      clauses: [
        {
          factId: WEAK_TWO_FACT_IDS.IS_MINIMUM,
          operator: FactOperator.Boolean,
          value: true,
          isPublic: true,
          rationale: "5-7 NV, 6-7 vul",
        },
        {
          factId: "module.weakTwo.topHonorCount.$suit",
          operator: FactOperator.Gte,
          value: 2,
          isPublic: true,
          rationale: "good suit",
        },
      ],
      band: RecommendationBand.Must,
      declarationOrder: 2,
      sourceIntent: { type: "OgustMinGood", params: { suit } },
      disclosure: Disclosure.Alert,
      teachingLabel: { name: bidName("Ogust min/good (3D)"), summary: bidSummary("Show minimum strength with a good suit (2+ top honors)") },
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),

    // 4. Max bad: 8-11 HCP, 0-1 top honors → 3H
    createSurface({
      meaningId: OGUST_MAX_BAD_ID[suit],
      semanticClassId: WEAK_TWO_CLASSES.OGUST_MAX_BAD,
      encoding: { defaultCall: bid(3, BidSuit.Hearts) },
      clauses: [
        {
          factId: WEAK_TWO_FACT_IDS.IS_MAXIMUM,
          operator: FactOperator.Boolean,
          value: true,
          isPublic: true,
          rationale: "8-11 HCP",
        },
        {
          factId: "module.weakTwo.topHonorCount.$suit",
          operator: FactOperator.Lte,
          value: 1,
          isPublic: true,
          rationale: "bad suit",
        },
      ],
      band: RecommendationBand.Must,
      declarationOrder: 3,
      sourceIntent: { type: "OgustMaxBad", params: { suit } },
      disclosure: Disclosure.Alert,
      teachingLabel: { name: bidName("Ogust max/bad (3H)"), summary: bidSummary("Show maximum strength with a bad suit (0-1 top honors)") },
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),

    // 5. Max good: 8-11 HCP, 2+ top honors → 3S
    createSurface({
      meaningId: OGUST_MAX_GOOD_ID[suit],
      semanticClassId: WEAK_TWO_CLASSES.OGUST_MAX_GOOD,
      encoding: { defaultCall: bid(3, BidSuit.Spades) },
      clauses: [
        {
          factId: WEAK_TWO_FACT_IDS.IS_MAXIMUM,
          operator: FactOperator.Boolean,
          value: true,
          isPublic: true,
          rationale: "8-11 HCP",
        },
        {
          factId: "module.weakTwo.topHonorCount.$suit",
          operator: FactOperator.Gte,
          value: 2,
          isPublic: true,
          rationale: "good suit",
        },
      ],
      band: RecommendationBand.Must,
      declarationOrder: 4,
      sourceIntent: { type: "OgustMaxGood", params: { suit } },
      disclosure: Disclosure.Alert,
      teachingLabel: { name: bidName("Ogust max/good (3S)"), summary: bidSummary("Show maximum strength with a good suit (2+ top honors)") },
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),
  ];
}

// ─── Round 4: Responder rebid after Ogust response ──────────
//
// After opener describes hand via Ogust, responder makes a natural
// rebid. Responder MUST NOT pass when the contract sits in an
// artificial suit (3C/3D for hearts/spades, 3C for diamonds).
//
// Game: 17+ HCP → bid game in agreed suit
// Signoff: sign off in agreed suit at 3-level (when Ogust response
//          was below the agreed suit)
// Pass: fallback (when already in agreed suit or higher)

function createPostOgustSurfaces(
  suit: WeakTwoSuit,
): readonly BidMeaning[] {
  const bindings = { suit } as const;
  const gameCall = gameRaiseBid(suit);

  return [
    // 1. Bid game: 17+ HCP → game in agreed suit (highest priority)
    createSurface({
      meaningId: POST_OGUST_GAME_ID[suit],
      semanticClassId: WEAK_TWO_CLASSES.POST_OGUST_GAME,
      encoding: { defaultCall: gameCall },
      clauses: [
        {
          factId: "hand.hcp",
          operator: FactOperator.Gte,
          value: WEAK_TWO_THRESHOLDS.POST_OGUST_GAME_MIN,
          isPublic: true,
        },
      ],
      band: RecommendationBand.Must,
      declarationOrder: 0,
      sourceIntent: { type: "PostOgustGame", params: { suit } },
      disclosure: Disclosure.Alert,
      teachingLabel: { name: bidName(`Bid game in ${suit}`), summary: bidSummary("Bid game after Ogust confirms sufficient combined strength") },
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),

    // 1.5. 3NT alternative (diamonds only): when responder has game values
    // and may prefer 3NT to 5D with balanced hand / stoppers
    ...(suit === ObsSuit.Diamonds ? [
      createSurface({
        meaningId: WEAK_TWO_MEANING_IDS.POST_OGUST_3NT_DIAMONDS,
        semanticClassId: WEAK_TWO_CLASSES.POST_OGUST_3NT,
        encoding: { defaultCall: bid(3, BidSuit.NoTrump) },
        clauses: [
          {
            factId: "hand.hcp",
            operator: FactOperator.Gte,
            value: WEAK_TWO_THRESHOLDS.POST_OGUST_GAME_MIN,
            isPublic: true,
          },
        ],
        band: RecommendationBand.Must,
        declarationOrder: 0,
        sourceIntent: { type: "PostOgust3NT", params: { suit } },
        disclosure: Disclosure.Alert,
        teachingLabel: { name: bidName("3NT game (alternative to 5D)"), summary: bidSummary("Choose 3NT over 5D as a more practical nine-trick game contract") },
        surfaceBindings: bindings,
      }, WEAK_TWOS_CTX),
    ] : []),

    // 2. Sign off in agreed suit at 3-level (when Ogust response was below suit)
    createSurface({
      meaningId: POST_OGUST_SIGNOFF_ID[suit],
      semanticClassId: WEAK_TWO_CLASSES.POST_OGUST_SIGNOFF,
      encoding: { defaultCall: bid(3, suitToBidSuit(suit)) },
      clauses: [],
      band: RecommendationBand.Should,
      declarationOrder: 1,
      sourceIntent: { type: "PostOgustSignoff", params: { suit } },
      disclosure: Disclosure.Natural,
      teachingLabel: { name: bidName(`Sign off in ${suit}`), summary: bidSummary("Return to the agreed suit at the 3-level to stop below game") },
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),

    // 3. Pass (fallback — when already in agreed suit or 3NT)
    createSurface({
      meaningId: POST_OGUST_PASS_ID[suit],
      semanticClassId: WEAK_TWO_CLASSES.POST_OGUST_PASS,
      encoding: { defaultCall: { type: "pass" } },
      clauses: [],
      band: RecommendationBand.Avoid,
      declarationOrder: 2,
      sourceIntent: { type: "PostOgustPass", params: { suit } },
      disclosure: Disclosure.Natural,
      teachingLabel: { name: bidName("Pass"), summary: bidSummary("Accept the current Ogust response as the final contract") },
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),
  ];
}

// ─── Opener rebid after new suit forcing ─────────────────────
//
// After responder bids a new suit (forcing), opener either:
//   1. Supports responder's suit with 3+ cards
//   2. Rebids own suit (default fallback)

function createNsfRebidSurfaces(
  suit: WeakTwoSuit,
): readonly BidMeaning[] {
  const bindings = { suit } as const;
  const sl = suitLabel(suit);

  return [
    // 1. Support responder's new suit: 3+ cards in responder's suit
    createSurface({
      meaningId: NSF_SUPPORT_ID[suit],
      semanticClassId: WEAK_TWO_CLASSES.NSF_SUPPORT,
      encoding: { defaultCall: bid(3, suitToBidSuit(suit)) },
      clauses: [
        {
          factId: `module.weakTwo.hasNsfSupport.$suit`,
          operator: FactOperator.Boolean,
          value: true,
          isPublic: true,
          rationale: "3+ cards in responder's suit",
        },
      ],
      band: RecommendationBand.Should,
      declarationOrder: 0,
      sourceIntent: { type: "NsfSupport", params: { suit } },
      disclosure: Disclosure.Natural,
      teachingLabel: { name: bidName("Support new suit"), summary: bidSummary("Raise responder's new suit showing 3+ card support") },
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),

    // 2. Rebid own suit (fallback)
    createSurface({
      meaningId: NSF_REBID_ID[suit],
      semanticClassId: WEAK_TWO_CLASSES.NSF_REBID,
      encoding: { defaultCall: bid(3, suitToBidSuit(suit)) },
      clauses: [],
      band: RecommendationBand.Should,
      declarationOrder: 1,
      sourceIntent: { type: "NsfRebid", params: { suit } },
      disclosure: Disclosure.Natural,
      teachingLabel: { name: bidName(`Rebid ${sl}`), summary: bidSummary("Rebid the original suit denying support for responder's new suit") },
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),
  ];
}

// ─── Pre-instantiated surfaces ──────────────────────────────

/** R1: Opener weak two surfaces (all 3 suits in one group). */
export const WEAK_TWO_R1_SURFACES = createWeakTwoR1Surfaces();

/** R2: Responder surfaces per suit. */
export const WEAK_TWO_R2_HEARTS_SURFACES = createWeakTwoR2Surfaces(ObsSuit.Hearts);
export const WEAK_TWO_R2_SPADES_SURFACES = createWeakTwoR2Surfaces(ObsSuit.Spades);
export const WEAK_TWO_R2_DIAMONDS_SURFACES = createWeakTwoR2Surfaces(ObsSuit.Diamonds);

/** R3: Ogust response surfaces per suit. */
export const WEAK_TWO_OGUST_HEARTS_SURFACES = createWeakTwoOgustSurfaces(ObsSuit.Hearts);
export const WEAK_TWO_OGUST_SPADES_SURFACES = createWeakTwoOgustSurfaces(ObsSuit.Spades);
export const WEAK_TWO_OGUST_DIAMONDS_SURFACES = createWeakTwoOgustSurfaces(ObsSuit.Diamonds);

/** R3: Opener rebid after new suit forcing per suit. */
export const NSF_REBID_HEARTS_SURFACES = createNsfRebidSurfaces(ObsSuit.Hearts);
export const NSF_REBID_SPADES_SURFACES = createNsfRebidSurfaces(ObsSuit.Spades);
export const NSF_REBID_DIAMONDS_SURFACES = createNsfRebidSurfaces(ObsSuit.Diamonds);

/** R4: Responder rebid after Ogust surfaces per suit. */
export const POST_OGUST_HEARTS_SURFACES = createPostOgustSurfaces(ObsSuit.Hearts);
export const POST_OGUST_SPADES_SURFACES = createPostOgustSurfaces(ObsSuit.Spades);
export const POST_OGUST_DIAMONDS_SURFACES = createPostOgustSurfaces(ObsSuit.Diamonds);
