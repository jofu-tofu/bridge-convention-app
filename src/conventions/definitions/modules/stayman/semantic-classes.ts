// ─── Semantic classes ────────────────────────────────────────

/** Stayman semantic class IDs — module-local, not in the central registry. */
export const STAYMAN_CLASSES = {
  ASK: "stayman:ask-major",
  SHOW_HEARTS: "stayman:show-hearts",
  SHOW_SPADES: "stayman:show-spades",
  DENY_MAJOR: "stayman:deny-major",
} as const;

/** Stayman R3 semantic class IDs — responder continuations after opener's Stayman response. */
export const STAYMAN_R3_CLASSES = {
  RAISE_GAME: "stayman:raise-game",
  RAISE_INVITE: "stayman:raise-invite",
  NT_GAME_NO_FIT: "stayman:nt-game-no-fit",
  NT_INVITE_NO_FIT: "stayman:nt-invite-no-fit",
  NT_GAME_DENIAL: "stayman:nt-game-denial",
  NT_INVITE_DENIAL: "stayman:nt-invite-denial",
} as const;
