// ── CLI dealtest command ────────────────────────────────────────────
//
// Deal-generation smoke test: for each bundle × seed, creates a drill
// session and reports whether deal generation succeeds or exhausts.
// Does NOT require dev WASM — only calls createDrillSession + startDrill.

import type { DevServicePort, SessionConfig } from "../../service";
import { PlayPreference, getSystemConfig, DEFAULT_BASE_MODULE_IDS } from "../../service";
import type { Flags } from "../shared";
import {
  optionalNumericArg,
  parseBaseSystem, parseVulnerability, parseOpponentMode,
  printJson,
} from "../shared";

interface BundleDealResult {
  bundle: string;
  seeds: number;
  pass: number;
  fail: number;
  failedSeeds: number[];
  failReasons: string[];
}

export async function runDealtest(service: DevServicePort, flags: Flags): Promise<void> {
  const startSeed = optionalNumericArg(flags, "seed") ?? 1;
  const count = optionalNumericArg(flags, "count") ?? 10;
  const system = parseBaseSystem(flags);
  const vuln = parseVulnerability(flags);
  const opponents = parseOpponentMode(flags);
  const singleBundle = typeof flags["bundle"] === "string" ? flags["bundle"] : undefined;

  // Discover bundles
  const conventions = await service.listConventions();
  const bundleIds = singleBundle
    ? [singleBundle]
    : conventions.map((c) => c.id);

  const results: BundleDealResult[] = [];
  let totalFail = 0;

  for (const bundleId of bundleIds) {
    const result: BundleDealResult = {
      bundle: bundleId,
      seeds: count,
      pass: 0,
      fail: 0,
      failedSeeds: [],
      failReasons: [],
    };

    for (let i = 0; i < count; i++) {
      const seed = startSeed + i;
      try {
        const config: SessionConfig = {
          conventionId: bundleId,
          seed,
          systemConfig: getSystemConfig(system),
          baseModuleIds: [...DEFAULT_BASE_MODULE_IDS],
          vulnerability: vuln as SessionConfig["vulnerability"],
          opponentMode: opponents as SessionConfig["opponentMode"],
          playPreference: PlayPreference.Skip,
        };
        const handle = await service.createDrillSession(config);
        await service.startDrill(handle);
        result.pass++;
      } catch (err: unknown) {
        result.fail++;
        result.failedSeeds.push(seed);
        const msg = err instanceof Error ? err.message : String(err);
        if (!result.failReasons.includes(msg)) {
          result.failReasons.push(msg);
        }
      }
    }

    totalFail += result.fail;
    results.push(result);
  }

  // Summary output
  const summary = results.map((r) => ({
    bundle: r.bundle,
    pass: r.pass,
    fail: r.fail,
    ...(r.fail > 0 ? { failedSeeds: r.failedSeeds, reasons: r.failReasons } : {}),
  }));

  printJson({
    system,
    seedRange: [startSeed, startSeed + count - 1],
    totalBundles: bundleIds.length,
    totalFail,
    bundles: summary,
  });

  process.exit(totalFail > 0 ? 1 : 0);
}
