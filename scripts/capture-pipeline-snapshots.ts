/**
 * Capture golden-master pipeline snapshots for Rust round-trip validation.
 *
 * Runs each bundle through the full pipeline with curated test hands,
 * serializes PipelineResult + EvaluatedFacts + TeachingProjection to JSON.
 *
 * Usage: npx tsx scripts/capture-pipeline-snapshots.ts
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { getBundleInput, specFromBundle } from "../src/conventions/definitions/system-registry";
import { SAYC_SYSTEM_CONFIG } from "../src/conventions/definitions/system-config";
import { protocolSpecToStrategy } from "../src/conventions/adapter/protocol-adapter";
import { mulberry32 } from "../src/engine/seeded-rng";
import { generateDeal } from "../src/engine/deal-generator";
import { calculateHcpAndShape } from "../src/engine/hand-evaluator";
import type { Hand, Seat, Vulnerability, Auction, Call, AuctionEntry, HandEvaluation } from "../src/engine/types";
import type { ConventionSpec } from "../src/conventions/core/spec-types";
import type { BiddingContext } from "../src/conventions/core/strategy-types";

// Side-effect: register all bundles
import "../src/conventions/registration";

const BUNDLE_IDS = [
  "nt-bundle",
  "nt-stayman",
  "nt-transfers",
  "bergen-bundle",
  "weak-twos-bundle",
  "dont-bundle",
];

const FIXTURES_DIR = join(
  __dirname,
  "../src-tauri/crates/bridge-conventions/fixtures/pipeline",
);

/**
 * Curated test scenarios per bundle.
 * Each scenario has a seed (for deterministic deal gen), dealer constraints,
 * and an auction prefix (bids made before the hand we're evaluating).
 */
interface TestScenario {
  readonly label: string;
  readonly seed: number;
  /** HCP range for South (the hand being evaluated) */
  readonly southHcp: [number, number];
  /** Optional shape constraints for South */
  readonly southBalanced?: boolean;
  /** HCP range for North (partner) — typically opener for responder tests */
  readonly northHcp?: [number, number];
  readonly northBalanced?: boolean;
  /** Auction entries before South's turn */
  readonly priorBids: readonly { seat: string; call: Call }[];
}

// ── Bundle-specific test scenarios ─────────────────────────────────────

const NT_OPENING: Call = { type: "bid", level: 1, strain: "NT" };
const PASS: Call = { type: "pass" };
const TWO_CLUBS: Call = { type: "bid", level: 2, strain: "C" };
const TWO_DIAMONDS: Call = { type: "bid", level: 2, strain: "D" };
const TWO_HEARTS: Call = { type: "bid", level: 2, strain: "H" };
const TWO_SPADES: Call = { type: "bid", level: 2, strain: "S" };
const THREE_NOTRUMP: Call = { type: "bid", level: 3, strain: "NT" };
const ONE_HEART: Call = { type: "bid", level: 1, strain: "H" };
const ONE_SPADE: Call = { type: "bid", level: 1, strain: "S" };
const THREE_HEARTS: Call = { type: "bid", level: 3, strain: "H" };
const THREE_SPADES: Call = { type: "bid", level: 3, strain: "S" };
const DOUBLE: Call = { type: "double" };

