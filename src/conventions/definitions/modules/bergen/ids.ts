// ─── Fact IDs ───────────────────────────────────────────────

/**
 * Typed ID constants for Bergen Raises fact IDs.
 *
 * Module-derived facts defined in facts.ts, plus shared/template fact IDs
 * referenced in Bergen surface clauses.
 */

import {
  HAND_HCP,
  HAND_SUIT_LENGTH_HEARTS,
  HAND_SUIT_LENGTH_SPADES,
  BRIDGE_HAS_SHORTAGE,
  BRIDGE_TOTAL_POINTS_FOR_RAISE,
} from "../../../core/shared-fact-vocabulary";

// ─── Bergen module fact IDs ──────────────────────────────────

export const BERGEN_FACT_IDS = {
  HAS_MAJOR_SUPPORT: "module.bergen.hasMajorSupport",
} as const;

export type BergenFactId = (typeof BERGEN_FACT_IDS)[keyof typeof BERGEN_FACT_IDS];

// ─── Clause fact IDs referenced in Bergen surfaces ───────────
//
// These are shared/template fact IDs that Bergen clauses reference.
// Re-exported here for single-source-of-truth imports within the module.

export const BERGEN_CLAUSE_FACT_IDS = {
  HAND_HCP,
  HAND_SUIT_LENGTH_HEARTS,
  HAND_SUIT_LENGTH_SPADES,
  /** Template: resolved via surfaceBindings { suit } */
  SUIT_LENGTH_TEMPLATE: "hand.suitLength.$suit",
  BRIDGE_HAS_SHORTAGE,
  BRIDGE_TOTAL_POINTS_FOR_RAISE,
  /** System fact for 1NT response HCP range */
  SYSTEM_RESPONDER_ONE_NT_RANGE: "system.responder.oneNtRange",
} as const;

// ─── Meaning IDs ────────────────────────────────────────────

/**
 * Typed ID constants for all Bergen Raises meaning IDs.
 *
 * Bergen generates meanings per suit (hearts, spades) via parameterized factories.
 * This file enumerates ALL concrete meaning IDs for both suit variants, plus
 * suit-independent terminal meanings.
 */

// ─── R1: Responder raises ────────────────────────────────────

// Splinter (12+ HCP, 4-card support, shortage)
const BERGEN_SPLINTER_HEARTS = "bergen:splinter-hearts" as const;
const BERGEN_SPLINTER_SPADES = "bergen:splinter-spades" as const;

// Game raise (13+ HCP, 4-card support)
const BERGEN_GAME_RAISE_HEARTS = "bergen:game-raise-hearts" as const;
const BERGEN_GAME_RAISE_SPADES = "bergen:game-raise-spades" as const;

// Limit raise (10-12 HCP, 4-card support)
const BERGEN_LIMIT_RAISE_HEARTS = "bergen:limit-raise-hearts" as const;
const BERGEN_LIMIT_RAISE_SPADES = "bergen:limit-raise-spades" as const;

// Constructive raise (7-10 HCP, 4-card support)
const BERGEN_CONSTRUCTIVE_RAISE_HEARTS = "bergen:constructive-raise-hearts" as const;
const BERGEN_CONSTRUCTIVE_RAISE_SPADES = "bergen:constructive-raise-spades" as const;

// Preemptive raise (0-6 HCP, 4-card support)
const BERGEN_PREEMPTIVE_RAISE_HEARTS = "bergen:preemptive-raise-hearts" as const;
const BERGEN_PREEMPTIVE_RAISE_SPADES = "bergen:preemptive-raise-spades" as const;

// ─── R1: Natural 1NT response ────────────────────────────────

const BERGEN_NATURAL_1NT_RESPONSE_HEARTS = "bergen:natural-1nt-response-hearts" as const;
const BERGEN_NATURAL_1NT_RESPONSE_SPADES = "bergen:natural-1nt-response-spades" as const;

// ─── R2: Opener rebids after constructive raise ──────────────

const BERGEN_OPENER_GAME_AFTER_CONSTRUCTIVE_HEARTS = "bergen:opener-game-after-constructive-hearts" as const;
const BERGEN_OPENER_GAME_AFTER_CONSTRUCTIVE_SPADES = "bergen:opener-game-after-constructive-spades" as const;
const BERGEN_OPENER_GAME_TRY_AFTER_CONSTRUCTIVE_HEARTS = "bergen:opener-game-try-after-constructive-hearts" as const;
const BERGEN_OPENER_GAME_TRY_AFTER_CONSTRUCTIVE_SPADES = "bergen:opener-game-try-after-constructive-spades" as const;
const BERGEN_OPENER_SIGNOFF_AFTER_CONSTRUCTIVE_HEARTS = "bergen:opener-signoff-after-constructive-hearts" as const;
const BERGEN_OPENER_SIGNOFF_AFTER_CONSTRUCTIVE_SPADES = "bergen:opener-signoff-after-constructive-spades" as const;

