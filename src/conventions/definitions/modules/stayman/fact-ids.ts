/**
 * Typed ID constants for all Stayman module fact IDs.
 *
 * Convention-intrinsic facts for the Stayman module. These are registered
 * via FactCatalogExtension in facts.ts, not in the shared vocabulary.
 */

export const STAYMAN_FACT_IDS = {
  ELIGIBLE: "module.stayman.eligible",
  PREFERRED: "module.stayman.preferred",
  NS_HAVE_EIGHT_CARD_FIT_LIKELY: "module.stayman.nsHaveEightCardFitLikely",
  OPENER_STILL_BALANCED_LIKELY: "module.stayman.openerStillBalancedLikely",
  OPENER_HAS_SECOND_MAJOR_LIKELY: "module.stayman.openerHasSecondMajorLikely",
} as const;

export type StaymanFactId =
  (typeof STAYMAN_FACT_IDS)[keyof typeof STAYMAN_FACT_IDS];
