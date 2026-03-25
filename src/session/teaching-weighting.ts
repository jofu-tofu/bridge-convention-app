import type { TeachingControls } from "../conventions";

/**
 * Distribution parameters for scenario sampling in deal generation.
 *
 * Represented as 2 independent parameters on a 2-simplex:
 * - nearBoundary + competitive must be <= 1.0
 * - positive is derived as the residual: 1.0 - nearBoundary - competitive
 *
 * Use `createScenarioDistribution()` to construct with invariant enforcement.
 */
export interface ScenarioDistribution {
  /** Fraction of deals where the convention clearly applies (hand meets all conditions).
   *  Derived: 1.0 - nearBoundary - competitive. */
  readonly positive: number;
  /** Fraction of deals near decision boundaries (hand barely qualifies or barely misses). */
  readonly nearBoundary: number;
  /** Fraction of deals with competitive interference that tests convention robustness. */
  readonly competitive: number;
}

/** Construct a ScenarioDistribution from the 2 independent parameters.
 *  Enforces the sum-to-1.0 invariant and validates non-negative values. */
export function createScenarioDistribution(
  nearBoundary: number,
  competitive: number,
): ScenarioDistribution {
  if (nearBoundary < 0 || competitive < 0) {
    throw new Error(`ScenarioDistribution: parameters must be non-negative (got nearBoundary=${nearBoundary}, competitive=${competitive})`);
  }
  if (nearBoundary + competitive > 1.0 + 1e-10) {
    throw new Error(`ScenarioDistribution: nearBoundary + competitive must be <= 1.0 (got ${nearBoundary + competitive})`);
  }
  const positive = Math.max(0, 1.0 - nearBoundary - competitive);
  return { positive, nearBoundary, competitive };
}

const POSITIVE_ONLY: ScenarioDistribution = createScenarioDistribution(0, 0);

const TEACHING_DEFAULT: ScenarioDistribution = createScenarioDistribution(0.25, 0.15);

const BALANCED: ScenarioDistribution = createScenarioDistribution(0.25, 0.25);

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
  controls: TeachingControls,
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
