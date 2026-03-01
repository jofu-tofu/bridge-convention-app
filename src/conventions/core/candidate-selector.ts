import type { ResolvedCandidate } from "./candidate-generator";

/** Select the best candidate using tiered selection:
 *  Tier 1: matched+legal
 *  Tier 2: preferred+legal
 *  Tier 3: null (alternatives never auto-selected) */
export function selectMatchedCandidate(
  candidates: readonly ResolvedCandidate[],
): ResolvedCandidate | null {
  // Tier 1: matched+legal
  const matched = candidates.find(c => c.isMatched && c.legal);
  if (matched) return matched;

  // Tier 2: preferred+legal
  const preferred = candidates.find(c => c.priority === "preferred" && c.legal);
  if (preferred) return preferred;

  // Tier 3: no selection
  return null;
}
