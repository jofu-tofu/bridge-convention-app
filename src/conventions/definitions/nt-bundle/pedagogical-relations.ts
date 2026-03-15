import type { PedagogicalRelation } from "../../../core/contracts/pedagogical-relations";

/**
 * Pedagogical relation graph for the 1NT bundle.
 *
 * These relations power teaching explanations ("why X instead of Y?"),
 * family grouping, and near-miss feedback. They have NO effect on truth,
 * recommendation order, or candidate selection.
 *
 * Relation semantics:
 * - same-family: a and b are alternative expressions of a similar intent
 * - stronger-than: a shows more strength than b (game vs invite)
 * - weaker-than: a shows less strength than b
 * - fallback-of: a is the fallback when b is not available
 * - continuation-of: a is a natural follow-up to b
 * - near-miss-of: a is commonly confused with b
 */
export const NT_PEDAGOGICAL_RELATIONS: readonly PedagogicalRelation[] = [
  // ═══════════════════════════════════════════════════════════════
  // Same-family: Responder R1 convention mechanisms for major-suit hands
  // Stayman ask and transfers are alternative mechanisms for finding
  // a major-suit fit — same strategic family, different hand shapes.
  // ═══════════════════════════════════════════════════════════════
  {
    kind: "same-family",
    a: "stayman:ask-major",
    b: "transfer:to-hearts",
  },
  {
    kind: "same-family",
    a: "stayman:ask-major",
    b: "transfer:to-spades",
  },
  {
    kind: "same-family",
    a: "transfer:to-hearts",
    b: "transfer:to-spades",
  },

  // ═══════════════════════════════════════════════════════════════
  // Same-family: Natural NT bids (invite and game) — strength variants
  // of the same "no convention applies" fallback.
  // ═══════════════════════════════════════════════════════════════
  {
    kind: "same-family",
    a: "bridge:nt-invite",
    b: "bridge:to-3nt",
  },

  // ═══════════════════════════════════════════════════════════════
  // Stronger-than / weaker-than: Invite vs game strength ordering
  // ═══════════════════════════════════════════════════════════════

  // Responder R1: 3NT game is stronger than 2NT invite
  {
    kind: "stronger-than",
    a: "bridge:to-3nt",
    b: "bridge:nt-invite",
  },

  // Stayman R3 after 2H: raise to game is stronger than raise to invite
  {
    kind: "stronger-than",
    a: "stayman:raise-game-hearts",
    b: "stayman:raise-invite-hearts",
  },

  // Stayman R3 after 2S: raise to game is stronger than raise to invite
  {
    kind: "stronger-than",
    a: "stayman:raise-game-spades",
    b: "stayman:raise-invite-spades",
  },

  // Stayman R3 after 2H: 3NT (no fit) is stronger than 2NT invite (no fit)
  {
    kind: "stronger-than",
    a: "stayman:nt-game-no-fit",
    b: "stayman:nt-invite-no-fit",
  },

  // Stayman R3 after denial: 3NT game is stronger than 2NT invite
  {
    kind: "stronger-than",
    a: "stayman:nt-game-after-denial",
    b: "stayman:nt-invite-after-denial",
  },

  // Transfer R3 hearts: game in major is stronger than invite
  {
    kind: "stronger-than",
    a: "transfer:game-hearts",
    b: "transfer:invite-hearts",
  },

  // Transfer R3 spades: game in major is stronger than invite
  {
    kind: "stronger-than",
    a: "transfer:game-spades",
    b: "transfer:invite-spades",
  },

  // ═══════════════════════════════════════════════════════════════
  // Fallback-of: Natural NT as fallback when conventions don't apply
  // ═══════════════════════════════════════════════════════════════

  // 2NT invite is the fallback when Stayman/transfers don't apply (no major)
  {
    kind: "fallback-of",
    a: "bridge:nt-invite",
    b: "stayman:ask-major",
  },

  // 3NT game is the fallback when Stayman/transfers don't apply (no major)
  {
    kind: "fallback-of",
    a: "bridge:to-3nt",
    b: "stayman:ask-major",
  },

  // ═══════════════════════════════════════════════════════════════
  // Continuation-of: R3 bids that follow from R1 mechanism choices
  // ═══════════════════════════════════════════════════════════════

  // Raising opener's shown heart suit continues the Stayman dialogue
  {
    kind: "continuation-of",
    a: "stayman:raise-game-hearts",
    b: "stayman:ask-major",
  },

  // Transfer signoff continues the transfer dialogue (weak hand, just pass)
  {
    kind: "continuation-of",
    a: "transfer:signoff-hearts",
    b: "transfer:to-hearts",
  },

  // ═══════════════════════════════════════════════════════════════
  // Near-miss-of: Common confusion points for learners
  // ═══════════════════════════════════════════════════════════════

  // Learners confuse Stayman ask with transfer to hearts (both bid at 2-level,
  // both involve majors, but different hand shape requirements)
  {
    kind: "near-miss-of",
    a: "stayman:ask-major",
    b: "transfer:to-hearts",
  },

  // After hearts transfer accepted, learners confuse 4H game with 3NT game
  // (both require game values, differ by suit length)
  {
    kind: "near-miss-of",
    a: "transfer:game-hearts",
    b: "transfer:nt-game-hearts",
  },

  // ═══════════════════════════════════════════════════════════════
  // Smolen: R3 continuation after 2D denial for 5-4 major hands
  // ═══════════════════════════════════════════════════════════════

  // Same-family: Both Smolen bids serve the same strategic purpose
  {
    kind: "same-family",
    a: "smolen:bid-short-hearts",
    b: "smolen:bid-short-spades",
  },

  // Stronger-than: Smolen is stronger than 2NT invite (game-forcing vs invite)
  {
    kind: "stronger-than",
    a: "smolen:bid-short-hearts",
    b: "stayman:nt-invite-after-denial",
  },
  {
    kind: "stronger-than",
    a: "smolen:bid-short-spades",
    b: "stayman:nt-invite-after-denial",
  },

  // Continuation-of: Smolen continues the Stayman dialogue
  {
    kind: "continuation-of",
    a: "smolen:bid-short-hearts",
    b: "stayman:ask-major",
  },
  {
    kind: "continuation-of",
    a: "smolen:bid-short-spades",
    b: "stayman:ask-major",
  },

  // Near-miss-of: Learners confuse Smolen 3H with 3NT game
  {
    kind: "near-miss-of",
    a: "smolen:bid-short-hearts",
    b: "stayman:nt-game-after-denial",
  },
  {
    kind: "near-miss-of",
    a: "smolen:bid-short-spades",
    b: "stayman:nt-game-after-denial",
  },
];
