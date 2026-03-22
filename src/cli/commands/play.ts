// ── CLI play command ────────────────────────────────────────────────
//
// Playthrough evaluation. Imports ONLY from the evaluation facade —
// no direct strategy, teaching, or convention internals.

import {
  startPlaythrough,
  getPlaythroughStepViewport,
  gradePlaythroughBid,
  getPlaythroughRevealSteps,
} from "../../service";
import type { Flags, OpponentMode ,
  Vulnerability, BaseSystemId} from "../shared";
import {
  requireArg, optionalNumericArg,
} from "../shared";

export function runPlay(flags: Flags, vuln: Vulnerability, opponentMode: OpponentMode, baseSystem: BaseSystemId): void {
  const bundleId = requireArg(flags, "bundle");
  const seed = optionalNumericArg(flags, "seed") ?? 42;
  const stepIdx = optionalNumericArg(flags, "step");
  const bidStr = flags["bid"] as string | undefined;
  const reveal = flags["reveal"] === true;

  if (reveal) {
    const { totalSteps, steps, atomsCovered } = getPlaythroughRevealSteps(bundleId, seed, vuln, opponentMode, baseSystem);
    console.log(JSON.stringify({ seed, totalSteps, steps, atomsCovered }, null, 2));
    return;
  }

  if (stepIdx === undefined) {
    const { handle, firstStep } = startPlaythrough(bundleId, seed, vuln, opponentMode, baseSystem);
    console.log(JSON.stringify({
      seed,
      totalSteps: handle.totalUserSteps,
      step: firstStep,
    }, null, 2));
    return;
  }

  if (!bidStr || bidStr === "true") {
    const viewport = getPlaythroughStepViewport(bundleId, seed, stepIdx, vuln, opponentMode, baseSystem);
    const { handle } = startPlaythrough(bundleId, seed, vuln, opponentMode, baseSystem);
    console.log(JSON.stringify({
      seed,
      totalSteps: handle.totalUserSteps,
      step: viewport,
    }, null, 2));
    return;
  }

  // Bid submitted: grade + next viewport
  let result;
  try {
    result = gradePlaythroughBid(bundleId, seed, stepIdx, bidStr, vuln, opponentMode, baseSystem);
  } catch {
    console.error(`Invalid bid: "${bidStr}"`);
    process.exit(2);
  }

  const { handle } = startPlaythrough(bundleId, seed, vuln, opponentMode, baseSystem);

  console.log(JSON.stringify({
    seed,
    totalSteps: handle.totalUserSteps,
    step: result.step,
    yourBid: result.yourBid,
    grade: result.grade,
    correct: result.correct,
    acceptable: result.acceptable,
    feedback: result.feedback,
    teaching: result.teaching,
    nextStep: result.nextStep,
    complete: result.complete,
  }, null, 2));

  process.exit(result.correct || result.acceptable ? 0 : 1);
}
