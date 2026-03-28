// ─── Fact IDs ───────────────────────────────────────────────

/**
 * Typed ID constants for all Weak Two module fact IDs.
 *
 * Every concrete fact ID used in facts.ts and meaning-surfaces.ts
 * is enumerated here. Per-suit facts are expanded for all three
 * weak-two suits (hearts, spades, diamonds).
 */

export const WEAK_TWO_FACT_IDS = {
  // ── Vulnerability-aware HCP range facts ─────────────────────
  IN_OPENING_HCP_RANGE: "module.weakTwo.inOpeningHcpRange",
  IS_MAXIMUM: "module.weakTwo.isMaximum",
  IS_MINIMUM: "module.weakTwo.isMinimum",

  // ── New suit forcing facts ─────────────────────────────────
  HAS_NEW_SUIT_HEARTS: "module.weakTwo.hasNewSuit.hearts",
  HAS_NEW_SUIT_SPADES: "module.weakTwo.hasNewSuit.spades",
  HAS_NEW_SUIT_DIAMONDS: "module.weakTwo.hasNewSuit.diamonds",
  HAS_NSF_SUPPORT_HEARTS: "module.weakTwo.hasNsfSupport.hearts",
  HAS_NSF_SUPPORT_SPADES: "module.weakTwo.hasNsfSupport.spades",
  HAS_NSF_SUPPORT_DIAMONDS: "module.weakTwo.hasNsfSupport.diamonds",

  // ── Per-suit solid (AKQ) facts ──────────────────────────────
  IS_SOLID_HEARTS: "module.weakTwo.isSolid.hearts",
  IS_SOLID_SPADES: "module.weakTwo.isSolid.spades",
  IS_SOLID_DIAMONDS: "module.weakTwo.isSolid.diamonds",

  // ── Per-suit top honor count facts ──────────────────────────
  TOP_HONOR_COUNT_HEARTS: "module.weakTwo.topHonorCount.hearts",
  TOP_HONOR_COUNT_SPADES: "module.weakTwo.topHonorCount.spades",
  TOP_HONOR_COUNT_DIAMONDS: "module.weakTwo.topHonorCount.diamonds",
} as const;

export type WeakTwoFactId =
  (typeof WEAK_TWO_FACT_IDS)[keyof typeof WEAK_TWO_FACT_IDS];

/**
 * Lookup from suit name to the corresponding isSolid fact ID.
 * Used by factory-generated surfaces with $suit bindings.
 */
export const WEAK_TWO_IS_SOLID_BY_SUIT = {
  hearts: WEAK_TWO_FACT_IDS.IS_SOLID_HEARTS,
  spades: WEAK_TWO_FACT_IDS.IS_SOLID_SPADES,
  diamonds: WEAK_TWO_FACT_IDS.IS_SOLID_DIAMONDS,
} as const;

/**
 * Lookup from suit name to the corresponding topHonorCount fact ID.
 * Used by factory-generated surfaces with $suit bindings.
 */
export const WEAK_TWO_TOP_HONOR_COUNT_BY_SUIT = {
  hearts: WEAK_TWO_FACT_IDS.TOP_HONOR_COUNT_HEARTS,
  spades: WEAK_TWO_FACT_IDS.TOP_HONOR_COUNT_SPADES,
  diamonds: WEAK_TWO_FACT_IDS.TOP_HONOR_COUNT_DIAMONDS,
} as const;

// ─── Meaning IDs ────────────────────────────────────────────

/**
 * Typed ID constants for all Weak Two module meaning IDs.
 *
 * Every concrete meaning ID used in meaning-surfaces.ts is enumerated
 * here. Per-suit meanings are expanded for all three weak-two suits
 * (hearts, spades, diamonds).
 */

