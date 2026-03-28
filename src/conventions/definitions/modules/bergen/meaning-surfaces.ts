import type { BidMeaning } from "../../../pipeline/evaluation/meaning";
import { BidSuit } from "../../../../engine/types";
import { BERGEN_CLASSES, BERGEN_MEANING_BY_SUIT, BERGEN_MEANING_IDS, BERGEN_CLAUSE_FACT_IDS } from "./ids";
import { bid, suitToBidSuit, otherMajorBidSuit } from "../../../core/surface-helpers";
import { createSurface } from "../../../core/surface-builder";
import type { ModuleContext } from "../../../core/surface-builder";

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

  const ids = BERGEN_MEANING_BY_SUIT[suit];

  return [
    // 1. Splinter -- 12+ HCP, exactly 4 support, shortage (singleton or void)
    // Highest priority: checked first (declarationOrder 0)
    createSurface({
      meaningId: ids.splinter,
      semanticClassId: BERGEN_CLASSES.SPLINTER,
      encoding: { defaultCall: bid(3, otherMajor) },
      clauses: [
        {
          factId: BERGEN_CLAUSE_FACT_IDS.HAND_HCP,
          operator: "gte",
          value: BERGEN_THRESHOLDS.SPLINTER_MIN,
          isPublic: true,
        },
        {
          factId: BERGEN_CLAUSE_FACT_IDS.SUIT_LENGTH_TEMPLATE,
          operator: "eq",
          value: BERGEN_THRESHOLDS.SUPPORT_LENGTH,
          isPublic: true,
        },
        {
          factId: BERGEN_CLAUSE_FACT_IDS.BRIDGE_HAS_SHORTAGE,
          operator: "boolean",
          value: true,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 0,
      sourceIntent: { type: "Splinter", params: { suit } },
      disclosure: "alert",
      teachingLabel: `Splinter (3${suit === "hearts" ? "S" : "H"})`,
      surfaceBindings: bindings,
    }, BERGEN_CTX),

    // 2. Game raise -- 13+ HCP, exactly 4 support
    createSurface({
      meaningId: ids.gameRaise,
      semanticClassId: BERGEN_CLASSES.GAME_RAISE,
      encoding: { defaultCall: bid(4, majorStrain) },
      clauses: [
        {
          factId: BERGEN_CLAUSE_FACT_IDS.HAND_HCP,
          operator: "gte",
          value: BERGEN_THRESHOLDS.GAME_RAISE_MIN,
          isPublic: true,
        },
        {
          factId: BERGEN_CLAUSE_FACT_IDS.SUIT_LENGTH_TEMPLATE,
          operator: "eq",
          value: BERGEN_THRESHOLDS.SUPPORT_LENGTH,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 1,
      sourceIntent: { type: "GameRaise", params: { suit } },
      disclosure: "alert",
      teachingLabel: `Game raise (4${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
    }, BERGEN_CTX),

    // 3. Limit raise -- 10-12 HCP, exactly 4 support
    createSurface({
      meaningId: ids.limitRaise,
      semanticClassId: BERGEN_CLASSES.LIMIT_RAISE,
      encoding: { defaultCall: bid(3, BidSuit.Diamonds) },
      clauses: [
        {
          factId: BERGEN_CLAUSE_FACT_IDS.HAND_HCP,
          operator: "range",
          value: { min: BERGEN_THRESHOLDS.LIMIT_RAISE_MIN, max: BERGEN_THRESHOLDS.LIMIT_RAISE_MAX },
          isPublic: true,
        },
        {
          factId: BERGEN_CLAUSE_FACT_IDS.SUIT_LENGTH_TEMPLATE,
          operator: "eq",
          value: BERGEN_THRESHOLDS.SUPPORT_LENGTH,
          isPublic: true,
        },
      ],
      band: "should",
      declarationOrder: 2,
      sourceIntent: { type: "LimitRaise", params: { suit } },
      disclosure: "alert",
      teachingLabel: "Limit raise (3D)",
      surfaceBindings: bindings,
    }, BERGEN_CTX),

    // 4. Constructive raise -- 7-10 HCP, exactly 4 support
    createSurface({
      meaningId: ids.constructiveRaise,
      semanticClassId: BERGEN_CLASSES.CONSTRUCTIVE_RAISE,
      encoding: { defaultCall: bid(3, BidSuit.Clubs) },
      clauses: [
        {
          factId: BERGEN_CLAUSE_FACT_IDS.HAND_HCP,
          operator: "range",
          value: { min: BERGEN_THRESHOLDS.CONSTRUCTIVE_MIN, max: BERGEN_THRESHOLDS.CONSTRUCTIVE_MAX },
          isPublic: true,
        },
        {
          factId: BERGEN_CLAUSE_FACT_IDS.SUIT_LENGTH_TEMPLATE,
          operator: "eq",
          value: BERGEN_THRESHOLDS.SUPPORT_LENGTH,
          isPublic: true,
        },
      ],
      band: "should",
      declarationOrder: 3,
      sourceIntent: { type: "ConstructiveRaise", params: { suit } },
      disclosure: "alert",
      teachingLabel: "Constructive raise (3C)",
      surfaceBindings: bindings,
    }, BERGEN_CTX),

    // 5. Preemptive raise -- 0-6 HCP, exactly 4 support
    createSurface({
      meaningId: ids.preemptiveRaise,
      semanticClassId: BERGEN_CLASSES.PREEMPTIVE_RAISE,
      encoding: { defaultCall: bid(3, majorStrain) },
      clauses: [
        {
          factId: BERGEN_CLAUSE_FACT_IDS.HAND_HCP,
          operator: "lte",
          value: BERGEN_THRESHOLDS.PREEMPTIVE_MAX,
          isPublic: true,
        },
        {
          factId: BERGEN_CLAUSE_FACT_IDS.SUIT_LENGTH_TEMPLATE,
          operator: "eq",
          value: BERGEN_THRESHOLDS.SUPPORT_LENGTH,
          isPublic: true,
        },
      ],
      band: "may",
      declarationOrder: 4,
      sourceIntent: { type: "PreemptiveRaise", params: { suit } },
      disclosure: "natural",
      teachingLabel: `Preemptive raise (3${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
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

  const ids = BERGEN_MEANING_BY_SUIT[suit];

  return [
    // Opener game: 17+ HCP → 4M
    createSurface({
      meaningId: ids.openerGameAfterConstructive,
      semanticClassId: BERGEN_CLASSES.OPENER_GAME_AFTER_CONSTRUCTIVE,
      encoding: { defaultCall: bid(4, majorStrain) },
      clauses: [
        {
          factId: BERGEN_CLAUSE_FACT_IDS.HAND_HCP,
          operator: "gte",
          value: BERGEN_THRESHOLDS.OPENER_GAME_AFTER_CONSTRUCTIVE_MIN,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 0,
      sourceIntent: { type: "AcceptInvitation", params: { suit } },
      disclosure: "natural",
      teachingLabel: "Accept constructive",
      surfaceBindings: bindings,
    }, BERGEN_CTX),

    // Opener signoff: ≤13 HCP → 3M (return to trump suit)
    createSurface({
      meaningId: ids.openerSignoffAfterConstructive,
      semanticClassId: BERGEN_CLASSES.OPENER_SIGNOFF_AFTER_CONSTRUCTIVE,
      encoding: { defaultCall: bid(3, majorStrain) },
      clauses: [
        {
          factId: BERGEN_CLAUSE_FACT_IDS.HAND_HCP,
          operator: "lte",
          value: BERGEN_THRESHOLDS.OPENER_SIGNOFF_AFTER_CONSTRUCTIVE_MAX,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 1,
      sourceIntent: { type: "DeclineInvitation", params: { suit } },
      disclosure: "natural",
      teachingLabel: "Decline constructive",
      surfaceBindings: bindings,
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
  const ids = BERGEN_MEANING_BY_SUIT[suit];

  return [
    // Opener game: 15+ HCP → 4M
    createSurface({
      meaningId: ids.openerGameAfterLimit,
      semanticClassId: BERGEN_CLASSES.OPENER_GAME_AFTER_LIMIT,
      encoding: { defaultCall: bid(4, majorStrain) },
      clauses: [
        {
          factId: BERGEN_CLAUSE_FACT_IDS.HAND_HCP,
          operator: "gte",
          value: BERGEN_THRESHOLDS.OPENER_GAME_AFTER_LIMIT_MIN,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 0,
      sourceIntent: { type: "AcceptInvitation", params: { suit } },
      disclosure: "natural",
      teachingLabel: "Accept limit raise",
      surfaceBindings: bindings,
    }, BERGEN_CTX),

    // Opener signoff: ≤14 HCP → 3M
    createSurface({
      meaningId: ids.openerSignoffAfterLimit,
      semanticClassId: BERGEN_CLASSES.OPENER_SIGNOFF_AFTER_LIMIT,
      encoding: { defaultCall: bid(3, majorStrain) },
      clauses: [
        {
          factId: BERGEN_CLAUSE_FACT_IDS.HAND_HCP,
          operator: "lte",
          value: BERGEN_THRESHOLDS.OPENER_SIGNOFF_AFTER_LIMIT_MAX,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 1,
      sourceIntent: { type: "DeclineInvitation", params: { suit } },
      disclosure: "natural",
      teachingLabel: "Decline limit raise",
      surfaceBindings: bindings,
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

  const ids = BERGEN_MEANING_BY_SUIT[suit];

  return [
    // Opener game: 18+ total points → 4M
    createSurface({
      meaningId: ids.openerGameAfterPreemptive,
      semanticClassId: BERGEN_CLASSES.OPENER_GAME_AFTER_PREEMPTIVE,
      encoding: { defaultCall: bid(4, majorStrain) },
      clauses: [
        {
          factId: BERGEN_CLAUSE_FACT_IDS.BRIDGE_TOTAL_POINTS_FOR_RAISE,
          operator: "gte",
          value: BERGEN_THRESHOLDS.OPENER_GAME_AFTER_PREEMPTIVE_MIN,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 0,
      sourceIntent: { type: "RaiseToGame", params: { suit } },
      disclosure: "natural",
      teachingLabel: `Bid game over preemptive (4${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
    }, BERGEN_CTX),

    // Opener pass: ≤17 total points → Pass
    createSurface({
      meaningId: ids.openerPassAfterPreemptive,
      semanticClassId: BERGEN_CLASSES.OPENER_PASS_AFTER_PREEMPTIVE,
      encoding: { type: "pass" },
      clauses: [
        {
          factId: BERGEN_CLAUSE_FACT_IDS.BRIDGE_TOTAL_POINTS_FOR_RAISE,
          operator: "lte",
          value: BERGEN_THRESHOLDS.OPENER_PASS_AFTER_PREEMPTIVE_MAX,
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 1,
      sourceIntent: { type: "AcceptPartnerDecision", params: { suit } },
      disclosure: "natural",
      teachingLabel: "Pass over preemptive",
      surfaceBindings: bindings,
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

  const ids = BERGEN_MEANING_BY_SUIT[suit];

  return [
    // Accept game try: 9-10 HCP → 4M
    createSurface({
      meaningId: ids.responderTryAccept,
      semanticClassId: BERGEN_CLASSES.RESPONDER_TRY_ACCEPT,
      encoding: { defaultCall: bid(4, majorStrain) },
      clauses: [
        {
          factId: BERGEN_CLAUSE_FACT_IDS.HAND_HCP,
          operator: "range",
          value: { min: BERGEN_THRESHOLDS.RESPONDER_TRY_ACCEPT_MIN, max: BERGEN_THRESHOLDS.RESPONDER_TRY_ACCEPT_MAX },
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 0,
      sourceIntent: { type: "AcceptInvitation", params: { suit } },
      disclosure: "alert",
      teachingLabel: `Accept game try → game (4${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
    }, BERGEN_CTX),

    // Reject game try: 7-8 HCP → 3M
    createSurface({
      meaningId: ids.responderTryReject,
      semanticClassId: BERGEN_CLASSES.RESPONDER_TRY_REJECT,
      encoding: { defaultCall: bid(3, majorStrain) },
      clauses: [
        {
          factId: BERGEN_CLAUSE_FACT_IDS.HAND_HCP,
          operator: "range",
          value: { min: BERGEN_THRESHOLDS.RESPONDER_TRY_REJECT_MIN, max: BERGEN_THRESHOLDS.RESPONDER_TRY_REJECT_MAX },
          isPublic: true,
        },
      ],
      band: "must",
      declarationOrder: 1,
      sourceIntent: { type: "DeclineInvitation", params: { suit } },
      disclosure: "alert",
      teachingLabel: `Reject game try → signoff (3${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
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
): readonly BidMeaning[] {
  return [
    createSurface({
      meaningId,
      semanticClassId,
      encoding: { type: "pass" },
      clauses: [],
      band: "must",
      declarationOrder: 0,
      sourceIntent: { type: "AcceptPartnerDecision", params: {} },
      disclosure: "natural",
      teachingLabel,
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
    BERGEN_MEANING_IDS.RESPONDER_ACCEPT_GAME,
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
    BERGEN_MEANING_IDS.RESPONDER_ACCEPT_SIGNOFF,
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
    BERGEN_MEANING_IDS.OPENER_ACCEPT_AFTER_TRY,
    BERGEN_CLASSES.OPENER_ACCEPT_AFTER_TRY,
    "Accept partner's decision on game try → pass",
  );
}

// ─── Natural 1NT response alternative (system-dependent) ────

/**
 * Natural 1NT response to partner's 1M opening.
 *
 * This surface represents "respond 1NT to partner's major" as a natural
 * alternative when the hand does NOT have 4-card support for opener's major.
 * The HCP range is system-dependent via `system.responder.oneNtRange`:
 * - SAYC: 6-10 HCP (non-forcing)
 * - 2/1 GF: 6-12 HCP (semi-forcing)
 *
 * This creates an observable behavioral difference between systems: a hand
 * with 11 HCP and only 3-card support matches in 2/1 (11 <= 12) but not
 * in SAYC (11 > 10).
 */
function createBergenNatural1NtResponseSurfaces(
  suit: "hearts" | "spades",
): readonly BidMeaning[] {
  const bindings = { suit } as const;

  const ids = BERGEN_MEANING_BY_SUIT[suit];

  return [
    createSurface({
      meaningId: ids.natural1nt,
      semanticClassId: BERGEN_CLASSES.NATURAL_1NT_RESPONSE,
      encoding: { defaultCall: bid(1, BidSuit.NoTrump) },
      clauses: [
        {
          factId: BERGEN_CLAUSE_FACT_IDS.SYSTEM_RESPONDER_ONE_NT_RANGE,
          operator: "boolean",
          value: true,
          isPublic: true,
        },
        {
          factId: BERGEN_CLAUSE_FACT_IDS.SUIT_LENGTH_TEMPLATE,
          operator: "lte",
          value: 3,
          isPublic: true,
        },
        // Over 1♥, responder must not have 4+ spades (bid 1♠ instead).
        // Over 1♠, no higher-ranking suit exists, so this clause is vacuous.
        ...(suit === "hearts" ? [{
          factId: BERGEN_CLAUSE_FACT_IDS.HAND_SUIT_LENGTH_SPADES,
          operator: "lte" as const,
          value: 3,
        }] : []),
      ],
      band: "should",
      declarationOrder: 5,
      sourceIntent: { type: "NaturalNtResponse", params: { suit } },
      disclosure: "natural",
      teachingLabel: "1NT response",
      surfaceBindings: bindings,
    }, BERGEN_CTX),
  ];
}

// ─── Pre-instantiated surfaces ──────────────────────────────

/** R1: Pre-instantiated surfaces for hearts and spades. */
export const BERGEN_R1_HEARTS_SURFACES = createBergenR1Surfaces("hearts");
export const BERGEN_R1_SPADES_SURFACES = createBergenR1Surfaces("spades");

/** R1: Natural 1NT response alternatives (system-dependent range). */
export const BERGEN_NATURAL_1NT_HEARTS_SURFACES = createBergenNatural1NtResponseSurfaces("hearts");
export const BERGEN_NATURAL_1NT_SPADES_SURFACES = createBergenNatural1NtResponseSurfaces("spades");

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
