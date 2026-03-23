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
