import type { PedagogicalRelation } from "../../../core/contracts/pedagogical-relations";

/**
 * Pedagogical relations for the Weak Two Bids bundle.
 *
 * Relation kinds:
 *   same-family     — semantically related bids
 *   stronger-than   — one bid shows more strength than another
 *   continuation-of — a later bid that follows logically from an earlier one
 *   near-miss-of    — bids that are easy to confuse
 */
export const WEAK_TWO_PEDAGOGICAL_RELATIONS: readonly PedagogicalRelation[] = [
  // ── Same-family: opener weak two bids ───────────────────────
  { kind: "same-family", a: "weak-two:open-2h", b: "weak-two:open-2s" },
  { kind: "same-family", a: "weak-two:open-2s", b: "weak-two:open-2d" },
  { kind: "same-family", a: "weak-two:open-2h", b: "weak-two:open-2d" },

  // ── Same-family: responder actions ──────────────────────────
  { kind: "same-family", a: "weak-two:game-raise-hearts", b: "weak-two:ogust-ask-hearts" },
  { kind: "same-family", a: "weak-two:ogust-ask-hearts", b: "weak-two:invite-raise-hearts" },
  { kind: "same-family", a: "weak-two:game-raise-spades", b: "weak-two:ogust-ask-spades" },
  { kind: "same-family", a: "weak-two:ogust-ask-spades", b: "weak-two:invite-raise-spades" },
  { kind: "same-family", a: "weak-two:game-raise-diamonds", b: "weak-two:ogust-ask-diamonds" },
  { kind: "same-family", a: "weak-two:ogust-ask-diamonds", b: "weak-two:invite-raise-diamonds" },

  // ── Stronger-than: responder strength chain ─────────────────
  { kind: "stronger-than", a: "weak-two:game-raise-hearts", b: "weak-two:invite-raise-hearts" },
  { kind: "stronger-than", a: "weak-two:invite-raise-hearts", b: "weak-two:weak-pass-hearts" },
  { kind: "stronger-than", a: "weak-two:game-raise-spades", b: "weak-two:invite-raise-spades" },
  { kind: "stronger-than", a: "weak-two:invite-raise-spades", b: "weak-two:weak-pass-spades" },
  { kind: "stronger-than", a: "weak-two:game-raise-diamonds", b: "weak-two:invite-raise-diamonds" },
  { kind: "stronger-than", a: "weak-two:invite-raise-diamonds", b: "weak-two:weak-pass-diamonds" },

  // ── Same-family: Ogust responses ────────────────────────────
  { kind: "same-family", a: "weak-two:ogust-solid-hearts", b: "weak-two:ogust-max-good-hearts" },
  { kind: "same-family", a: "weak-two:ogust-max-good-hearts", b: "weak-two:ogust-max-bad-hearts" },
  { kind: "same-family", a: "weak-two:ogust-max-bad-hearts", b: "weak-two:ogust-min-good-hearts" },
  { kind: "same-family", a: "weak-two:ogust-min-good-hearts", b: "weak-two:ogust-min-bad-hearts" },

  { kind: "same-family", a: "weak-two:ogust-solid-spades", b: "weak-two:ogust-max-good-spades" },
  { kind: "same-family", a: "weak-two:ogust-max-good-spades", b: "weak-two:ogust-max-bad-spades" },
  { kind: "same-family", a: "weak-two:ogust-max-bad-spades", b: "weak-two:ogust-min-good-spades" },
  { kind: "same-family", a: "weak-two:ogust-min-good-spades", b: "weak-two:ogust-min-bad-spades" },

  { kind: "same-family", a: "weak-two:ogust-solid-diamonds", b: "weak-two:ogust-max-good-diamonds" },
  { kind: "same-family", a: "weak-two:ogust-max-good-diamonds", b: "weak-two:ogust-max-bad-diamonds" },
  { kind: "same-family", a: "weak-two:ogust-max-bad-diamonds", b: "weak-two:ogust-min-good-diamonds" },
  { kind: "same-family", a: "weak-two:ogust-min-good-diamonds", b: "weak-two:ogust-min-bad-diamonds" },

  // ── Continuation-of: R3 Ogust follows R2 Ogust ask ─────────
  { kind: "continuation-of", a: "weak-two:ogust-solid-hearts", b: "weak-two:ogust-ask-hearts" },
  { kind: "continuation-of", a: "weak-two:ogust-min-bad-hearts", b: "weak-two:ogust-ask-hearts" },
  { kind: "continuation-of", a: "weak-two:ogust-min-good-hearts", b: "weak-two:ogust-ask-hearts" },
  { kind: "continuation-of", a: "weak-two:ogust-max-bad-hearts", b: "weak-two:ogust-ask-hearts" },
  { kind: "continuation-of", a: "weak-two:ogust-max-good-hearts", b: "weak-two:ogust-ask-hearts" },

  // ── Near-miss-of: commonly confused bids ────────────────────
  // Game raise vs invite raise — the HCP boundary at 14/16 is confusing.
  { kind: "near-miss-of", a: "weak-two:game-raise-hearts", b: "weak-two:invite-raise-hearts" },
  { kind: "near-miss-of", a: "weak-two:game-raise-spades", b: "weak-two:invite-raise-spades" },
  { kind: "near-miss-of", a: "weak-two:game-raise-diamonds", b: "weak-two:invite-raise-diamonds" },
  // Ogust min-good vs max-bad — the 8/9 HCP boundary.
  { kind: "near-miss-of", a: "weak-two:ogust-min-good-hearts", b: "weak-two:ogust-max-bad-hearts" },
  { kind: "near-miss-of", a: "weak-two:ogust-min-good-spades", b: "weak-two:ogust-max-bad-spades" },
  { kind: "near-miss-of", a: "weak-two:ogust-min-good-diamonds", b: "weak-two:ogust-max-bad-diamonds" },
];
