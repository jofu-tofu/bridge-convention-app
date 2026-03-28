/**
 * Shared fact vocabulary — typed constants for all shared fact IDs.
 *
 * These fact IDs represent bridge-universal hand properties used across
 * convention modules. Primitive facts describe raw hand attributes;
 * bridge-derived facts are computed from primitives; posterior-derived
 * facts compute probabilities over partner's hand samples.
 *
 * Convention-intrinsic facts (e.g. "module.stayman.eligible") are NOT
 * part of this vocabulary — they belong in FactCatalogExtensions.
 *
 * Naming convention: `hand.<property>` (primitive), `bridge.<concept>` (derived)
 */

// ─── Primitive fact IDs ─────────────────────────────────────

export const HAND_HCP = "hand.hcp" as const;
export const HAND_SUIT_LENGTH_SPADES = "hand.suitLength.spades" as const;
export const HAND_SUIT_LENGTH_HEARTS = "hand.suitLength.hearts" as const;
export const HAND_SUIT_LENGTH_DIAMONDS = "hand.suitLength.diamonds" as const;
export const HAND_SUIT_LENGTH_CLUBS = "hand.suitLength.clubs" as const;
export const HAND_IS_BALANCED = "hand.isBalanced" as const;

export const PRIMITIVE_FACT_IDS = {
  HAND_HCP,
  HAND_SUIT_LENGTH_SPADES,
  HAND_SUIT_LENGTH_HEARTS,
  HAND_SUIT_LENGTH_DIAMONDS,
  HAND_SUIT_LENGTH_CLUBS,
  HAND_IS_BALANCED,
} as const;

// ─── Bridge-derived fact IDs ────────────────────────────────

export const BRIDGE_IS_VULNERABLE = "bridge.isVulnerable" as const;
export const BRIDGE_HAS_FOUR_CARD_MAJOR = "bridge.hasFourCardMajor" as const;
export const BRIDGE_HAS_FIVE_CARD_MAJOR = "bridge.hasFiveCardMajor" as const;
export const BRIDGE_MAJOR_PATTERN = "bridge.majorPattern" as const;
export const BRIDGE_SUPPORT_FOR_BOUND_SUIT = "bridge.supportForBoundSuit" as const;
export const BRIDGE_FIT_WITH_BOUND_SUIT = "bridge.fitWithBoundSuit" as const;
export const BRIDGE_HAS_SHORTAGE = "bridge.hasShortage" as const;
export const BRIDGE_SHORTAGE_IN_SUIT = "bridge.shortageInSuit" as const;
export const BRIDGE_TOTAL_POINTS_FOR_RAISE = "bridge.totalPointsForRaise" as const;

export const BRIDGE_DERIVED_FACT_IDS = {
  BRIDGE_IS_VULNERABLE,
  BRIDGE_HAS_FOUR_CARD_MAJOR,
  BRIDGE_HAS_FIVE_CARD_MAJOR,
  BRIDGE_MAJOR_PATTERN,
  BRIDGE_SUPPORT_FOR_BOUND_SUIT,
  BRIDGE_FIT_WITH_BOUND_SUIT,
  BRIDGE_HAS_SHORTAGE,
  BRIDGE_SHORTAGE_IN_SUIT,
  BRIDGE_TOTAL_POINTS_FOR_RAISE,
} as const;

// ─── Posterior-derived fact IDs ─────────────────────────────

export const BRIDGE_PARTNER_HAS_4_HEARTS_LIKELY = "bridge.partnerHas4HeartsLikely" as const;
export const BRIDGE_PARTNER_HAS_4_SPADES_LIKELY = "bridge.partnerHas4SpadesLikely" as const;
export const BRIDGE_PARTNER_HAS_4_DIAMONDS_LIKELY = "bridge.partnerHas4DiamondsLikely" as const;
export const BRIDGE_PARTNER_HAS_4_CLUBS_LIKELY = "bridge.partnerHas4ClubsLikely" as const;
export const BRIDGE_COMBINED_HCP_IN_RANGE_LIKELY = "bridge.combinedHcpInRangeLikely" as const;

export const POSTERIOR_FACT_IDS = {
  BRIDGE_PARTNER_HAS_4_HEARTS_LIKELY,
  BRIDGE_PARTNER_HAS_4_SPADES_LIKELY,
  BRIDGE_PARTNER_HAS_4_DIAMONDS_LIKELY,
  BRIDGE_PARTNER_HAS_4_CLUBS_LIKELY,
  BRIDGE_COMBINED_HCP_IN_RANGE_LIKELY,
} as const;

// ─── Collected vocabulary ───────────────────────────────────

/** Union type of all primitive fact IDs. */
export type PrimitiveFactId = (typeof PRIMITIVE_FACT_IDS)[keyof typeof PRIMITIVE_FACT_IDS];

/** Union type of all bridge-derived fact IDs. */
export type BridgeDerivedFactId = (typeof BRIDGE_DERIVED_FACT_IDS)[keyof typeof BRIDGE_DERIVED_FACT_IDS];

/** Union type of all posterior-derived fact IDs. */
export type PosteriorFactId = (typeof POSTERIOR_FACT_IDS)[keyof typeof POSTERIOR_FACT_IDS];

/** Union type of all shared fact IDs. */
export type SharedFactId = PrimitiveFactId | BridgeDerivedFactId | PosteriorFactId;
