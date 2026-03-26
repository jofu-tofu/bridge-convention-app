/**
 * Pure replay cursor logic for review-phase card-by-card stepping.
 *
 * ExplanationPhase owns `replayStep` state; all other components
 * (PlayHistoryPanel, TrickOverlay, TrickReviewPanel) derive from it.
 */

import type { Trick, PlayRecommendation, Seat } from "../../service";

/** Position within the trick sequence. playIndex -1 = before first play of that trick. */
export interface ReplayPosition {
  readonly trickIndex: number;
  readonly playIndex: number;
}

/** Visible trick/play counts for progressive-reveal props. */
export interface ReplayVisibility {
  readonly visibleTrickCount: number;
  readonly partialTrickPlays: number;
}

/** Total number of steps: 0 (nothing shown) through sum-of-all-plays (everything shown). */
export function totalSteps(tricks: readonly Trick[]): number {
  let count = 0;
  for (const trick of tricks) {
    count += trick.plays.length;
  }
  // +1 for step 0 (nothing shown)
  return count + 1;
}

/** Convert a linear step number to a trick/play position. */
export function positionAtStep(step: number, tricks: readonly Trick[]): ReplayPosition {
  if (step <= 0 || tricks.length === 0) {
    return { trickIndex: 0, playIndex: -1 };
  }

  let remaining = step;
  for (let t = 0; t < tricks.length; t++) {
    const playCount = tricks[t]!.plays.length;
    if (remaining <= playCount) {
      return { trickIndex: t, playIndex: remaining - 1 };
    }
    remaining -= playCount;
  }

  // Past the end — clamp to last play
  const lastTrick = tricks[tricks.length - 1]!;
  return { trickIndex: tricks.length - 1, playIndex: lastTrick.plays.length - 1 };
}

/** Convert a trick/play position back to a linear step number. */
export function stepAtPosition(pos: ReplayPosition, tricks: readonly Trick[]): number {
  if (tricks.length === 0) return 0;

  let step = 0;
  for (let t = 0; t < pos.trickIndex && t < tricks.length; t++) {
    step += tricks[t]!.plays.length;
  }
  // playIndex -1 means "at the start of this trick" = step before first play
  step += pos.playIndex + 1;
  return Math.max(0, step);
}

/** Derive progressive-reveal props from a replay position. */
export function visibleTricksAtPosition(pos: ReplayPosition): ReplayVisibility {
  if (pos.playIndex === -1 && pos.trickIndex === 0) {
    return { visibleTrickCount: 0, partialTrickPlays: 0 };
  }
  return {
    visibleTrickCount: pos.trickIndex + 1,
    partialTrickPlays: pos.playIndex + 1,
  };
}

/** Check if the current position is a decision point (user's suboptimal play). */
export function isDecisionPoint(
  pos: ReplayPosition,
  recs: readonly PlayRecommendation[],
  userSeat: Seat,
): PlayRecommendation | null {
  if (pos.playIndex < 0) return null;
  for (const rec of recs) {
    if (
      rec.trickIndex === pos.trickIndex &&
      rec.playIndex === pos.playIndex &&
      rec.seat === userSeat &&
      !rec.isOptimal
    ) {
      return rec;
    }
  }
  return null;
}

/** Find the next step with a suboptimal user play, or null if none. */
export function findNextDecision(
  currentStep: number,
  tricks: readonly Trick[],
  recs: readonly PlayRecommendation[],
  userSeat: Seat,
): number | null {
  const max = totalSteps(tricks);
  for (let s = currentStep + 1; s < max; s++) {
    const pos = positionAtStep(s, tricks);
    if (isDecisionPoint(pos, recs, userSeat)) {
      return s;
    }
  }
  return null;
}
