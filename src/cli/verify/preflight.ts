// ── Preflight certification ──────────────────────────────────────────
//
// Orchestrates all verification stages in sequence:
// lint → interfere → explore → motif (if needed) → fuzz

import type { RuleModule } from "../../conventions/core/rule-module";
import type { BiddingSystem } from "../../conventions/definitions/bidding-system";

import { lintModule } from "./lint";
import { analyzeBundle } from "./interfere";
import { exploreBundle } from "./explore";
import { motifTest } from "./motif";
import { fuzzBundle } from "./fuzz";
import type { PreflightOutput } from "./types";
import { ALL_INVARIANTS } from "./invariants";

export type PreflightBudget = "fast" | "full";

interface PreflightConfig {
  readonly budget: PreflightBudget;
}

const BUDGET_PARAMS = {
  fast: { exploreTrials: 20, fuzzTrials: 50, motifTrials: 50 },
  full: { exploreTrials: 100, fuzzTrials: 200, motifTrials: 100 },
} as const;

/**
 * Run preflight certification on a bundle.
 *
 * Orchestrates: lint → interfere → explore → motif (if flagged) → fuzz.
 * Returns structured output with per-stage results and overall verdict.
 */
export function runPreflight(
  system: BiddingSystem,
  modules: readonly RuleModule[],
  config: PreflightConfig,
): PreflightOutput {
  const start = Date.now();
  const params = BUDGET_PARAMS[config.budget];

  // Stage 1: Lint
  let lintErrors = 0;
  let lintWarnings = 0;
  for (const mod of modules) {
    const diagnostics = lintModule(mod);
    lintErrors += diagnostics.filter((d) => d.severity === "error").length;
    lintWarnings += diagnostics.filter((d) => d.severity === "warn").length;
  }

  // Stage 2: Interference analysis
  const interactions = analyzeBundle(modules);
  const highRisk = interactions.filter((p) => p.riskLevel === "high").length;
  const mediumRisk = interactions.filter((p) => p.riskLevel === "medium").length;
  const flaggedPairs = interactions
    .filter((p) => p.riskLevel === "high" || p.riskLevel === "medium")
    .map((p) => `${p.moduleA}:${p.moduleB}`);

  // Stage 3: Explore
  const exploreResult = exploreBundle(system, modules, {
    depth: 6,
    seed: 42,
    trials: params.exploreTrials,
  });

  // Stage 4: Motif (only for full budget + flagged pairs)
  let motifStage: { pairsChecked: number; failing: number } | undefined;
  if (config.budget === "full" && flaggedPairs.length > 0) {
    let failing = 0;
    for (const pair of flaggedPairs) {
      const [a, b] = pair.split(":");
      if (a && b) {
        const motifResult = motifTest(system, modules, {
          depth: 8,
          seed: 42,
          trials: params.motifTrials,
          pair: [a, b],
        });
        if (motifResult.verdict === "failing") failing++;
      }
    }
    motifStage = { pairsChecked: flaggedPairs.length, failing };
  }

  // Stage 5: Fuzz
  const fuzzResult = fuzzBundle(system, modules, {
    trials: params.fuzzTrials,
    seed: 0,
    vulnMixed: true,
  });

  // Determine verdict — only error-severity invariant violations cause failure
  const errorInvariants = ALL_INVARIANTS.filter((inv) => inv.severity === "error");
  const errorInvariantIds = new Set(errorInvariants.map((inv) => inv.id));
  const exploreErrors = exploreResult.violations.filter((v) => errorInvariantIds.has(v.invariant));
  const fuzzErrors = fuzzResult.violations.filter((v) => errorInvariantIds.has(v.invariant));

  const hasFail =
    lintErrors > 0 ||
    exploreErrors.length > 0 ||
    fuzzResult.crashes.length > 0 ||
    fuzzErrors.length > 0;

  return {
    command: "verify preflight",
    bundle: system.id,
    budget: config.budget,
    stages: {
      lint: { clean: lintErrors === 0, errors: lintErrors, warnings: lintWarnings },
      interfere: { highRisk, mediumRisk, flaggedPairs },
      explore: {
        clean: exploreResult.violations.length === 0,
        violations: exploreResult.violations.length,
        trialsRun: params.exploreTrials,
      },
      ...(motifStage ? { motif: motifStage } : {}),
      fuzz: {
        clean: fuzzResult.crashes.length === 0 && fuzzResult.violations.length === 0,
        crashes: fuzzResult.crashes.length,
        trialsRun: params.fuzzTrials,
      },
    },
    verdict: hasFail ? "fail" : "pass",
    duration_ms: Date.now() - start,
  };
}
