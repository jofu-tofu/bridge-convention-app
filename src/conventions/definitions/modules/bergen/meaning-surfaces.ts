import type { BidMeaning } from "../../../../core/contracts/meaning";
import type { TeachingTagRef } from "../../../../core/contracts/teaching-tag";
import { BidSuit } from "../../../../engine/types";
import { BERGEN_CLASSES } from "./semantic-classes";
import { bid, suitToBidSuit, otherMajorBidSuit } from "../../../core/surface-helpers";
import { createSurface } from "../../../core/surface-builder";
import type { ModuleContext } from "../../../core/surface-builder";
import {
  SAME_FAMILY,
  STRONGER_THAN,
  CONTINUATION_OF,
  NEAR_MISS_OF,
  FALLBACK_OF,
  ALTERNATIVES,
} from "../../teaching-vocabulary";
import {
  SCOPE_BERGEN_R4_AFTER_TRY_DECISION,
  bergenScopes,
} from "../../pedagogical-scope-vocabulary";

const BERGEN_CTX: ModuleContext = { moduleId: "bergen" };

// ─── Convention-intrinsic thresholds ────────────────────────
//
// Bergen Raises HCP thresholds are convention-intrinsic (same in all
// bidding systems). Named constants prevent magic numbers and make
// the values discoverable by enforcement tests.

export const BERGEN_THRESHOLDS = {
  // R1: Responder initial bids
  SPLINTER_MIN: 12,
  GAME_RAISE_MIN: 13,
  LIMIT_RAISE_MIN: 10,
  LIMIT_RAISE_MAX: 12,
  CONSTRUCTIVE_MIN: 7,
  CONSTRUCTIVE_MAX: 10,
  PREEMPTIVE_MAX: 6,

  // R2: Opener rebids after constructive raise
  OPENER_GAME_AFTER_CONSTRUCTIVE_MIN: 17,
  OPENER_SIGNOFF_AFTER_CONSTRUCTIVE_MAX: 13,

  // R2: Opener rebids after limit raise
  OPENER_GAME_AFTER_LIMIT_MIN: 15,
  OPENER_SIGNOFF_AFTER_LIMIT_MAX: 14,

  // R2: Opener rebids after preemptive raise
  OPENER_GAME_AFTER_PREEMPTIVE_MIN: 18,
  OPENER_PASS_AFTER_PREEMPTIVE_MAX: 17,

  // R3: Responder game try decisions
  RESPONDER_TRY_ACCEPT_MIN: 9,
  RESPONDER_TRY_ACCEPT_MAX: 10,
  RESPONDER_TRY_REJECT_MIN: 7,
  RESPONDER_TRY_REJECT_MAX: 8,

  // Suit support
  SUPPORT_LENGTH: 4,
} as const;

/**
 * Create the 5 Bergen Raises R1 surfaces for a given major suit.
 *
 * Surfaces use surfaceBindings to parameterize by suit -- clauses reference
 * `hand.suitLength.$suit` which resolves via the binding infrastructure
 * in meaning-evaluator.ts before fact lookup.
 *
 * Encodings are statically determined per suit instantiation:
 * - Splinter: 3 of the other major (3S after 1H, 3H after 1S)
 * - Game raise: 4 of the opened major
 * - Limit raise: always 3D
 * - Constructive: always 3C
 * - Preemptive: 3 of the opened major
 */
