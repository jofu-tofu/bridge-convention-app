import type { BidMeaning } from "../../../pipeline/meaning";
import { BidSuit } from "../../../../engine/types";
import { WEAK_TWO_CLASSES } from "./semantic-classes";
import { bid, suitToBidSuit } from "../../../core/surface-helpers";
import { createSurface } from "../../../core/surface-builder";
import type { ModuleContext } from "../../../core/surface-builder";
import { WEAK_TWO_FACT_IDS } from "./fact-ids";
import { WEAK_TWO_MEANING_IDS } from "./meaning-ids";

type WeakTwoSuit = "hearts" | "spades" | "diamonds";

const WEAK_TWOS_CTX: ModuleContext = { moduleId: "weak-twos" };

// ─── Per-suit meaning ID lookups ─────────────────────────────

const R1_MEANING_ID: Record<WeakTwoSuit, string> = {
  hearts: WEAK_TWO_MEANING_IDS.OPEN_2H,
  spades: WEAK_TWO_MEANING_IDS.OPEN_2S,
  diamonds: WEAK_TWO_MEANING_IDS.OPEN_2D,
};

const R2_GAME_RAISE_ID: Record<WeakTwoSuit, string> = {
  hearts: WEAK_TWO_MEANING_IDS.GAME_RAISE_HEARTS,
  spades: WEAK_TWO_MEANING_IDS.GAME_RAISE_SPADES,
  diamonds: WEAK_TWO_MEANING_IDS.GAME_RAISE_DIAMONDS,
};

const R2_OGUST_ASK_ID: Record<WeakTwoSuit, string> = {
  hearts: WEAK_TWO_MEANING_IDS.OGUST_ASK_HEARTS,
  spades: WEAK_TWO_MEANING_IDS.OGUST_ASK_SPADES,
  diamonds: WEAK_TWO_MEANING_IDS.OGUST_ASK_DIAMONDS,
};

const R2_INVITE_RAISE_ID: Record<WeakTwoSuit, string> = {
  hearts: WEAK_TWO_MEANING_IDS.INVITE_RAISE_HEARTS,
  spades: WEAK_TWO_MEANING_IDS.INVITE_RAISE_SPADES,
  diamonds: WEAK_TWO_MEANING_IDS.INVITE_RAISE_DIAMONDS,
};

const R2_WEAK_PASS_ID: Record<WeakTwoSuit, string> = {
  hearts: WEAK_TWO_MEANING_IDS.WEAK_PASS_HEARTS,
  spades: WEAK_TWO_MEANING_IDS.WEAK_PASS_SPADES,
  diamonds: WEAK_TWO_MEANING_IDS.WEAK_PASS_DIAMONDS,
};

const OGUST_SOLID_ID: Record<WeakTwoSuit, string> = {
  hearts: WEAK_TWO_MEANING_IDS.OGUST_SOLID_HEARTS,
  spades: WEAK_TWO_MEANING_IDS.OGUST_SOLID_SPADES,
  diamonds: WEAK_TWO_MEANING_IDS.OGUST_SOLID_DIAMONDS,
};

const OGUST_MIN_BAD_ID: Record<WeakTwoSuit, string> = {
  hearts: WEAK_TWO_MEANING_IDS.OGUST_MIN_BAD_HEARTS,
  spades: WEAK_TWO_MEANING_IDS.OGUST_MIN_BAD_SPADES,
  diamonds: WEAK_TWO_MEANING_IDS.OGUST_MIN_BAD_DIAMONDS,
};

const OGUST_MIN_GOOD_ID: Record<WeakTwoSuit, string> = {
  hearts: WEAK_TWO_MEANING_IDS.OGUST_MIN_GOOD_HEARTS,
  spades: WEAK_TWO_MEANING_IDS.OGUST_MIN_GOOD_SPADES,
  diamonds: WEAK_TWO_MEANING_IDS.OGUST_MIN_GOOD_DIAMONDS,
};

