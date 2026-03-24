// ─── Fact IDs ───────────────────────────────────────────────

/**
 * Typed ID constants for all Smolen module-derived fact IDs.
 *
 * Follows the pattern established by shared-fact-vocabulary.ts.
 * These are module-scoped facts — not part of the shared vocabulary.
 */

export const SMOLEN_FACT_IDS = {
  HAS_FIVE_HEARTS: "module.smolen.hasFiveHearts",
  HAS_FIVE_SPADES: "module.smolen.hasFiveSpades",
  HAS_FOUR_HEARTS: "module.smolen.hasFourHearts",
  HAS_FOUR_SPADES: "module.smolen.hasFourSpades",
  OPENER_HAS_HEART_FIT: "module.smolen.openerHasHeartFit",
  OPENER_HAS_SPADES_FIT: "module.smolen.openerHasSpadesFit",
} as const;

export type SmolenFactId = (typeof SMOLEN_FACT_IDS)[keyof typeof SMOLEN_FACT_IDS];

// ─── Meaning IDs ────────────────────────────────────────────

/**
 * Typed ID constants for all Smolen meaning IDs.
 *
 * Each constant corresponds to a meaningId used in Smolen meaning surfaces.
 */

export const SMOLEN_MEANING_IDS = {
  BID_SHORT_HEARTS: "smolen:bid-short-hearts",
  BID_SHORT_SPADES: "smolen:bid-short-spades",
  PLACE_FOUR_HEARTS: "smolen:place-four-hearts",
  PLACE_FOUR_SPADES: "smolen:place-four-spades",
  PLACE_THREE_NT_NO_HEART_FIT: "smolen:place-three-nt-no-heart-fit",
  PLACE_THREE_NT_NO_SPADE_FIT: "smolen:place-three-nt-no-spade-fit",
  STAYMAN_ENTRY_5H4S: "smolen:stayman-entry-5h4s",
  STAYMAN_ENTRY_5S4H: "smolen:stayman-entry-5s4h",
} as const;

export type SmolenMeaningId = (typeof SMOLEN_MEANING_IDS)[keyof typeof SMOLEN_MEANING_IDS];

// ─── Semantic Classes ───────────────────────────────────────

/** Smolen semantic class IDs — Stayman R3 continuation for 5-4 major hands. */
export const SMOLEN_CLASSES = {
  BID_SHORT_HEARTS: "smolen:bid-short-hearts",
  BID_SHORT_SPADES: "smolen:bid-short-spades",
  PLACE_FOUR_HEARTS: "smolen:place-four-hearts",
  PLACE_FOUR_SPADES: "smolen:place-four-spades",
  PLACE_THREE_NT: "smolen:place-three-nt",
} as const;
