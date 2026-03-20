// ── CLI eval command ────────────────────────────────────────────────
//
// Per-atom evaluation. Imports ONLY from the evaluation facade —
// no direct strategy, teaching, or convention internals.

import {
  buildAtomViewport,
  gradeAtomBid,
  validateAtomId,
  parseAtomId,
} from "../../evaluation";
import type { Flags ,
  Vulnerability} from "../shared";
import {
  requireArg, optionalNumericArg,
} from "../shared";

export function runEval(flags: Flags, vuln: Vulnerability): void {
  const bundleId = requireArg(flags, "bundle");
  const atomId = requireArg(flags, "atom");
  const seed = optionalNumericArg(flags, "seed") ?? 42;
  const bidStr = flags["bid"] as string | undefined;

  // Validate inputs
  try {
    parseAtomId(atomId);
  } catch {
    console.error(`Invalid atom ID: "${atomId}" (expected stateId/surfaceId/meaningId)`);
    process.exit(2);
  }

  try {
    validateAtomId(bundleId, atomId);
  } catch {
    console.error(`Unknown atom: "${atomId}"`);
    console.error("Use 'list --bundle=<id>' to see valid atom IDs.");
    process.exit(2);
  }

  if (!bidStr || bidStr === "true") {
    // No bid: return viewport only
    const viewport = buildAtomViewport(bundleId, atomId, seed, vuln);
    console.log(JSON.stringify(viewport, null, 2));
    return;
  }

  // Bid submitted: grade with full teaching feedback
  let result;
  try {
    result = gradeAtomBid(bundleId, atomId, seed, bidStr, vuln);
  } catch {
    console.error(`Invalid bid: "${bidStr}"`);
    process.exit(2);
  }

  if (result.skip) {
    console.log(JSON.stringify({
      viewport: result.viewport,
      grade: "skip",
      correct: false,
      skip: true,
      feedback: null,
      teaching: null,
    }, null, 2));
    process.exit(0);
    return;
  }

  console.log(JSON.stringify({
    viewport: result.viewport,
    yourBid: result.yourBid,
    correctBid: result.correctBid,
    grade: result.grade,
    correct: result.correct,
    acceptable: result.acceptable,
    skip: false,
    feedback: result.feedback,
    teaching: result.teaching,
  }, null, 2));
  process.exit(result.correct || result.acceptable ? 0 : 1);
}
