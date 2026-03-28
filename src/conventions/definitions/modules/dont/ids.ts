// ─── Fact IDs ───────────────────────────────────────────────

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

  // Advancer bypass / escape facts (6+ in a suit)
  LONG_DIAMONDS: "module.dont.longDiamonds",
  LONG_HEARTS: "module.dont.longHearts",
  LONG_SPADES: "module.dont.longSpades",
  LONG_CLUBS: "module.dont.longClubs",
} as const;

export type DontFactId = (typeof DONT_FACT_IDS)[keyof typeof DONT_FACT_IDS];

// ─── Meaning IDs ────────────────────────────────────────────

/**
 * Typed ID constants for all DONT module meaning IDs.
 *
 * Centralizes string literals so that meaning-surfaces.ts references
 * compile-checked constants instead of raw strings.
 */

export const DONT_MEANING_IDS = {
  // Stub: Opponent's 1NT opening (phase trigger)
  OPPONENT_1NT: "dont:opponent-1nt",

  // R1: Overcaller initial action
  BOTH_MAJORS_2H: "dont:both-majors-2h",
  DIAMONDS_MAJOR_2D: "dont:diamonds-major-2d",
  CLUBS_HIGHER_2C: "dont:clubs-higher-2c",
  NATURAL_SPADES_2S: "dont:natural-spades-2s",
  SINGLE_SUITED_DOUBLE: "dont:single-suited-double",
  OVERCALLER_PASS: "dont:overcaller-pass",

  // Advancer after 2H (both majors)
  ACCEPT_HEARTS_PASS: "dont:accept-hearts-pass",
  PREFER_SPADES_2S: "dont:prefer-spades-2s",
  ESCAPE_CLUBS_3C: "dont:escape-clubs-3c",
  ESCAPE_DIAMONDS_3D: "dont:escape-diamonds-3d",

  // Advancer after 2D (diamonds + major)
  ACCEPT_DIAMONDS_PASS: "dont:accept-diamonds-pass",
  RELAY_2H_AFTER_2D: "dont:relay-2h-after-2d",
  BYPASS_2S_AFTER_2D: "dont:bypass-2s-after-2d",

  // Advancer after 2C (clubs + higher)
  ACCEPT_CLUBS_PASS: "dont:accept-clubs-pass",
  RELAY_2D_AFTER_2C: "dont:relay-2d-after-2c",
  BYPASS_2H_AFTER_2C: "dont:bypass-2h-after-2c",
  BYPASS_2S_AFTER_2C: "dont:bypass-2s-after-2c",

  // Advancer after 2S (natural spades)
  ACCEPT_SPADES_PASS: "dont:accept-spades-pass",
  ACCEPT_SPADES_FALLBACK: "dont:accept-spades-fallback",
  ESCAPE_3C_AFTER_2S: "dont:escape-3c-after-2s",
  ESCAPE_3D_AFTER_2S: "dont:escape-3d-after-2s",
  ESCAPE_3H_AFTER_2S: "dont:escape-3h-after-2s",

  // Advancer after X (double — single suited)
  FORCED_RELAY_2C: "dont:forced-relay-2c",
  BYPASS_DIAMONDS_2D: "dont:bypass-diamonds-2d",
  BYPASS_HEARTS_2H: "dont:bypass-hearts-2h",
  BYPASS_SPADES_2S: "dont:bypass-spades-2s",

  // Overcaller reveal after X -> 2C
  REVEAL_CLUBS_PASS: "dont:reveal-clubs-pass",
  REVEAL_DIAMONDS_2D: "dont:reveal-diamonds-2d",
  REVEAL_HEARTS_2H: "dont:reveal-hearts-2h",

  // Overcaller reply after 2C -> 2D relay
  CLUBS_HIGHER_DIAMONDS_PASS: "dont:clubs-higher-diamonds-pass",
  CLUBS_HIGHER_HEARTS_2H: "dont:clubs-higher-hearts-2h",
  CLUBS_HIGHER_SPADES_2S: "dont:clubs-higher-spades-2s",

  // Overcaller reply after 2D -> 2H relay
  DIAMONDS_MAJOR_HEARTS_PASS: "dont:diamonds-major-hearts-pass",
  DIAMONDS_MAJOR_SPADES_2S: "dont:diamonds-major-spades-2s",
} as const;

export type DontMeaningId =
  (typeof DONT_MEANING_IDS)[keyof typeof DONT_MEANING_IDS];

// ─── Semantic Classes ───────────────────────────────────────

/** DONT (Disturbing Opponents' Notrump) semantic class IDs -- module-local, not in the central registry. */
export const DONT_CLASSES = {
  // R1: Overcaller initial actions
  BOTH_MAJORS: "dont:both-majors",           // 2H — both majors 5-4+
  DIAMONDS_AND_MAJOR: "dont:diamonds-major",  // 2D — diamonds + a major
  CLUBS_AND_HIGHER: "dont:clubs-higher",      // 2C — clubs + a higher suit
  NATURAL_SPADES: "dont:natural-spades",      // 2S — natural 6+ spades
  SINGLE_SUITED: "dont:single-suited",        // X — one suit 6+, not spades
  OVERCALLER_PASS: "dont:overcaller-pass",    // Pass — no DONT bid applies

  // Advancer responses
  ACCEPT_SUIT: "dont:accept-suit",            // Pass — accept partner's suit
  PREFER_SPADES: "dont:prefer-spades",        // 2S after 2H — prefer spades
  RELAY_ASK: "dont:relay-ask",               // Next step relay
  ESCAPE_MINOR: "dont:escape-minor",          // 3C/3D escape with 6+ minor
  BYPASS_SUIT: "dont:bypass-suit",            // Bypass relay with own long suit
  ESCAPE_SUIT: "dont:escape-suit",            // 3-level escape with own long suit
  FORCED_RELAY: "dont:forced-relay",          // 2C after double — must relay

  // Overcaller reveal/relay responses
  REVEAL_CLUBS: "dont:reveal-clubs",          // Pass after X-2C — clubs
  REVEAL_DIAMONDS: "dont:reveal-diamonds",    // 2D after X-2C — diamonds
  REVEAL_HEARTS: "dont:reveal-hearts",        // 2H after X-2C — hearts
  SHOW_HIGHER_SUIT: "dont:show-higher",       // Response to relay showing suit
} as const;
