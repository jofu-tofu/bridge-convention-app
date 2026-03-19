#!/usr/bin/env -S npx tsx
// ── Bridge Convention Coverage CLI ──────────────────────────────────
//
// Agent-friendly CLI for testing bridge convention correctness.
//
// Three modes:
//   list    — enumerate targets (agent picks one)
//   present — show the viewport for a target (agent reads, decides)
//   grade   — submit a bid, get feedback (agent retries if wrong)
//   selftest — automated self-test for CI (strategy vs. itself)
//
// The same --seed produces the same deal across present and grade,
// so an agent can:
//   1. Run `present` → read hand, auction, options
//   2. Decide what to bid (as a bridge expert)
//   3. Run `grade --bid=2C` → get pass/fail + teaching feedback
//   4. If wrong, analyze feedback and run `grade --bid=3NT`
//
// Usage:
//   npx tsx src/cli/coverage-runner.ts list --bundle=nt-bundle
//   npx tsx src/cli/coverage-runner.ts present --bundle=nt-bundle --target=responder-r1 --seed=42
//   npx tsx src/cli/coverage-runner.ts grade --bundle=nt-bundle --target=responder-r1 --seed=42 --bid=2C
//   npx tsx src/cli/coverage-runner.ts selftest --bundle=nt-bundle --seed=42
//   npx tsx src/cli/coverage-runner.ts selftest --all

// ── Side-effect import: populates bundle & convention registries ────
import "../conventions/index";

import { getBundle, listBundles } from "../conventions/core/bundle";
import type { ConventionBundle } from "../conventions/core/bundle";
import {
  generateOptimizedManifest,
} from "../conventions/core/runtime/coverage-spec-compiler";
import type {
  SurfaceCoverageTarget,
} from "../conventions/core/runtime/coverage-spec-compiler";
import { buildBundleStrategy } from "../bootstrap/config-factory";
import type { ConventionBiddingStrategy } from "../core/contracts/recommendation";
import { createBiddingContext } from "../conventions/core/context-factory";
import { evaluateHand } from "../engine/hand-evaluator";
import { generateDeal } from "../engine/deal-generator";
import { buildAuction } from "../engine/auction-helpers";
import { getLegalCalls } from "../engine/auction";
import { nextSeat } from "../engine/constants";
import { Seat, Vulnerability } from "../engine/types";
import type { Auction, Call, Deal } from "../engine/types";
import type { BidResult } from "../core/contracts/bidding";
import { resolveTeachingAnswer, BidGrade } from "../teaching/teaching-resolution";
import {
  buildBiddingViewport,
  buildEvaluationOracle,
  gradeAgainstOracle,
  buildViewportFeedback,
  buildTeachingDetail,
} from "../core/viewport/build-viewport";
import type { BiddingViewport } from "../core/viewport/player-viewport";
import { callsMatch } from "../engine/call-helpers";
import { formatCall } from "../core/display/format";

// ====================================================================
// Seedable PRNG (xoshiro128**)
// ====================================================================

function createSeededRng(seed: number): () => number {
  let s0 = seed | 0;
  let s1 = (seed * 1_812_433_253 + 1) | 0;
  let s2 = (s1 * 1_812_433_253 + 1) | 0;
  let s3 = (s2 * 1_812_433_253 + 1) | 0;
  return () => {
    const result = Math.imul(s1 * 5, 7) >>> 0;
    const t = s1 << 9;
    s2 ^= s0; s3 ^= s1; s1 ^= s2; s0 ^= s3;
    s2 ^= t;
    s3 = (s3 << 11) | (s3 >>> 21);
    return (result >>> 0) / 4_294_967_296;
  };
}

// ====================================================================
// Shared: resolve a target from a bundle manifest
// ====================================================================

function resolveTarget(
  bundle: ConventionBundle,
  targetId: string,
  surfaceId?: string,
): SurfaceCoverageTarget | null {
  const manifest = generateOptimizedManifest(bundle, { skipFeasibilityCheck: true });
  if (!manifest) return null;
  return manifest.allTargets.find((t) =>
    t.stateId === targetId &&
    (!surfaceId || t.targetSurfaceId === surfaceId),
  ) ?? null;
}

// ====================================================================
// Shared: generate deal + auction + viewport for a target
// ====================================================================

