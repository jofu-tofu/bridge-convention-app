import type { ResolvedCandidate } from "./candidate-generator";
import { ForcingState, ObligationKind } from "../dialogue/dialogue-state";
import type { Obligation } from "../dialogue/dialogue-state";

/** Check three eligibility dimensions — candidate must satisfy hand, protocol, and encoding to be selectable.
 *  Pedagogical acceptability is a post-selection annotation, not a selection gate. */
export function isSelectable(c: ResolvedCandidate): boolean {
  return c.eligibility.hand.satisfied
    && c.eligibility.protocol.satisfied
    && c.eligibility.encoding.legal;
}

/** Check pedagogical acceptability — post-selection annotation for teaching consumers. */
export function isPedagogicallyAcceptable(c: ResolvedCandidate): boolean {
  return c.eligibility.pedagogical.acceptable;
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
  /** All candidates in the winning tier BEFORE ranking. Preserved even when ranker clears tierPeers.
   *  Enables teaching to distinguish "only one bid was right" from "multiple were live, ranker chose." */
  readonly preRankingPeers: readonly ResolvedCandidate[];
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

  /** Sort candidates within a tier by orderKey (lower = higher priority).
   *  When no ranker is applied, orderKey provides deterministic tie-breaking
   *  that makes the implicit DFS insertion order explicit and inspectable. */
  const sortByOrderKey = (cs: ResolvedCandidate[]) =>
    cs.sort((a, b) => a.orderKey - b.orderKey);

  /** Build result from a tier's candidates.
   *  preRankingPeers is always the full tier set (pre-ranker order);
   *  tierPeers is cleared when a ranker disambiguated. */
  const buildResult = (tierCandidates: ResolvedCandidate[]): SelectionResult => {
    // Snapshot before ranker-driven reorder
    const preRankingPeers = [...tierCandidates];
    if (!hasRanker) sortByOrderKey(tierCandidates);
    return {
      selected: tierCandidates[0]!,
      tierPeers: hasRanker ? [] : tierCandidates.slice(1),
      preRankingPeers,
      rankerApplied: hasRanker,
    };
  };

  // Tier 1: matched+selectable (matched candidates have no failedConditions by construction)
  const matchedAll = ranked.filter(c => c.isMatched && isSelectable(c) && allowed(c));
  if (matchedAll.length > 0) {
    const result = buildResult(matchedAll);
    if (import.meta.env?.DEV && result.selected!.failedConditions.length > 0) {
      // eslint-disable-next-line no-console -- invariant checks should surface in development.
      console.warn("Invariant violation: matched candidate has non-empty failedConditions");
    }
    return result;
  }

  // Tier 2: preferred+selectable
  const preferredAll = ranked.filter(c =>
    c.priority === "preferred" && isSelectable(c) && allowed(c));
  if (preferredAll.length > 0) return buildResult(preferredAll);

  // Tier 3: alternative+selectable
  const altAll = ranked.filter(c =>
    c.priority === "alternative" && isSelectable(c) && allowed(c));
  if (altAll.length > 0) return buildResult(altAll);

  // Tier 4: no selection
  return { selected: null, tierPeers: [], preRankingPeers: [], rankerApplied: hasRanker };
}
