import type { MeaningSurface } from "../../../../core/contracts/meaning";
import type { PedagogicalTagRef } from "../../../../core/contracts/pedagogical-tag";
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
} from "../../pedagogical-vocabulary";

const BERGEN_CTX: ModuleContext = { moduleId: "bergen" };

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
export function createBergenR1Surfaces(
  suit: "hearts" | "spades",
): readonly MeaningSurface[] {
  const bindings = { suit } as const;
  const majorStrain = suitToBidSuit(suit);
  const otherMajor = otherMajorBidSuit(suit);

  return [
    // 1. Splinter -- 12+ HCP, 4+ support, shortage (singleton or void)
    // Highest priority: checked first (intraModuleOrder 0)
    createSurface({
      meaningId: `bergen:splinter-${suit}`,
      semanticClassId: BERGEN_CLASSES.SPLINTER,
      encoding: { defaultCall: bid(3, otherMajor) },
      clauses: [
        {
          factId: "hand.hcp",
          operator: "gte",
          value: 12,
        },
        {
          factId: "hand.suitLength.$suit",
          operator: "gte",
          value: 4,
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
      pedagogicalTags: [
        { tag: SAME_FAMILY, scope: `bergen:r1-splinter-and-game-${suit}` },
        { tag: NEAR_MISS_OF, scope: `bergen:r1-splinter-vs-game-${suit}`, role: "a" },
      ],
    }, BERGEN_CTX),

    // 2. Game raise -- 13+ HCP, 4+ support
    createSurface({
      meaningId: `bergen:game-raise-${suit}`,
      semanticClassId: BERGEN_CLASSES.GAME_RAISE,
      encoding: { defaultCall: bid(4, majorStrain) },
      clauses: [
        {
          factId: "hand.hcp",
          operator: "gte",
          value: 13,
        },
        {
          factId: "hand.suitLength.$suit",
          operator: "gte",
          value: 4,
        },
      ],
      band: "must",
      intraModuleOrder: 1,
      sourceIntent: { type: "GameRaise", params: { suit } },
      teachingLabel: `Game raise (4${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
      pedagogicalTags: [
        { tag: SAME_FAMILY, scope: `bergen:r1-strength-raises-${suit}` },
        { tag: SAME_FAMILY, scope: `bergen:r1-splinter-and-game-${suit}` },
        { tag: STRONGER_THAN, scope: `bergen:r1-strength-chain-${suit}`, ordinal: 0 },
        { tag: NEAR_MISS_OF, scope: `bergen:r1-splinter-vs-game-${suit}`, role: "b" },
        { tag: ALTERNATIVES, scope: `Bergen strength raises (${suit})` },
      ],
    }, BERGEN_CTX),

    // 3. Limit raise -- 10-12 HCP, 4+ support
    createSurface({
      meaningId: `bergen:limit-raise-${suit}`,
      semanticClassId: BERGEN_CLASSES.LIMIT_RAISE,
      encoding: { defaultCall: bid(3, BidSuit.Diamonds) },
      clauses: [
        {
          factId: "hand.hcp",
          operator: "range",
          value: { min: 10, max: 12 },
        },
        {
          factId: "hand.suitLength.$suit",
          operator: "gte",
          value: 4,
        },
      ],
      band: "should",
      intraModuleOrder: 2,
      sourceIntent: { type: "LimitRaise", params: { suit } },
      teachingLabel: "Limit raise (3D)",
      surfaceBindings: bindings,
      pedagogicalTags: [
        { tag: SAME_FAMILY, scope: `bergen:r1-strength-raises-${suit}` },
        { tag: STRONGER_THAN, scope: `bergen:r1-strength-chain-${suit}`, ordinal: 1 },
        { tag: NEAR_MISS_OF, scope: `bergen:r1-constructive-vs-limit-${suit}`, role: "b" },
        { tag: CONTINUATION_OF, scope: `bergen:r2-after-limit-${suit}`, role: "b" },
        { tag: ALTERNATIVES, scope: `Bergen strength raises (${suit})` },
      ],
    }, BERGEN_CTX),

    // 4. Constructive raise -- 7-10 HCP, 4+ support
    createSurface({
      meaningId: `bergen:constructive-raise-${suit}`,
      semanticClassId: BERGEN_CLASSES.CONSTRUCTIVE_RAISE,
      encoding: { defaultCall: bid(3, BidSuit.Clubs) },
      clauses: [
        {
          factId: "hand.hcp",
          operator: "range",
          value: { min: 7, max: 10 },
        },
        {
          factId: "hand.suitLength.$suit",
          operator: "gte",
          value: 4,
        },
      ],
      band: "should",
      intraModuleOrder: 3,
      sourceIntent: { type: "ConstructiveRaise", params: { suit } },
      teachingLabel: "Constructive raise (3C)",
      surfaceBindings: bindings,
      pedagogicalTags: [
        { tag: SAME_FAMILY, scope: `bergen:r1-strength-raises-${suit}` },
        { tag: STRONGER_THAN, scope: `bergen:r1-strength-chain-${suit}`, ordinal: 2 },
        { tag: NEAR_MISS_OF, scope: `bergen:r1-constructive-vs-limit-${suit}`, role: "a" },
        { tag: FALLBACK_OF, scope: `bergen:r1-preemptive-fallback-${suit}`, role: "b" },
        { tag: CONTINUATION_OF, scope: `bergen:r2-after-constructive-${suit}`, role: "b" },
        { tag: ALTERNATIVES, scope: `Bergen strength raises (${suit})` },
      ],
    }, BERGEN_CTX),

    // 5. Preemptive raise -- 0-6 HCP, 4+ support
    createSurface({
      meaningId: `bergen:preemptive-raise-${suit}`,
      semanticClassId: BERGEN_CLASSES.PREEMPTIVE_RAISE,
      encoding: { defaultCall: bid(3, majorStrain) },
      clauses: [
        {
          factId: "hand.hcp",
          operator: "lte",
          value: 6,
        },
        {
          factId: "hand.suitLength.$suit",
          operator: "gte",
          value: 4,
        },
      ],
      band: "may",
      intraModuleOrder: 4,
      sourceIntent: { type: "PreemptiveRaise", params: { suit } },
      teachingLabel: `Preemptive raise (3${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
      pedagogicalTags: [
        { tag: SAME_FAMILY, scope: `bergen:r1-strength-raises-${suit}` },
        { tag: STRONGER_THAN, scope: `bergen:r1-strength-chain-${suit}`, ordinal: 3 },
        { tag: FALLBACK_OF, scope: `bergen:r1-preemptive-fallback-${suit}`, role: "a" },
        { tag: CONTINUATION_OF, scope: `bergen:r2-after-preemptive-${suit}`, role: "b" },
        { tag: ALTERNATIVES, scope: `Bergen strength raises (${suit})` },
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
export function createBergenR2AfterConstructiveSurfaces(
  suit: "hearts" | "spades",
): readonly MeaningSurface[] {
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
          value: 17,
        },
      ],
      band: "must",
      intraModuleOrder: 0,
      sourceIntent: { type: "AcceptInvitation", params: { suit } },
      teachingLabel: `Accept constructive → game (4${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
      pedagogicalTags: [
        { tag: SAME_FAMILY, scope: `bergen:r2-rebids-after-constructive-${suit}` },
        { tag: STRONGER_THAN, scope: `bergen:r2-constructive-strength-${suit}`, ordinal: 0 },
        { tag: CONTINUATION_OF, scope: `bergen:r2-after-constructive-${suit}`, role: "a" },
        { tag: ALTERNATIVES, scope: `Opener rebid after constructive (${suit})` },
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
          value: 13,
        },
      ],
      band: "must",
      intraModuleOrder: 1,
      sourceIntent: { type: "DeclineInvitation", params: { suit } },
      teachingLabel: `Decline constructive → signoff (3${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
      pedagogicalTags: [
        { tag: SAME_FAMILY, scope: `bergen:r2-rebids-after-constructive-${suit}` },
        { tag: STRONGER_THAN, scope: `bergen:r2-constructive-strength-${suit}`, ordinal: 1 },
        { tag: ALTERNATIVES, scope: `Opener rebid after constructive (${suit})` },
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
export function createBergenR2AfterLimitSurfaces(
  suit: "hearts" | "spades",
): readonly MeaningSurface[] {
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
          value: 15,
        },
      ],
      band: "must",
      intraModuleOrder: 0,
      sourceIntent: { type: "AcceptInvitation", params: { suit } },
      teachingLabel: `Accept limit raise → game (4${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
      pedagogicalTags: [
        { tag: SAME_FAMILY, scope: `bergen:r2-rebids-after-limit-${suit}` },
        { tag: STRONGER_THAN, scope: `bergen:r2-limit-strength-${suit}`, ordinal: 0 },
        { tag: CONTINUATION_OF, scope: `bergen:r2-after-limit-${suit}`, role: "a" },
        { tag: ALTERNATIVES, scope: `Opener rebid after limit (${suit})` },
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
          value: 14,
        },
      ],
      band: "must",
      intraModuleOrder: 1,
      sourceIntent: { type: "DeclineInvitation", params: { suit } },
      teachingLabel: `Decline limit raise → signoff (3${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
      pedagogicalTags: [
        { tag: SAME_FAMILY, scope: `bergen:r2-rebids-after-limit-${suit}` },
        { tag: STRONGER_THAN, scope: `bergen:r2-limit-strength-${suit}`, ordinal: 1 },
        { tag: ALTERNATIVES, scope: `Opener rebid after limit (${suit})` },
      ],
    }, BERGEN_CTX),
  ];
}

/**
 * R2 surfaces after preemptive raise (1M-P-3M-P).
 *
 * Opener evaluates HCP:
 * - 18+ HCP → bid game (4M)
 * - ≤17 HCP → pass
 */
export function createBergenR2AfterPreemptiveSurfaces(
  suit: "hearts" | "spades",
): readonly MeaningSurface[] {
  const bindings = { suit } as const;
  const majorStrain = suitToBidSuit(suit);

  return [
    // Opener game: 18+ HCP → 4M
    createSurface({
      meaningId: `bergen:opener-game-after-preemptive-${suit}`,
      semanticClassId: BERGEN_CLASSES.OPENER_GAME_AFTER_PREEMPTIVE,
      encoding: { defaultCall: bid(4, majorStrain) },
      clauses: [
        {
          factId: "hand.hcp",
          operator: "gte",
          value: 18,
        },
      ],
      band: "must",
      intraModuleOrder: 0,
      sourceIntent: { type: "RaiseToGame", params: { suit } },
      teachingLabel: `Bid game over preemptive (4${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
      pedagogicalTags: [
        { tag: SAME_FAMILY, scope: `bergen:r2-rebids-after-preemptive-${suit}` },
        { tag: STRONGER_THAN, scope: `bergen:r2-preemptive-strength-${suit}`, ordinal: 0 },
        { tag: CONTINUATION_OF, scope: `bergen:r2-after-preemptive-${suit}`, role: "a" },
      ],
    }, BERGEN_CTX),

    // Opener pass: ≤17 HCP → Pass
    createSurface({
      meaningId: `bergen:opener-pass-after-preemptive-${suit}`,
      semanticClassId: BERGEN_CLASSES.OPENER_PASS_AFTER_PREEMPTIVE,
      encoding: { type: "pass" },
      clauses: [
        {
          factId: "hand.hcp",
          operator: "lte",
          value: 17,
        },
      ],
      band: "must",
      intraModuleOrder: 1,
      sourceIntent: { type: "AcceptPartnerDecision", params: { suit } },
      teachingLabel: "Pass over preemptive",
      surfaceBindings: bindings,
      pedagogicalTags: [
        { tag: SAME_FAMILY, scope: `bergen:r2-rebids-after-preemptive-${suit}` },
        { tag: STRONGER_THAN, scope: `bergen:r2-preemptive-strength-${suit}`, ordinal: 1 },
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
export function createBergenR3AfterGameTrySurfaces(
  suit: "hearts" | "spades",
): readonly MeaningSurface[] {
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
          value: { min: 9, max: 10 },
        },
      ],
      band: "must",
      intraModuleOrder: 0,
      sourceIntent: { type: "AcceptInvitation", params: { suit } },
      teachingLabel: `Accept game try → game (4${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
      pedagogicalTags: [
        { tag: SAME_FAMILY, scope: `bergen:r3-game-try-decisions-${suit}` },
        { tag: STRONGER_THAN, scope: `bergen:r3-game-try-strength-${suit}`, ordinal: 0 },
        { tag: CONTINUATION_OF, scope: "bergen:r4-after-try-decision", role: "b" },
        { tag: ALTERNATIVES, scope: `Responder game try decision (${suit})` },
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
          value: { min: 7, max: 8 },
        },
      ],
      band: "must",
      intraModuleOrder: 1,
      sourceIntent: { type: "DeclineInvitation", params: { suit } },
      teachingLabel: `Reject game try → signoff (3${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
      pedagogicalTags: [
        { tag: SAME_FAMILY, scope: `bergen:r3-game-try-decisions-${suit}` },
        { tag: STRONGER_THAN, scope: `bergen:r3-game-try-strength-${suit}`, ordinal: 1 },
        { tag: CONTINUATION_OF, scope: "bergen:r4-after-try-decision", role: "b" },
        { tag: ALTERNATIVES, scope: `Responder game try decision (${suit})` },
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
  pedagogicalTags?: readonly PedagogicalTagRef[],
): readonly MeaningSurface[] {
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
      ...(pedagogicalTags ? { pedagogicalTags } : {}),
    }, BERGEN_CTX),
  ];
}

/**
 * R3 surface after opener bids game directly (4M).
 *
 * Responder unconditionally passes — game has been bid.
 */
export function createBergenR3AfterGameSurfaces(): readonly MeaningSurface[] {
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
export function createBergenR3AfterSignoffSurfaces(): readonly MeaningSurface[] {
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
export function createBergenR4Surfaces(): readonly MeaningSurface[] {
  return createBergenPassSurface(
    "bergen:opener-accept-after-try",
    BERGEN_CLASSES.OPENER_ACCEPT_AFTER_TRY,
    "Accept partner's decision on game try → pass",
    [{ tag: CONTINUATION_OF, scope: "bergen:r4-after-try-decision", role: "a" }],
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
