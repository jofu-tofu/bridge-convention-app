// ── Verify subcommand dispatcher ────────────────────────────────────
//
// All verification commands under the `verify` namespace.
// Usage: main.ts verify <subcommand> [options]

import type { Flags, BaseSystemId } from "../shared";
import { requireArg, optionalNumericArg, resolveBundleWithRules, parseBaseSystem } from "../shared";
import { exploreBundle } from "./explore";
import { motifTest } from "./motif";
import { fuzzBundle } from "./fuzz";
import { runPreflight } from "./preflight";

export function runVerify(subcommand: string, flags: Flags): void {
  const baseSystem = parseBaseSystem(flags);
  switch (subcommand) {
    case "explore":
      return runVerifyExplore(flags, baseSystem);
    case "motif":
      return runVerifyMotif(flags, baseSystem);
    case "fuzz":
      return runVerifyFuzz(flags, baseSystem);
    case "preflight":
      return runVerifyPreflight(flags, baseSystem);
    default:
      console.error(`Unknown verify subcommand: "${subcommand}"`);
      console.error("Available: explore, motif, fuzz, preflight");
      process.exit(2);
  }
}

function runVerifyExplore(flags: Flags, baseSystem: BaseSystemId): void {
  const bundleId = requireArg(flags, "bundle");
  const bundle = resolveBundleWithRules(bundleId, baseSystem);
  const modules = bundle.ruleModules ?? [];
  const depth = optionalNumericArg(flags, "depth") ?? 6;
  const seed = optionalNumericArg(flags, "seed") ?? 42;
  const trials = optionalNumericArg(flags, "trials") ?? 50;
  const invariantFilter = flags["invariant"] as string | undefined;

  if (modules.length === 0) {
    console.error(`Bundle "${bundleId}" has no rule modules`);
    process.exit(2);
  }

  const result = exploreBundle(bundle, modules, {
    depth,
    seed,
    trials,
    invariants: invariantFilter ? [invariantFilter] : undefined,
    baseSystem,
  });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.violations.length > 0 ? 1 : 0);
}

function runVerifyMotif(flags: Flags, baseSystem: BaseSystemId): void {
  const bundleId = requireArg(flags, "bundle");
  const pairStr = requireArg(flags, "pair");
  const bundle = resolveBundleWithRules(bundleId, baseSystem);
  const modules = bundle.ruleModules ?? [];
  const depth = optionalNumericArg(flags, "depth") ?? 8;
  const seed = optionalNumericArg(flags, "seed") ?? 42;
  const trials = optionalNumericArg(flags, "trials") ?? 100;

  if (modules.length === 0) {
    console.error(`Bundle "${bundleId}" has no rule modules`);
    process.exit(2);
  }

  const [a, b] = pairStr.split(",");
  if (!a || !b) {
    console.error("--pair must be two module IDs separated by comma (e.g., --pair=modA,modB)");
    process.exit(2);
  }

  const result = motifTest(bundle, modules, { depth, seed, trials, pair: [a, b], baseSystem });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.verdict === "failing" ? 1 : 0);
}

function runVerifyFuzz(flags: Flags, baseSystem: BaseSystemId): void {
  const bundleId = requireArg(flags, "bundle");
  const bundle = resolveBundleWithRules(bundleId, baseSystem);
  const modules = bundle.ruleModules ?? [];
  const trials = optionalNumericArg(flags, "trials") ?? 200;
  const seed = optionalNumericArg(flags, "seed") ?? 0;
  const vulnMixed = flags["vuln"] === "mixed";

  if (modules.length === 0) {
    console.error(`Bundle "${bundleId}" has no rule modules`);
    process.exit(2);
  }

  const result = fuzzBundle(bundle, modules, { trials, seed, vulnMixed, baseSystem });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.summary.clean ? 0 : 1);
}

function runVerifyPreflight(flags: Flags, baseSystem: BaseSystemId): void {
  const bundleId = requireArg(flags, "bundle");
  const bundle = resolveBundleWithRules(bundleId, baseSystem);
  const modules = bundle.ruleModules ?? [];
  const budgetStr = (flags["budget"] as string) ?? "fast";

  if (modules.length === 0) {
    console.error(`Bundle "${bundleId}" has no rule modules`);
    process.exit(2);
  }

  if (budgetStr !== "fast" && budgetStr !== "full") {
    console.error(`Invalid --budget value: "${budgetStr}" (expected: fast, full)`);
    process.exit(2);
  }

  const result = runPreflight(bundle, modules, { budget: budgetStr, baseSystem });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.verdict === "pass" ? 0 : 1);
}
