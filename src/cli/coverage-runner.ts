#!/usr/bin/env -S npx tsx
// ── Coverage Runner ─────────────────────────────────────────────────
//
// Headless self-test runner for convention coverage.
// Runs the evaluation pipeline without a browser, DOM, or Svelte.
//
// Usage:
//   npx tsx src/cli/coverage-runner.ts --bundle=nt-bundle
//   npx tsx src/cli/coverage-runner.ts --all
//   npx tsx src/cli/coverage-runner.ts --bundle=nt-bundle --max-retries=3 --json --seed=42

// ── Side-effect import: populates bundle & convention registries ────
import "../conventions/index";

// ── Bundle & Coverage ───────────────────────────────────────────────
import { getBundle, listBundles } from "../conventions/core/bundle";
import type { ConventionBundle } from "../conventions/core/bundle";
import {
  generateOptimizedManifest,
} from "../conventions/core/runtime/coverage-spec-compiler";
import type {
  SurfaceCoverageTarget,
  OptimizedCoverageManifest,
} from "../conventions/core/runtime/coverage-spec-compiler";

// ── Strategy ────────────────────────────────────────────────────────
import { buildBundleStrategy } from "../bootstrap/config-factory";
import type { ConventionBiddingStrategy } from "../core/contracts/recommendation";

// ── Context & Evaluation ────────────────────────────────────────────
import { createBiddingContext } from "../conventions/core/context-factory";
import { evaluateHand } from "../engine/hand-evaluator";

// ── Deal Generation ─────────────────────────────────────────────────
import { generateDeal } from "../engine/deal-generator";

// ── Auction ─────────────────────────────────────────────────────────
import { buildAuction } from "../engine/auction-helpers";
import { getLegalCalls } from "../engine/auction";
import { nextSeat } from "../engine/constants";

// ── Types ───────────────────────────────────────────────────────────
import { Seat, Vulnerability } from "../engine/types";
import type { Auction, Call, Deal } from "../engine/types";
import type { BidResult } from "../core/contracts/bidding";

// ── Teaching Resolution ─────────────────────────────────────────────
import { resolveTeachingAnswer, BidGrade } from "../teaching/teaching-resolution";

// ── Viewport ────────────────────────────────────────────────────────
import {
  buildBiddingViewport,
  buildEvaluationOracle,
  gradeAgainstOracle,
  buildViewportFeedback,
} from "../core/viewport/build-viewport";
import type { BiddingViewport } from "../core/viewport/player-viewport";
import type { EvaluationOracle } from "../core/viewport/evaluation-oracle";

// ── Call Utilities ──────────────────────────────────────────────────
import { callsMatch } from "../engine/call-helpers";
import { formatCall } from "../core/display/format";

// ====================================================================
// CLI Argument Parsing
// ====================================================================

interface CliArgs {
  bundleIds: string[];
  all: boolean;
  maxRetries: number;
  json: boolean;
  seed: number | undefined;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    bundleIds: [],
    all: false,
    maxRetries: 3,
    json: false,
    seed: undefined,
  };

  for (const arg of args) {
    if (arg === "--all") {
      result.all = true;
    } else if (arg === "--json") {
      result.json = true;
    } else if (arg.startsWith("--bundle=")) {
      result.bundleIds.push(arg.slice("--bundle=".length));
    } else if (arg.startsWith("--max-retries=")) {
      result.maxRetries = parseInt(arg.slice("--max-retries=".length), 10);
    } else if (arg.startsWith("--seed=")) {
      result.seed = parseInt(arg.slice("--seed=".length), 10);
    } else {
      console.error(`Unknown argument: ${arg}`);
      console.error(
        "Usage: npx tsx src/cli/coverage-runner.ts --bundle=<id> [--all] [--max-retries=N] [--json] [--seed=N]",
      );
      process.exit(2);
    }
  }

  if (!result.all && result.bundleIds.length === 0) {
    console.error("Error: specify --bundle=<id> or --all");
    console.error(
      "Usage: npx tsx src/cli/coverage-runner.ts --bundle=<id> [--all] [--max-retries=N] [--json] [--seed=N]",
    );
    process.exit(2);
  }

  return result;
}

// ====================================================================
// Seedable PRNG (xoshiro128** — compact, high quality)
// ====================================================================

