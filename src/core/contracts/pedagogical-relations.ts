/** Pedagogical relation between two bids or meanings.
 *  Used by teaching UI to explain "why is X better than Y?" */
export type PedagogicalRelation =
  | { readonly kind: "same-family"; readonly a: string; readonly b: string }
  | { readonly kind: "stronger-than"; readonly a: string; readonly b: string }
  | { readonly kind: "weaker-than"; readonly a: string; readonly b: string }
  | { readonly kind: "fallback-of"; readonly a: string; readonly b: string }
  | { readonly kind: "continuation-of"; readonly a: string; readonly b: string }
  | { readonly kind: "near-miss-of"; readonly a: string; readonly b: string };