// ─── R2: Opener rebids after limit raise ─────────────────────

const BERGEN_OPENER_GAME_AFTER_LIMIT_HEARTS = "bergen:opener-game-after-limit-hearts" as const;
const BERGEN_OPENER_GAME_AFTER_LIMIT_SPADES = "bergen:opener-game-after-limit-spades" as const;
const BERGEN_OPENER_SIGNOFF_AFTER_LIMIT_HEARTS = "bergen:opener-signoff-after-limit-hearts" as const;
const BERGEN_OPENER_SIGNOFF_AFTER_LIMIT_SPADES = "bergen:opener-signoff-after-limit-spades" as const;

// ─── R2: Opener rebids after preemptive raise ────────────────

const BERGEN_OPENER_GAME_AFTER_PREEMPTIVE_HEARTS = "bergen:opener-game-after-preemptive-hearts" as const;
const BERGEN_OPENER_GAME_AFTER_PREEMPTIVE_SPADES = "bergen:opener-game-after-preemptive-spades" as const;
const BERGEN_OPENER_PASS_AFTER_PREEMPTIVE_HEARTS = "bergen:opener-pass-after-preemptive-hearts" as const;
const BERGEN_OPENER_PASS_AFTER_PREEMPTIVE_SPADES = "bergen:opener-pass-after-preemptive-spades" as const;

// ─── R3: Responder continuations ─────────────────────────────

// After opener makes a game try
const BERGEN_RESPONDER_TRY_ACCEPT_HEARTS = "bergen:responder-try-accept-hearts" as const;
const BERGEN_RESPONDER_TRY_ACCEPT_SPADES = "bergen:responder-try-accept-spades" as const;
const BERGEN_RESPONDER_TRY_REJECT_HEARTS = "bergen:responder-try-reject-hearts" as const;
const BERGEN_RESPONDER_TRY_REJECT_SPADES = "bergen:responder-try-reject-spades" as const;

// After opener bids game directly (suit-independent)
const BERGEN_RESPONDER_ACCEPT_GAME = "bergen:responder-accept-game" as const;

// After opener signs off (suit-independent)
const BERGEN_RESPONDER_ACCEPT_SIGNOFF = "bergen:responder-accept-signoff" as const;

// ─── R4: Opener final acceptance (suit-independent) ──────────

const BERGEN_OPENER_ACCEPT_AFTER_TRY = "bergen:opener-accept-after-try" as const;

// ─── Stub openings ───────────────────────────────────────────

const BERGEN_OPENER_1H = "bergen:opener-1h" as const;
const BERGEN_OPENER_1S = "bergen:opener-1s" as const;

// ─── Collected constants ─────────────────────────────────────