interface TargetSetup {
  deal: Deal;
  auction: Auction;
  viewport: BiddingViewport;
  strategy: ConventionBiddingStrategy;
  target: SurfaceCoverageTarget;
  expectedCall: Call | null;
}

function setupTarget(
  bundle: ConventionBundle,
  target: SurfaceCoverageTarget,
  seed?: number,
): TargetSetup | { error: string } {
  const strategy = buildBundleStrategy(bundle);
  if (!strategy) return { error: "Bundle has no strategy" };

  const rng = seed !== undefined ? createSeededRng(seed) : undefined;

  // Generate deal — rng is the second parameter, not a constraint field
  let deal: Deal;
  try {
    deal = generateDeal(target.dealConstraints, rng).deal;
  } catch {
    return { error: "Deal generation failed — constraints infeasible for this seed" };
  }

  // Build auction
  const dealer = target.dealConstraints.dealer ?? Seat.North;
  let auction: Auction = { entries: [], isComplete: false };
  if (target.auctionPrefix.length > 0) {
    try {
      auction = buildAuction(dealer, [...target.auctionPrefix]);
    } catch (e) {
      return { error: `Auction build failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  // Determine expected call
  let expectedCall: Call | null = null;
  if (target.targetSurfaceId && target.activeSurfaces.length > 0) {
    const surface = target.activeSurfaces.find((s) => s.meaningId === target.targetSurfaceId);
    if (surface) expectedCall = surface.encoding.defaultCall;
  }

  // Build viewport
  const currentSeat = getCurrentSeat(dealer, auction);
  const userSeat = Seat.South;
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

  return { deal, auction, viewport, strategy, target, expectedCall };
}

function getCurrentSeat(dealer: Seat, auction: Auction): Seat {
  let seat = dealer;
  for (let i = 0; i < auction.entries.length; i++) {
    seat = nextSeat(seat);
  }
  return seat;
}

// ====================================================================
// Parse a bid string like "2C", "3NT", "Pass", "X", "XX"
// ====================================================================

function parseBidString(bid: string): Call | null {
  const upper = bid.toUpperCase().trim();
  if (upper === "P" || upper === "PASS") return { type: "pass" };
  if (upper === "X" || upper === "DBL" || upper === "DOUBLE") return { type: "double" };
  if (upper === "XX" || upper === "RDBL" || upper === "REDOUBLE") return { type: "redouble" };

  const match = upper.match(/^([1-7])(C|D|H|S|NT)$/);
  if (!match) return null;
  const level = parseInt(match[1]!, 10) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  const strainMap: Record<string, string> = { C: "C", D: "D", H: "H", S: "S", NT: "NT" };
  return { type: "bid", level, strain: strainMap[match[2]!] as any };
}

// ====================================================================
// Command: list
// ====================================================================

function cmdList(bundleId: string) {
  const bundle = requireBundle(bundleId);
  const manifest = generateOptimizedManifest(bundle, { skipFeasibilityCheck: true });
  if (!manifest) {
    console.error(`Bundle "${bundleId}" has no conversation machine.`);
    process.exit(2);
  }

  const output = {
    bundleId: manifest.bundleId,
    bundleName: manifest.bundleName,
    totalStates: manifest.totalStates,
    totalSurfacePairs: manifest.totalSurfacePairs,
    treeLPBound: manifest.treeLPBound,
    targets: manifest.allTargets.map((t) => ({
      stateId: t.stateId,
      surfaceId: t.targetSurfaceId ?? null,
      surfaceLabel: t.targetSurfaceLabel ?? null,
      phase: t.phase,
      pathDescription: t.pathDescription,
      surfaceCount: t.activeSurfaces.length,
    })),
  };

  console.log(JSON.stringify(output, null, 2));
}

// ====================================================================
// Command: present
// ====================================================================

function cmdPresent(bundleId: string, targetId: string, surfaceId?: string, seed?: number) {
  const bundle = requireBundle(bundleId);
  const target = resolveTarget(bundle, targetId, surfaceId);
  if (!target) {
    console.error(`Target "${targetId}" (surface: ${surfaceId ?? "any"}) not found in "${bundleId}".`);
    console.error(`Run: npx tsx src/cli/coverage-runner.ts list --bundle=${bundleId}`);
    process.exit(2);
  }

  const setup = setupTarget(bundle, target, seed);
  if ("error" in setup) {
    console.log(JSON.stringify({ error: setup.error }, null, 2));
    process.exit(1);
  }

  // Output viewport — what the agent sees. NO correct answer.
  const output = {
    stateId: target.stateId,
    surfaceId: target.targetSurfaceId ?? null,
    convention: setup.viewport.conventionName,
    seat: setup.viewport.seat,
    hand: {
      summary: setup.viewport.handSummary,
      hcp: setup.viewport.handEvaluation.hcp,
      shape: setup.viewport.handEvaluation.shape,
      totalPoints: setup.viewport.handEvaluation.totalPoints,
    },
    auction: setup.viewport.auctionEntries.map((e) => ({
      seat: e.seat,
      call: e.callDisplay,
      alert: e.alertLabel ?? null,
    })),
    legalCalls: setup.viewport.legalCalls.map(formatCall),
    biddingOptions: setup.viewport.biddingOptions.map((o) => ({
      call: o.callDisplay,
      meaning: o.teachingLabel ?? null,
      alertable: o.isAlertable,
      recommendation: o.recommendation ?? null,
    })),
    isYourTurn: setup.viewport.isUserTurn,
    instruction: "You are South. Study your hand and the auction. What do you bid? Submit your answer with: grade --bid=YOUR_BID",
  };

  console.log(JSON.stringify(output, null, 2));
}

// ====================================================================
// Command: grade
// ====================================================================

function cmdGrade(bundleId: string, targetId: string, bidStr: string, surfaceId?: string, seed?: number) {
  const bundle = requireBundle(bundleId);
  const target = resolveTarget(bundle, targetId, surfaceId);
  if (!target) {
    console.error(`Target "${targetId}" not found in "${bundleId}".`);
    process.exit(2);
  }

  const userCall = parseBidString(bidStr);
  if (!userCall) {
    console.error(`Invalid bid: "${bidStr}". Examples: 1C, 2NT, 3H, Pass, X, XX`);
    process.exit(2);
  }

  const setup = setupTarget(bundle, target, seed);
  if ("error" in setup) {
    console.log(JSON.stringify({ error: setup.error }, null, 2));
    process.exit(1);
  }

  // Run strategy to get the expected answer
  const hand = setup.deal.hands[Seat.South];
  const evaluation = evaluateHand(hand);
  const context = createBiddingContext({
    hand,
    auction: setup.auction,
    seat: Seat.South,
    evaluation,
    vulnerability: setup.deal.vulnerability,
    dealer: setup.deal.dealer,
  });

  let bidResult: BidResult | null;
  try {
    bidResult = setup.strategy.suggest(context);
  } catch {
    bidResult = null;
  }

  const effectiveResult: BidResult = bidResult ?? {
    call: { type: "pass" },
    ruleName: null,
    explanation: "No convention bid applies — pass",
  };

  // Resolve teaching + build oracle
  const strategyEval = setup.strategy.getLastEvaluation();
  const teachingResolution = resolveTeachingAnswer(
    effectiveResult,
    strategyEval?.acceptableAlternatives,
    strategyEval?.intentFamilies,
  );

  const oracle = buildEvaluationOracle({
    deal: setup.deal,
    bidResult: effectiveResult,
    teachingResolution,
    strategyEvaluation: strategyEval ?? undefined,
    targetSurfaceId: target.targetSurfaceId,
  });

  // Grade the agent's bid
  const grading = gradeAgainstOracle(userCall, oracle);

  // Build feedback
  const feedbackInput = {
    grade: grading.grade === "correct" ? BidGrade.Correct
      : grading.grade === "correct-not-preferred" ? BidGrade.CorrectNotPreferred
      : grading.grade === "acceptable" ? BidGrade.Acceptable
      : grading.grade === "near-miss" ? BidGrade.NearMiss
      : BidGrade.Incorrect,
    userCall,
    expectedResult: effectiveResult,
    teachingResolution,
    practicalRecommendation: strategyEval?.practicalRecommendation ?? undefined,
    teachingProjection: strategyEval?.teachingProjection ?? undefined,
  };

  const viewportFeedback = buildViewportFeedback(feedbackInput);
  const teachingDetail = grading.requiresRetry ? buildTeachingDetail(feedbackInput) : null;

  // Build output
  const output: Record<string, unknown> = {
    yourBid: formatCall(userCall),
    grade: grading.grade,
    correct: !grading.requiresRetry,
    requiresRetry: grading.requiresRetry,
  };

  if (!grading.requiresRetry) {
    // Correct — brief confirmation
    output.message = grading.grade === "correct"
      ? "Correct!"
      : grading.grade === "correct-not-preferred"
        ? `Correct, though ${viewportFeedback.correctCallDisplay} is preferred.`
        : `Acceptable. Textbook bid is ${viewportFeedback.correctCallDisplay}.`;
  } else {
    // Wrong — full teaching feedback
    output.correctBid = viewportFeedback.correctCallDisplay;
    output.correctBidMeaning = viewportFeedback.correctBidLabel;
    output.explanation = viewportFeedback.correctBidExplanation;
    output.message = `Incorrect. The correct bid is ${viewportFeedback.correctCallDisplay}${viewportFeedback.correctBidLabel ? ` (${viewportFeedback.correctBidLabel})` : ""}.`;

    if (teachingDetail) {
      // Conditions
      if (teachingDetail.primaryExplanation?.length) {
        output.conditions = teachingDetail.primaryExplanation
          .filter((n) => n.kind === "condition")
          .map((n) => ({ description: n.content, passed: n.passed ?? true }));
      }
      // Hand summary
      if (teachingDetail.handSummary) {
        output.handSummary = teachingDetail.handSummary;
      }
      // Partner info
      if (teachingDetail.partnerSummary) {
        output.partnerInfo = teachingDetail.partnerSummary;
      }
      // Near misses
      if (teachingDetail.nearMissCalls?.length) {
        output.nearMisses = teachingDetail.nearMissCalls.map((nm) => ({
          call: formatCall(nm.call),
          reason: nm.reason,
        }));
      }
    }

    output.instruction = "Try again with: grade --bid=YOUR_NEW_BID";
  }

  console.log(JSON.stringify(output, null, 2));
  process.exit(grading.requiresRetry ? 1 : 0);
}

// ====================================================================
// Command: selftest (the original CI mode)
// ====================================================================

function cmdSelftest(bundleIds: string[], seed?: number, maxRetries = 3) {
  const rng = seed !== undefined ? createSeededRng(seed) : undefined;
  let anyFailure = false;

  console.log(`Coverage Self-Test — ${bundleIds.length} bundle(s)\n`);

  for (const bundleId of bundleIds) {
    const bundle = requireBundle(bundleId);
    const strategy = buildBundleStrategy(bundle);
    if (!strategy) { console.log(`  ✗ ${bundleId}: no strategy`); continue; }

    const manifest = generateOptimizedManifest(bundle, { skipFeasibilityCheck: true });
    if (!manifest) { console.log(`  ✗ ${bundleId}: no FSM`); continue; }

    console.log(`── ${bundle.name} (${bundleId}) ──`);
    console.log(`   ${manifest.allTargets.length} targets, LP bound: ${manifest.treeLPBound}`);

    let passed = 0, failed = 0, skipped = 0;

    for (const target of manifest.allTargets) {
      const result = runSelfTestTarget(target, strategy, bundle, maxRetries, rng);
      if (result === "pass") { passed++; console.log(`   ✓ ${target.stateId}${target.targetSurfaceLabel ? ` [${target.targetSurfaceLabel}]` : ""}`); }
      else if (result === "fail") { failed++; anyFailure = true; console.log(`   ✗ ${target.stateId} — ${result}`); }
      else { skipped++; console.log(`   ○ ${target.stateId} — ${result}`); }
    }

    console.log(`   Summary: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  }

  process.exit(anyFailure ? 1 : 0);
}

function runSelfTestTarget(
  target: SurfaceCoverageTarget,
  strategy: ConventionBiddingStrategy,
  bundle: ConventionBundle,
  maxRetries: number,
  rng?: () => number,
): "pass" | string {
  let expectedCall: Call | null = null;
  if (target.targetSurfaceId) {
    const surface = target.activeSurfaces.find((s) => s.meaningId === target.targetSurfaceId);
    if (surface) expectedCall = surface.encoding.defaultCall;
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let deal: Deal;
    try {
      deal = generateDeal(target.dealConstraints, rng).deal;
    } catch { continue; }

    const dealer = target.dealConstraints.dealer ?? Seat.North;
    let auction: Auction = { entries: [], isComplete: false };
    if (target.auctionPrefix.length > 0) {
      try { auction = buildAuction(dealer, [...target.auctionPrefix]); } catch { continue; }
    }

    const hand = deal.hands[Seat.South];
    const context = createBiddingContext({
      hand, auction, seat: Seat.South,
      evaluation: evaluateHand(hand),
      vulnerability: deal.vulnerability, dealer,
    });

    let bidResult: BidResult | null;
    try { bidResult = strategy.suggest(context); } catch { continue; }

    const effectiveCall = bidResult?.call ?? { type: "pass" as const };

    if (expectedCall) {
      if (callsMatch(effectiveCall, expectedCall)) return "pass";
      // Check if acceptable
      const effectiveResult: BidResult = bidResult ?? { call: { type: "pass" }, ruleName: null, explanation: "" };
      const strategyEval = strategy.getLastEvaluation();
      const teachingRes = resolveTeachingAnswer(effectiveResult, strategyEval?.acceptableAlternatives, strategyEval?.intentFamilies);
      const oracle = buildEvaluationOracle({ deal, bidResult: effectiveResult, teachingResolution: teachingRes });
      const grading = gradeAgainstOracle(expectedCall, oracle);
      if (!grading.requiresRetry) return "pass";
      continue;
    }

    return "pass";
  }

  return expectedCall
    ? `Strategy mismatch — expected ${formatCall(expectedCall)}`
    : "Deal generation failed";
}

// ====================================================================
// Utilities
// ====================================================================

function requireBundle(bundleId: string): ConventionBundle {
  const bundle = getBundle(bundleId);
  if (!bundle) {
    console.error(`Bundle "${bundleId}" not found. Available:`);
    for (const b of listBundles()) {
      if (!b.internal) console.error(`  - ${b.id} (${b.name})`);
    }
    process.exit(2);
  }
  return bundle;
}

function usage(): never {
  console.error(`Bridge Convention Coverage CLI

Commands:
  list     --bundle=<id>                          List all coverage targets
  present  --bundle=<id> --target=<state> [--surface=<id>] [--seed=N]
                                                   Show hand & auction (agent reads this)
  grade    --bundle=<id> --target=<state> --bid=<call> [--surface=<id>] [--seed=N]
                                                   Submit a bid, get feedback
  selftest --bundle=<id> [--all] [--seed=N] [--max-retries=N]
                                                   Automated self-test (CI mode)

Examples:
  npx tsx src/cli/coverage-runner.ts list --bundle=nt-bundle
  npx tsx src/cli/coverage-runner.ts present --bundle=nt-bundle --target=responder-r1 --seed=42
  npx tsx src/cli/coverage-runner.ts grade --bundle=nt-bundle --target=responder-r1 --seed=42 --bid=2C
  npx tsx src/cli/coverage-runner.ts selftest --all --seed=42`);
  process.exit(2);
}

// ====================================================================
// Main: route subcommand
// ====================================================================

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) usage();

  const command = args[0]!;
  const flags: Record<string, string> = {};
  const boolFlags = new Set<string>();

  for (const arg of args.slice(1)) {
    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx >= 0) {
        flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      } else {
        boolFlags.add(arg.slice(2));
      }
    }
  }

  const bundleId = flags["bundle"];
  const targetId = flags["target"];
  const surfaceId = flags["surface"];
  const bidStr = flags["bid"];
  const seed = flags["seed"] !== undefined ? parseInt(flags["seed"], 10) : undefined;
  const maxRetries = flags["max-retries"] !== undefined ? parseInt(flags["max-retries"], 10) : 3;

  switch (command) {
    case "list":
      if (!bundleId) { console.error("list requires --bundle=<id>"); process.exit(2); }
      cmdList(bundleId);
      break;

    case "present":
      if (!bundleId || !targetId) { console.error("present requires --bundle=<id> --target=<state>"); process.exit(2); }
      cmdPresent(bundleId, targetId, surfaceId, seed);
      break;

    case "grade":
      if (!bundleId || !targetId || !bidStr) { console.error("grade requires --bundle=<id> --target=<state> --bid=<call>"); process.exit(2); }
      cmdGrade(bundleId, targetId, bidStr, surfaceId, seed);
      break;

    case "selftest": {
      let ids: string[];
      if (boolFlags.has("all")) {
        ids = listBundles().filter((b) => !b.internal).map((b) => b.id);
      } else if (bundleId) {
        ids = [bundleId];
      } else {
        console.error("selftest requires --bundle=<id> or --all");
        process.exit(2);
      }
      cmdSelftest(ids, seed, maxRetries);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      usage();
  }
}

main();
