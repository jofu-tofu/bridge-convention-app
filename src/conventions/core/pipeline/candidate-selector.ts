import type { ResolvedCandidate } from "./candidate-generator";
import { ForcingState, ObligationKind } from "../dialogue/dialogue-state";
import type { Obligation } from "../dialogue/dialogue-state";

/** Check all four eligibility dimensions — candidate must satisfy all to be selectable. */
export function isSelectable(c: ResolvedCandidate): boolean {
  return c.eligibility.hand.satisfied
    && c.eligibility.protocol.satisfied
    && c.eligibility.encoding.legal
    && c.eligibility.pedagogical.acceptable;
}

/** Ranker function type — reorders candidates before tiered selection. */
export type CandidateRankerFn = (
  candidates: readonly ResolvedCandidate[],
) => readonly ResolvedCandidate[];

/**
 * Check whether a candidate meets an obligation constraint.
 * Conservative: only `BidSuit` actively filters (excludes Pass).
 * All other obligation kinds are informational — the tree already constrains correctly.
 */
function meetsObligation(c: ResolvedCandidate, obligation: Obligation | undefined): boolean {
  if (!obligation || obligation.kind === ObligationKind.None) return true;
  switch (obligation.kind) {
    case ObligationKind.BidSuit:
      // Context-dependent: must act constructively. Always excludes Pass.
      // Allows NT for strong hands (obligation is "bid constructively", not literally "bid a suit").
      // Pass exclusion is the primary enforcement; tree/resolver handles suit preference.
      if (c.resolvedCall.type === "pass") return false;
      return true;
    default:
      // All other obligation kinds are informational for now.
      // ShowMajor, CompleteRelay, etc. — the tree already constrains responses correctly.
      return true;
  }
}

export interface SelectionResult {
  readonly selected: ResolvedCandidate | null;
  readonly tierPeers: readonly ResolvedCandidate[];
  readonly rankerApplied: boolean;
}

/** Select the best candidate using tiered selection.
 *  If ranker is provided, candidates are reordered first.
 *  Tier 1: matched+legal
 *  Tier 2: preferred+legal+satisfiable
 *  Tier 3: alternative+legal+satisfiable
 *  Tier 4: null
 *  When forcingState is ForcingOneRound or GameForcing, Pass candidates
 *  are excluded from all tiers.
 *  When obligation is provided, candidates are filtered by obligation constraints.
 *  Ranker influences WHICH candidate wins within a tier, not tier boundaries.
 *  Returns SelectionResult with tier peers for ambiguity detection. */
export function selectMatchedCandidate(
  candidates: readonly ResolvedCandidate[],
  ranker?: CandidateRankerFn,
  forcingState?: ForcingState,
  obligation?: Obligation,
): SelectionResult {
  const hasRanker = !!ranker;
  const ranked = ranker ? ranker(candidates) : candidates;
  const noPass = forcingState === ForcingState.ForcingOneRound
    || forcingState === ForcingState.GameForcing;
  const passOnly = forcingState === ForcingState.PassForcing;
  const allowed = (c: ResolvedCandidate) => {
    if (noPass && c.resolvedCall.type === "pass") return false;
    if (passOnly && c.resolvedCall.type !== "pass") return false;
    if (!meetsObligation(c, obligation)) return false;
    return true;
  };

  // Tier 1: matched+selectable (matched candidates have no failedConditions by construction)
  const matchedAll = ranked.filter(c => c.isMatched && isSelectable(c) && allowed(c));
  if (matchedAll.length > 0) {
    const selected = matchedAll[0]!;
    if (import.meta.env?.DEV && selected.failedConditions.length > 0) {
      // eslint-disable-next-line no-console -- invariant checks should surface in development.
      console.warn("Invariant violation: matched candidate has non-empty failedConditions");
    }
    return {
      selected,
      tierPeers: hasRanker ? [] : matchedAll.slice(1),
      rankerApplied: hasRanker,
    };
  }

  // Tier 2: preferred+selectable
  const preferredAll = ranked.filter(c =>
    c.priority === "preferred" && isSelectable(c) && allowed(c));
  if (preferredAll.length > 0) {
    return {
      selected: preferredAll[0]!,
      tierPeers: hasRanker ? [] : preferredAll.slice(1),
      rankerApplied: hasRanker,
    };
  }

  // Tier 3: alternative+selectable
  const altAll = ranked.filter(c =>
    c.priority === "alternative" && isSelectable(c) && allowed(c));
  if (altAll.length > 0) {
    return {
      selected: altAll[0]!,
      tierPeers: hasRanker ? [] : altAll.slice(1),
      rankerApplied: hasRanker,
    };
  }

  // Tier 4: no selection
  return { selected: null, tierPeers: [], rankerApplied: hasRanker };
}
