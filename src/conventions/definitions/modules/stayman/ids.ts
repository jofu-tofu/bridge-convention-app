// ─── Fact IDs ───────────────────────────────────────────────

/**
 * Typed ID constants for all Stayman module fact IDs.
 *
 * Convention-intrinsic facts for the Stayman module. These are registered
 * via FactCatalogExtension in facts.ts, not in the shared vocabulary.
 */

export const STAYMAN_FACT_IDS = {
  ELIGIBLE: "module.stayman.eligible",
  PREFERRED: "module.stayman.preferred",
  NS_HAVE_EIGHT_CARD_FIT_LIKELY: "module.stayman.nsHaveEightCardFitLikely",
  OPENER_STILL_BALANCED_LIKELY: "module.stayman.openerStillBalancedLikely",
  OPENER_HAS_SECOND_MAJOR_LIKELY: "module.stayman.openerHasSecondMajorLikely",
} as const;

export type StaymanFactId =
  (typeof STAYMAN_FACT_IDS)[keyof typeof STAYMAN_FACT_IDS];

// ─── Meaning IDs ────────────────────────────────────────────

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

  // R3 after 2D denial: Show 5-card major (5-4 in majors, invitational)
  SHOW_FIVE_HEARTS_AFTER_DENIAL: "stayman:show-five-hearts-after-denial",
  SHOW_FIVE_SPADES_AFTER_DENIAL: "stayman:show-five-spades-after-denial",

  // R3 after 2H: Additional continuations
  CROSS_MAJOR_INVITE_2S_AFTER_2H: "stayman:cross-major-invite-2s-after-2h",
  MINOR_GF_3C_AFTER_2H: "stayman:minor-gf-3c-after-2h",
  MINOR_GF_3D_AFTER_2H: "stayman:minor-gf-3d-after-2h",
  CROSS_MAJOR_GF_3S_AFTER_2H: "stayman:cross-major-gf-3s-after-2h",
  QUANTITATIVE_4NT_AFTER_2H: "stayman:quantitative-4nt-after-2h",

  // R3 after 2S: Additional continuations
  MINOR_GF_3C_AFTER_2S: "stayman:minor-gf-3c-after-2s",
  MINOR_GF_3D_AFTER_2S: "stayman:minor-gf-3d-after-2s",
  CROSS_MAJOR_GF_3H_AFTER_2S: "stayman:cross-major-gf-3h-after-2s",
  QUANTITATIVE_4NT_AFTER_2S: "stayman:quantitative-4nt-after-2s",

  // R3 after 2D denial: Additional continuations
  MINOR_GF_3C_AFTER_2D: "stayman:minor-gf-3c-after-2d",
  MINOR_GF_3D_AFTER_2D: "stayman:minor-gf-3d-after-2d",
  MAJOR_SIGNOFF_4H_AFTER_2D: "stayman:major-signoff-4h-after-2d",
  MAJOR_SIGNOFF_4S_AFTER_2D: "stayman:major-signoff-4s-after-2d",
  QUANTITATIVE_4NT_AFTER_2D: "stayman:quantitative-4nt-after-2d",
} as const;

export type StaymanMeaningId =
  (typeof STAYMAN_MEANING_IDS)[keyof typeof STAYMAN_MEANING_IDS];

// ─── Semantic Classes ───────────────────────────────────────

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
  SHOW_FIVE_CARD_MAJOR: "stayman:show-five-card-major",
  MINOR_GF: "stayman:minor-gf",
  CROSS_MAJOR_INVITE: "stayman:cross-major-invite",
  CROSS_MAJOR_GF: "stayman:cross-major-gf",
  MAJOR_SIGNOFF_64: "stayman:major-signoff-64",
  QUANTITATIVE_4NT: "stayman:quantitative-4nt",
} as const;
