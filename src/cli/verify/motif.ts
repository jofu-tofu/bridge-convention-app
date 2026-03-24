// ── Pairwise motif testing ───────────────────────────────────────────
//
// Reuses exploreBundle infrastructure but focuses on a specific module pair,
// tracking co-activation and pair-specific conflicts.

import type { ConventionModule, ConventionBundle } from "../../conventions";

import type { BaseSystemId } from "../../conventions/definitions/system-config";
import { exploreBundle } from "./explore";
import type { MotifResult, InvariantViolation } from "./types";

export interface MotifConfig {
  readonly depth: number;
  readonly seed: number;
  readonly trials: number;
  readonly pair: readonly [string, string];
  readonly baseSystem?: BaseSystemId;
}

/**
 * Run pairwise motif testing — explore a bundle but focus analysis on a specific pair.
 *
 * Runs the full exploration, then filters results to the pair of interest.
 * Co-activation = both modules had active claims at the same snapshot.
 */
export function motifTest(
  bundle: ConventionBundle,
  modules: readonly ConventionModule[],
  config: MotifConfig,
): MotifResult {
  const [modA, modB] = config.pair;

  // Run full exploration
  const result = exploreBundle(bundle, modules, {
    depth: config.depth,
    seed: config.seed,
    trials: config.trials,
    baseSystem: config.baseSystem,
  });

  // Count co-activations from coverage data
  // Both modules being activated at all is a proxy for co-activation
  const bothActivated =
    result.coverage.modulesActivated.includes(modA) &&
    result.coverage.modulesActivated.includes(modB);

  // Filter violations relevant to this pair
  const pairViolations: InvariantViolation[] = result.violations.filter((v) => {
    // Include violations where both modules appear in the context
    const phases = v.context.localPhases;
    return modA in phases && modB in phases;
  });

  // Estimate co-activations from atoms exercised
  const atomsA = result.coverage.atomsExercised.filter((a) => a.startsWith(`${modA}/`));
  const atomsB = result.coverage.atomsExercised.filter((a) => a.startsWith(`${modB}/`));
  const coActivations = bothActivated ? Math.min(atomsA.length, atomsB.length) : 0;

  const conflicts = pairViolations.length;
  let verdict: "safe" | "risky" | "failing";
  if (conflicts > 0) {
    verdict = "failing";
  } else if (coActivations > 0) {
    verdict = "safe";
  } else {
    verdict = "safe"; // No co-activation means no conflict possible
  }

  return {
    command: "verify motif",
    bundle: bundle.id,
    pair: config.pair,
    coActivations,
    conflicts,
    violations: pairViolations,
    verdict,
  };
}
