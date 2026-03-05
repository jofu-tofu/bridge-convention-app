import type { ResolvedCandidate } from "./candidate-generator";
import { ForcingState } from "./dialogue/dialogue-state";

/** Ranker function type — reorders candidates before tiered selection. */
export type CandidateRankerFn = (
  candidates: readonly ResolvedCandidate[],
) => readonly ResolvedCandidate[];

/** Select the best candidate using tiered selection.
 *  If ranker is provided, candidates are reordered first.
 *  Tier 1: matched+legal
 *  Tier 2: preferred+legal+satisfiable
 *  Tier 3: alternative+legal+satisfiable
 *  Tier 4: null
 *  When forcingState is ForcingOneRound or GameForcing, Pass candidates
 *  are excluded from all tiers.
 *  Ranker influences WHICH candidate wins within a tier, not tier boundaries. */
export function selectMatchedCandidate(
  candidates: readonly ResolvedCandidate[],
  ranker?: CandidateRankerFn,
  forcingState?: ForcingState,
): ResolvedCandidate | null {
  const ranked = ranker ? ranker(candidates) : candidates;
  const noPass = forcingState === ForcingState.ForcingOneRound
    || forcingState === ForcingState.GameForcing;
  const passOnly = forcingState === ForcingState.PassForcing;
  const allowed = (c: ResolvedCandidate) => {
    if (noPass && c.resolvedCall.type === "pass") return false;
    if (passOnly && c.resolvedCall.type !== "pass") return false;
    return true;
  };

  // Tier 1: matched+legal
  const matched = ranked.find(c => c.isMatched && c.legal && allowed(c));
  if (matched) {
    // Invariant: matched candidates have no failed conditions by construction.
    if (import.meta.env?.DEV && matched.failedConditions.length > 0) {
      // eslint-disable-next-line no-console -- invariant checks should surface in development.
      console.warn("Invariant violation: matched candidate has non-empty failedConditions");
    }
    return matched;
  }

  // Tier 2: preferred+legal+satisfiable
  const preferred = ranked.find(c =>
    c.priority === "preferred" && c.legal && c.failedConditions.length === 0 && allowed(c));
  if (preferred) return preferred;

  // Tier 3: alternative+legal+satisfiable
  const alt = ranked.find(c =>
    c.priority === "alternative" && c.legal && c.failedConditions.length === 0 && allowed(c));
  if (alt) return alt;

  // Tier 4: no selection
  return null;
}