/** Opening scenarios — responder's first bid after 1NT opening */
function ntResponderScenarios(): TestScenario[] {
  return [
    // Stayman hands
    { label: "stayman-4hearts-invite", seed: 100, southHcp: [8, 9], southBalanced: false, northHcp: [15, 17], northBalanced: true, priorBids: [{ seat: "N", call: NT_OPENING }, { seat: "E", call: PASS }] },
    { label: "stayman-4spades-game", seed: 101, southHcp: [10, 14], southBalanced: false, northHcp: [15, 17], northBalanced: true, priorBids: [{ seat: "N", call: NT_OPENING }, { seat: "E", call: PASS }] },
    // Transfer hands
    { label: "transfer-hearts-weak", seed: 110, southHcp: [0, 7], southBalanced: false, northHcp: [15, 17], northBalanced: true, priorBids: [{ seat: "N", call: NT_OPENING }, { seat: "E", call: PASS }] },
    { label: "transfer-spades-invite", seed: 111, southHcp: [8, 9], southBalanced: false, northHcp: [15, 17], northBalanced: true, priorBids: [{ seat: "N", call: NT_OPENING }, { seat: "E", call: PASS }] },
    // Direct raises
    { label: "nt-invite-balanced", seed: 120, southHcp: [8, 9], southBalanced: true, northHcp: [15, 17], northBalanced: true, priorBids: [{ seat: "N", call: NT_OPENING }, { seat: "E", call: PASS }] },
    { label: "nt-game-balanced", seed: 121, southHcp: [10, 15], southBalanced: true, northHcp: [15, 17], northBalanced: true, priorBids: [{ seat: "N", call: NT_OPENING }, { seat: "E", call: PASS }] },
    // Weak/pass
    { label: "pass-weak", seed: 130, southHcp: [0, 7], southBalanced: true, northHcp: [15, 17], northBalanced: true, priorBids: [{ seat: "N", call: NT_OPENING }, { seat: "E", call: PASS }] },
    // Continuation: after Stayman 2C, opener denies
    { label: "stayman-after-deny", seed: 140, southHcp: [8, 14], southBalanced: false, northHcp: [15, 17], northBalanced: true, priorBids: [{ seat: "N", call: NT_OPENING }, { seat: "E", call: PASS }, { seat: "S", call: TWO_CLUBS }, { seat: "W", call: PASS }, { seat: "N", call: TWO_DIAMONDS }, { seat: "E", call: PASS }] },
    // Continuation: after transfer accepted
    { label: "transfer-after-accept", seed: 150, southHcp: [8, 14], southBalanced: false, northHcp: [15, 17], northBalanced: true, priorBids: [{ seat: "N", call: NT_OPENING }, { seat: "E", call: PASS }, { seat: "S", call: TWO_DIAMONDS }, { seat: "W", call: PASS }, { seat: "N", call: TWO_HEARTS }, { seat: "E", call: PASS }] },
    // Off-system (no matching surface)
    { label: "off-system-strong", seed: 160, southHcp: [18, 20], southBalanced: true, northHcp: [15, 17], northBalanced: true, priorBids: [{ seat: "N", call: NT_OPENING }, { seat: "E", call: PASS }] },
  ];
}

function bergenScenarios(): TestScenario[] {
  return [
    // Bergen raises after 1H/1S opening
    { label: "bergen-limit-raise", seed: 200, southHcp: [10, 12], southBalanced: false, northHcp: [12, 16], priorBids: [{ seat: "N", call: ONE_HEART }, { seat: "E", call: PASS }] },
    { label: "bergen-constructive-raise", seed: 201, southHcp: [7, 9], southBalanced: false, northHcp: [12, 16], priorBids: [{ seat: "N", call: ONE_HEART }, { seat: "E", call: PASS }] },
    { label: "bergen-preemptive-raise", seed: 202, southHcp: [0, 6], southBalanced: false, northHcp: [12, 16], priorBids: [{ seat: "N", call: ONE_HEART }, { seat: "E", call: PASS }] },
    { label: "bergen-game-raise-spades", seed: 210, southHcp: [13, 16], southBalanced: false, northHcp: [12, 16], priorBids: [{ seat: "N", call: ONE_SPADE }, { seat: "E", call: PASS }] },
    { label: "bergen-splinter", seed: 220, southHcp: [12, 15], southBalanced: false, northHcp: [12, 16], priorBids: [{ seat: "N", call: ONE_HEART }, { seat: "E", call: PASS }] },
  ];
}