function createSeededRng(seed: number): () => number {
  let s0 = seed | 0;
  let s1 = (seed * 1_812_433_253 + 1) | 0;
  let s2 = (s1 * 1_812_433_253 + 1) | 0;
  let s3 = (s2 * 1_812_433_253 + 1) | 0;

  return () => {
    const result = Math.imul(s1 * 5, 7) >>> 0;
    const t = s1 << 9;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = (s3 << 11) | (s3 >>> 21);
    return (result >>> 0) / 4_294_967_296;
  };
}

// ====================================================================
// Target Result Types
// ====================================================================

interface TargetResult {
  stateId: string;
  surfaceId: string | undefined;
  surfaceLabel: string | undefined;
  result: "pass" | "fail" | "skip";
  attempts: number;
  viewport: BiddingViewport | null;
  oracle: EvaluationOracle | null;
  expectedCall: Call | null;
  actualCall: Call | null;
  failureReason?: string;
  feedback?: ReturnType<typeof buildViewportFeedback>;
}

interface BundleReport {
  bundleId: string;
  bundleName: string;
  totalTargets: number;
  passed: number;
  failed: number;
  skipped: number;
  targets: TargetResult[];
}

// ====================================================================
// Compute Current Seat from Auction
// ====================================================================

function getCurrentSeat(dealer: Seat, auction: Auction): Seat {
  let seat = dealer;
  for (let i = 0; i < auction.entries.length; i++) {
    seat = nextSeat(seat);
  }
  return seat;
}

// ====================================================================
// Run a Single Target
// ====================================================================

function runTarget(
  target: SurfaceCoverageTarget,
  strategy: ConventionBiddingStrategy,
  bundle: ConventionBundle,
  maxRetries: number,
  rng: (() => number) | undefined,
): TargetResult {
  const baseResult: TargetResult = {
    stateId: target.stateId,
    surfaceId: target.targetSurfaceId,
    surfaceLabel: target.targetSurfaceLabel,
    result: "skip",
    attempts: 0,
    viewport: null,
    oracle: null,
    expectedCall: null,
    actualCall: null,
  };

  // Determine expected call from target surface
  let expectedCall: Call | null = null;
  if (target.targetSurfaceId && target.activeSurfaces.length > 0) {
    const surface = target.activeSurfaces.find(
      (s) => s.meaningId === target.targetSurfaceId,
    );
    if (surface) {
      expectedCall = surface.encoding.defaultCall;
    }
  }

  // Retry loop: deal generation can produce hands that the strategy
  // evaluates differently than expected (constraint gaps).
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    baseResult.attempts = attempt;

    // ── Generate deal ───────────────────────────────────────────
    let deal: Deal;
    try {
      const constraints = rng
        ? { ...target.dealConstraints, rng }
        : target.dealConstraints;
      const genResult = generateDeal(constraints);
      deal = genResult.deal;
    } catch {
      baseResult.result = "skip";
      baseResult.failureReason = "Deal generation failed (constraints infeasible)";
      continue;
    }

    // ── Build auction from prefix ───────────────────────────────
    const dealer = target.dealConstraints.dealer ?? Seat.North;
    let auction: Auction = { entries: [], isComplete: false };
    if (target.auctionPrefix.length > 0) {
      try {
        auction = buildAuction(dealer, [...target.auctionPrefix]);
      } catch (e) {
        baseResult.result = "skip";
        baseResult.failureReason = `Auction build failed: ${e instanceof Error ? e.message : String(e)}`;
        continue;
      }
    }

    // ── Determine current turn ──────────────────────────────────
    const currentSeat = getCurrentSeat(dealer, auction);
    const userSeat = Seat.South;

    // ── Get player hand and evaluate ────────────────────────────
    const hand = deal.hands[userSeat];
    const evaluation = evaluateHand(hand);

    // ── Run the convention strategy ─────────────────────────────
    const context = createBiddingContext({
      hand,
      auction,
      seat: userSeat,
      evaluation,
      vulnerability: deal.vulnerability,
      dealer,
    });

    let bidResult: BidResult | null;
    try {
      bidResult = strategy.suggest(context);
    } catch (e) {
      baseResult.result = "fail";
      baseResult.failureReason = `Strategy threw: ${e instanceof Error ? e.message : String(e)}`;
      continue;
    }

    // Convention exhausted → expected bid is Pass
    const effectiveResult: BidResult = bidResult ?? {
      call: { type: "pass" },
      ruleName: null,
      explanation: "No convention bid applies — pass",
    };

    // ── Resolve teaching answer ─────────────────────────────────
    const strategyEval = strategy.getLastEvaluation();
    const teachingResolution = resolveTeachingAnswer(
      effectiveResult,
      strategyEval?.acceptableAlternatives,
      strategyEval?.intentFamilies,
    );

    // ── Build viewport ──────────────────────────────────────────
    const legalCalls = getLegalCalls(auction, currentSeat);
    const viewport = buildBiddingViewport({
      deal,
      userSeat,
      auction,
      bidHistory: [],
      legalCalls,
      faceUpSeats: new Set([userSeat]),
      conventionName: bundle.name,
      isUserTurn: currentSeat === userSeat,
      currentBidder: currentSeat,
      activeSurfaces: target.activeSurfaces,
    });

    // ── Build oracle ────────────────────────────────────────────
    const oracle = buildEvaluationOracle({
      deal,
      bidResult: effectiveResult,
      teachingResolution,
      strategyEvaluation: strategyEval ?? undefined,
      targetSurfaceId: target.targetSurfaceId,
    });

    baseResult.viewport = viewport;
    baseResult.oracle = oracle;
    baseResult.expectedCall = expectedCall ?? effectiveResult.call;
    baseResult.actualCall = effectiveResult.call;

    // ── Self-test grading ───────────────────────────────────────
    // In self-test mode: the strategy IS the agent.  We verify
    // that its suggestion matches the target surface's expected call.
    if (expectedCall) {
      // Check if strategy's bid matches the surface's defaultCall
      if (callsMatch(effectiveResult.call, expectedCall)) {
        baseResult.result = "pass";
        return baseResult;
      }

      // Strategy disagrees with the target surface → use oracle grading
      const grading = gradeAgainstOracle(expectedCall, oracle);
      if (!grading.requiresRetry) {
        // Acceptable or correct-not-preferred — count as pass
        baseResult.result = "pass";
        return baseResult;
      }

      // Build feedback for failure diagnostics
      baseResult.feedback = buildViewportFeedback({
        grade: BidGrade.Incorrect,
        userCall: effectiveResult.call,
        expectedResult: { ...effectiveResult, call: expectedCall },
        teachingResolution,
        practicalRecommendation: strategyEval?.practicalRecommendation ?? undefined,
        teachingProjection: strategyEval?.teachingProjection ?? undefined,
      });

      baseResult.result = "fail";
      baseResult.failureReason =
        `Strategy suggested ${formatCall(effectiveResult.call)} but expected ${formatCall(expectedCall)}`;

      // Retry with a new deal — the constraint gap may be dealt-specific
      continue;
    }

    // No specific surface target — just check strategy fires
    if (bidResult === null) {
      // Strategy returned null at a state that should have active surfaces
      if (target.activeSurfaces.length > 0) {
        baseResult.result = "fail";
        baseResult.failureReason =
          "Strategy returned null (pass) at state with active surfaces";
        continue;
      }
    }

    baseResult.result = "pass";
    return baseResult;
  }

  // Exhausted all retries
  if (baseResult.result !== "fail") {
    baseResult.result = "skip";
  }
  return baseResult;
}

