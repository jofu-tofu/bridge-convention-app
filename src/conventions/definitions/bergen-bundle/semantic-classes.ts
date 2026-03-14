/** Bergen Raises semantic class IDs -- module-local, not in the central registry. */
export const BERGEN_CLASSES = {
  // R1: Responder initial bids
  SPLINTER: "bergen:splinter",
  GAME_RAISE: "bergen:game-raise",
  LIMIT_RAISE: "bergen:limit-raise",
  CONSTRUCTIVE_RAISE: "bergen:constructive-raise",
  PREEMPTIVE_RAISE: "bergen:preemptive-raise",

  // R2: Opener rebids
  OPENER_GAME_AFTER_CONSTRUCTIVE: "bergen:opener-game-after-constructive",
  OPENER_SIGNOFF_AFTER_CONSTRUCTIVE: "bergen:opener-signoff-after-constructive",
  OPENER_GAME_AFTER_LIMIT: "bergen:opener-game-after-limit",
  OPENER_SIGNOFF_AFTER_LIMIT: "bergen:opener-signoff-after-limit",
  OPENER_GAME_AFTER_PREEMPTIVE: "bergen:opener-game-after-preemptive",
  OPENER_PASS_AFTER_PREEMPTIVE: "bergen:opener-pass-after-preemptive",

  // R3: Responder continuations
  RESPONDER_ACCEPT_GAME: "bergen:responder-accept-game",
  RESPONDER_ACCEPT_SIGNOFF: "bergen:responder-accept-signoff",
  RESPONDER_TRY_ACCEPT: "bergen:responder-try-accept",
  RESPONDER_TRY_REJECT: "bergen:responder-try-reject",

  // R4: Opener final acceptance
  OPENER_ACCEPT_AFTER_TRY: "bergen:opener-accept-after-try",
} as const;
