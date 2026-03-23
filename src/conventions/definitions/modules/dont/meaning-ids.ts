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

  // Advancer after 2C (clubs + higher)
  ACCEPT_CLUBS_PASS: "dont:accept-clubs-pass",
  RELAY_2D_AFTER_2C: "dont:relay-2d-after-2c",

  // Advancer after 2S (natural spades)
  ACCEPT_SPADES_PASS: "dont:accept-spades-pass",
  ACCEPT_SPADES_FALLBACK: "dont:accept-spades-fallback",

  // Advancer after X (double — single suited)
  FORCED_RELAY_2C: "dont:forced-relay-2c",

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