function weakTwoScenarios(): TestScenario[] {
  return [
    // After 2H/2S weak opening — responder bids
    { label: "weak-two-raise", seed: 300, southHcp: [6, 10], southBalanced: false, northHcp: [5, 10], priorBids: [{ seat: "N", call: TWO_HEARTS }, { seat: "E", call: PASS }] },
    { label: "weak-two-ogust", seed: 301, southHcp: [14, 18], southBalanced: false, northHcp: [5, 10], priorBids: [{ seat: "N", call: TWO_HEARTS }, { seat: "E", call: PASS }] },
    { label: "weak-two-pass", seed: 302, southHcp: [0, 5], southBalanced: true, northHcp: [5, 10], priorBids: [{ seat: "N", call: TWO_SPADES }, { seat: "E", call: PASS }] },
    { label: "weak-two-game", seed: 310, southHcp: [15, 18], southBalanced: false, northHcp: [5, 10], priorBids: [{ seat: "N", call: TWO_HEARTS }, { seat: "E", call: PASS }] },
    { label: "weak-two-3nt", seed: 311, southHcp: [15, 18], southBalanced: true, northHcp: [5, 10], priorBids: [{ seat: "N", call: TWO_HEARTS }, { seat: "E", call: PASS }] },
  ];
}

function dontScenarios(): TestScenario[] {
  return [
    // After opponent's 1NT, DONT overcaller
    { label: "dont-single-suited", seed: 400, southHcp: [8, 14], southBalanced: false, northHcp: [5, 10], priorBids: [{ seat: "E", call: NT_OPENING }, { seat: "S", call: DOUBLE }] },
  ];
}

function getScenariosForBundle(bundleId: string): TestScenario[] {
  switch (bundleId) {
    case "nt-bundle":
    case "nt-stayman":
    case "nt-transfers":
      return ntResponderScenarios();
    case "bergen-bundle":
      return bergenScenarios();
    case "weak-twos-bundle":
      return weakTwoScenarios();
    case "dont-bundle":
      return dontScenarios();
    default:
      return ntResponderScenarios(); // fallback
  }
}

// ── Pipeline execution ─────────────────────────────────────────────────

interface PipelineSnapshot {
  bundleId: string;
  label: string;
  seed: number;
  // Input
  hand: unknown; // Hand serialized
  evaluation: unknown; // HandEvaluation serialized
  auctionEntries: unknown[]; // Auction entries
  // Output — what matters for golden-master
  selectedMeaningId: string | null;
  selectedCall: unknown | null;
  truthSetMeaningIds: string[];
  truthSetCalls: unknown[];
  acceptableSetMeaningIds: string[];
  eliminatedCount: number;
  // Teaching
  bidGradeIfCorrect: string; // What grade the primary bid gets
  callViewCount: number;
  meaningViewCount: number;
  whyNotCount: number;
}

function seatFromString(s: string): Seat {
  return s as Seat;
}

