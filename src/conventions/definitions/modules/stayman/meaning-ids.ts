/**
 * Typed ID constants for all Stayman module meaning IDs.
 *
 * Every meaningId used in createSurface() calls in meaning-surfaces.ts
 * is defined here as a typed constant.
 */

export const STAYMAN_MEANING_IDS = {
  // R1: Responder asks for 4-card major
  ASK_MAJOR: "stayman:ask-major",

  // R2: Opener responses
  SHOW_HEARTS: "stayman:show-hearts",
  SHOW_SPADES: "stayman:show-spades",
  DENY_MAJOR: "stayman:deny-major",

  // R3 after 2H: Responder continuation
  RAISE_GAME_HEARTS: "stayman:raise-game-hearts",
  RAISE_INVITE_HEARTS: "stayman:raise-invite-hearts",
  NT_GAME_NO_FIT: "stayman:nt-game-no-fit",
  NT_INVITE_NO_FIT: "stayman:nt-invite-no-fit",

  // R3 after 2S: Responder continuation
  RAISE_GAME_SPADES: "stayman:raise-game-spades",
  RAISE_INVITE_SPADES: "stayman:raise-invite-spades",
  NT_GAME_NO_FIT_2S: "stayman:nt-game-no-fit-2s",
  NT_INVITE_NO_FIT_2S: "stayman:nt-invite-no-fit-2s",

  // R3 after 2D denial: Responder continuation
  NT_GAME_AFTER_DENIAL: "stayman:nt-game-after-denial",
  NT_INVITE_AFTER_DENIAL: "stayman:nt-invite-after-denial",
} as const;

export type StaymanMeaningId =
  (typeof STAYMAN_MEANING_IDS)[keyof typeof STAYMAN_MEANING_IDS];
