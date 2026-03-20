import type { MeaningSurface } from "../../../../core/contracts/meaning";
import type { Call } from "../../../../engine/types";
import { BidSuit } from "../../../../engine/types";
import { WEAK_TWO_CLASSES } from "./semantic-classes";
import { bid, suitToBidSuit } from "../../../core/surface-helpers";

type WeakTwoSuit = "hearts" | "spades" | "diamonds";

function suitLabel(suit: WeakTwoSuit): string {
  switch (suit) {
    case "hearts": return "H";
    case "spades": return "S";
    case "diamonds": return "D";
  }
}

function gameRaiseBid(suit: WeakTwoSuit): Call {
  if (suit === "diamonds") return bid(5, BidSuit.Diamonds);
  return bid(4, suitToBidSuit(suit));
}

// ─── Round 1: Opener weak two bid ───────────────────────────
//
// Priority: hearts (0) > spades (1) > diamonds (2).
// Surfaces use $suit binding — clauses reference hand.suitLength.$suit
// which resolves via surfaceBindings in the meaning evaluator.

export function createWeakTwoR1Surfaces(): readonly MeaningSurface[] {
  const suits: readonly { suit: WeakTwoSuit; order: number; cls: string }[] = [
    { suit: "hearts", order: 0, cls: WEAK_TWO_CLASSES.OPEN_2H },
    { suit: "spades", order: 1, cls: WEAK_TWO_CLASSES.OPEN_2S },
    { suit: "diamonds", order: 2, cls: WEAK_TWO_CLASSES.OPEN_2D },
  ];

  return suits.map(({ suit, order, cls }) => ({
    meaningId: `weak-two:open-2${suitLabel(suit).toLowerCase()}`,
    semanticClassId: cls,
    moduleId: "weak-twos",
    encoding: { defaultCall: bid(2, suitToBidSuit(suit)) },
    clauses: [
      {
        clauseId: "suit-6-plus",
        factId: "hand.suitLength.$suit",
        operator: "gte" as const,
        value: 6,
        description: `6+ ${suit}`,
      },
      {
        clauseId: "opening-hcp-range",
        factId: "module.weakTwo.inOpeningHcpRange",
        operator: "boolean" as const,
        value: true,
        description: "HCP in opening range (6-11 vul, 5-11 NV)",
      },
    ],
    ranking: {
      recommendationBand: "must" as const,
      modulePrecedence: 0,
      intraModuleOrder: order,
    },
    sourceIntent: { type: "WeakTwoOpen", params: { suit } },
    teachingLabel: `Open 2${suitLabel(suit)}`,
    surfaceBindings: { suit },
  }));
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

export function createWeakTwoR2Surfaces(
  suit: WeakTwoSuit,
): readonly MeaningSurface[] {
  const bindings = { suit } as const;
  const sl = suitLabel(suit);
  const gameCall = gameRaiseBid(suit);
  const gameLevel = suit === "diamonds" ? 5 : 4;

  return [
    // 1. Game raise: 16+ HCP, 3+ fit (highest priority)
    {
      meaningId: `weak-two:game-raise-${suit}`,
      semanticClassId: WEAK_TWO_CLASSES.GAME_RAISE,
      moduleId: "weak-twos",
      encoding: { defaultCall: gameCall },
      clauses: [
        {
          clauseId: "hcp-16-plus",
          factId: "hand.hcp",
          operator: "gte" as const,
          value: 16,
          description: "16+ HCP for game raise",
        },
        {
          clauseId: "support-3-plus",
          factId: "hand.suitLength.$suit",
          operator: "gte" as const,
          value: 3,
          description: `3+ ${suit} support`,
        },
      ],
      ranking: {
        recommendationBand: "must" as const,
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
      sourceIntent: { type: "GameRaise", params: { suit } },
      teachingLabel: `Game raise (${gameLevel}${sl})`,
      surfaceBindings: bindings,
    },

    // 2. Ogust ask: 16+ HCP → 2NT (lower specificity than game raise)
    {
      meaningId: `weak-two:ogust-ask-${suit}`,
      semanticClassId: WEAK_TWO_CLASSES.OGUST_ASK,
      moduleId: "weak-twos",
      encoding: { defaultCall: bid(2, BidSuit.NoTrump) },
      clauses: [
        {
          clauseId: "hcp-16-plus",
          factId: "hand.hcp",
          operator: "gte" as const,
          value: 16,
          description: "16+ HCP for Ogust ask",
        },
        {
          clauseId: "support-2-plus",
          factId: `hand.suitLength.$suit`,
          operator: "gte" as const,
          value: 2,
          description: "2+ support for Ogust (usually shows fit)",
        },
      ],
      ranking: {
        recommendationBand: "must" as const,
        modulePrecedence: 0,
        intraModuleOrder: 1,
      },
      sourceIntent: { type: "OgustAsk", params: { suit } },
      teachingLabel: "Ogust ask (2NT)",
      surfaceBindings: bindings,
    },

    // 3. Invite raise: 14-15 HCP, 3+ fit → 3 of opener's suit
    {
      meaningId: `weak-two:invite-raise-${suit}`,
      semanticClassId: WEAK_TWO_CLASSES.INVITE_RAISE,
      moduleId: "weak-twos",
      encoding: { defaultCall: bid(3, suitToBidSuit(suit)) },
      clauses: [
        {
          clauseId: "hcp-14-15",
          factId: "hand.hcp",
          operator: "range" as const,
          value: { min: 14, max: 15 },
          description: "14-15 HCP for invite raise",
        },
        {
          clauseId: "support-3-plus",
          factId: "hand.suitLength.$suit",
          operator: "gte" as const,
          value: 3,
          description: `3+ ${suit} support`,
        },
      ],
      ranking: {
        recommendationBand: "should" as const,
        modulePrecedence: 0,
        intraModuleOrder: 2,
      },
      sourceIntent: { type: "InviteRaise", params: { suit } },
      teachingLabel: `Invite raise (3${sl})`,
      surfaceBindings: bindings,
    },

    // 4. Pass (fallback — no convention bid applies)
    {
      meaningId: `weak-two:weak-pass-${suit}`,
      semanticClassId: WEAK_TWO_CLASSES.WEAK_PASS,
      moduleId: "weak-twos",
      encoding: { defaultCall: { type: "pass" } },
      clauses: [],
      ranking: {
        recommendationBand: "avoid" as const,
        modulePrecedence: 0,
        intraModuleOrder: 3,
      },
      sourceIntent: { type: "WeakPass", params: { suit } },
      teachingLabel: "Pass (no action)",
      surfaceBindings: bindings,
    },
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

export function createWeakTwoOgustSurfaces(
  suit: WeakTwoSuit,
): readonly MeaningSurface[] {
  const bindings = { suit } as const;

  return [
    // 1. Solid: AKQ in suit → 3NT (highest priority — checked first)
    {
      meaningId: `weak-two:ogust-solid-${suit}`,
      semanticClassId: WEAK_TWO_CLASSES.OGUST_SOLID,
      moduleId: "weak-twos",
      encoding: { defaultCall: bid(3, BidSuit.NoTrump) },
      clauses: [
        {
          clauseId: "is-solid",
          factId: "module.weakTwo.isSolid.$suit",
          operator: "boolean" as const,
          value: true,
          description: "AKQ in opened suit (solid)",
        },
      ],
      ranking: {
        recommendationBand: "must" as const,
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
      sourceIntent: { type: "OgustSolid", params: { suit } },
      teachingLabel: "Ogust solid (3NT)",
      surfaceBindings: bindings,
    },

    // 2. Min bad: 5-8 NV / 6-8 vul HCP, 0-1 top honors → 3C
    {
      meaningId: `weak-two:ogust-min-bad-${suit}`,
      semanticClassId: WEAK_TWO_CLASSES.OGUST_MIN_BAD,
      moduleId: "weak-twos",
      encoding: { defaultCall: bid(3, BidSuit.Clubs) },
      clauses: [
        {
          clauseId: "is-minimum",
          factId: "module.weakTwo.isMinimum",
          operator: "boolean" as const,
          value: true,
          description: "Minimum range (5-8 NV, 6-8 vul)",
        },
        {
          clauseId: "top-honors-lte-1",
          factId: "module.weakTwo.topHonorCount.$suit",
          operator: "lte" as const,
          value: 1,
          description: "0-1 top honors (bad suit)",
        },
      ],
      ranking: {
        recommendationBand: "must" as const,
        modulePrecedence: 0,
        intraModuleOrder: 1,
      },
      sourceIntent: { type: "OgustMinBad", params: { suit } },
      teachingLabel: "Ogust min/bad (3C)",
      surfaceBindings: bindings,
    },

    // 3. Min good: 5-8 NV / 6-8 vul HCP, 2+ top honors → 3D
    {
      meaningId: `weak-two:ogust-min-good-${suit}`,
      semanticClassId: WEAK_TWO_CLASSES.OGUST_MIN_GOOD,
      moduleId: "weak-twos",
      encoding: { defaultCall: bid(3, BidSuit.Diamonds) },
      clauses: [
        {
          clauseId: "is-minimum",
          factId: "module.weakTwo.isMinimum",
          operator: "boolean" as const,
          value: true,
          description: "Minimum range (5-8 NV, 6-8 vul)",
        },
        {
          clauseId: "top-honors-gte-2",
          factId: "module.weakTwo.topHonorCount.$suit",
          operator: "gte" as const,
          value: 2,
          description: "2+ top honors (good suit)",
        },
      ],
      ranking: {
        recommendationBand: "must" as const,
        modulePrecedence: 0,
        intraModuleOrder: 2,
      },
      sourceIntent: { type: "OgustMinGood", params: { suit } },
      teachingLabel: "Ogust min/good (3D)",
      surfaceBindings: bindings,
    },

    // 4. Max bad: 9-11 HCP, 0-1 top honors → 3H
    {
      meaningId: `weak-two:ogust-max-bad-${suit}`,
      semanticClassId: WEAK_TWO_CLASSES.OGUST_MAX_BAD,
      moduleId: "weak-twos",
      encoding: { defaultCall: bid(3, BidSuit.Hearts) },
      clauses: [
        {
          clauseId: "is-maximum",
          factId: "module.weakTwo.isMaximum",
          operator: "boolean" as const,
          value: true,
          description: "Maximum range (9-11 HCP)",
        },
        {
          clauseId: "top-honors-lte-1",
          factId: "module.weakTwo.topHonorCount.$suit",
          operator: "lte" as const,
          value: 1,
          description: "0-1 top honors (bad suit)",
        },
      ],
      ranking: {
        recommendationBand: "must" as const,
        modulePrecedence: 0,
        intraModuleOrder: 3,
      },
      sourceIntent: { type: "OgustMaxBad", params: { suit } },
      teachingLabel: "Ogust max/bad (3H)",
      surfaceBindings: bindings,
    },

    // 5. Max good: 9-11 HCP, 2+ top honors → 3S
    {
      meaningId: `weak-two:ogust-max-good-${suit}`,
      semanticClassId: WEAK_TWO_CLASSES.OGUST_MAX_GOOD,
      moduleId: "weak-twos",
      encoding: { defaultCall: bid(3, BidSuit.Spades) },
      clauses: [
        {
          clauseId: "is-maximum",
          factId: "module.weakTwo.isMaximum",
          operator: "boolean" as const,
          value: true,
          description: "Maximum range (9-11 HCP)",
        },
        {
          clauseId: "top-honors-gte-2",
          factId: "module.weakTwo.topHonorCount.$suit",
          operator: "gte" as const,
          value: 2,
          description: "2+ top honors (good suit)",
        },
      ],
      ranking: {
        recommendationBand: "must" as const,
        modulePrecedence: 0,
        intraModuleOrder: 4,
      },
      sourceIntent: { type: "OgustMaxGood", params: { suit } },
      teachingLabel: "Ogust max/good (3S)",
      surfaceBindings: bindings,
    },
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

export function createPostOgustSurfaces(
  suit: WeakTwoSuit,
): readonly MeaningSurface[] {
  const bindings = { suit } as const;
  const sl = suitLabel(suit);
  const gameCall = gameRaiseBid(suit);
  const gameLevel = suit === "diamonds" ? 5 : 4;

  return [
    // 1. Bid game: 17+ HCP → game in agreed suit (highest priority)
    {
      meaningId: `weak-two:post-ogust-game-${suit}`,
      semanticClassId: WEAK_TWO_CLASSES.POST_OGUST_GAME,
      moduleId: "weak-twos",
      encoding: { defaultCall: gameCall },
      clauses: [
        {
          clauseId: "hcp-17-plus",
          factId: "hand.hcp",
          operator: "gte" as const,
          value: 17,
          description: "17+ HCP — bid game after Ogust",
        },
      ],
      ranking: {
        recommendationBand: "must" as const,
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
      sourceIntent: { type: "PostOgustGame", params: { suit } },
      teachingLabel: `Bid game in ${suit}`,
      surfaceBindings: bindings,
    },

    // 2. Sign off in agreed suit at 3-level (when Ogust response was below suit)
    {
      meaningId: `weak-two:post-ogust-signoff-${suit}`,
      semanticClassId: WEAK_TWO_CLASSES.POST_OGUST_SIGNOFF,
      moduleId: "weak-twos",
      encoding: { defaultCall: bid(3, suitToBidSuit(suit)) },
      clauses: [],
      ranking: {
        recommendationBand: "should" as const,
        modulePrecedence: 0,
        intraModuleOrder: 1,
      },
      sourceIntent: { type: "PostOgustSignoff", params: { suit } },
      teachingLabel: `Sign off in ${suit}`,
      surfaceBindings: bindings,
    },

    // 3. Pass (fallback — when already in agreed suit or 3NT)
    {
      meaningId: `weak-two:post-ogust-pass-${suit}`,
      semanticClassId: WEAK_TWO_CLASSES.POST_OGUST_PASS,
      moduleId: "weak-twos",
      encoding: { defaultCall: { type: "pass" } },
      clauses: [],
      ranking: {
        recommendationBand: "avoid" as const,
        modulePrecedence: 0,
        intraModuleOrder: 2,
      },
      sourceIntent: { type: "PostOgustPass", params: { suit } },
      teachingLabel: "Pass",
      surfaceBindings: bindings,
    },
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
