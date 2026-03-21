// ── Verify subcommand dispatcher ────────────────────────────────────
//
// All verification commands under the `verify` namespace.
// Usage: main.ts verify <subcommand> [options]

import type { Flags } from "../shared";
import { requireArg, optionalNumericArg, resolveSystemWithRules } from "../shared";
import { lintModule } from "./lint";
import { analyzeBundle } from "./interfere";
import { exploreBundle } from "./explore";
import { motifTest } from "./motif";
import { fuzzBundle } from "./fuzz";
import { runPreflight } from "./preflight";
import type { LintOutput, InterfereOutput } from "./types";

export function runVerify(subcommand: string, flags: Flags): void {
  switch (subcommand) {
    case "lint":
      return runVerifyLint(flags);
    case "interfere":
      return runVerifyInterfere(flags);
    case "explore":
      return runVerifyExplore(flags);
    case "motif":
      return runVerifyMotif(flags);
    case "fuzz":
      return runVerifyFuzz(flags);
    case "preflight":
      return runVerifyPreflight(flags);
    default:
      console.error(`Unknown verify subcommand: "${subcommand}"`);
      console.error("Available: lint, interfere, explore, motif, fuzz, preflight");
      process.exit(2);
  }
}

function runVerifyLint(flags: Flags): void {
  const bundleId = requireArg(flags, "bundle");
  const system = resolveSystemWithRules(bundleId);
  const modules = system.ruleModules ?? [];
  const moduleFilter = flags["module"] as string | undefined;
  const severityFilter = flags["severity"] as string | undefined;

  if (modules.length === 0) {
    console.error(`Bundle "${bundleId}" has no rule modules`);
    process.exit(2);
  }

  const targetModules = moduleFilter
    ? modules.filter((m) => m.id === moduleFilter)
    : modules;

  const output: LintOutput = {
    command: "verify lint",
    bundle: bundleId,
    modules: targetModules.map((mod) => {
      let diagnostics = lintModule(mod);
      if (severityFilter && severityFilter !== "all") {
        diagnostics = diagnostics.filter((d) => d.severity === severityFilter);
      }
      return {
        moduleId: mod.id,
        diagnostics,
        summary: {
          errors: diagnostics.filter((d) => d.severity === "error").length,
          warnings: diagnostics.filter((d) => d.severity === "warn").length,
        },
      };
    }),
    summary: {
      totalModules: targetModules.length,
      totalErrors: 0,
      totalWarnings: 0,
      clean: true,
    },
  };

  // Compute totals
  let totalErrors = 0;
  let totalWarnings = 0;
  for (const m of output.modules) {
    totalErrors += m.summary.errors;
    totalWarnings += m.summary.warnings;
  }

  // Rebuild summary with correct totals (readonly workaround)
  const finalOutput: LintOutput = {
    ...output,
    summary: {
      totalModules: targetModules.length,
      totalErrors,
      totalWarnings,
      clean: totalErrors === 0,
    },
  };

  console.log(JSON.stringify(finalOutput, null, 2));
  process.exit(totalErrors > 0 ? 1 : 0);
}

function runVerifyInterfere(flags: Flags): void {
  const bundleId = requireArg(flags, "bundle");
  const system = resolveSystemWithRules(bundleId);
  const modules = system.ruleModules ?? [];
  const pairFilter = flags["pair"] as string | undefined;
  const kindFilter = flags["kind"] as string | undefined;

  if (modules.length === 0) {
    console.error(`Bundle "${bundleId}" has no rule modules`);
    process.exit(2);
  }

  let interactions = analyzeBundle(modules);

  if (pairFilter) {
    const [a, b] = pairFilter.split(",");
    interactions = interactions.filter(
      (p) => (p.moduleA === a && p.moduleB === b) || (p.moduleA === b && p.moduleB === a),
    );
  }

  if (kindFilter && kindFilter !== "all") {
    interactions = interactions.map((p) => ({
      ...p,
      edges: p.edges.filter((e) => e.kind === kindFilter),
    }));
  }

  const highRisk = interactions.filter((p) => p.riskLevel === "high").length;
  const mediumRisk = interactions.filter((p) => p.riskLevel === "medium").length;
  const lowRisk = interactions.filter((p) => p.riskLevel === "low").length;
  const none = interactions.filter((p) => p.riskLevel === "none").length;
  const flaggedPairs = interactions
    .filter((p) => p.riskLevel === "high" || p.riskLevel === "medium")
    .map((p) => `${p.moduleA}:${p.moduleB}`);

  const output: InterfereOutput = {
    command: "verify interfere",
    bundle: bundleId,
    interactions,
    summary: { highRisk, mediumRisk, lowRisk, none, flaggedPairs },
  };

  console.log(JSON.stringify(output, null, 2));
}

function runVerifyExplore(flags: Flags): void {
  const bundleId = requireArg(flags, "bundle");
  const system = resolveSystemWithRules(bundleId);
  const modules = system.ruleModules ?? [];
  const depth = optionalNumericArg(flags, "depth") ?? 6;
  const seed = optionalNumericArg(flags, "seed") ?? 42;
  const trials = optionalNumericArg(flags, "trials") ?? 50;
  const invariantFilter = flags["invariant"] as string | undefined;

  if (modules.length === 0) {
    console.error(`Bundle "${bundleId}" has no rule modules`);
    process.exit(2);
  }

  const result = exploreBundle(system, modules, {
    depth,
    seed,
    trials,
    invariants: invariantFilter ? [invariantFilter] : undefined,
  });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.violations.length > 0 ? 1 : 0);
}

function runVerifyMotif(flags: Flags): void {
  const bundleId = requireArg(flags, "bundle");
  const pairStr = requireArg(flags, "pair");
  const system = resolveSystemWithRules(bundleId);
  const modules = system.ruleModules ?? [];
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

  const result = motifTest(system, modules, { depth, seed, trials, pair: [a, b] });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.verdict === "failing" ? 1 : 0);
}

function runVerifyFuzz(flags: Flags): void {
  const bundleId = requireArg(flags, "bundle");
  const system = resolveSystemWithRules(bundleId);
  const modules = system.ruleModules ?? [];
  const trials = optionalNumericArg(flags, "trials") ?? 200;
  const seed = optionalNumericArg(flags, "seed") ?? 0;
  const vulnMixed = flags["vuln"] === "mixed";

  if (modules.length === 0) {
    console.error(`Bundle "${bundleId}" has no rule modules`);
    process.exit(2);
  }

  const result = fuzzBundle(system, modules, { trials, seed, vulnMixed });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.summary.clean ? 0 : 1);
}

function runVerifyPreflight(flags: Flags): void {
  const bundleId = requireArg(flags, "bundle");
  const system = resolveSystemWithRules(bundleId);
  const modules = system.ruleModules ?? [];
  const budgetStr = (flags["budget"] as string) ?? "fast";

  if (modules.length === 0) {
    console.error(`Bundle "${bundleId}" has no rule modules`);
    process.exit(2);
  }

  if (budgetStr !== "fast" && budgetStr !== "full") {
    console.error(`Invalid --budget value: "${budgetStr}" (expected: fast, full)`);
    process.exit(2);
  }

  const result = runPreflight(system, modules, { budget: budgetStr });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.verdict === "pass" ? 0 : 1);
}
