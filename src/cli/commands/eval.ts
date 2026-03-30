// ── CLI eval command ────────────────────────────────────────────────
//
// Per-atom evaluation. Routes through ServicePort so the same WASM
// boundary applies to CLI and UI.

import type { DevServicePort } from "../../service";
import type { Flags ,
  Vulnerability, BaseSystemId} from "../shared";
import {
  requireArg, optionalNumericArg,
} from "../shared";

/** Parse an atom ID into components (moduleId/meaningId). */
function parseAtomId(atomId: string): { moduleId: string; meaningId: string } {
  const slashIdx = atomId.indexOf("/");
  if (slashIdx < 0) throw new Error(`Invalid atom ID: "${atomId}"`);
  return { moduleId: atomId.slice(0, slashIdx), meaningId: atomId.slice(slashIdx + 1) };
}

export async function runEval(service: DevServicePort, flags: Flags, vuln: Vulnerability, baseSystem: BaseSystemId): Promise<void> {
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

  // Atom validation is now done server-side by WasmService.evaluateAtom/gradeAtom

  if (!bidStr || bidStr === "true") {
    // No bid: return viewport only
    const viewport = await service.evaluateAtom(bundleId, atomId, seed, vuln, baseSystem);
    console.log(JSON.stringify(viewport, null, 2));
    return;
  }

  // Bid submitted: grade with full teaching feedback
  let result;
  try {
    result = await service.gradeAtom(bundleId, atomId, seed, bidStr, vuln, baseSystem);
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
