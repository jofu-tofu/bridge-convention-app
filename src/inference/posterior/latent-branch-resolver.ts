import type { LatentBranchSet } from "../../core/contracts/posterior";
import type { Hand } from "../../engine/types";
import type { WeightedDealSample } from "./posterior-sampler";

/**
 * Per-alternative marginal probability within a latent branch set.
 */
export interface BranchMarginal {
  readonly branchId: string;
  readonly meaningId: string;
  readonly probability: number;
  readonly matchCount: number;
}

/**
 * Resolution of a single LatentBranchSet: per-alternative marginal probabilities
 * computed from sampled deals, plus optional selection when one branch dominates.
 */
export interface LatentBranchResolution {
  readonly setId: string;
  readonly marginals: readonly BranchMarginal[];
  readonly effectiveSampleSize: number;
  /** Branch ID selected when one alternative's probability exceeds the dominance threshold (0.8). */
  readonly selectedBranchId?: string;
}

/** Probability threshold above which a branch is considered "selected" (dominant). */
const DOMINANCE_THRESHOLD = 0.8;

/**
 * Resolve latent branch sets by computing marginal probabilities per alternative
 * from sampled deals. For each branch alternative, the corresponding predicate is
 * evaluated against the target seat's hand in each sample. The marginal probability
 * is the fraction of samples satisfying that predicate.
 *
 * When one alternative's probability exceeds 80%, it is marked as selected.
 *
 * @param branchSets - Latent branch sets to resolve
 * @param samples - Weighted deal samples from rejection sampling
 * @param targetSeatId - Seat whose hand is checked against branch predicates
 * @param branchPredicates - Map from branchId to hand predicate function
 * @returns One LatentBranchResolution per branch set
 */
export function resolveLatentBranches(
  branchSets: readonly LatentBranchSet[],
  samples: readonly WeightedDealSample[],
  targetSeatId: string,
  branchPredicates: ReadonlyMap<string, (hand: Hand) => boolean>,
): readonly LatentBranchResolution[] {
  return branchSets.map((branchSet) =>
    resolveSingleBranchSet(branchSet, samples, targetSeatId, branchPredicates),
  );
}

function resolveSingleBranchSet(
  branchSet: LatentBranchSet,
  samples: readonly WeightedDealSample[],
  targetSeatId: string,
  branchPredicates: ReadonlyMap<string, (hand: Hand) => boolean>,
): LatentBranchResolution {
  const totalSamples = samples.length;

  const marginals: BranchMarginal[] = branchSet.alternatives.map((alt) => {
    const predicate = branchPredicates.get(alt.branchId);
    if (!predicate || totalSamples === 0) {
      return {
        branchId: alt.branchId,
        meaningId: alt.meaningId,
        probability: 0,
        matchCount: 0,
      };
    }

    let matchCount = 0;
    for (const sample of samples) {
      const hand = sample.hands.get(targetSeatId);
      if (hand && predicate(hand)) {
        matchCount++;
      }
    }

    return {
      branchId: alt.branchId,
      meaningId: alt.meaningId,
      probability: matchCount / totalSamples,
      matchCount,
    };
  });

  // Select the dominant branch if one exceeds the threshold
  let selectedBranchId: string | undefined;
  for (const marginal of marginals) {
    if (marginal.probability >= DOMINANCE_THRESHOLD) {
      selectedBranchId = marginal.branchId;
      break;
    }
  }

  return {
    setId: branchSet.setId,
    marginals,
    effectiveSampleSize: totalSamples,
    ...(selectedBranchId !== undefined ? { selectedBranchId } : {}),
  };
}