const OGUST_MAX_BAD_ID: Record<WeakTwoSuit, string> = {
  hearts: WEAK_TWO_MEANING_IDS.OGUST_MAX_BAD_HEARTS,
  spades: WEAK_TWO_MEANING_IDS.OGUST_MAX_BAD_SPADES,
  diamonds: WEAK_TWO_MEANING_IDS.OGUST_MAX_BAD_DIAMONDS,
};

const OGUST_MAX_GOOD_ID: Record<WeakTwoSuit, string> = {
  hearts: WEAK_TWO_MEANING_IDS.OGUST_MAX_GOOD_HEARTS,
  spades: WEAK_TWO_MEANING_IDS.OGUST_MAX_GOOD_SPADES,
  diamonds: WEAK_TWO_MEANING_IDS.OGUST_MAX_GOOD_DIAMONDS,
};

const POST_OGUST_GAME_ID: Record<WeakTwoSuit, string> = {
  hearts: WEAK_TWO_MEANING_IDS.POST_OGUST_GAME_HEARTS,
  spades: WEAK_TWO_MEANING_IDS.POST_OGUST_GAME_SPADES,
  diamonds: WEAK_TWO_MEANING_IDS.POST_OGUST_GAME_DIAMONDS,
};

const POST_OGUST_SIGNOFF_ID: Record<WeakTwoSuit, string> = {
  hearts: WEAK_TWO_MEANING_IDS.POST_OGUST_SIGNOFF_HEARTS,
  spades: WEAK_TWO_MEANING_IDS.POST_OGUST_SIGNOFF_SPADES,
  diamonds: WEAK_TWO_MEANING_IDS.POST_OGUST_SIGNOFF_DIAMONDS,
};

const POST_OGUST_PASS_ID: Record<WeakTwoSuit, string> = {
  hearts: WEAK_TWO_MEANING_IDS.POST_OGUST_PASS_HEARTS,
  spades: WEAK_TWO_MEANING_IDS.POST_OGUST_PASS_SPADES,
  diamonds: WEAK_TWO_MEANING_IDS.POST_OGUST_PASS_DIAMONDS,
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

  // R4: Post-Ogust responder rebid
  POST_OGUST_GAME_MIN: 17,
} as const;

function suitLabel(suit: WeakTwoSuit): string {
  switch (suit) {
    case "hearts": return "H";
    case "spades": return "S";
    case "diamonds": return "D";
  }
}

function gameRaiseBid(suit: WeakTwoSuit) {
  if (suit === "diamonds") return bid(5, BidSuit.Diamonds);
  return bid(4, suitToBidSuit(suit));
}

// ─── Round 1: Opener weak two bid ───────────────────────────
//
// Priority: hearts (0) > spades (1) > diamonds (2).
// Surfaces use $suit binding — clauses reference hand.suitLength.$suit
// which resolves via surfaceBindings in the meaning evaluator.

function createWeakTwoR1Surfaces(): readonly BidMeaning[] {
  const suits: readonly { suit: WeakTwoSuit; order: number; cls: string }[] = [
    { suit: "hearts", order: 0, cls: WEAK_TWO_CLASSES.OPEN_2H },
    { suit: "spades", order: 1, cls: WEAK_TWO_CLASSES.OPEN_2S },
    { suit: "diamonds", order: 2, cls: WEAK_TWO_CLASSES.OPEN_2D },
  ];

  return suits.map(({ suit, order, cls }) => createSurface({
    meaningId: R1_MEANING_ID[suit],
    semanticClassId: cls,
    encoding: { defaultCall: bid(2, suitToBidSuit(suit)) },
    clauses: [
      {
        factId: "hand.suitLength.$suit",
        operator: "gte",
        value: WEAK_TWO_THRESHOLDS.MIN_SUIT_LENGTH,
        isPublic: true,
      },
      {
        factId: WEAK_TWO_FACT_IDS.IN_OPENING_HCP_RANGE,
        operator: "boolean",
        value: true,
        isPublic: true,
        description: "HCP in opening range (6-11 vul, 5-11 NV)",
      },
    ],
    band: "must",
    declarationOrder: order,
    sourceIntent: { type: "WeakTwoOpen", params: { suit } },
    disclosure: "standard",
    teachingLabel: `Open 2${suitLabel(suit)}`,
    surfaceBindings: { suit },
  }, WEAK_TWOS_CTX));
}

