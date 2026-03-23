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
