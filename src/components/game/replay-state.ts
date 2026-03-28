/**
 * Pure replay cursor logic for review-phase card-by-card stepping.
 *
 * ExplanationPhase owns `replayStep` state; all other components
 * (PlayHistoryPanel, TrickOverlay, TrickReviewPanel) derive from it.
 */

import type { Trick, PlayRecommendation, Seat, Card, Hand } from "../../service";

/** Position within the trick sequence. playIndex -1 = before first play of that trick. */
interface ReplayPosition {
  readonly trickIndex: number;
  readonly playIndex: number;
}

/** Visible trick/play counts for progressive-reveal props. */
interface ReplayVisibility {
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

/**
 * Compute remaining cards per seat at a given replay position.
 * Cards played in completed tricks (before trickIndex) and partial plays
 * in the current trick (up to playIndex) are removed from each hand.
 * Returns undefined when replay is at step 0 (no cards played yet),
 * so BridgeTable falls through to visibleHands.
 */
export function remainingCardsAtPosition(
  pos: ReplayPosition,
  tricks: readonly Trick[],
  allHands: Record<Seat, Hand>,
): Partial<Record<Seat, readonly Card[]>> | undefined {
  if (pos.trickIndex === 0 && pos.playIndex === -1) return undefined;

  const played = new Map<Seat, Set<string>>();
  for (const seat of Object.keys(allHands) as Seat[]) {
    played.set(seat, new Set());
  }

  for (let t = 0; t < tricks.length && t <= pos.trickIndex; t++) {
    const trick = tricks[t]!;
    const maxPlay = t < pos.trickIndex ? trick.plays.length : pos.playIndex + 1;
    for (let p = 0; p < maxPlay; p++) {
      const play = trick.plays[p]!;
      played.get(play.seat)?.add(`${play.card.suit}${play.card.rank}`);
    }
  }

  const result: Partial<Record<Seat, readonly Card[]>> = {};
  for (const [seat, hand] of Object.entries(allHands) as [Seat, Hand][]) {
    const seatPlayed = played.get(seat)!;
    result[seat] = hand.cards.filter(c => !seatPlayed.has(`${c.suit}${c.rank}`));
  }
  return result;
}