// ====================================================================
// Run All Targets for a Bundle
// ====================================================================

function runBundle(
  bundle: ConventionBundle,
  maxRetries: number,
  rng: (() => number) | undefined,
  json: boolean,
): BundleReport {
  const strategy = buildBundleStrategy(bundle);
  if (!strategy) {
    if (!json) {
      console.error(`  ✗ Bundle "${bundle.id}" has no meaning surfaces — skipping`);
    }
    return {
      bundleId: bundle.id,
      bundleName: bundle.name,
      totalTargets: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      targets: [],
    };
  }

  const manifest = generateOptimizedManifest(bundle, { skipFeasibilityCheck: true });
  if (!manifest) {
    if (!json) {
      console.error(`  ✗ Bundle "${bundle.id}" has no conversation machine — skipping`);
    }
    return {
      bundleId: bundle.id,
      bundleName: bundle.name,
      totalTargets: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      targets: [],
    };
  }

  if (!json) {
    console.log(`\n── ${bundle.name} (${bundle.id}) ──`);
    console.log(
      `   ${manifest.totalStates} states, ${manifest.totalSurfacePairs} surface pairs, ` +
      `${manifest.allTargets.length} targets (${manifest.phase1Targets.length} phase1, ${manifest.phase2Targets.length} phase2)`,
    );
    console.log(`   Tree LP lower bound: ${manifest.treeLPBound} sessions`);
  }

  const results: TargetResult[] = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const target of manifest.allTargets) {
    const result = runTarget(target, strategy, bundle, maxRetries, rng);
    results.push(result);

    switch (result.result) {
      case "pass":
        passed++;
        if (!json) {
          const surfaceInfo = result.surfaceId
            ? ` [${result.surfaceLabel ?? result.surfaceId}]`
            : "";
          console.log(`   ✓ ${result.stateId}${surfaceInfo}`);
        }
        break;
      case "fail":
        failed++;
        if (!json) {
          console.log(
            `   ✗ ${result.stateId} — ${result.failureReason ?? "unknown"}` +
            ` (${result.attempts} attempt${result.attempts === 1 ? "" : "s"})`,
          );
        }
        break;
      case "skip":
        skipped++;
        if (!json) {
          console.log(
            `   ○ ${result.stateId} — ${result.failureReason ?? "skipped"}`,
          );
        }
        break;
    }
  }

  if (!json) {
    console.log(
      `\n   Summary: ${passed} passed, ${failed} failed, ${skipped} skipped / ${manifest.allTargets.length} total`,
    );
  }

  return {
    bundleId: bundle.id,
    bundleName: bundle.name,
    totalTargets: manifest.allTargets.length,
    passed,
    failed,
    skipped,
    targets: results,
  };
}