// ─── Round 2: Responder actions after weak two ──────────────
//
// Parameterized by which suit opener showed. Uses surfaceBindings
// so clause factIds resolve to the correct suit.
//
// Game raise: 16+ HCP, 3+ fit → 4M for majors, 5D for diamonds
// Ogust ask: 16+ HCP → 2NT (lower specificity than game raise)
// Invite raise: 14-15 HCP, 3+ fit → 3 of opener's suit
// Pass: fallback (no action in 10-13 HCP range)

function createWeakTwoR2Surfaces(
  suit: WeakTwoSuit,
): readonly BidMeaning[] {
  const bindings = { suit } as const;
  const sl = suitLabel(suit);
  const gameCall = gameRaiseBid(suit);
  const gameLevel = suit === "diamonds" ? 5 : 4;

  return [
    // 1. Game raise: 16+ total points (HCP + shortage), 3+ fit (highest priority)
    createSurface({
      meaningId: R2_GAME_RAISE_ID[suit],
      semanticClassId: WEAK_TWO_CLASSES.GAME_RAISE,
      encoding: { defaultCall: gameCall },
      clauses: [
        {
          factId: "bridge.totalPointsForRaise",
          operator: "gte",
          value: WEAK_TWO_THRESHOLDS.GAME_RAISE_MIN,
          isPublic: true,
          description: "16+ total points (HCP + shortage) for game",
        },
        {
          factId: "hand.suitLength.$suit",
          operator: "gte",
          value: WEAK_TWO_THRESHOLDS.GAME_RAISE_FIT,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 0,
      sourceIntent: { type: "GameRaise", params: { suit } },
      disclosure: "natural",
      teachingLabel: `Game raise (${gameLevel}${sl})`,
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
          operator: "gte",
          value: WEAK_TWO_THRESHOLDS.OGUST_ASK_MIN,
          isPublic: true,
          description: "15+ total points for Ogust inquiry",
        },
        {
          factId: `hand.suitLength.$suit`,
          operator: "gte",
          value: WEAK_TWO_THRESHOLDS.OGUST_FIT,
          description: "2+ support for Ogust (usually shows fit)",
        },
      ],
      band: "should",
      declarationOrder: 1,
      sourceIntent: { type: "OgustAsk", params: { suit } },
      disclosure: "alert",
      teachingLabel: "Ogust ask (2NT)",
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
          operator: "range",
          value: { min: WEAK_TWO_THRESHOLDS.INVITE_RAISE_MIN, max: WEAK_TWO_THRESHOLDS.INVITE_RAISE_MAX },
          isPublic: true,
          description: "14-15 total points (HCP + shortage) for invite",
        },
        {
          factId: "hand.suitLength.$suit",
          operator: "gte",
          value: WEAK_TWO_THRESHOLDS.INVITE_FIT,
          isPublic: true,
        },
      ],
      band: "should",
      declarationOrder: 2,
      sourceIntent: { type: "InviteRaise", params: { suit } },
      disclosure: "natural",
      teachingLabel: `Invite raise (3${sl})`,
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),

    // 4. Pass (fallback — no convention bid applies)
    createSurface({
      meaningId: R2_WEAK_PASS_ID[suit],
      semanticClassId: WEAK_TWO_CLASSES.WEAK_PASS,
      encoding: { defaultCall: { type: "pass" } },
      clauses: [],
      band: "avoid",
      declarationOrder: 3,
      sourceIntent: { type: "WeakPass", params: { suit } },
      disclosure: "natural",
      teachingLabel: "Pass (no action)",
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),
  ];
}