function runScenario(
  spec: ConventionSpec,
  scenario: TestScenario,
  bundleId: string,
): PipelineSnapshot | null {
  // Generate a hand for South matching constraints
  const rng = mulberry32(scenario.seed);

  const seats: Array<{ seat: Seat; minHcp?: number; maxHcp?: number; balanced?: boolean }> = [];

  seats.push({
    seat: "S" as Seat,
    minHcp: scenario.southHcp[0],
    maxHcp: scenario.southHcp[1],
    ...(scenario.southBalanced !== undefined ? { balanced: scenario.southBalanced } : {}),
  });

  if (scenario.northHcp) {
    seats.push({
      seat: "N" as Seat,
      minHcp: scenario.northHcp[0],
      maxHcp: scenario.northHcp[1],
      ...(scenario.northBalanced !== undefined ? { balanced: scenario.northBalanced } : {}),
    });
  }

  let deal;
  try {
    deal = generateDeal({
      seats: seats as any, // any: SeatConstraint[] compat
      rng,
      maxAttempts: 10000,
    });
  } catch {
    console.warn(`  ⚠ Could not generate deal for ${scenario.label} (seed=${scenario.seed})`);
    return null;
  }

  const hand = deal.deal.hands["S" as Seat];
  if (!hand) {
    console.warn(`  ⚠ No South hand for ${scenario.label}`);
    return null;
  }

  const evaluation = calculateHcpAndShape(hand);

  // Build auction from prior bids
  const entries: AuctionEntry[] = scenario.priorBids.map((b, i) => ({
    call: b.call,
    seat: b.seat as Seat,
  }));

  const auction: Auction = { entries };

  const context: BiddingContext = {
    hand,
    auction,
    seat: "S" as Seat,
    evaluation,
    vulnerability: "none" as Vulnerability,
    dealer: (scenario.priorBids[0]?.seat ?? "N") as Seat,
    opponentConventionIds: [],
  };

  // Run the strategy
  const strategy = protocolSpecToStrategy(spec);
  const bidResult = strategy.suggest(context);
  const evalSnapshot = strategy.getLastEvaluation();

  const pipelineResult = evalSnapshot?.pipelineResult;
  const teachingProjection = evalSnapshot?.teachingProjection;

  return {
    bundleId,
    label: scenario.label,
    seed: scenario.seed,
    hand,
    evaluation,
    auctionEntries: entries,
    selectedMeaningId: pipelineResult?.selected?.proposal?.meaningId ?? null,
    selectedCall: pipelineResult?.selected ? callToJson(pipelineResult.selected.call) : null,
    truthSetMeaningIds: (pipelineResult?.truthSet ?? []).map(c => c.proposal.meaningId),
    truthSetCalls: (pipelineResult?.truthSet ?? []).map(c => callToJson(c.call)),
    acceptableSetMeaningIds: (pipelineResult?.acceptableSet ?? []).map(c => c.proposal.meaningId),
    eliminatedCount: pipelineResult?.eliminated?.length ?? 0,
    bidGradeIfCorrect: bidResult ? "correct" : "off-system",
    callViewCount: teachingProjection?.callViews?.length ?? 0,
    meaningViewCount: teachingProjection?.meaningViews?.length ?? 0,
    whyNotCount: teachingProjection?.whyNot?.length ?? 0,
  };
}

function callToJson(call: Call): unknown {
  return call;
}

// ── Main ───────────────────────────────────────────────────────────────

function main(): void {
  mkdirSync(FIXTURES_DIR, { recursive: true });

  let totalSnapshots = 0;

  for (const bundleId of BUNDLE_IDS) {
    const input = getBundleInput(bundleId);
    if (!input) {
      console.error(`Bundle not found: ${bundleId}`);
      continue;
    }

    const spec = specFromBundle(input, SAYC_SYSTEM_CONFIG);
    const scenarios = getScenariosForBundle(bundleId);
    const snapshots: PipelineSnapshot[] = [];

    console.log(`\n${bundleId}: ${scenarios.length} scenarios`);

    for (const scenario of scenarios) {
      const snapshot = runScenario(spec, scenario, bundleId);
      if (snapshot) {
        snapshots.push(snapshot);
        const selected = snapshot.selectedMeaningId ?? "(off-system)";
        console.log(`  ✓ ${scenario.label}: ${selected} [truth=${snapshot.truthSetMeaningIds.length}, elim=${snapshot.eliminatedCount}]`);
      }
    }

    if (snapshots.length > 0) {
      const outPath = join(FIXTURES_DIR, `${bundleId}.json`);
      writeFileSync(outPath, JSON.stringify(snapshots, null, 2) + "\n", "utf-8");
      console.log(`  → ${outPath} (${snapshots.length} snapshots)`);
      totalSnapshots += snapshots.length;
    }
  }

  console.log(`\nDone. ${totalSnapshots} snapshots across ${BUNDLE_IDS.length} bundles.`);
}

main();
