import type { PedagogicalRelation } from "../../../core/contracts/pedagogical-relations";

/**
 * Pedagogical relations for the DONT bundle.
 *
 * Relation kinds:
 *   same-family     — semantically related bids
 *   continuation-of — a later bid that follows logically from an earlier one
 *   near-miss-of    — bids that are easy to confuse
 */
export const DONT_PEDAGOGICAL_RELATIONS: readonly PedagogicalRelation[] = [
  // ── Same-family: overcaller R1 bids ─────────────────────────
  { kind: "same-family", a: "dont:both-majors-2h", b: "dont:diamonds-major-2d" },
  { kind: "same-family", a: "dont:both-majors-2h", b: "dont:clubs-higher-2c" },
  { kind: "same-family", a: "dont:both-majors-2h", b: "dont:natural-spades-2s" },
  { kind: "same-family", a: "dont:both-majors-2h", b: "dont:single-suited-double" },
  { kind: "same-family", a: "dont:diamonds-major-2d", b: "dont:clubs-higher-2c" },
  { kind: "same-family", a: "dont:diamonds-major-2d", b: "dont:natural-spades-2s" },
  { kind: "same-family", a: "dont:diamonds-major-2d", b: "dont:single-suited-double" },
  { kind: "same-family", a: "dont:clubs-higher-2c", b: "dont:natural-spades-2s" },
  { kind: "same-family", a: "dont:clubs-higher-2c", b: "dont:single-suited-double" },
  { kind: "same-family", a: "dont:natural-spades-2s", b: "dont:single-suited-double" },

  // ── Same-family: overcaller reveal bids ─────────────────────
  { kind: "same-family", a: "dont:reveal-clubs", b: "dont:reveal-diamonds" },
  { kind: "same-family", a: "dont:reveal-clubs", b: "dont:reveal-hearts" },
  { kind: "same-family", a: "dont:reveal-diamonds", b: "dont:reveal-hearts" },

  // ── Continuation-of: reveal bids follow from double ─────────
  { kind: "continuation-of", a: "dont:reveal-clubs", b: "dont:single-suited-double" },
  { kind: "continuation-of", a: "dont:reveal-diamonds", b: "dont:single-suited-double" },
  { kind: "continuation-of", a: "dont:reveal-hearts", b: "dont:single-suited-double" },

  // ── Continuation-of: 2C relay surfaces ──────────────────────
  // After 2C (clubs + higher), advancer's relay reveals the higher suit.
  { kind: "continuation-of", a: "dont:reveal-diamonds", b: "dont:clubs-higher-2c" },
  { kind: "continuation-of", a: "dont:reveal-hearts", b: "dont:clubs-higher-2c" },

  // ── Continuation-of: 2D relay surfaces ──────────────────────
  // After 2D (diamonds + major), advancer's relay reveals the major.
  { kind: "continuation-of", a: "dont:reveal-hearts", b: "dont:diamonds-major-2d" },

  // ── Near-miss-of: commonly confused bids ────────────────────
  // 2H vs 2D — both show two-suited hands with overlapping shapes.
  { kind: "near-miss-of", a: "dont:both-majors-2h", b: "dont:diamonds-major-2d" },
  // 2C vs 2D — both are two-suited bids (clubs+higher vs diamonds+major).
  { kind: "near-miss-of", a: "dont:clubs-higher-2c", b: "dont:diamonds-major-2d" },
  // 2S vs X — both show a long suit; spades is the differentiator.
  { kind: "near-miss-of", a: "dont:natural-spades-2s", b: "dont:single-suited-double" },
];
