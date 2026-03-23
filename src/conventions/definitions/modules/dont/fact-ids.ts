/**
 * Typed ID constants for all DONT module fact IDs.
 *
 * Centralizes string literals so that facts.ts and meaning-surfaces.ts
 * reference compile-checked constants instead of raw strings.
 */

// ─── Overcaller R1 facts ─────────────────────────────────────

export const DONT_FACT_IDS = {
  BOTH_MAJORS: "module.dont.bothMajors",
  DIAMONDS_AND_MAJOR: "module.dont.diamondsAndMajor",
  CLUBS_AND_HIGHER: "module.dont.clubsAndHigher",
  NATURAL_SPADES: "module.dont.naturalSpades",
  SINGLE_SUITED: "module.dont.singleSuited",

  // Overcaller reveal facts (after X -> 2C)
  SINGLE_SUIT_CLUBS: "module.dont.singleSuitClubs",
  SINGLE_SUIT_DIAMONDS: "module.dont.singleSuitDiamonds",
  SINGLE_SUIT_HEARTS: "module.dont.singleSuitHearts",

  // 2C relay response facts
  CLUBS_HIGHER_DIAMONDS: "module.dont.clubsHigherDiamonds",
  CLUBS_HIGHER_HEARTS: "module.dont.clubsHigherHearts",
  CLUBS_HIGHER_SPADES: "module.dont.clubsHigherSpades",

  // 2D relay response facts
  DIAMONDS_MAJOR_HEARTS: "module.dont.diamondsMajorHearts",
  DIAMONDS_MAJOR_SPADES: "module.dont.diamondsMajorSpades",

  // Advancer support facts
  HAS_HEART_SUPPORT: "module.dont.hasHeartSupport",
  HAS_SPADE_SUPPORT: "module.dont.hasSpadeSupport",
  HAS_DIAMOND_SUPPORT: "module.dont.hasDiamondSupport",
  HAS_CLUB_SUPPORT: "module.dont.hasClubSupport",
  HAS_LONG_MINOR: "module.dont.hasLongMinor",
  LONG_MINOR_IS_CLUBS: "module.dont.longMinorIsClubs",
  LONG_MINOR_IS_DIAMONDS: "module.dont.longMinorIsDiamonds",
} as const;

export type DontFactId = (typeof DONT_FACT_IDS)[keyof typeof DONT_FACT_IDS];
