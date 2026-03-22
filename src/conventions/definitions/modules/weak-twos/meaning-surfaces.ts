import type { BidMeaning } from "../../../../core/contracts/meaning";
import { BidSuit } from "../../../../engine/types";
import { WEAK_TWO_CLASSES } from "./semantic-classes";
import { bid, suitToBidSuit } from "../../../core/surface-helpers";
import { createSurface } from "../../../core/surface-builder";
import type { ModuleContext } from "../../../core/surface-builder";
import {
  SAME_FAMILY,
  STRONGER_THAN,
  CONTINUATION_OF,
  NEAR_MISS_OF,
  ALTERNATIVES,
} from "../../teaching-vocabulary";
import {
  SCOPE_WEAK_TWO_OPENER_BIDS,
  SCOPE_OGUST_RESPONSES,
} from "../../pedagogical-scope-vocabulary";

type WeakTwoSuit = "hearts" | "spades" | "diamonds";

const WEAK_TWOS_CTX: ModuleContext = { moduleId: "weak-twos" };

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
    meaningId: `weak-two:open-2${suitLabel(suit).toLowerCase()}`,
    semanticClassId: cls,
    encoding: { defaultCall: bid(2, suitToBidSuit(suit)) },
    clauses: [
      {
        factId: "hand.suitLength.$suit",
        operator: "gte",
        value: 6,
      },
      {
        factId: "module.weakTwo.inOpeningHcpRange",
        operator: "boolean",
        value: true,
        description: "HCP in opening range (6-11 vul, 5-11 NV)",
      },
    ],
    band: "must",
    intraModuleOrder: order,
    sourceIntent: { type: "WeakTwoOpen", params: { suit } },
    teachingLabel: `Open 2${suitLabel(suit)}`,
    surfaceBindings: { suit },
    teachingTags: [
      { tag: SAME_FAMILY, scope: SCOPE_WEAK_TWO_OPENER_BIDS },
    ],
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
      meaningId: `weak-two:game-raise-${suit}`,
      semanticClassId: WEAK_TWO_CLASSES.GAME_RAISE,
      encoding: { defaultCall: gameCall },
      clauses: [
        {
          factId: "bridge.totalPointsForRaise",
          operator: "gte",
          value: 16,
          description: "16+ total points (HCP + shortage) for game",
        },
        {
          factId: "hand.suitLength.$suit",
          operator: "gte",
          value: 3,
        },
      ],
      band: "must",
      intraModuleOrder: 0,
      sourceIntent: { type: "GameRaise", params: { suit } },
      teachingLabel: `Game raise (${gameLevel}${sl})`,
      surfaceBindings: bindings,
      teachingTags: [
        { tag: SAME_FAMILY, scope: `weak-two:responder-actions-${suit}` },
        { tag: STRONGER_THAN, scope: `weak-two:responder-strength-${suit}`, ordinal: 0 },
        { tag: NEAR_MISS_OF, scope: `weak-two:raise-boundary-${suit}`, role: "a" },
        { tag: ALTERNATIVES, scope: `Weak Two responder action (${suit})` },
      ],
    }, WEAK_TWOS_CTX),

    // 2. Ogust ask: 16+ total points → 2NT (lower specificity than game raise)
    createSurface({
      meaningId: `weak-two:ogust-ask-${suit}`,
      semanticClassId: WEAK_TWO_CLASSES.OGUST_ASK,
      encoding: { defaultCall: bid(2, BidSuit.NoTrump) },
      clauses: [
        {
          factId: "bridge.totalPointsForRaise",
          operator: "gte",
          value: 16,
          description: "16+ total points for Ogust inquiry",
        },
        {
          factId: `hand.suitLength.$suit`,
          operator: "gte",
          value: 2,
          description: "2+ support for Ogust (usually shows fit)",
        },
      ],
      band: "must",
      intraModuleOrder: 1,
      sourceIntent: { type: "OgustAsk", params: { suit } },
      teachingLabel: "Ogust ask (2NT)",
      surfaceBindings: bindings,
      teachingTags: [
        { tag: SAME_FAMILY, scope: `weak-two:responder-actions-${suit}` },
        { tag: CONTINUATION_OF, scope: `weak-two:ogust-continues-ask-${suit}`, role: "b" },
        { tag: ALTERNATIVES, scope: `Weak Two responder action (${suit})` },
      ],
    }, WEAK_TWOS_CTX),

    // 3. Invite raise: 14-15 total points, 3+ fit → 3 of opener's suit
    createSurface({
      meaningId: `weak-two:invite-raise-${suit}`,
      semanticClassId: WEAK_TWO_CLASSES.INVITE_RAISE,
      encoding: { defaultCall: bid(3, suitToBidSuit(suit)) },
      clauses: [
        {
          factId: "bridge.totalPointsForRaise",
          operator: "range",
          value: { min: 14, max: 15 },
          description: "14-15 total points (HCP + shortage) for invite",
        },
        {
          factId: "hand.suitLength.$suit",
          operator: "gte",
          value: 3,
        },
      ],
      band: "should",
      intraModuleOrder: 2,
      sourceIntent: { type: "InviteRaise", params: { suit } },
      teachingLabel: `Invite raise (3${sl})`,
      surfaceBindings: bindings,
      teachingTags: [
        { tag: SAME_FAMILY, scope: `weak-two:responder-actions-${suit}` },
        { tag: STRONGER_THAN, scope: `weak-two:responder-strength-${suit}`, ordinal: 1 },
        { tag: NEAR_MISS_OF, scope: `weak-two:raise-boundary-${suit}`, role: "b" },
        { tag: ALTERNATIVES, scope: `Weak Two responder action (${suit})` },
      ],
    }, WEAK_TWOS_CTX),

    // 4. Pass (fallback — no convention bid applies)
    createSurface({
      meaningId: `weak-two:weak-pass-${suit}`,
      semanticClassId: WEAK_TWO_CLASSES.WEAK_PASS,
      encoding: { defaultCall: { type: "pass" } },
      clauses: [],
      band: "avoid",
      intraModuleOrder: 3,
      sourceIntent: { type: "WeakPass", params: { suit } },
      teachingLabel: "Pass (no action)",
      surfaceBindings: bindings,
      teachingTags: [
        { tag: STRONGER_THAN, scope: `weak-two:responder-strength-${suit}`, ordinal: 2 },
      ],
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
      meaningId: `weak-two:ogust-solid-${suit}`,
      semanticClassId: WEAK_TWO_CLASSES.OGUST_SOLID,
      encoding: { defaultCall: bid(3, BidSuit.NoTrump) },
      clauses: [
        {
          factId: "module.weakTwo.isSolid.$suit",
          operator: "boolean",
          value: true,
          description: "AKQ in opened suit (solid)",
        },
      ],
      band: "must",
      intraModuleOrder: 0,
      sourceIntent: { type: "OgustSolid", params: { suit } },
      teachingLabel: "Ogust solid (3NT)",
      surfaceBindings: bindings,
      teachingTags: [
        { tag: SAME_FAMILY, scope: `weak-two:ogust-responses-${suit}` },
        { tag: STRONGER_THAN, scope: `weak-two:ogust-strength-${suit}`, ordinal: 0 },
        { tag: CONTINUATION_OF, scope: `weak-two:ogust-continues-ask-${suit}`, role: "a" },
        { tag: ALTERNATIVES, scope: SCOPE_OGUST_RESPONSES },
      ],
    }, WEAK_TWOS_CTX),

    // 2. Min bad: 5-8 NV / 6-8 vul HCP, 0-1 top honors → 3C
    createSurface({
      meaningId: `weak-two:ogust-min-bad-${suit}`,
      semanticClassId: WEAK_TWO_CLASSES.OGUST_MIN_BAD,
      encoding: { defaultCall: bid(3, BidSuit.Clubs) },
      clauses: [
        {
          factId: "module.weakTwo.isMinimum",
          operator: "boolean",
          value: true,
          description: "Minimum range (5-8 NV, 6-8 vul)",
        },
        {
          factId: "module.weakTwo.topHonorCount.$suit",
          operator: "lte",
          value: 1,
          description: "0-1 top honors (bad suit)",
        },
      ],
      band: "must",
      intraModuleOrder: 1,
      sourceIntent: { type: "OgustMinBad", params: { suit } },
      teachingLabel: "Ogust min/bad (3C)",
      surfaceBindings: bindings,
      teachingTags: [
        { tag: SAME_FAMILY, scope: `weak-two:ogust-responses-${suit}` },
        { tag: STRONGER_THAN, scope: `weak-two:ogust-strength-${suit}`, ordinal: 4 },
        { tag: CONTINUATION_OF, scope: `weak-two:ogust-continues-ask-${suit}`, role: "a" },
        { tag: ALTERNATIVES, scope: SCOPE_OGUST_RESPONSES },
      ],
    }, WEAK_TWOS_CTX),

    // 3. Min good: 5-8 NV / 6-8 vul HCP, 2+ top honors → 3D
    createSurface({
      meaningId: `weak-two:ogust-min-good-${suit}`,
      semanticClassId: WEAK_TWO_CLASSES.OGUST_MIN_GOOD,
      encoding: { defaultCall: bid(3, BidSuit.Diamonds) },
      clauses: [
        {
          factId: "module.weakTwo.isMinimum",
          operator: "boolean",
          value: true,
          description: "Minimum range (5-8 NV, 6-8 vul)",
        },
        {
          factId: "module.weakTwo.topHonorCount.$suit",
          operator: "gte",
          value: 2,
          description: "2+ top honors (good suit)",
        },
      ],
      band: "must",
      intraModuleOrder: 2,
      sourceIntent: { type: "OgustMinGood", params: { suit } },
      teachingLabel: "Ogust min/good (3D)",
      surfaceBindings: bindings,
      teachingTags: [
        { tag: SAME_FAMILY, scope: `weak-two:ogust-responses-${suit}` },
        { tag: STRONGER_THAN, scope: `weak-two:ogust-strength-${suit}`, ordinal: 3 },
        { tag: CONTINUATION_OF, scope: `weak-two:ogust-continues-ask-${suit}`, role: "a" },
        { tag: NEAR_MISS_OF, scope: `weak-two:ogust-strength-boundary-${suit}`, role: "a" },
        { tag: ALTERNATIVES, scope: SCOPE_OGUST_RESPONSES },
      ],
    }, WEAK_TWOS_CTX),

    // 4. Max bad: 9-11 HCP, 0-1 top honors → 3H
    createSurface({
      meaningId: `weak-two:ogust-max-bad-${suit}`,
      semanticClassId: WEAK_TWO_CLASSES.OGUST_MAX_BAD,
      encoding: { defaultCall: bid(3, BidSuit.Hearts) },
      clauses: [
        {
          factId: "module.weakTwo.isMaximum",
          operator: "boolean",
          value: true,
          description: "Maximum range (9-11 HCP)",
        },
        {
          factId: "module.weakTwo.topHonorCount.$suit",
          operator: "lte",
          value: 1,
          description: "0-1 top honors (bad suit)",
        },
      ],
      band: "must",
      intraModuleOrder: 3,
      sourceIntent: { type: "OgustMaxBad", params: { suit } },
      teachingLabel: "Ogust max/bad (3H)",
      surfaceBindings: bindings,
      teachingTags: [
        { tag: SAME_FAMILY, scope: `weak-two:ogust-responses-${suit}` },
        { tag: STRONGER_THAN, scope: `weak-two:ogust-strength-${suit}`, ordinal: 2 },
        { tag: CONTINUATION_OF, scope: `weak-two:ogust-continues-ask-${suit}`, role: "a" },
        { tag: NEAR_MISS_OF, scope: `weak-two:ogust-strength-boundary-${suit}`, role: "b" },
        { tag: ALTERNATIVES, scope: SCOPE_OGUST_RESPONSES },
      ],
    }, WEAK_TWOS_CTX),

    // 5. Max good: 9-11 HCP, 2+ top honors → 3S
    createSurface({
      meaningId: `weak-two:ogust-max-good-${suit}`,
      semanticClassId: WEAK_TWO_CLASSES.OGUST_MAX_GOOD,
      encoding: { defaultCall: bid(3, BidSuit.Spades) },
      clauses: [
        {
          factId: "module.weakTwo.isMaximum",
          operator: "boolean",
          value: true,
          description: "Maximum range (9-11 HCP)",
        },
        {
          factId: "module.weakTwo.topHonorCount.$suit",
          operator: "gte",
          value: 2,
          description: "2+ top honors (good suit)",
        },
      ],
      band: "must",
      intraModuleOrder: 4,
      sourceIntent: { type: "OgustMaxGood", params: { suit } },
      teachingLabel: "Ogust max/good (3S)",
      surfaceBindings: bindings,
      teachingTags: [
        { tag: SAME_FAMILY, scope: `weak-two:ogust-responses-${suit}` },
        { tag: STRONGER_THAN, scope: `weak-two:ogust-strength-${suit}`, ordinal: 1 },
        { tag: CONTINUATION_OF, scope: `weak-two:ogust-continues-ask-${suit}`, role: "a" },
        { tag: ALTERNATIVES, scope: SCOPE_OGUST_RESPONSES },
      ],
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
      meaningId: `weak-two:post-ogust-game-${suit}`,
      semanticClassId: WEAK_TWO_CLASSES.POST_OGUST_GAME,
      encoding: { defaultCall: gameCall },
      clauses: [
        {
          factId: "hand.hcp",
          operator: "gte",
          value: 17,
        },
      ],
      band: "must",
      intraModuleOrder: 0,
      sourceIntent: { type: "PostOgustGame", params: { suit } },
      teachingLabel: `Bid game in ${suit}`,
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),

    // 2. Sign off in agreed suit at 3-level (when Ogust response was below suit)
    createSurface({
      meaningId: `weak-two:post-ogust-signoff-${suit}`,
      semanticClassId: WEAK_TWO_CLASSES.POST_OGUST_SIGNOFF,
      encoding: { defaultCall: bid(3, suitToBidSuit(suit)) },
      clauses: [],
      band: "should",
      intraModuleOrder: 1,
      sourceIntent: { type: "PostOgustSignoff", params: { suit } },
      teachingLabel: `Sign off in ${suit}`,
      surfaceBindings: bindings,
    }, WEAK_TWOS_CTX),

    // 3. Pass (fallback — when already in agreed suit or 3NT)
    createSurface({
      meaningId: `weak-two:post-ogust-pass-${suit}`,
      semanticClassId: WEAK_TWO_CLASSES.POST_OGUST_PASS,
      encoding: { defaultCall: { type: "pass" } },
      clauses: [],
      band: "avoid",
      intraModuleOrder: 2,
      sourceIntent: { type: "PostOgustPass", params: { suit } },
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
