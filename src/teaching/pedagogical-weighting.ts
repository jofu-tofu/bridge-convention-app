import type { PedagogicalControls } from "../core/contracts/witness-spec";

/**
 * Distribution parameters for scenario sampling in deal generation.
 * Each field represents the fraction of deals that should target that scenario category.
 * All fields sum to 1.0.
 */
export interface ScenarioDistribution {
  /** Fraction of deals where the convention clearly applies (hand meets all conditions). */
  readonly positive: number;
  /** Fraction of deals near decision boundaries (hand barely qualifies or barely misses). */
  readonly nearBoundary: number;
  /** Fraction of deals with competitive interference that tests convention robustness. */
  readonly competitive: number;
}

const POSITIVE_ONLY: ScenarioDistribution = {
  positive: 1.0,
  nearBoundary: 0,
  competitive: 0,
};

const TEACHING_DEFAULT: ScenarioDistribution = {
  positive: 0.6,
  nearBoundary: 0.25,
  competitive: 0.15,
};

const BALANCED: ScenarioDistribution = {
  positive: 0.5,
  nearBoundary: 0.25,
  competitive: 0.25,
};

/**
 * Maps a pedagogical weighting mode to scenario distribution parameters.
 *
 * Pure infrastructure function — returns distribution parameters that a deal
 * generator can use to sample scenarios. Not directly wired into deal generation yet.
 *
 * Modes:
 * - `positiveOnly`: Only cases where the convention applies (current default behavior).
 * - `teachingDefault`: ~60% positive / ~25% near-boundary / ~15% competitive.
 * - `balanced`: Equal positive/negative split with boundary and competitive scenarios.
 * - `adaptive`: Stub that defaults to `teachingDefault` (future: adjusts based on learner performance).
 */
export function computeScenarioDistribution(
  controls: PedagogicalControls,
): ScenarioDistribution {
  const mode = controls.weightingMode ?? "positiveOnly";

  switch (mode) {
    case "positiveOnly":
      return POSITIVE_ONLY;
    case "teachingDefault":
      return TEACHING_DEFAULT;
    case "balanced":
      return BALANCED;
    case "adaptive":
      // Stub: defaults to teachingDefault until learner performance tracking exists
      return TEACHING_DEFAULT;
  }
}