function createBergenR1Surfaces(
  suit: "hearts" | "spades",
): readonly BidMeaning[] {
  const bindings = { suit } as const;
  const majorStrain = suitToBidSuit(suit);
  const otherMajor = otherMajorBidSuit(suit);

  return [
    // 1. Splinter -- 12+ HCP, exactly 4 support, shortage (singleton or void)
    // Highest priority: checked first (intraModuleOrder 0)
    createSurface({
      meaningId: `bergen:splinter-${suit}`,
      semanticClassId: BERGEN_CLASSES.SPLINTER,
      encoding: { defaultCall: bid(3, otherMajor) },
      clauses: [
        {
          factId: "hand.hcp",
          operator: "gte",
          value: BERGEN_THRESHOLDS.SPLINTER_MIN,
        },
        {
          factId: "hand.suitLength.$suit",
          operator: "eq",
          value: BERGEN_THRESHOLDS.SUPPORT_LENGTH,
        },
        {
          factId: "bridge.hasShortage",
          operator: "boolean",
          value: true,
        },
      ],
      band: "must",
      intraModuleOrder: 0,
      sourceIntent: { type: "Splinter", params: { suit } },
      teachingLabel: `Splinter (3${suit === "hearts" ? "S" : "H"})`,
      surfaceBindings: bindings,
      teachingTags: [
        { tag: SAME_FAMILY, scope: bergenScopes.r1SplinterAndGame(suit) },
        { tag: NEAR_MISS_OF, scope: bergenScopes.r1SplinterVsGame(suit), role: "a" },
      ],
    }, BERGEN_CTX),

    // 2. Game raise -- 13+ HCP, exactly 4 support
    createSurface({
      meaningId: `bergen:game-raise-${suit}`,
      semanticClassId: BERGEN_CLASSES.GAME_RAISE,
      encoding: { defaultCall: bid(4, majorStrain) },
      clauses: [
        {
          factId: "hand.hcp",
          operator: "gte",
          value: BERGEN_THRESHOLDS.GAME_RAISE_MIN,
        },
        {
          factId: "hand.suitLength.$suit",
          operator: "eq",
          value: BERGEN_THRESHOLDS.SUPPORT_LENGTH,
        },
      ],
      band: "must",
      intraModuleOrder: 1,
      sourceIntent: { type: "GameRaise", params: { suit } },
      teachingLabel: `Game raise (4${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
      teachingTags: [
        { tag: SAME_FAMILY, scope: bergenScopes.r1StrengthRaises(suit) },
        { tag: SAME_FAMILY, scope: bergenScopes.r1SplinterAndGame(suit) },
        { tag: STRONGER_THAN, scope: bergenScopes.r1StrengthChain(suit), ordinal: 0 },
        { tag: NEAR_MISS_OF, scope: bergenScopes.r1SplinterVsGame(suit), role: "b" },
        { tag: ALTERNATIVES, scope: bergenScopes.strengthRaisesAlternatives(suit) },
      ],
    }, BERGEN_CTX),

    // 3. Limit raise -- 10-12 HCP, exactly 4 support
    createSurface({
      meaningId: `bergen:limit-raise-${suit}`,
      semanticClassId: BERGEN_CLASSES.LIMIT_RAISE,
      encoding: { defaultCall: bid(3, BidSuit.Diamonds) },
      clauses: [
        {
          factId: "hand.hcp",
          operator: "range",
          value: { min: BERGEN_THRESHOLDS.LIMIT_RAISE_MIN, max: BERGEN_THRESHOLDS.LIMIT_RAISE_MAX },
        },
        {
          factId: "hand.suitLength.$suit",
          operator: "eq",
          value: BERGEN_THRESHOLDS.SUPPORT_LENGTH,
        },
      ],
      band: "should",
      intraModuleOrder: 2,
      sourceIntent: { type: "LimitRaise", params: { suit } },
      teachingLabel: "Limit raise (3D)",
      surfaceBindings: bindings,
      teachingTags: [
        { tag: SAME_FAMILY, scope: bergenScopes.r1StrengthRaises(suit) },
        { tag: STRONGER_THAN, scope: bergenScopes.r1StrengthChain(suit), ordinal: 1 },
        { tag: NEAR_MISS_OF, scope: bergenScopes.r1ConstructiveVsLimit(suit), role: "b" },
        { tag: CONTINUATION_OF, scope: bergenScopes.r2AfterLimit(suit), role: "b" },
        { tag: ALTERNATIVES, scope: bergenScopes.strengthRaisesAlternatives(suit) },
      ],
    }, BERGEN_CTX),

    // 4. Constructive raise -- 7-10 HCP, exactly 4 support
    createSurface({
      meaningId: `bergen:constructive-raise-${suit}`,
      semanticClassId: BERGEN_CLASSES.CONSTRUCTIVE_RAISE,
      encoding: { defaultCall: bid(3, BidSuit.Clubs) },
      clauses: [
        {
          factId: "hand.hcp",
          operator: "range",
          value: { min: BERGEN_THRESHOLDS.CONSTRUCTIVE_MIN, max: BERGEN_THRESHOLDS.CONSTRUCTIVE_MAX },
        },
        {
          factId: "hand.suitLength.$suit",
          operator: "eq",
          value: BERGEN_THRESHOLDS.SUPPORT_LENGTH,
        },
      ],
      band: "should",
      intraModuleOrder: 3,
      sourceIntent: { type: "ConstructiveRaise", params: { suit } },
      teachingLabel: "Constructive raise (3C)",
      surfaceBindings: bindings,
      teachingTags: [
        { tag: SAME_FAMILY, scope: bergenScopes.r1StrengthRaises(suit) },
        { tag: STRONGER_THAN, scope: bergenScopes.r1StrengthChain(suit), ordinal: 2 },
        { tag: NEAR_MISS_OF, scope: bergenScopes.r1ConstructiveVsLimit(suit), role: "a" },
        { tag: FALLBACK_OF, scope: bergenScopes.r1PreemptiveFallback(suit), role: "b" },
        { tag: CONTINUATION_OF, scope: bergenScopes.r2AfterConstructive(suit), role: "b" },
        { tag: ALTERNATIVES, scope: bergenScopes.strengthRaisesAlternatives(suit) },
      ],
    }, BERGEN_CTX),

    // 5. Preemptive raise -- 0-6 HCP, exactly 4 support
    createSurface({
      meaningId: `bergen:preemptive-raise-${suit}`,
      semanticClassId: BERGEN_CLASSES.PREEMPTIVE_RAISE,
      encoding: { defaultCall: bid(3, majorStrain) },
      clauses: [
        {
          factId: "hand.hcp",
          operator: "lte",
          value: BERGEN_THRESHOLDS.PREEMPTIVE_MAX,
        },
        {
          factId: "hand.suitLength.$suit",
          operator: "eq",
          value: BERGEN_THRESHOLDS.SUPPORT_LENGTH,
        },
      ],
      band: "may",
      intraModuleOrder: 4,
      sourceIntent: { type: "PreemptiveRaise", params: { suit } },
      teachingLabel: `Preemptive raise (3${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
      teachingTags: [
        { tag: SAME_FAMILY, scope: bergenScopes.r1StrengthRaises(suit) },
        { tag: STRONGER_THAN, scope: bergenScopes.r1StrengthChain(suit), ordinal: 3 },
        { tag: FALLBACK_OF, scope: bergenScopes.r1PreemptiveFallback(suit), role: "a" },
        { tag: CONTINUATION_OF, scope: bergenScopes.r2AfterPreemptive(suit), role: "b" },
        { tag: ALTERNATIVES, scope: bergenScopes.strengthRaisesAlternatives(suit) },
      ],
    }, BERGEN_CTX),
  ];
}

// ─── Round 2: Opener rebids ─────────────────────────────────

/**
 * R2 surfaces after constructive raise (1M-P-3C-P).
 *
 * Opener evaluates HCP to accept or decline:
 * - 17+ HCP → bid game (4M)
 * - ≤13 HCP → pass (decline)
 *
 * The 14-16 HCP help-suit game try is omitted here because it requires
 * dynamic call selection based on hand shape (weakest side suit) that
 * static meaning surfaces cannot express.
 */
function createBergenR2AfterConstructiveSurfaces(
  suit: "hearts" | "spades",
): readonly BidMeaning[] {
  const bindings = { suit } as const;
  const majorStrain = suitToBidSuit(suit);

  return [
    // Opener game: 17+ HCP → 4M
    createSurface({
      meaningId: `bergen:opener-game-after-constructive-${suit}`,
      semanticClassId: BERGEN_CLASSES.OPENER_GAME_AFTER_CONSTRUCTIVE,
      encoding: { defaultCall: bid(4, majorStrain) },
      clauses: [
        {
          factId: "hand.hcp",
          operator: "gte",
          value: BERGEN_THRESHOLDS.OPENER_GAME_AFTER_CONSTRUCTIVE_MIN,
        },
      ],
      band: "must",
      intraModuleOrder: 0,
      sourceIntent: { type: "AcceptInvitation", params: { suit } },
      teachingLabel: `Accept constructive → game (4${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
      teachingTags: [
        { tag: SAME_FAMILY, scope: bergenScopes.r2RebidsAfterConstructive(suit) },
        { tag: STRONGER_THAN, scope: bergenScopes.r2ConstructiveStrength(suit), ordinal: 0 },
        { tag: CONTINUATION_OF, scope: bergenScopes.r2AfterConstructive(suit), role: "a" },
        { tag: ALTERNATIVES, scope: bergenScopes.openerRebidAfterConstructive(suit) },
      ],
    }, BERGEN_CTX),

    // Opener signoff: ≤13 HCP → 3M (return to trump suit)
    createSurface({
      meaningId: `bergen:opener-signoff-after-constructive-${suit}`,
      semanticClassId: BERGEN_CLASSES.OPENER_SIGNOFF_AFTER_CONSTRUCTIVE,
      encoding: { defaultCall: bid(3, majorStrain) },
      clauses: [
        {
          factId: "hand.hcp",
          operator: "lte",
          value: BERGEN_THRESHOLDS.OPENER_SIGNOFF_AFTER_CONSTRUCTIVE_MAX,
        },
      ],
      band: "must",
      intraModuleOrder: 1,
      sourceIntent: { type: "DeclineInvitation", params: { suit } },
      teachingLabel: `Decline constructive → signoff (3${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
      teachingTags: [
        { tag: SAME_FAMILY, scope: bergenScopes.r2RebidsAfterConstructive(suit) },
        { tag: STRONGER_THAN, scope: bergenScopes.r2ConstructiveStrength(suit), ordinal: 1 },
        { tag: ALTERNATIVES, scope: bergenScopes.openerRebidAfterConstructive(suit) },
      ],
    }, BERGEN_CTX),
  ];
}

/**
 * R2 surfaces after limit raise (1M-P-3D-P).
 *
 * Opener evaluates HCP:
 * - 15+ HCP → bid game (4M)
 * - ≤14 HCP → sign off (3M)
 */
function createBergenR2AfterLimitSurfaces(
  suit: "hearts" | "spades",
): readonly BidMeaning[] {
  const bindings = { suit } as const;
  const majorStrain = suitToBidSuit(suit);

  return [
    // Opener game: 15+ HCP → 4M
    createSurface({
      meaningId: `bergen:opener-game-after-limit-${suit}`,
      semanticClassId: BERGEN_CLASSES.OPENER_GAME_AFTER_LIMIT,
      encoding: { defaultCall: bid(4, majorStrain) },
      clauses: [
        {
          factId: "hand.hcp",
          operator: "gte",
          value: BERGEN_THRESHOLDS.OPENER_GAME_AFTER_LIMIT_MIN,
        },
      ],
      band: "must",
      intraModuleOrder: 0,
      sourceIntent: { type: "AcceptInvitation", params: { suit } },
      teachingLabel: `Accept limit raise → game (4${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
      teachingTags: [
        { tag: SAME_FAMILY, scope: bergenScopes.r2RebidsAfterLimit(suit) },
        { tag: STRONGER_THAN, scope: bergenScopes.r2LimitStrength(suit), ordinal: 0 },
        { tag: CONTINUATION_OF, scope: bergenScopes.r2AfterLimit(suit), role: "a" },
        { tag: ALTERNATIVES, scope: bergenScopes.openerRebidAfterLimit(suit) },
      ],
    }, BERGEN_CTX),

    // Opener signoff: ≤14 HCP → 3M
    createSurface({
      meaningId: `bergen:opener-signoff-after-limit-${suit}`,
      semanticClassId: BERGEN_CLASSES.OPENER_SIGNOFF_AFTER_LIMIT,
      encoding: { defaultCall: bid(3, majorStrain) },
      clauses: [
        {
          factId: "hand.hcp",
          operator: "lte",
          value: BERGEN_THRESHOLDS.OPENER_SIGNOFF_AFTER_LIMIT_MAX,
        },
      ],
      band: "must",
      intraModuleOrder: 1,
      sourceIntent: { type: "DeclineInvitation", params: { suit } },
      teachingLabel: `Decline limit raise → signoff (3${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
      teachingTags: [
        { tag: SAME_FAMILY, scope: bergenScopes.r2RebidsAfterLimit(suit) },
        { tag: STRONGER_THAN, scope: bergenScopes.r2LimitStrength(suit), ordinal: 1 },
        { tag: ALTERNATIVES, scope: bergenScopes.openerRebidAfterLimit(suit) },
      ],
    }, BERGEN_CTX),
  ];
}

/**
 * R2 surfaces after preemptive raise (1M-P-3M-P).
 *
 * Opener evaluates total points (HCP + shortage):
 * - 18+ total points → bid game (4M)
 * - ≤17 total points → pass
 */
function createBergenR2AfterPreemptiveSurfaces(
  suit: "hearts" | "spades",
): readonly BidMeaning[] {
  const bindings = { suit } as const;
  const majorStrain = suitToBidSuit(suit);

  return [
    // Opener game: 18+ total points → 4M
    createSurface({
      meaningId: `bergen:opener-game-after-preemptive-${suit}`,
      semanticClassId: BERGEN_CLASSES.OPENER_GAME_AFTER_PREEMPTIVE,
      encoding: { defaultCall: bid(4, majorStrain) },
      clauses: [
        {
          factId: "bridge.totalPointsForRaise",
          operator: "gte",
          value: BERGEN_THRESHOLDS.OPENER_GAME_AFTER_PREEMPTIVE_MIN,
        },
      ],
      band: "must",
      intraModuleOrder: 0,
      sourceIntent: { type: "RaiseToGame", params: { suit } },
      teachingLabel: `Bid game over preemptive (4${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
      teachingTags: [
        { tag: SAME_FAMILY, scope: bergenScopes.r2RebidsAfterPreemptive(suit) },
        { tag: STRONGER_THAN, scope: bergenScopes.r2PreemptiveStrength(suit), ordinal: 0 },
        { tag: CONTINUATION_OF, scope: bergenScopes.r2AfterPreemptive(suit), role: "a" },
      ],
    }, BERGEN_CTX),

    // Opener pass: ≤17 total points → Pass
    createSurface({
      meaningId: `bergen:opener-pass-after-preemptive-${suit}`,
      semanticClassId: BERGEN_CLASSES.OPENER_PASS_AFTER_PREEMPTIVE,
      encoding: { type: "pass" },
      clauses: [
        {
          factId: "bridge.totalPointsForRaise",
          operator: "lte",
          value: BERGEN_THRESHOLDS.OPENER_PASS_AFTER_PREEMPTIVE_MAX,
        },
      ],
      band: "must",
      intraModuleOrder: 1,
      sourceIntent: { type: "AcceptPartnerDecision", params: { suit } },
      teachingLabel: "Pass over preemptive",
      surfaceBindings: bindings,
      teachingTags: [
        { tag: SAME_FAMILY, scope: bergenScopes.r2RebidsAfterPreemptive(suit) },
        { tag: STRONGER_THAN, scope: bergenScopes.r2PreemptiveStrength(suit), ordinal: 1 },
      ],
    }, BERGEN_CTX),
  ];
}

// ─── Round 3: Responder continuations ───────────────────────

/**
 * R3 surfaces after opener makes a help-suit game try.
 *
 * Responder evaluates HCP within the constructive range:
 * - 9-10 HCP → accept game try, bid 4M
 * - 7-8 HCP  → reject game try, sign off at 3M
 */
function createBergenR3AfterGameTrySurfaces(
  suit: "hearts" | "spades",
): readonly BidMeaning[] {
  const bindings = { suit } as const;
  const majorStrain = suitToBidSuit(suit);

  return [
    // Accept game try: 9-10 HCP → 4M
    createSurface({
      meaningId: `bergen:responder-try-accept-${suit}`,
      semanticClassId: BERGEN_CLASSES.RESPONDER_TRY_ACCEPT,
      encoding: { defaultCall: bid(4, majorStrain) },
      clauses: [
        {
          factId: "hand.hcp",
          operator: "range",
          value: { min: BERGEN_THRESHOLDS.RESPONDER_TRY_ACCEPT_MIN, max: BERGEN_THRESHOLDS.RESPONDER_TRY_ACCEPT_MAX },
        },
      ],
      band: "must",
      intraModuleOrder: 0,
      sourceIntent: { type: "AcceptInvitation", params: { suit } },
      teachingLabel: `Accept game try → game (4${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
      teachingTags: [
        { tag: SAME_FAMILY, scope: bergenScopes.r3GameTryDecisions(suit) },
        { tag: STRONGER_THAN, scope: bergenScopes.r3GameTryStrength(suit), ordinal: 0 },
        { tag: CONTINUATION_OF, scope: SCOPE_BERGEN_R4_AFTER_TRY_DECISION, role: "b" },
        { tag: ALTERNATIVES, scope: bergenScopes.responderGameTryDecision(suit) },
      ],
    }, BERGEN_CTX),

    // Reject game try: 7-8 HCP → 3M
    createSurface({
      meaningId: `bergen:responder-try-reject-${suit}`,
      semanticClassId: BERGEN_CLASSES.RESPONDER_TRY_REJECT,
      encoding: { defaultCall: bid(3, majorStrain) },
      clauses: [
        {
          factId: "hand.hcp",
          operator: "range",
          value: { min: BERGEN_THRESHOLDS.RESPONDER_TRY_REJECT_MIN, max: BERGEN_THRESHOLDS.RESPONDER_TRY_REJECT_MAX },
        },
      ],
      band: "must",
      intraModuleOrder: 1,
      sourceIntent: { type: "DeclineInvitation", params: { suit } },
      teachingLabel: `Reject game try → signoff (3${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
      teachingTags: [
        { tag: SAME_FAMILY, scope: bergenScopes.r3GameTryDecisions(suit) },
        { tag: STRONGER_THAN, scope: bergenScopes.r3GameTryStrength(suit), ordinal: 1 },
        { tag: CONTINUATION_OF, scope: SCOPE_BERGEN_R4_AFTER_TRY_DECISION, role: "b" },
        { tag: ALTERNATIVES, scope: bergenScopes.responderGameTryDecision(suit) },
      ],
    }, BERGEN_CTX),
  ];
}

// ─── Round 4: Opener final acceptance ───────────────────────

// ─── Shared pass surface factory ────────────────────────────

/** Create a single-element pass surface used in R3 and R4 terminal states. */
function createBergenPassSurface(
  meaningId: string,
  semanticClassId: string,
  teachingLabel: string,
  teachingTags?: readonly TeachingTagRef[],
): readonly BidMeaning[] {
  return [
    createSurface({
      meaningId,
      semanticClassId,
      encoding: { type: "pass" },
      clauses: [],
      band: "must",
      intraModuleOrder: 0,
      sourceIntent: { type: "AcceptPartnerDecision", params: {} },
      teachingLabel,
      ...(teachingTags ? { teachingTags } : {}),
    }, BERGEN_CTX),
  ];
}

/**
 * R3 surface after opener bids game directly (4M).
 *
 * Responder unconditionally passes — game has been bid.
 */
function createBergenR3AfterGameSurfaces(): readonly BidMeaning[] {
  return createBergenPassSurface(
    "bergen:responder-accept-game",
    BERGEN_CLASSES.RESPONDER_ACCEPT_GAME,
    "Accept partner's game bid → pass",
  );
}

/**
 * R3 surface after opener signs off (3M or Pass).
 *
 * Responder unconditionally passes — the auction is over.
 */
function createBergenR3AfterSignoffSurfaces(): readonly BidMeaning[] {
  return createBergenPassSurface(
    "bergen:responder-accept-signoff",
    BERGEN_CLASSES.RESPONDER_ACCEPT_SIGNOFF,
    "Accept partner's signoff → pass",
  );
}

/**
 * R4 surface after responder decides on the game try.
 *
 * Opener unconditionally passes — responder has made the final decision.
 */
function createBergenR4Surfaces(): readonly BidMeaning[] {
  return createBergenPassSurface(
    "bergen:opener-accept-after-try",
    BERGEN_CLASSES.OPENER_ACCEPT_AFTER_TRY,
    "Accept partner's decision on game try → pass",
    [{ tag: CONTINUATION_OF, scope: SCOPE_BERGEN_R4_AFTER_TRY_DECISION, role: "a" }],
  );
}

// ─── Pre-instantiated surfaces ──────────────────────────────

/** R1: Pre-instantiated surfaces for hearts and spades. */
export const BERGEN_R1_HEARTS_SURFACES = createBergenR1Surfaces("hearts");
export const BERGEN_R1_SPADES_SURFACES = createBergenR1Surfaces("spades");

/** R2: Pre-instantiated surfaces for hearts and spades. */
export const BERGEN_R2_AFTER_CONSTRUCTIVE_HEARTS_SURFACES =
  createBergenR2AfterConstructiveSurfaces("hearts");
export const BERGEN_R2_AFTER_CONSTRUCTIVE_SPADES_SURFACES =
  createBergenR2AfterConstructiveSurfaces("spades");
export const BERGEN_R2_AFTER_LIMIT_HEARTS_SURFACES =
  createBergenR2AfterLimitSurfaces("hearts");
export const BERGEN_R2_AFTER_LIMIT_SPADES_SURFACES =
  createBergenR2AfterLimitSurfaces("spades");
export const BERGEN_R2_AFTER_PREEMPTIVE_HEARTS_SURFACES =
  createBergenR2AfterPreemptiveSurfaces("hearts");
export const BERGEN_R2_AFTER_PREEMPTIVE_SPADES_SURFACES =
  createBergenR2AfterPreemptiveSurfaces("spades");

/** R3: Pre-instantiated surfaces. */
export const BERGEN_R3_AFTER_GAME_SURFACES =
  createBergenR3AfterGameSurfaces();
export const BERGEN_R3_AFTER_SIGNOFF_SURFACES =
  createBergenR3AfterSignoffSurfaces();
export const BERGEN_R3_AFTER_GAME_TRY_HEARTS_SURFACES =
  createBergenR3AfterGameTrySurfaces("hearts");
export const BERGEN_R3_AFTER_GAME_TRY_SPADES_SURFACES =
  createBergenR3AfterGameTrySurfaces("spades");

/** R4: Pre-instantiated surfaces. */
export const BERGEN_R4_SURFACES = createBergenR4Surfaces();
