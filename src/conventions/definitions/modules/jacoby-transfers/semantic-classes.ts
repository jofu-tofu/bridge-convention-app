// ─── Semantic classes ────────────────────────────────────────

/** Jacoby Transfer semantic class IDs — module-local, not in the central registry. */
export const TRANSFER_CLASSES = {
  TO_HEARTS: "transfer:to-hearts",
  TO_SPADES: "transfer:to-spades",
  ACCEPT: "transfer:accept",
  ACCEPT_SPADES: "transfer:accept-spades",
} as const;

/** Transfer R3 semantic class IDs — responder continuations after opener accepts transfer. */
export const TRANSFER_R3_CLASSES = {
  SIGNOFF: "transfer:signoff",
  INVITE: "transfer:invite",
  INVITE_RAISE: "transfer:invite-raise",
  GAME_IN_MAJOR: "transfer:game-in-major",
  NT_GAME: "transfer:nt-game",
} as const;

/** Opener placement semantic class IDs — opener's decision after responder's 3NT or 2NT. */
export const OPENER_PLACE_CLASSES = {
  CORRECT_TO_MAJOR: "transfer:correct-to-major",
  PASS_3NT: "transfer:pass-3nt",
  ACCEPT_INVITE: "transfer:accept-invite",
  DECLINE_INVITE: "transfer:decline-invite",
} as const;