// ─── Round 3: Ogust rebid (opener describes hand) ───────────
//
// After 2NT Ogust ask, opener classifies hand along two dimensions:
//   1. Strength: minimum (5-8 NV / 6-8 vul) vs maximum (9-11 HCP)
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
          operator: "boolean",
          value: true,
          isPublic: true,
          description: "AKQ in opened suit (solid)",
        },
      ],
      band: "must",
      declarationOrder: 0,
      sourceIntent: { type: "OgustSolid", params: { suit } },
      disclosure: "alert",
      teachingLabel: "Ogust solid (3NT)",
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),

    // 2. Min bad: 5-8 NV / 6-8 vul HCP, 0-1 top honors → 3C
    createSurface({
      meaningId: OGUST_MIN_BAD_ID[suit],
      semanticClassId: WEAK_TWO_CLASSES.OGUST_MIN_BAD,
      encoding: { defaultCall: bid(3, BidSuit.Clubs) },
      clauses: [
        {
          factId: WEAK_TWO_FACT_IDS.IS_MINIMUM,
          operator: "boolean",
          value: true,
          isPublic: true,
          description: "Minimum range (5-8 NV, 6-8 vul)",
        },
        {
          factId: "module.weakTwo.topHonorCount.$suit",
          operator: "lte",
          value: 1,
          isPublic: true,
          description: "0-1 top honors (bad suit)",
        },
      ],
      band: "must",
      declarationOrder: 1,
      sourceIntent: { type: "OgustMinBad", params: { suit } },
      disclosure: "alert",
      teachingLabel: "Ogust min/bad (3C)",
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),

    // 3. Min good: 5-8 NV / 6-8 vul HCP, 2+ top honors → 3D
    createSurface({
      meaningId: OGUST_MIN_GOOD_ID[suit],
      semanticClassId: WEAK_TWO_CLASSES.OGUST_MIN_GOOD,
      encoding: { defaultCall: bid(3, BidSuit.Diamonds) },
      clauses: [
        {
          factId: WEAK_TWO_FACT_IDS.IS_MINIMUM,
          operator: "boolean",
          value: true,
          isPublic: true,
          description: "Minimum range (5-8 NV, 6-8 vul)",
        },
        {
          factId: "module.weakTwo.topHonorCount.$suit",
          operator: "gte",
          value: 2,
          isPublic: true,
          description: "2+ top honors (good suit)",
        },
      ],
      band: "must",
      declarationOrder: 2,
      sourceIntent: { type: "OgustMinGood", params: { suit } },
      disclosure: "alert",
      teachingLabel: "Ogust min/good (3D)",
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),

    // 4. Max bad: 9-11 HCP, 0-1 top honors → 3H
    createSurface({
      meaningId: OGUST_MAX_BAD_ID[suit],
      semanticClassId: WEAK_TWO_CLASSES.OGUST_MAX_BAD,
      encoding: { defaultCall: bid(3, BidSuit.Hearts) },
      clauses: [
        {
          factId: WEAK_TWO_FACT_IDS.IS_MAXIMUM,
          operator: "boolean",
          value: true,
          isPublic: true,
          description: "Maximum range (9-11 HCP)",
        },
        {
          factId: "module.weakTwo.topHonorCount.$suit",
          operator: "lte",
          value: 1,
          isPublic: true,
          description: "0-1 top honors (bad suit)",
        },
      ],
      band: "must",
      declarationOrder: 3,
      sourceIntent: { type: "OgustMaxBad", params: { suit } },
      disclosure: "alert",
      teachingLabel: "Ogust max/bad (3H)",
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),

    // 5. Max good: 9-11 HCP, 2+ top honors → 3S
    createSurface({
      meaningId: OGUST_MAX_GOOD_ID[suit],
      semanticClassId: WEAK_TWO_CLASSES.OGUST_MAX_GOOD,
      encoding: { defaultCall: bid(3, BidSuit.Spades) },
      clauses: [
        {
          factId: WEAK_TWO_FACT_IDS.IS_MAXIMUM,
          operator: "boolean",
          value: true,
          isPublic: true,
          description: "Maximum range (9-11 HCP)",
        },
        {
          factId: "module.weakTwo.topHonorCount.$suit",
          operator: "gte",
          value: 2,
          isPublic: true,
          description: "2+ top honors (good suit)",
        },
      ],
      band: "must",
      declarationOrder: 4,
      sourceIntent: { type: "OgustMaxGood", params: { suit } },
      disclosure: "alert",
      teachingLabel: "Ogust max/good (3S)",
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
          operator: "gte",
          value: WEAK_TWO_THRESHOLDS.POST_OGUST_GAME_MIN,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 0,
      sourceIntent: { type: "PostOgustGame", params: { suit } },
      disclosure: "alert",
      teachingLabel: `Bid game in ${suit}`,
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),

    // 1.5. 3NT alternative (diamonds only): when responder has game values
    // and may prefer 3NT to 5D with balanced hand / stoppers
    ...(suit === "diamonds" ? [
      createSurface({
        meaningId: WEAK_TWO_MEANING_IDS.POST_OGUST_3NT_DIAMONDS,
        semanticClassId: WEAK_TWO_CLASSES.POST_OGUST_3NT,
        encoding: { defaultCall: bid(3, BidSuit.NoTrump) },
        clauses: [
          {
            factId: "hand.hcp",
            operator: "gte",
            value: WEAK_TWO_THRESHOLDS.POST_OGUST_GAME_MIN,
            isPublic: true,
          },
        ],
        band: "must",
        declarationOrder: 0,
        sourceIntent: { type: "PostOgust3NT", params: { suit } },
        disclosure: "alert",
        teachingLabel: "3NT game (alternative to 5D)",
        surfaceBindings: bindings,
      }, WEAK_TWOS_CTX),
    ] : []),

    // 2. Sign off in agreed suit at 3-level (when Ogust response was below suit)
    createSurface({
      meaningId: POST_OGUST_SIGNOFF_ID[suit],
      semanticClassId: WEAK_TWO_CLASSES.POST_OGUST_SIGNOFF,
      encoding: { defaultCall: bid(3, suitToBidSuit(suit)) },
      clauses: [],
      band: "should",
      declarationOrder: 1,
      sourceIntent: { type: "PostOgustSignoff", params: { suit } },
      disclosure: "natural",
      teachingLabel: `Sign off in ${suit}`,
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),

    // 3. Pass (fallback — when already in agreed suit or 3NT)
    createSurface({
      meaningId: POST_OGUST_PASS_ID[suit],
      semanticClassId: WEAK_TWO_CLASSES.POST_OGUST_PASS,
      encoding: { defaultCall: { type: "pass" } },
      clauses: [],
      band: "avoid",
      declarationOrder: 2,
      sourceIntent: { type: "PostOgustPass", params: { suit } },
      disclosure: "natural",
      teachingLabel: "Pass",
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),
  ];
}

// ─── Pre-instantiated surfaces ──────────────────────────────

/** R1: Opener weak two surfaces (all 3 suits in one group). */
export const WEAK_TWO_R1_SURFACES = createWeakTwoR1Surfaces();

/** R2: Responder surfaces per suit. */
export const WEAK_TWO_R2_HEARTS_SURFACES = createWeakTwoR2Surfaces("hearts");
export const WEAK_TWO_R2_SPADES_SURFACES = createWeakTwoR2Surfaces("spades");
export const WEAK_TWO_R2_DIAMONDS_SURFACES = createWeakTwoR2Surfaces("diamonds");

/** R3: Ogust response surfaces per suit. */
export const WEAK_TWO_OGUST_HEARTS_SURFACES = createWeakTwoOgustSurfaces("hearts");
export const WEAK_TWO_OGUST_SPADES_SURFACES = createWeakTwoOgustSurfaces("spades");
export const WEAK_TWO_OGUST_DIAMONDS_SURFACES = createWeakTwoOgustSurfaces("diamonds");

/** R4: Responder rebid after Ogust surfaces per suit. */
export const POST_OGUST_HEARTS_SURFACES = createPostOgustSurfaces("hearts");
export const POST_OGUST_SPADES_SURFACES = createPostOgustSurfaces("spades");
export const POST_OGUST_DIAMONDS_SURFACES = createPostOgustSurfaces("diamonds");
