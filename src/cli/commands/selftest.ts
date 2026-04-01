// ── CLI selftest command ────────────────────────────────────────────
//
// Self-consistency check: for each seed, creates a session, gets the
// strategy's recommended bid via getExpectedBid(), submits it, and
// verifies it grades as correct. Requires a dev WASM build.

import type { DevServicePort } from "../../service";
import type { Call } from "../../engine/types";
import { callKey } from "../../engine/call-helpers";
import { ViewportBidGrade } from "../../service/response-types";
import type { SessionConfig } from "../../service/request-types";
import { PlayPreference } from "../../service/session-types";
import type { Flags } from "../shared";
import {
  requireArg, optionalNumericArg,
  parseBaseSystem, parseVulnerability, parseOpponentMode,
} from "../shared";

interface SeedResult {
  seed: number;
  status: "pass" | "fail" | "skip";
  steps: number;
  failStep?: number;
  expected?: string;
  grade?: string;
  details?: string;
}

export async function runSelftest(service: DevServicePort, flags: Flags): Promise<void> {
  const all = flags["all"] === true;
  const bundleId = all ? undefined : requireArg(flags, "bundle");
  const startSeed = optionalNumericArg(flags, "seed") ?? 42;
  const count = optionalNumericArg(flags, "count") ?? 20;
  const system = parseBaseSystem(flags);
  const vuln = parseVulnerability(flags);
  const opponents = parseOpponentMode(flags);

  // Determine bundles to test
  let bundleIds: string[];
  if (all) {
    const conventions = await service.listConventions();
    bundleIds = conventions.map((c) => c.id);
  } else {
    bundleIds = [bundleId!];
  }

  const allResults: Record<string, unknown>[] = [];

  for (const bid of bundleIds) {
    const results: SeedResult[] = [];
    let pass = 0;
    let fail = 0;
    let skip = 0;

    for (let i = 0; i < count; i++) {
      const seed = startSeed + i;
      const result = await runSingleSeed(service, bid, seed, system, vuln, opponents);
      results.push(result);
      if (result.status === "pass") pass++;
      else if (result.status === "fail") fail++;
      else skip++;
    }

    allResults.push({
      bundle: bid,
      system,
      seedRange: [startSeed, startSeed + count - 1],
      pass,
      fail,
      skip,
      results,
    });
  }

  if (allResults.length === 1) {
    console.log(JSON.stringify(allResults[0], null, 2));
  } else {
    console.log(JSON.stringify(allResults, null, 2));
  }

  const anyFail = allResults.some((r) => (r.fail as number) > 0);
  process.exit(anyFail ? 1 : 0);
}

async function runSingleSeed(
  service: DevServicePort,
  bundleId: string,
  seed: number,
  system: string,
  vuln: unknown,
  opponents: unknown,
): Promise<SeedResult> {
  const config: SessionConfig = {
    conventionId: bundleId,
    seed,
    baseSystemId: system,
    vulnerability: vuln as SessionConfig["vulnerability"],
    opponentMode: opponents as SessionConfig["opponentMode"],
    playPreference: PlayPreference.Skip,
  };

  const handle = await service.createSession(config);
  const drill = await service.startDrill(handle);

  if (drill.auctionComplete) {
    return { seed, status: "pass", steps: 0 };
  }

  let steps = 0;

  // Loop until auction completes
  for (;;) {
    steps++;

    // Get expected bid from strategy.
    // DevServicePort declares { call: Call } | null, but the WASM binding
    // returns Call | null directly. Handle both shapes.
    const raw = await service.getExpectedBid(handle);
    if (!raw) {
      // getExpectedBid returns null in release builds or when no recommendation
      return {
        seed,
        status: "skip",
        steps,
        details: "getExpectedBid returned null (no strategy recommendation, or release build)",
      };
    }

    // Normalize: if the result has a `call` property, unwrap it; otherwise it IS the call.
    // JSON round-trip to strip WASM proxy — raw WASM objects can't be passed back directly.
    const unwrapped = "call" in raw && raw.call ? raw.call : raw;
    const expectedCall = JSON.parse(JSON.stringify(unwrapped)) as { type: string; level?: number; strain?: string };

    const result = await service.submitBid(handle, expectedCall as Call);

    if (!result.accepted) {
      return {
        seed,
        status: "fail",
        steps,
        failStep: steps,
        expected: callKey(expectedCall as Call),
        grade: "rejected",
        details: "Strategy's recommended bid was not accepted (not legal)",
      };
    }

    const grade = result.grade;
    const isCorrect = grade === ViewportBidGrade.Correct || grade === ViewportBidGrade.Acceptable;

    if (!isCorrect) {
      return {
        seed,
        status: "fail",
        steps,
        failStep: steps,
        expected: callKey(expectedCall as Call),
        grade: grade ?? "null",
        details: "Strategy's recommended bid did not grade as correct",
      };
    }

    if (result.phaseTransition) {
      return { seed, status: "pass", steps };
    }
  }
}

