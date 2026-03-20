import type { PedagogicalRelation } from "../../../../core/contracts/teaching-projection";

/**
 * Pedagogical relations for the Bergen Raises bundle.
 *
 * These relations are used by the teaching UI to explain
 * "why this bid instead of that one?" They have NO effect
 * on truth-set selection or recommendation order.
 *
 * Relation kinds:
 *   same-family     — semantically related bids (e.g., all strength raises)
 *   stronger-than   — one bid shows more strength than another
 *   continuation-of — a later bid that follows logically from an earlier one
 *   fallback-of     — a bid used when the preferred bid doesn't apply
 *   near-miss-of    — bids that are easy to confuse
 */
export const BERGEN_PEDAGOGICAL_RELATIONS: readonly PedagogicalRelation[] = [
  // ── Same-family: strength raises (hearts) ───────────────────
  // The three core Bergen strength raises form a family — they all show
  // 4-card support but differ in HCP range.
  { kind: "same-family", a: "bergen:game-raise-hearts", b: "bergen:limit-raise-hearts" },
  { kind: "same-family", a: "bergen:limit-raise-hearts", b: "bergen:constructive-raise-hearts" },
  { kind: "same-family", a: "bergen:constructive-raise-hearts", b: "bergen:preemptive-raise-hearts" },

  // ── Same-family: strength raises (spades) ──────────────────
  { kind: "same-family", a: "bergen:game-raise-spades", b: "bergen:limit-raise-spades" },
  { kind: "same-family", a: "bergen:limit-raise-spades", b: "bergen:constructive-raise-spades" },
  { kind: "same-family", a: "bergen:constructive-raise-spades", b: "bergen:preemptive-raise-spades" },

  // ── Same-family: splinter vs game raise ─────────────────────
  // Both show 12+ HCP but differ in shape (shortage vs balanced).
  { kind: "same-family", a: "bergen:splinter-hearts", b: "bergen:game-raise-hearts" },
  { kind: "same-family", a: "bergen:splinter-spades", b: "bergen:game-raise-spades" },

  // ── Stronger-than: descending strength chain (hearts) ───────
  { kind: "stronger-than", a: "bergen:game-raise-hearts", b: "bergen:limit-raise-hearts" },
  { kind: "stronger-than", a: "bergen:limit-raise-hearts", b: "bergen:constructive-raise-hearts" },
  { kind: "stronger-than", a: "bergen:constructive-raise-hearts", b: "bergen:preemptive-raise-hearts" },

  // ── Stronger-than: descending strength chain (spades) ───────
  { kind: "stronger-than", a: "bergen:game-raise-spades", b: "bergen:limit-raise-spades" },
  { kind: "stronger-than", a: "bergen:limit-raise-spades", b: "bergen:constructive-raise-spades" },
  { kind: "stronger-than", a: "bergen:constructive-raise-spades", b: "bergen:preemptive-raise-spades" },

  // ── Same-family: opener rebids after constructive ───────────
  // Opener's three choices after 3C: game, try, signoff.
  { kind: "same-family", a: "bergen:opener-game-after-constructive", b: "bergen:opener-signoff-after-constructive" },
  { kind: "stronger-than", a: "bergen:opener-game-after-constructive", b: "bergen:opener-signoff-after-constructive" },

  // ── Same-family: opener rebids after limit ──────────────────
  { kind: "same-family", a: "bergen:opener-game-after-limit", b: "bergen:opener-signoff-after-limit" },
  { kind: "stronger-than", a: "bergen:opener-game-after-limit", b: "bergen:opener-signoff-after-limit" },

  // ── Same-family: opener rebids after preemptive ─────────────
  { kind: "same-family", a: "bergen:opener-game-after-preemptive", b: "bergen:opener-pass-after-preemptive" },
  { kind: "stronger-than", a: "bergen:opener-game-after-preemptive", b: "bergen:opener-pass-after-preemptive" },

  // ── Continuation-of: R2 follows R1 ─────────────────────────
  // Opener's rebid is a continuation of responder's initial raise.
  { kind: "continuation-of", a: "bergen:opener-game-after-constructive", b: "bergen:constructive-raise-hearts" },
  { kind: "continuation-of", a: "bergen:opener-game-after-constructive", b: "bergen:constructive-raise-spades" },
  { kind: "continuation-of", a: "bergen:opener-game-after-limit", b: "bergen:limit-raise-hearts" },
  { kind: "continuation-of", a: "bergen:opener-game-after-limit", b: "bergen:limit-raise-spades" },
  { kind: "continuation-of", a: "bergen:opener-game-after-preemptive", b: "bergen:preemptive-raise-hearts" },
  { kind: "continuation-of", a: "bergen:opener-game-after-preemptive", b: "bergen:preemptive-raise-spades" },

  // ── Continuation-of: R3 follows R2 ─────────────────────────
  // Responder's game-try decision is a continuation of opener's try.
  { kind: "continuation-of", a: "bergen:responder-try-accept", b: "bergen:opener-try-after-constructive" },
  { kind: "continuation-of", a: "bergen:responder-try-reject", b: "bergen:opener-try-after-constructive" },

  // ── Same-family: responder game-try decisions ───────────────
  { kind: "same-family", a: "bergen:responder-try-accept", b: "bergen:responder-try-reject" },
  { kind: "stronger-than", a: "bergen:responder-try-accept", b: "bergen:responder-try-reject" },

  // ── Continuation-of: R4 follows R3 ─────────────────────────
  { kind: "continuation-of", a: "bergen:opener-accept-after-try", b: "bergen:responder-try-accept" },
  { kind: "continuation-of", a: "bergen:opener-accept-after-try", b: "bergen:responder-try-reject" },

  // ── Near-miss-of: commonly confused bids ────────────────────
  // 3C (constructive, 7-10) vs 3D (limit, 10-12) — the HCP boundary at 10 is confusing.
  { kind: "near-miss-of", a: "bergen:constructive-raise-hearts", b: "bergen:limit-raise-hearts" },
  { kind: "near-miss-of", a: "bergen:constructive-raise-spades", b: "bergen:limit-raise-spades" },
  // Splinter vs game raise — both 12+ HCP, differ on shortage.
  { kind: "near-miss-of", a: "bergen:splinter-hearts", b: "bergen:game-raise-hearts" },
  { kind: "near-miss-of", a: "bergen:splinter-spades", b: "bergen:game-raise-spades" },

  // ── Fallback-of: preemptive as fallback ─────────────────────
  // The preemptive raise (3M) is the fallback when no coded raise fits.
  { kind: "fallback-of", a: "bergen:preemptive-raise-hearts", b: "bergen:constructive-raise-hearts" },
  { kind: "fallback-of", a: "bergen:preemptive-raise-spades", b: "bergen:constructive-raise-spades" },
];
