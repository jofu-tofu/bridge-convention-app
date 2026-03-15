/** Weak Two Bids semantic class IDs -- module-local, not in the central registry. */
export const WEAK_TWO_CLASSES = {
  // R1: Opener initial bids
  OPEN_2D: "weak-two:open-2d",
  OPEN_2H: "weak-two:open-2h",
  OPEN_2S: "weak-two:open-2s",

  // R2: Responder actions
  GAME_RAISE: "weak-two:game-raise",
  OGUST_ASK: "weak-two:ogust-ask",
  INVITE_RAISE: "weak-two:invite-raise",
  WEAK_PASS: "weak-two:weak-pass",

  // R3: Ogust rebid responses
  OGUST_SOLID: "weak-two:ogust-solid",
  OGUST_MIN_BAD: "weak-two:ogust-min-bad",
  OGUST_MIN_GOOD: "weak-two:ogust-min-good",
  OGUST_MAX_BAD: "weak-two:ogust-max-bad",
  OGUST_MAX_GOOD: "weak-two:ogust-max-good",
} as const;
