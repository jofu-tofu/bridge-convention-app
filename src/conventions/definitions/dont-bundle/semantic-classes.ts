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
  FORCED_RELAY: "dont:forced-relay",          // 2C after double — must relay

  // Overcaller reveal/relay responses
  REVEAL_CLUBS: "dont:reveal-clubs",          // Pass after X-2C — clubs
  REVEAL_DIAMONDS: "dont:reveal-diamonds",    // 2D after X-2C — diamonds
  REVEAL_HEARTS: "dont:reveal-hearts",        // 2H after X-2C — hearts
  SHOW_HIGHER_SUIT: "dont:show-higher",       // Response to relay showing suit
} as const;