export const BERGEN_MEANING_IDS = {
  // R1: Raises
  SPLINTER_HEARTS: BERGEN_SPLINTER_HEARTS,
  SPLINTER_SPADES: BERGEN_SPLINTER_SPADES,
  GAME_RAISE_HEARTS: BERGEN_GAME_RAISE_HEARTS,
  GAME_RAISE_SPADES: BERGEN_GAME_RAISE_SPADES,
  LIMIT_RAISE_HEARTS: BERGEN_LIMIT_RAISE_HEARTS,
  LIMIT_RAISE_SPADES: BERGEN_LIMIT_RAISE_SPADES,
  CONSTRUCTIVE_RAISE_HEARTS: BERGEN_CONSTRUCTIVE_RAISE_HEARTS,
  CONSTRUCTIVE_RAISE_SPADES: BERGEN_CONSTRUCTIVE_RAISE_SPADES,
  PREEMPTIVE_RAISE_HEARTS: BERGEN_PREEMPTIVE_RAISE_HEARTS,
  PREEMPTIVE_RAISE_SPADES: BERGEN_PREEMPTIVE_RAISE_SPADES,

  // R1: Natural 1NT
  NATURAL_1NT_RESPONSE_HEARTS: BERGEN_NATURAL_1NT_RESPONSE_HEARTS,
  NATURAL_1NT_RESPONSE_SPADES: BERGEN_NATURAL_1NT_RESPONSE_SPADES,

  // R2: After constructive
  OPENER_GAME_AFTER_CONSTRUCTIVE_HEARTS: BERGEN_OPENER_GAME_AFTER_CONSTRUCTIVE_HEARTS,
  OPENER_GAME_AFTER_CONSTRUCTIVE_SPADES: BERGEN_OPENER_GAME_AFTER_CONSTRUCTIVE_SPADES,
  OPENER_GAME_TRY_AFTER_CONSTRUCTIVE_HEARTS: BERGEN_OPENER_GAME_TRY_AFTER_CONSTRUCTIVE_HEARTS,
  OPENER_GAME_TRY_AFTER_CONSTRUCTIVE_SPADES: BERGEN_OPENER_GAME_TRY_AFTER_CONSTRUCTIVE_SPADES,
  OPENER_SIGNOFF_AFTER_CONSTRUCTIVE_HEARTS: BERGEN_OPENER_SIGNOFF_AFTER_CONSTRUCTIVE_HEARTS,
  OPENER_SIGNOFF_AFTER_CONSTRUCTIVE_SPADES: BERGEN_OPENER_SIGNOFF_AFTER_CONSTRUCTIVE_SPADES,

  // R2: After limit
  OPENER_GAME_AFTER_LIMIT_HEARTS: BERGEN_OPENER_GAME_AFTER_LIMIT_HEARTS,
  OPENER_GAME_AFTER_LIMIT_SPADES: BERGEN_OPENER_GAME_AFTER_LIMIT_SPADES,
  OPENER_SIGNOFF_AFTER_LIMIT_HEARTS: BERGEN_OPENER_SIGNOFF_AFTER_LIMIT_HEARTS,
  OPENER_SIGNOFF_AFTER_LIMIT_SPADES: BERGEN_OPENER_SIGNOFF_AFTER_LIMIT_SPADES,

  // R2: After preemptive
  OPENER_GAME_AFTER_PREEMPTIVE_HEARTS: BERGEN_OPENER_GAME_AFTER_PREEMPTIVE_HEARTS,
  OPENER_GAME_AFTER_PREEMPTIVE_SPADES: BERGEN_OPENER_GAME_AFTER_PREEMPTIVE_SPADES,
  OPENER_PASS_AFTER_PREEMPTIVE_HEARTS: BERGEN_OPENER_PASS_AFTER_PREEMPTIVE_HEARTS,
  OPENER_PASS_AFTER_PREEMPTIVE_SPADES: BERGEN_OPENER_PASS_AFTER_PREEMPTIVE_SPADES,

  // R3: Game try decisions
  RESPONDER_TRY_ACCEPT_HEARTS: BERGEN_RESPONDER_TRY_ACCEPT_HEARTS,
  RESPONDER_TRY_ACCEPT_SPADES: BERGEN_RESPONDER_TRY_ACCEPT_SPADES,
  RESPONDER_TRY_REJECT_HEARTS: BERGEN_RESPONDER_TRY_REJECT_HEARTS,
  RESPONDER_TRY_REJECT_SPADES: BERGEN_RESPONDER_TRY_REJECT_SPADES,

  // R3: Terminal pass surfaces
  RESPONDER_ACCEPT_GAME: BERGEN_RESPONDER_ACCEPT_GAME,
  RESPONDER_ACCEPT_SIGNOFF: BERGEN_RESPONDER_ACCEPT_SIGNOFF,

  // R4: Terminal pass
  OPENER_ACCEPT_AFTER_TRY: BERGEN_OPENER_ACCEPT_AFTER_TRY,

  // Stub openings
  OPENER_1H: BERGEN_OPENER_1H,
  OPENER_1S: BERGEN_OPENER_1S,
} as const;

export type BergenMeaningId = (typeof BERGEN_MEANING_IDS)[keyof typeof BERGEN_MEANING_IDS];

// ─── Suit-parameterized lookup helper ────────────────────────

