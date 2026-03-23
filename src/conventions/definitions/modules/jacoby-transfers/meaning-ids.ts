/**
 * Typed constants for Jacoby Transfers meaning IDs.
 *
 * Every meaningId used in createSurface() calls in meaning-surfaces.ts
 * is defined here as a typed constant.
 */

export const TRANSFER_MEANING_IDS = {
  // R1 — responder transfer bids
  TO_HEARTS: "transfer:to-hearts",
  TO_SPADES: "transfer:to-spades",

  // R2 — opener accepts transfer
  ACCEPT: "transfer:accept",
  ACCEPT_SPADES: "transfer:accept-spades",

  // R3 — responder rebids after hearts transfer accepted
  SIGNOFF_HEARTS: "transfer:signoff-hearts",
  GAME_HEARTS: "transfer:game-hearts",
  NT_GAME_HEARTS: "transfer:nt-game-hearts",
  INVITE_RAISE_HEARTS: "transfer:invite-raise-hearts",
  INVITE_HEARTS: "transfer:invite-hearts",

  // R3 — responder rebids after spades transfer accepted
  SIGNOFF_SPADES: "transfer:signoff-spades",
  GAME_SPADES: "transfer:game-spades",
  NT_GAME_SPADES: "transfer:nt-game-spades",
  INVITE_RAISE_SPADES: "transfer:invite-raise-spades",
  INVITE_SPADES: "transfer:invite-spades",

  // R4 — opener placement after responder's 3NT choice
  CORRECT_TO_4H: "transfer:correct-to-4h",
  PASS_3NT_HEARTS: "transfer:pass-3nt-hearts",
  CORRECT_TO_4S: "transfer:correct-to-4s",
  PASS_3NT_SPADES: "transfer:pass-3nt-spades",

  // R4 — opener invite acceptance after responder's 2NT invite
  ACCEPT_INVITE_HEARTS: "transfer:accept-invite-hearts",
  DECLINE_INVITE_HEARTS: "transfer:decline-invite-hearts",
  ACCEPT_INVITE_SPADES: "transfer:accept-invite-spades",
  DECLINE_INVITE_SPADES: "transfer:decline-invite-spades",

  // R4 — opener invite-raise acceptance after responder's 3M invite raise
  ACCEPT_INVITE_RAISE_HEARTS: "transfer:accept-invite-raise-hearts",
  DECLINE_INVITE_RAISE_HEARTS: "transfer:decline-invite-raise-hearts",
  ACCEPT_INVITE_RAISE_SPADES: "transfer:accept-invite-raise-spades",
  DECLINE_INVITE_RAISE_SPADES: "transfer:decline-invite-raise-spades",
} as const;

/** Union type of all Jacoby Transfers meaning IDs. */
export type TransferMeaningId = (typeof TRANSFER_MEANING_IDS)[keyof typeof TRANSFER_MEANING_IDS];
