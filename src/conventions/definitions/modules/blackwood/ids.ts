// ─── Fact IDs ───────────────────────────────────────────────

/**
 * Typed ID constants for all Blackwood module fact IDs.
 *
 * Convention-intrinsic facts for the Blackwood module. These are registered
 * via FactCatalogExtension in facts.ts, not in the shared vocabulary.
 */

export const BLACKWOOD_FACT_IDS = {
  SLAM_INTEREST: "module.blackwood.slamInterest",
  ACE_COUNT: "module.blackwood.aceCount",
  KING_COUNT: "module.blackwood.kingCount",
} as const;

export type BlackwoodFactId =
  (typeof BLACKWOOD_FACT_IDS)[keyof typeof BLACKWOOD_FACT_IDS];

// ─── Meaning IDs ────────────────────────────────────────────

/**
 * Typed ID constants for all Blackwood module meaning IDs.
 *
 * Every meaningId used in createSurface() calls in meaning-surfaces.ts
 * is defined here as a typed constant.
 */

export const BLACKWOOD_MEANING_IDS = {
  // R1: Asker bids 4NT
  ASK_ACES: "blackwood:ask-aces",

  // R2: Responder shows ace count (step responses to 4NT)
  RESPONSE_0_ACES: "blackwood:response-0-aces",
  RESPONSE_1_ACE: "blackwood:response-1-ace",
  RESPONSE_2_ACES: "blackwood:response-2-aces",
  RESPONSE_3_ACES: "blackwood:response-3-aces",

  // R3: Asker follow-up after ace response
  ASK_KINGS: "blackwood:ask-kings",
  SIGNOFF_SMALL_SLAM: "blackwood:signoff-small-slam",
  SIGNOFF_GRAND_SLAM: "blackwood:signoff-grand-slam",
  SIGNOFF_5_LEVEL: "blackwood:signoff-5-level",

  // R4: Responder shows king count (step responses to 5NT)
  KING_RESPONSE_0: "blackwood:king-response-0",
  KING_RESPONSE_1: "blackwood:king-response-1",
  KING_RESPONSE_2: "blackwood:king-response-2",
  KING_RESPONSE_3: "blackwood:king-response-3",
} as const;

export type BlackwoodMeaningId =
  (typeof BLACKWOOD_MEANING_IDS)[keyof typeof BLACKWOOD_MEANING_IDS];

// ─── Semantic Classes ───────────────────────────────────────

/** Blackwood semantic class IDs — module-local, not in the central registry. */
export const BLACKWOOD_CLASSES = {
  ASK_ACES: "blackwood:ask-aces",
  ACE_RESPONSE: "blackwood:ace-response",
  ASK_KINGS: "blackwood:ask-kings",
  KING_RESPONSE: "blackwood:king-response",
  SIGNOFF: "blackwood:signoff",
} as const;