/** Look up concrete meaning IDs by suit for parameterized surface factories. */
export const BERGEN_MEANING_BY_SUIT = {
  hearts: {
    splinter: BERGEN_SPLINTER_HEARTS,
    gameRaise: BERGEN_GAME_RAISE_HEARTS,
    limitRaise: BERGEN_LIMIT_RAISE_HEARTS,
    constructiveRaise: BERGEN_CONSTRUCTIVE_RAISE_HEARTS,
    preemptiveRaise: BERGEN_PREEMPTIVE_RAISE_HEARTS,
    natural1nt: BERGEN_NATURAL_1NT_RESPONSE_HEARTS,
    openerGameAfterConstructive: BERGEN_OPENER_GAME_AFTER_CONSTRUCTIVE_HEARTS,
    openerGameTryAfterConstructive: BERGEN_OPENER_GAME_TRY_AFTER_CONSTRUCTIVE_HEARTS,
    openerSignoffAfterConstructive: BERGEN_OPENER_SIGNOFF_AFTER_CONSTRUCTIVE_HEARTS,
    openerGameAfterLimit: BERGEN_OPENER_GAME_AFTER_LIMIT_HEARTS,
    openerSignoffAfterLimit: BERGEN_OPENER_SIGNOFF_AFTER_LIMIT_HEARTS,
    openerGameAfterPreemptive: BERGEN_OPENER_GAME_AFTER_PREEMPTIVE_HEARTS,
    openerPassAfterPreemptive: BERGEN_OPENER_PASS_AFTER_PREEMPTIVE_HEARTS,
    responderTryAccept: BERGEN_RESPONDER_TRY_ACCEPT_HEARTS,
    responderTryReject: BERGEN_RESPONDER_TRY_REJECT_HEARTS,
  },
  spades: {
    splinter: BERGEN_SPLINTER_SPADES,
    gameRaise: BERGEN_GAME_RAISE_SPADES,
    limitRaise: BERGEN_LIMIT_RAISE_SPADES,
    constructiveRaise: BERGEN_CONSTRUCTIVE_RAISE_SPADES,
    preemptiveRaise: BERGEN_PREEMPTIVE_RAISE_SPADES,
    natural1nt: BERGEN_NATURAL_1NT_RESPONSE_SPADES,
    openerGameAfterConstructive: BERGEN_OPENER_GAME_AFTER_CONSTRUCTIVE_SPADES,
    openerGameTryAfterConstructive: BERGEN_OPENER_GAME_TRY_AFTER_CONSTRUCTIVE_SPADES,
    openerSignoffAfterConstructive: BERGEN_OPENER_SIGNOFF_AFTER_CONSTRUCTIVE_SPADES,
    openerGameAfterLimit: BERGEN_OPENER_GAME_AFTER_LIMIT_SPADES,
    openerSignoffAfterLimit: BERGEN_OPENER_SIGNOFF_AFTER_LIMIT_SPADES,
    openerGameAfterPreemptive: BERGEN_OPENER_GAME_AFTER_PREEMPTIVE_SPADES,
    openerPassAfterPreemptive: BERGEN_OPENER_PASS_AFTER_PREEMPTIVE_SPADES,
    responderTryAccept: BERGEN_RESPONDER_TRY_ACCEPT_SPADES,
    responderTryReject: BERGEN_RESPONDER_TRY_REJECT_SPADES,
  },
} as const;

// ─── Semantic Classes ───────────────────────────────────────

/** Bergen Raises semantic class IDs -- module-local, not in the central registry. */
export const BERGEN_CLASSES = {
  // R1: Responder initial bids
  SPLINTER: "bergen:splinter",
  GAME_RAISE: "bergen:game-raise",
  LIMIT_RAISE: "bergen:limit-raise",
  CONSTRUCTIVE_RAISE: "bergen:constructive-raise",
  PREEMPTIVE_RAISE: "bergen:preemptive-raise",

  // R2: Opener rebids
  OPENER_GAME_AFTER_CONSTRUCTIVE: "bergen:opener-game-after-constructive",
  OPENER_GAME_TRY_AFTER_CONSTRUCTIVE: "bergen:opener-game-try-after-constructive",
  OPENER_SIGNOFF_AFTER_CONSTRUCTIVE: "bergen:opener-signoff-after-constructive",
  OPENER_GAME_AFTER_LIMIT: "bergen:opener-game-after-limit",
  OPENER_SIGNOFF_AFTER_LIMIT: "bergen:opener-signoff-after-limit",
  OPENER_GAME_AFTER_PREEMPTIVE: "bergen:opener-game-after-preemptive",
  OPENER_PASS_AFTER_PREEMPTIVE: "bergen:opener-pass-after-preemptive",

  // R3: Responder continuations
  RESPONDER_ACCEPT_GAME: "bergen:responder-accept-game",
  RESPONDER_ACCEPT_SIGNOFF: "bergen:responder-accept-signoff",
  RESPONDER_TRY_ACCEPT: "bergen:responder-try-accept",
  RESPONDER_TRY_REJECT: "bergen:responder-try-reject",

  // R4: Opener final acceptance
  OPENER_ACCEPT_AFTER_TRY: "bergen:opener-accept-after-try",

  // Natural alternative: 1NT response to 1M (system-dependent range)
  NATURAL_1NT_RESPONSE: "bergen:natural-1nt-response",
} as const;
