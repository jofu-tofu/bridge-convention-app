import type { ResolvedCandidate } from "./candidate-generator";

/** Ranker function type — reorders candidates before tiered selection. */
export type CandidateRankerFn = (
  candidates: readonly ResolvedCandidate[],
) => readonly ResolvedCandidate[];

/** Select the best candidate using tiered selection.
 *  If ranker is provided, candidates are reordered first.
 *  Tier 1: matched+legal
 *  Tier 2: preferred+legal
 *  Tier 3: alternative+legal
 *  Tier 4: null
 *  Ranker influences WHICH candidate wins within a tier, not tier boundaries. */
export function selectMatchedCandidate(
  candidates: readonly ResolvedCandidate[],
  ranker?: CandidateRankerFn,
): ResolvedCandidate | null {
  const ranked = ranker ? ranker(candidates) : candidates;

  // Tier 1: matched+legal
  const matched = ranked.find(c => c.isMatched && c.legal);
  if (matched) return matched;

  // Tier 2: preferred+legal
  const preferred = ranked.find(c => c.priority === "preferred" && c.legal);
  if (preferred) return preferred;

  // Tier 3: alternative+legal
  const alt = ranked.find(c => c.priority === "alternative" && c.legal);
  if (alt) return alt;

  // Tier 4: no selection
  return null;
}
