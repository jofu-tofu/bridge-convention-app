// ── CLI play command ────────────────────────────────────────────────

import type { Flags, OpponentMode, Vulnerability, Call } from "../shared";
import {
  callKey, parsePatternCall,
  requireArg, optionalNumericArg,
  resolveSpec, resolveBundle,
} from "../shared";
import {
  buildAtomCallMap,
  runSinglePlaythrough,
  buildStepViewport,
  gradePlaythroughStep,
} from "../playthrough";

export function runPlay(flags: Flags, vuln: Vulnerability, opponentMode: OpponentMode): void {
  const bundleId = requireArg(flags, "bundle");
  const seed = optionalNumericArg(flags, "seed") ?? 42;
  const stepIdx = optionalNumericArg(flags, "step");
  const bidStr = flags["bid"] as string | undefined;
  const reveal = flags["reveal"] === true;

  const spec = resolveSpec(bundleId);
  const bundle = resolveBundle(bundleId);
  const atomCallMap = buildAtomCallMap(spec);

  const result = runSinglePlaythrough(bundle, spec, seed, atomCallMap, vuln, opponentMode);
  const userSteps = result.steps.filter((s) => s.isUserStep);

  if (reveal) {
    // Full trace with all recommendations and atom IDs
    console.log(JSON.stringify({
      seed,
      totalSteps: userSteps.length,
      steps: result.steps,
      atomsCovered: result.atomsCovered,
    }, null, 2));
    return;
  }

  if (stepIdx === undefined) {
    // No step: return totalSteps + first viewport
    console.log(JSON.stringify({
      seed,
      totalSteps: userSteps.length,
      step: userSteps.length > 0 ? buildStepViewport(userSteps[0]!) : null,
    }, null, 2));
    return;
  }

  if (stepIdx < 0 || stepIdx >= userSteps.length) {
    console.error(`Step ${stepIdx} out of range (0-${userSteps.length - 1})`);
    process.exit(2);
  }

  const s = userSteps[stepIdx]!;
  const viewport = buildStepViewport(s);

  if (!bidStr || bidStr === "true") {
    // No bid: viewport only for this step
    console.log(JSON.stringify({
      seed,
      totalSteps: userSteps.length,
      step: viewport,
    }, null, 2));
    return;
  }

  // Bid submitted: grade + next viewport
  let submittedCall: Call;
  try {
    submittedCall = parsePatternCall(bidStr);
  } catch {
    console.error(`Invalid bid: "${bidStr}"`);
    process.exit(2);
  }

  const { viewportFeedback, teachingDetail, isCorrect, isAcceptable } =
    gradePlaythroughStep(s, submittedCall, spec, bundle, seed, vuln);

  const nextStepIdx = stepIdx + 1;
  const nextStep = nextStepIdx < userSteps.length
    ? buildStepViewport(userSteps[nextStepIdx]!)
    : null;

  console.log(JSON.stringify({
    seed,
    totalSteps: userSteps.length,
    step: viewport,
    yourBid: callKey(submittedCall),
    grade: viewportFeedback.grade,
    correct: isCorrect,
    acceptable: isAcceptable,
    feedback: viewportFeedback,
    teaching: teachingDetail,
    nextStep,
    complete: nextStep === null,
  }, null, 2));

  process.exit(isCorrect || isAcceptable ? 0 : 1);
}
