/**
 * Typed ID constants for all Weak Two module fact IDs.
 *
 * Every concrete fact ID used in facts.ts and meaning-surfaces.ts
 * is enumerated here. Per-suit facts are expanded for all three
 * weak-two suits (hearts, spades, diamonds).
 */

export const WEAK_TWO_FACT_IDS = {
  // ── Vulnerability-aware HCP range facts ─────────────────────
  IN_OPENING_HCP_RANGE: "module.weakTwo.inOpeningHcpRange",
  IS_MAXIMUM: "module.weakTwo.isMaximum",
  IS_MINIMUM: "module.weakTwo.isMinimum",

  // ── Per-suit solid (AKQ) facts ──────────────────────────────
  IS_SOLID_HEARTS: "module.weakTwo.isSolid.hearts",
  IS_SOLID_SPADES: "module.weakTwo.isSolid.spades",
  IS_SOLID_DIAMONDS: "module.weakTwo.isSolid.diamonds",

  // ── Per-suit top honor count facts ──────────────────────────
  TOP_HONOR_COUNT_HEARTS: "module.weakTwo.topHonorCount.hearts",
  TOP_HONOR_COUNT_SPADES: "module.weakTwo.topHonorCount.spades",
  TOP_HONOR_COUNT_DIAMONDS: "module.weakTwo.topHonorCount.diamonds",
} as const;

export type WeakTwoFactId =
  (typeof WEAK_TWO_FACT_IDS)[keyof typeof WEAK_TWO_FACT_IDS];

/**
 * Lookup from suit name to the corresponding isSolid fact ID.
 * Used by factory-generated surfaces with $suit bindings.
 */
export const WEAK_TWO_IS_SOLID_BY_SUIT = {
  hearts: WEAK_TWO_FACT_IDS.IS_SOLID_HEARTS,
  spades: WEAK_TWO_FACT_IDS.IS_SOLID_SPADES,
  diamonds: WEAK_TWO_FACT_IDS.IS_SOLID_DIAMONDS,
} as const;

/**
 * Lookup from suit name to the corresponding topHonorCount fact ID.
 * Used by factory-generated surfaces with $suit bindings.
 */
export const WEAK_TWO_TOP_HONOR_COUNT_BY_SUIT = {
  hearts: WEAK_TWO_FACT_IDS.TOP_HONOR_COUNT_HEARTS,
  spades: WEAK_TWO_FACT_IDS.TOP_HONOR_COUNT_SPADES,
  diamonds: WEAK_TWO_FACT_IDS.TOP_HONOR_COUNT_DIAMONDS,
} as const;
