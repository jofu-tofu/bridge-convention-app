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
  WEAK_PASS_HEARTS: "weak-two:weak-pass-hearts",

  // ── R2: Responder actions (spades) ──────────────────────────
  GAME_RAISE_SPADES: "weak-two:game-raise-spades",
  OGUST_ASK_SPADES: "weak-two:ogust-ask-spades",
  INVITE_RAISE_SPADES: "weak-two:invite-raise-spades",
  WEAK_PASS_SPADES: "weak-two:weak-pass-spades",

  // ── R2: Responder actions (diamonds) ────────────────────────
  GAME_RAISE_DIAMONDS: "weak-two:game-raise-diamonds",
  OGUST_ASK_DIAMONDS: "weak-two:ogust-ask-diamonds",
  INVITE_RAISE_DIAMONDS: "weak-two:invite-raise-diamonds",
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