// ====================================================================
// Main
// ====================================================================

function main() {
  const args = parseArgs();
  const rng = args.seed !== undefined ? createSeededRng(args.seed) : undefined;

  // Resolve bundle IDs
  let bundleIds: string[];
  if (args.all) {
    bundleIds = listBundles()
      .filter((b) => !b.internal)
      .map((b) => b.id);
  } else {
    bundleIds = args.bundleIds;
  }

  if (!args.json) {
    console.log(`Coverage Runner — testing ${bundleIds.length} bundle(s)`);
  }

  const reports: BundleReport[] = [];
  let anyFailure = false;

  for (const bundleId of bundleIds) {
    const bundle = getBundle(bundleId);
    if (!bundle) {
      if (!args.json) {
        console.error(`Bundle "${bundleId}" not found. Available bundles:`);
        for (const b of listBundles()) {
          console.error(`  - ${b.id} (${b.name})`);
        }
      }
      process.exit(2);
    }

    const report = runBundle(bundle, args.maxRetries, rng, args.json);
    reports.push(report);
    if (report.failed > 0) anyFailure = true;
  }

  // ── Output ──────────────────────────────────────────────────────
  if (args.json) {
    // Structured JSON output — strip non-serializable data from viewport/oracle
    const jsonOutput = reports.map((report) => ({
      bundleId: report.bundleId,
      bundleName: report.bundleName,
      totalTargets: report.totalTargets,
      passed: report.passed,
      failed: report.failed,
      skipped: report.skipped,
      targets: report.targets.map((t) => ({
        stateId: t.stateId,
        surfaceId: t.surfaceId,
        surfaceLabel: t.surfaceLabel,
        result: t.result,
        attempts: t.attempts,
        expectedCall: t.expectedCall,
        actualCall: t.actualCall,
        failureReason: t.failureReason,
        viewport: t.viewport
          ? {
              seat: t.viewport.seat,
              conventionName: t.viewport.conventionName,
              handSummary: t.viewport.handSummary,
              handEvaluation: t.viewport.handEvaluation,
              auctionEntries: t.viewport.auctionEntries,
              biddingOptions: t.viewport.biddingOptions,
              isUserTurn: t.viewport.isUserTurn,
            }
          : null,
        feedback: t.feedback
          ? {
              grade: t.feedback.grade,
              correctCallDisplay: t.feedback.correctCallDisplay,
              correctBidLabel: t.feedback.correctBidLabel,
              correctBidExplanation: t.feedback.correctBidExplanation,
            }
          : null,
      })),
    }));

    // Single-bundle output: unwrap the array
    const output = jsonOutput.length === 1 ? jsonOutput[0] : jsonOutput;
    console.log(JSON.stringify(output, null, 2));
  } else {
    // Summary line
    const totalPassed = reports.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = reports.reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = reports.reduce((sum, r) => sum + r.skipped, 0);
    const totalTargets = reports.reduce((sum, r) => sum + r.totalTargets, 0);

    console.log(`\n══════════════════════════════════════════════════`);
    console.log(
      `Total: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped / ${totalTargets}`,
    );
    console.log(`══════════════════════════════════════════════════`);
  }

  process.exit(anyFailure ? 1 : 0);
}

main();