export const WEAK_TWO_MEANING_IDS = {
  // ── R1: Opener weak two bid ─────────────────────────────────
  OPEN_2H: "weak-two:open-2h",
  OPEN_2S: "weak-two:open-2s",
  OPEN_2D: "weak-two:open-2d",

  // ── R2: Responder actions (hearts) ──────────────────────────
  GAME_RAISE_HEARTS: "weak-two:game-raise-hearts",
  OGUST_ASK_HEARTS: "weak-two:ogust-ask-hearts",
  INVITE_RAISE_HEARTS: "weak-two:invite-raise-hearts",
  PREEMPTIVE_RAISE_HEARTS: "weak-two:preemptive-raise-hearts",
  NEW_SUIT_FORCING_HEARTS: "weak-two:new-suit-forcing-hearts",
  WEAK_PASS_HEARTS: "weak-two:weak-pass-hearts",

  // ── R2: Responder actions (spades) ──────────────────────────
  GAME_RAISE_SPADES: "weak-two:game-raise-spades",
  OGUST_ASK_SPADES: "weak-two:ogust-ask-spades",
  INVITE_RAISE_SPADES: "weak-two:invite-raise-spades",
  PREEMPTIVE_RAISE_SPADES: "weak-two:preemptive-raise-spades",
  NEW_SUIT_FORCING_SPADES: "weak-two:new-suit-forcing-spades",
  WEAK_PASS_SPADES: "weak-two:weak-pass-spades",

  // ── R2: Responder actions (diamonds) ────────────────────────
  GAME_RAISE_DIAMONDS: "weak-two:game-raise-diamonds",
  OGUST_ASK_DIAMONDS: "weak-two:ogust-ask-diamonds",
  INVITE_RAISE_DIAMONDS: "weak-two:invite-raise-diamonds",
  PREEMPTIVE_RAISE_DIAMONDS: "weak-two:preemptive-raise-diamonds",
  NEW_SUIT_FORCING_DIAMONDS: "weak-two:new-suit-forcing-diamonds",
  WEAK_PASS_DIAMONDS: "weak-two:weak-pass-diamonds",

  // ── R3: Ogust rebid — opener describes hand (hearts) ───────
  OGUST_SOLID_HEARTS: "weak-two:ogust-solid-hearts",
  OGUST_MIN_BAD_HEARTS: "weak-two:ogust-min-bad-hearts",
  OGUST_MIN_GOOD_HEARTS: "weak-two:ogust-min-good-hearts",
  OGUST_MAX_BAD_HEARTS: "weak-two:ogust-max-bad-hearts",
  OGUST_MAX_GOOD_HEARTS: "weak-two:ogust-max-good-hearts",

  // ── R3: Ogust rebid — opener describes hand (spades) ───────
  OGUST_SOLID_SPADES: "weak-two:ogust-solid-spades",
  OGUST_MIN_BAD_SPADES: "weak-two:ogust-min-bad-spades",
  OGUST_MIN_GOOD_SPADES: "weak-two:ogust-min-good-spades",
  OGUST_MAX_BAD_SPADES: "weak-two:ogust-max-bad-spades",
  OGUST_MAX_GOOD_SPADES: "weak-two:ogust-max-good-spades",

  // ── R3: Ogust rebid — opener describes hand (diamonds) ─────
  OGUST_SOLID_DIAMONDS: "weak-two:ogust-solid-diamonds",
  OGUST_MIN_BAD_DIAMONDS: "weak-two:ogust-min-bad-diamonds",
  OGUST_MIN_GOOD_DIAMONDS: "weak-two:ogust-min-good-diamonds",
  OGUST_MAX_BAD_DIAMONDS: "weak-two:ogust-max-bad-diamonds",
  OGUST_MAX_GOOD_DIAMONDS: "weak-two:ogust-max-good-diamonds",

  // ── R3: Opener rebid after new suit forcing (hearts) ───────
  NSF_SUPPORT_HEARTS: "weak-two:nsf-support-hearts",
  NSF_REBID_HEARTS: "weak-two:nsf-rebid-hearts",

  // ── R3: Opener rebid after new suit forcing (spades) ──────
  NSF_SUPPORT_SPADES: "weak-two:nsf-support-spades",
  NSF_REBID_SPADES: "weak-two:nsf-rebid-spades",

  // ── R3: Opener rebid after new suit forcing (diamonds) ────
  NSF_SUPPORT_DIAMONDS: "weak-two:nsf-support-diamonds",
  NSF_REBID_DIAMONDS: "weak-two:nsf-rebid-diamonds",

  // ── R4: Post-Ogust responder rebid (hearts) ────────────────
  POST_OGUST_GAME_HEARTS: "weak-two:post-ogust-game-hearts",
  POST_OGUST_SIGNOFF_HEARTS: "weak-two:post-ogust-signoff-hearts",
  POST_OGUST_PASS_HEARTS: "weak-two:post-ogust-pass-hearts",

  // ── R4: Post-Ogust responder rebid (spades) ────────────────
  POST_OGUST_GAME_SPADES: "weak-two:post-ogust-game-spades",
  POST_OGUST_SIGNOFF_SPADES: "weak-two:post-ogust-signoff-spades",
  POST_OGUST_PASS_SPADES: "weak-two:post-ogust-pass-spades",

  // ── R4: Post-Ogust responder rebid (diamonds) ──────────────
  POST_OGUST_GAME_DIAMONDS: "weak-two:post-ogust-game-diamonds",
  POST_OGUST_3NT_DIAMONDS: "weak-two:post-ogust-3nt-diamonds",
  POST_OGUST_SIGNOFF_DIAMONDS: "weak-two:post-ogust-signoff-diamonds",
  POST_OGUST_PASS_DIAMONDS: "weak-two:post-ogust-pass-diamonds",
} as const;

export type WeakTwoMeaningId =
  (typeof WEAK_TWO_MEANING_IDS)[keyof typeof WEAK_TWO_MEANING_IDS];

// ─── Semantic Classes ───────────────────────────────────────

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
  PREEMPTIVE_RAISE: "weak-two:preemptive-raise",
  NEW_SUIT_FORCING: "weak-two:new-suit-forcing",
  WEAK_PASS: "weak-two:weak-pass",

  // R3: Opener rebid after new suit forcing
  NSF_SUPPORT: "weak-two:nsf-support",
  NSF_REBID: "weak-two:nsf-rebid",

  // R3: Ogust rebid responses
  OGUST_SOLID: "weak-two:ogust-solid",
  OGUST_MIN_BAD: "weak-two:ogust-min-bad",
  OGUST_MIN_GOOD: "weak-two:ogust-min-good",
  OGUST_MAX_BAD: "weak-two:ogust-max-bad",
  OGUST_MAX_GOOD: "weak-two:ogust-max-good",

  // R4: Responder rebid after Ogust
  POST_OGUST_GAME: "weak-two:post-ogust-game",
  POST_OGUST_3NT: "weak-two:post-ogust-3nt",
  POST_OGUST_SIGNOFF: "weak-two:post-ogust-signoff",
  POST_OGUST_PASS: "weak-two:post-ogust-pass",
} as const;
