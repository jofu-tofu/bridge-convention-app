/**
 * General-purpose pedagogical tag vocabulary.
 *
 * 6 tags — one per relation kind + one for alternatives.
 * Modules use these with `scope` to express any pedagogical relationship.
 * Tag names are universal concepts; scopes provide local grouping.
 */

import type { PedagogicalTagDef } from "../../core/contracts/pedagogical-tag";

/** Surfaces that serve the same pedagogical purpose (symmetric).
 *  All members in a (SAME_FAMILY, scope) group pair with each other. */
export const SAME_FAMILY: PedagogicalTagDef = {
  id: "same-family",
  label: "Same conceptual family",
  derives: { type: "relation", kind: "same-family", symmetric: true },
};

/** Directed strength ordering between surfaces.
 *  Use `role: "a"` for stronger, `role: "b"` for weaker (simple pairs).
 *  Use `ordinal` for chains (0 = strongest, adjacent pairs derived). */
export const STRONGER_THAN: PedagogicalTagDef = {
  id: "stronger-than",
  label: "Stronger than (by strength/commitment level)",
  derives: { type: "relation", kind: "stronger-than" },
};

/** A surface continues a prior bid in the conversation.
 *  `role: "a"` = the continuation, `role: "b"` = the prior bid. */
export const CONTINUATION_OF: PedagogicalTagDef = {
  id: "continuation-of",
  label: "Continues a prior bid in the conversation",
  derives: { type: "relation", kind: "continuation-of" },
};

/** Surfaces commonly confused by learners.
 *  `role: "a"` = the near-miss, `role: "b"` = the target. */
export const NEAR_MISS_OF: PedagogicalTagDef = {
  id: "near-miss-of",
  label: "Commonly confused with",
  derives: { type: "relation", kind: "near-miss-of" },
};

/** A general fallback when a more specific convention doesn't apply.
 *  `role: "a"` = the fallback, `role: "b"` = the specific bid. */
export const FALLBACK_OF: PedagogicalTagDef = {
  id: "fallback-of",
  label: "General fallback when specific convention doesn't apply",
  derives: { type: "relation", kind: "fallback-of" },
};

/** Surfaces that are acceptable alternatives for grading.
 *  All members in a (ALTERNATIVES, scope) group form one AlternativeGroup.
 *  The scope string is used as the group label. */
export const ALTERNATIVES: PedagogicalTagDef = {
  id: "alternatives",
  label: "Acceptable alternative bids for grading",
  derives: { type: "alternative-group", tier: "alternative" },
};

/** All vocabulary tags for validation. */
export const ALL_PEDAGOGICAL_TAGS: readonly PedagogicalTagDef[] = [
  SAME_FAMILY,
  STRONGER_THAN,
  CONTINUATION_OF,
  NEAR_MISS_OF,
  FALLBACK_OF,
  ALTERNATIVES,
];
