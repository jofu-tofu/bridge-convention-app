#!/usr/bin/env -S npx tsx
// ── Bridge Convention Coverage CLI ──────────────────────────────────
//
// Protocol-frame-aware coverage runner. Enumerates coverage targets,
// presents hands, grades bids, and runs self-test sessions.
//
// Subcommands:
//   list      — enumerate all coverage atoms for a bundle
//   present   — present a hand for an agent to bid (no correct answer)
//   grade     — grade a submitted bid against the strategy
//   selftest  — run strategy against itself for all atoms (CI)

// ── Side-effect import: registers all bundles + conventions ─────────
import "../conventions";

import { listConventionSpecs, getConventionSpec } from "../conventions/spec-registry";
import {
  generateProtocolCoverageManifest,
  enumerateBaseTrackStates,
  type BaseTrackPath,
} from "../conventions/core/protocol/coverage-enumeration";
import { getBaseModules } from "../conventions/core/protocol/types";
import { replay } from "../conventions/core/protocol/replay";
import { getBundle } from "../conventions/core/bundle";
import { protocolSpecToStrategy } from "../strategy/bidding/protocol-adapter";
import { createBiddingContext } from "../conventions/core/context-factory";
import { generateDeal } from "../engine/deal-generator";
import { mulberry32 } from "../core/util/seeded-rng";
import { evaluateHand } from "../engine/hand-evaluator";
import { callKey, callsMatch } from "../engine/call-helpers";
import { parsePatternCall } from "../engine/auction-helpers";
import { getLegalCalls } from "../engine/auction";
import { Seat, Vulnerability } from "../engine/types";
import type {
  Auction,
  Call,
  Hand,
  Deal,
  DealConstraints,
  Card,
} from "../engine/types";
import type { ConventionSpec } from "../conventions/core/protocol/types";
import type { ConventionBundle } from "../conventions/core/bundle/bundle-types";
import type { BiddingContext } from "../core/contracts/bidding";

// ── Argument parsing ────────────────────────────────────────────────

function parseArgs(argv: string[]): Record<string, string | true> {
  const result: Record<string, string | true> = {};
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx !== -1) {
        result[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      } else {
        result[arg.slice(2)] = true;
      }
    }
  }
  return result;
}

function requireArg(args: Record<string, string | true>, name: string): string {
  const val = args[name];
  if (val === undefined || val === true) {
    console.error(`Missing required argument: --${name}`);
    process.exit(2);
  }
  return val;
}

function optionalNumericArg(args: Record<string, string | true>, name: string): number | undefined {
  const val = args[name];
  if (val === undefined || val === true) return undefined;
  const n = Number(val);
  if (isNaN(n)) {
    console.error(`Invalid numeric argument: --${name}=${val}`);
    process.exit(2);
  }
  return n;
}

// ── Resolve spec + bundle ───────────────────────────────────────────

function resolveSpec(bundleId: string): ConventionSpec {
  const spec = getConventionSpec(bundleId);
  if (!spec) {
    console.error(`Unknown convention spec: "${bundleId}"`);
    console.error("Available specs:");
    const seen = new Set<string>();
    for (const s of listConventionSpecs()) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      console.error(`  ${s.id} — ${s.name}`);
    }
    process.exit(2);
  }
  return spec;
}

function resolveBundle(bundleId: string): ConventionBundle {
  const bundle = getBundle(bundleId);
  if (!bundle) {
    console.error(`Unknown bundle: "${bundleId}" (no ConventionBundle registered)`);
    process.exit(2);
  }
  return bundle;
}

// ── Deal generation ─────────────────────────────────────────────────

function generateSeededDeal(
  bundle: ConventionBundle,
  seed: number,
): Deal {
  const rng = mulberry32(seed);
  const constraints: DealConstraints = {
    ...bundle.dealConstraints,
  };
  const result = generateDeal(constraints, rng);
  return result.deal;
}

// ── Auction + context setup ─────────────────────────────────────────

/**
 * Determine the user seat for the convention.
 * Most conventions have the responder as South. The default auction
 * function from the bundle determines this — if there's an initial
 * auction for that seat, it's the user seat.
 */
function resolveUserSeat(bundle: ConventionBundle, deal: Deal): Seat {
  const candidates: Seat[] = [Seat.South, Seat.East, Seat.North, Seat.West];
  for (const seat of candidates) {
    if (bundle.defaultAuction) {
      const auction = bundle.defaultAuction(seat, deal);
      if (auction && auction.entries.length > 0) {
        return seat;
      }
    }
  }
  return Seat.South;
}

function buildInitialAuction(
  bundle: ConventionBundle,
  userSeat: Seat,
  deal: Deal,
): Auction {
  if (bundle.defaultAuction) {
    const auction = bundle.defaultAuction(userSeat, deal);
    if (auction) return auction;
  }
  return { entries: [], isComplete: false };
}

function buildContext(
  hand: Hand,
  auction: Auction,
  seat: Seat,
): BiddingContext {
  const evaluation = evaluateHand(hand);
  return createBiddingContext({
    hand,
    auction,
    seat,
    evaluation,
    vulnerability: Vulnerability.None,
    dealer: auction.entries.length > 0 ? auction.entries[0]!.seat : Seat.North,
  });
}

// ── Hand formatting ─────────────────────────────────────────────────

function formatCard(card: Card): string {
  return `${card.rank}${card.suit}`;
}

function formatHandBySuit(hand: Hand): Record<string, string[]> {
  const suits: Record<string, Card[]> = { S: [], H: [], D: [], C: [] };
  for (const card of hand.cards) {
    suits[card.suit]!.push(card);
  }
  return {
    S: suits.S!.map((c) => c.rank),
    H: suits.H!.map((c) => c.rank),
    D: suits.D!.map((c) => c.rank),
    C: suits.C!.map((c) => c.rank),
  };
}

// ── Targeted auction from BFS paths ─────────────────────────────────

function nextSeatClockwise(seat: Seat): Seat {
  switch (seat) {
    case Seat.North: return Seat.East;
    case Seat.East: return Seat.South;
    case Seat.South: return Seat.West;
    case Seat.West: return Seat.North;
  }
}

function partnerOf(seat: Seat): Seat {
  switch (seat) {
    case Seat.North: return Seat.South;
    case Seat.South: return Seat.North;
    case Seat.East: return Seat.West;
    case Seat.West: return Seat.East;
  }
}

/**
 * Find the BFS path to a target state across all base tracks.
 */
function findPathToState(
  spec: ConventionSpec,
  targetStateId: string,
): BaseTrackPath | null {
  for (const track of getBaseModules(spec)) {
    const paths = enumerateBaseTrackStates(track);
    const path = paths.get(targetStateId);
    if (path) return path;
  }
  return null;
}

/**
 * Build an auction that reaches a target state by following the BFS path.
 *
 * The default auction covers the boot pattern (e.g., N: 1NT) plus the first
 * transition (e.g., E: Pass). Remaining transitions are appended, with
 * opponent passes inserted where the BFS skips them.
 */
function buildTargetedAuction(
  defaultAuction: Auction,
  path: BaseTrackPath,
  userSeat: Seat,
): Auction {
  const entries = [...defaultAuction.entries];

  // First transition is covered by the default auction (opponent pass after opening)
  const transitionsToAdd = path.transitions.slice(1);
  if (transitionsToAdd.length === 0) return { entries, isComplete: false };

  let currentSeat = nextSeatClockwise(entries[entries.length - 1]!.seat);
  const partner = partnerOf(userSeat);

  for (const transition of transitionsToAdd) {
    if (!transition.call) continue;

    const isPass = transition.call.type === "pass";

    // For non-pass convention bids: skip over opponent seats with passes
    if (!isPass) {
      while (currentSeat !== userSeat && currentSeat !== partner) {
        entries.push({ seat: currentSeat, call: { type: "pass" } });
        currentSeat = nextSeatClockwise(currentSeat);
      }
    }

    entries.push({ seat: currentSeat, call: transition.call });
    currentSeat = nextSeatClockwise(currentSeat);
  }

  // Fill opponent passes so the next bidder is a convention player
  while (currentSeat !== userSeat && currentSeat !== partner) {
    entries.push({ seat: currentSeat, call: { type: "pass" } });
    currentSeat = nextSeatClockwise(currentSeat);
  }

  return { entries, isComplete: false };
}

/**
 * Build the auction for a target state. Falls back to the default auction
 * if no BFS path is found or the path has null calls.
 */
function resolveAuction(
  bundle: ConventionBundle,
  spec: ConventionSpec,
  deal: Deal,
  targetStateId: string,
  userSeat: Seat,
): { auction: Auction; targeted: boolean } {
  const defaultAuction = buildInitialAuction(bundle, userSeat, deal);
  const path = findPathToState(spec, targetStateId);
  if (!path) return { auction: defaultAuction, targeted: false };

  // Check for null calls in the path (can't build a concrete auction)
  if (path.transitions.some((t) => t.call === null)) {
    return { auction: defaultAuction, targeted: false };
  }

  const targeted = buildTargetedAuction(defaultAuction, path, userSeat);
  return { auction: targeted, targeted: true };
}

// ── Main dispatch ───────────────────────────────────────────────────

const rawArgs = process.argv.slice(2);
const subcommand = rawArgs[0];
const flags = parseArgs(rawArgs.slice(1));

if (!subcommand || subcommand === "--help" || subcommand === "-h") {
  printUsage();
  process.exit(2);
}

switch (subcommand) {
  case "list":
    runList();
    break;
  case "present":
    runPresent();
    break;
  case "grade":
    runGrade();
    break;
  case "selftest":
    runSelftest();
    break;
  case "trace":
    runTrace();
    break;
  case "plan":
    runPlan();
    break;
  default:
    console.error(`Unknown subcommand: "${subcommand}"`);
    printUsage();
    process.exit(2);
}

// ── Subcommand: list ────────────────────────────────────────────────

function runList(): void {
  const bundleId = requireArg(flags, "bundle");
  const spec = resolveSpec(bundleId);
  const manifest = generateProtocolCoverageManifest(spec);

  const allAtoms = [...manifest.baseAtoms, ...manifest.protocolAtoms];
  for (const atom of allAtoms) {
    const line = {
      baseStateId: atom.baseStateId,
      surfaceId: atom.surfaceId,
      meaningId: atom.meaningId,
      meaningLabel: atom.meaningLabel,
      involvesProtocol: atom.involvesProtocol,
      activeProtocols: atom.activeProtocols,
    };
    console.log(JSON.stringify(line));
  }
}

// ── Subcommand: present ─────────────────────────────────────────────

function runPresent(): void {
  const bundleId = requireArg(flags, "bundle");
  const targetState = requireArg(flags, "target");
  const surface = requireArg(flags, "surface");
  const seed = optionalNumericArg(flags, "seed") ?? 42;

  const spec = resolveSpec(bundleId);
  const bundle = resolveBundle(bundleId);

  // Generate deal
  const deal = generateSeededDeal(bundle, seed);
  const userSeat = resolveUserSeat(bundle, deal);

  // Build targeted auction to reach the target state
  const { auction, targeted } = resolveAuction(bundle, spec, deal, targetState, userSeat);

  // Active seat = next bidder after the auction prefix
  const activeSeat = auction.entries.length > 0
    ? nextSeatClockwise(auction.entries[auction.entries.length - 1]!.seat)
    : userSeat;
  const hand = deal.hands[activeSeat];

  // Legal calls from the active seat's perspective
  const legalCalls = getLegalCalls(auction, activeSeat).map(callKey);

  // Build viewport output (no correct answer)
  const output = {
    bundle: bundleId,
    target: targetState,
    surface,
    seed,
    seat: activeSeat,
    targeted,
    hand: formatHandBySuit(hand),
    handRaw: hand.cards.map(formatCard),
    hcp: evaluateHand(hand).hcp,
    auction: auction.entries.map((e) => ({
      seat: e.seat,
      call: callKey(e.call),
    })),
    legalCalls,
  };

  console.log(JSON.stringify(output, null, 2));
}

// ── Subcommand: grade ───────────────────────────────────────────────

function runGrade(): void {
  const bundleId = requireArg(flags, "bundle");
  const targetState = requireArg(flags, "target");
  const surface = requireArg(flags, "surface");
  const seed = optionalNumericArg(flags, "seed") ?? 42;
  const bidStr = requireArg(flags, "bid");

  const spec = resolveSpec(bundleId);
  const bundle = resolveBundle(bundleId);

  // Parse the submitted bid
  let submittedCall: Call;
  try {
    submittedCall = parsePatternCall(bidStr);
  } catch {
    console.error(`Invalid bid: "${bidStr}"`);
    process.exit(2);
  }

  // Same deal as present (same seed)
  const deal = generateSeededDeal(bundle, seed);
  const userSeat = resolveUserSeat(bundle, deal);

  // Build targeted auction and determine active seat
  const { auction, targeted } = resolveAuction(bundle, spec, deal, targetState, userSeat);
  const activeSeat = auction.entries.length > 0
    ? nextSeatClockwise(auction.entries[auction.entries.length - 1]!.seat)
    : userSeat;
  const hand = deal.hands[activeSeat];

  // Build context from the active seat's perspective
  const context = buildContext(hand, auction, activeSeat);

  // Run strategy to get the correct bid
  const strategy = protocolSpecToStrategy(spec);
  const result = strategy.suggest(context);

  if (!result) {
    // Strategy has no recommendation — report as skip, not wrong
    const output = {
      bundle: bundleId,
      target: targetState,
      surface,
      seed,
      targeted,
      yourBid: callKey(submittedCall),
      correctBid: null,
      grade: "skip",
      correct: false,
      skip: true,
      requiresRetry: false,
      explanation: null,
      meaning: null,
      feedback: "Strategy returned null (no recommendation for this state/hand)",
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(0); // skip is not a failure
    return;
  }

  const correctCall = result.call;
  const isCorrect = callsMatch(submittedCall, correctCall);

  const output = {
    bundle: bundleId,
    target: targetState,
    surface,
    seed,
    targeted,
    yourBid: callKey(submittedCall),
    correctBid: callKey(correctCall),
    grade: isCorrect ? "correct" : "wrong",
    correct: isCorrect,
    skip: false,
    requiresRetry: !isCorrect,
    explanation: result.explanation ?? null,
    meaning: result.meaning ?? null,
    feedback: isCorrect
      ? "Correct!"
      : `Expected ${callKey(correctCall)}, got ${callKey(submittedCall)}`,
  };

  console.log(JSON.stringify(output, null, 2));
  process.exit(isCorrect ? 0 : 1);
}

// ── Subcommand: selftest ────────────────────────────────────────────

function runSelftest(): void {
  const bundleId = flags["bundle"] as string | undefined;
  const all = flags["all"] === true;
  const seed = optionalNumericArg(flags, "seed") ?? 42;

  if (!bundleId && !all) {
    console.error("selftest requires --bundle=<id> or --all");
    process.exit(2);
  }

  const specs: { id: string; spec: ConventionSpec; bundle: ConventionBundle }[] = [];

  if (all) {
    // Deduplicate by spec id (aliases share specs)
    const seen = new Set<string>();
    for (const spec of listConventionSpecs()) {
      if (seen.has(spec.id)) continue;
      seen.add(spec.id);
      const bundle = getBundle(spec.id);
      if (bundle) {
        specs.push({ id: spec.id, spec, bundle });
      }
    }
  } else {
    const spec = resolveSpec(bundleId!);
    const bundle = resolveBundle(bundleId!);
    specs.push({ id: bundleId!, spec, bundle });
  }

  let totalPass = 0;
  let totalFail = 0;
  let totalSkip = 0;
  const results: {
    bundle: string;
    atom: string;
    status: "pass" | "fail" | "skip";
    targeted: boolean;
    activeSeat?: string;
    correctBid?: string;
    details?: string;
  }[] = [];

  for (const { id, spec, bundle } of specs) {
    const manifest = generateProtocolCoverageManifest(spec);
    const allAtoms = [...manifest.baseAtoms, ...manifest.protocolAtoms];
    const strategy = protocolSpecToStrategy(spec);

    for (let i = 0; i < allAtoms.length; i++) {
      const atom = allAtoms[i]!;
      const atomSeed = seed + i;
      const atomLabel = `${atom.baseStateId}/${atom.surfaceId}/${atom.meaningId}`;

      try {
        // Generate deal for this atom
        const deal = generateSeededDeal(bundle, atomSeed);
        const userSeat = resolveUserSeat(bundle, deal);

        // Build targeted auction to reach the atom's state
        const { auction, targeted } = resolveAuction(bundle, spec, deal, atom.baseStateId, userSeat);

        // Determine active seat at the target state
        const activeSeat = auction.entries.length > 0
          ? nextSeatClockwise(auction.entries[auction.entries.length - 1]!.seat)
          : userSeat;
        const hand = deal.hands[activeSeat];

        // Build context from the active seat's perspective
        const context = buildContext(hand, auction, activeSeat);

        // Run strategy
        const result = strategy.suggest(context);

        if (!result) {
          totalSkip++;
          results.push({
            bundle: id,
            atom: atomLabel,
            status: "skip",
            targeted,
            activeSeat: activeSeat as string,
            details: "Strategy returned null (no recommendation)",
          });
          continue;
        }

        // Self-test: strategy bid should be deterministic
        const bidKey = callKey(result.call);
        const verifyResult = strategy.suggest(context);
        if (!verifyResult || !callsMatch(result.call, verifyResult.call)) {
          totalFail++;
          results.push({
            bundle: id,
            atom: atomLabel,
            status: "fail",
            targeted,
            activeSeat: activeSeat as string,
            correctBid: bidKey,
            details: "Strategy is non-deterministic",
          });
          continue;
        }

        totalPass++;
        results.push({
          bundle: id,
          atom: atomLabel,
          status: "pass",
          targeted,
          activeSeat: activeSeat as string,
          correctBid: bidKey,
        });
      } catch (err: unknown) {
        totalFail++;
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          bundle: id,
          atom: atomLabel,
          status: "fail",
          targeted: false,
          details: `Error: ${msg}`,
        });
      }
    }
  }

  // Output summary
  const output = {
    seed,
    totalAtoms: results.length,
    pass: totalPass,
    fail: totalFail,
    skip: totalSkip,
    results,
  };

  console.log(JSON.stringify(output, null, 2));
  process.exit(totalFail > 0 ? 1 : 0);
}

// ── Playthrough infrastructure ──────────────────────────────────────

interface PlaythroughStep {
  readonly stepIndex: number;
  readonly seat: string;
  readonly stateId: string | null;
  readonly atomId: string | null;
  readonly meaningLabel: string | null;
  readonly hand: Record<string, string[]>;
  readonly hcp: number;
  readonly auctionSoFar: readonly { seat: string; call: string }[];
  readonly legalCalls: readonly string[];
  readonly recommendation: string;
}

interface PlaythroughResult {
  readonly seed: number;
  readonly steps: readonly PlaythroughStep[];
  readonly atomsCovered: readonly string[];
}

/**
 * Build a map from (stateId, callKey) → atom info.
 * Used to identify which atom a strategy recommendation corresponds to.
 */
function buildAtomCallMap(
  spec: ConventionSpec,
): Map<string, { atomId: string; meaningLabel: string }> {
  const map = new Map<string, { atomId: string; meaningLabel: string }>();
  for (const track of getBaseModules(spec)) {
    for (const [stateId, state] of Object.entries(track.states)) {
      if (!state.surface) continue;
      const fragment = spec.surfaces[state.surface];
      if (!fragment) continue;
      for (const surface of fragment.surfaces) {
        const call = surface.encoding?.defaultCall;
        if (call) {
          const key = `${stateId}|${callKey(call)}`;
          map.set(key, {
            atomId: `${stateId}/${state.surface}/${surface.meaningId}`,
            meaningLabel: surface.teachingLabel,
          });
        }
      }
    }
  }
  return map;
}

/**
 * Run a single playthrough: generate a deal, let the strategy drive
 * the auction naturally, and record each decision point.
 */
function runSinglePlaythrough(
  bundle: ConventionBundle,
  spec: ConventionSpec,
  seed: number,
  atomCallMap: Map<string, { atomId: string; meaningLabel: string }>,
): PlaythroughResult {
  const deal = generateSeededDeal(bundle, seed);
  const userSeat = resolveUserSeat(bundle, deal);
  const partner = partnerOf(userSeat);
  const strategy = protocolSpecToStrategy(spec);

  const initAuction = buildInitialAuction(bundle, userSeat, deal);
  const entries: { seat: Seat; call: Call }[] = [...initAuction.entries];

  const steps: PlaythroughStep[] = [];
  const atomsCovered: string[] = [];
  const maxIter = 30; // safety limit

  for (let iter = 0; iter < maxIter; iter++) {
    const activeSeat = entries.length > 0
      ? nextSeatClockwise(entries[entries.length - 1]!.seat)
      : userSeat;

    // Opponent → pass
    if (activeSeat !== userSeat && activeSeat !== partner) {
      entries.push({ seat: activeSeat, call: { type: "pass" } });
      // Check 3 consecutive passes after a bid → auction complete
      if (entries.length >= 4) {
        const tail = entries.slice(-3);
        if (tail.every((e) => e.call.type === "pass") && entries.some((e) => e.call.type === "bid")) break;
      }
      continue;
    }

    // Convention player's turn
    const hand = deal.hands[activeSeat];
    const auction: Auction = { entries: [...entries], isComplete: false };
    const context = buildContext(hand, auction, activeSeat);
    const result = strategy.suggest(context);

    if (!result) break; // Strategy done

    // Replay to find current state
    const snapshot = replay(
      entries.map((e) => ({ call: e.call, seat: e.seat })),
      spec,
      userSeat,
    );
    const stateId = snapshot.base?.stateId ?? null;

    // Map recommendation to atom
    let atomId: string | null = null;
    let meaningLabel: string | null = null;
    if (stateId) {
      const match = atomCallMap.get(`${stateId}|${callKey(result.call)}`);
      if (match) {
        atomId = match.atomId;
        meaningLabel = match.meaningLabel;
        atomsCovered.push(atomId);
      }
    }

    steps.push({
      stepIndex: steps.length,
      seat: activeSeat as string,
      stateId,
      atomId,
      meaningLabel,
      hand: formatHandBySuit(hand),
      hcp: evaluateHand(hand).hcp,
      auctionSoFar: entries.map((e) => ({ seat: e.seat as string, call: callKey(e.call) })),
      legalCalls: getLegalCalls(auction, activeSeat).map(callKey),
      recommendation: callKey(result.call),
    });

    entries.push({ seat: activeSeat, call: result.call });
  }

  return { seed, steps, atomsCovered };
}

// ── Subcommand: trace ───────────────────────────────────────────────
//
// Three modes:
//   trace --bundle=X --seed=N --phase=present --step=0
//     Outputs a single viewport (hand, auction, legal calls) for one
//     decision point. No answer revealed. The agent evaluates with
//     bridge knowledge and commits before requesting the next step.
//
//   trace --bundle=X --seed=N --phase=present
//     (no --step) Outputs only totalSteps so the agent knows how many
//     steps to iterate.
//
//   trace --bundle=X --seed=N --phase=reveal
//     Outputs the full trace including all recommendations and atom IDs.
//     The agent compares their committed answers against the strategy's.
//
// Same seed = same playthrough. The protocol is:
//   1. trace --phase=present           → learn totalSteps
//   2. trace --phase=present --step=0  → see viewport, commit answer
//   3. trace --phase=present --step=1  → see viewport (auction reveals
//      step 0's bid, but agent already committed), commit answer
//   4. ... repeat for each step ...
//   5. trace --phase=reveal            → compare all answers

function runTrace(): void {
  const bundleId = requireArg(flags, "bundle");
  const seed = optionalNumericArg(flags, "seed") ?? 42;
  const phase = (flags["phase"] as string) ?? "reveal";
  const stepIdx = optionalNumericArg(flags, "step");

  if (phase !== "present" && phase !== "reveal") {
    console.error("trace --phase must be 'present' or 'reveal'");
    process.exit(2);
  }

  const spec = resolveSpec(bundleId);
  const bundle = resolveBundle(bundleId);
  const atomCallMap = buildAtomCallMap(spec);

  const result = runSinglePlaythrough(bundle, spec, seed, atomCallMap);

  if (phase === "present") {
    if (stepIdx === undefined) {
      // No --step: just report how many steps
      console.log(JSON.stringify({
        bundle: bundleId,
        seed,
        phase: "present",
        totalSteps: result.steps.length,
      }, null, 2));
    } else {
      // Single step viewport — no recommendation, no atom ID
      if (stepIdx < 0 || stepIdx >= result.steps.length) {
        console.error(`Step ${stepIdx} out of range (0-${result.steps.length - 1})`);
        process.exit(2);
      }
      const s = result.steps[stepIdx]!;
      console.log(JSON.stringify({
        bundle: bundleId,
        seed,
        phase: "present",
        totalSteps: result.steps.length,
        step: {
          stepIndex: s.stepIndex,
          seat: s.seat,
          hand: s.hand,
          hcp: s.hcp,
          auctionSoFar: s.auctionSoFar,
          legalCalls: s.legalCalls,
        },
      }, null, 2));
    }
  } else {
    // Full trace with answers
    console.log(JSON.stringify({
      bundle: bundleId,
      seed,
      phase: "reveal",
      totalSteps: result.steps.length,
      steps: result.steps,
      atomsCovered: result.atomsCovered,
    }, null, 2));
  }
}

// ── Subcommand: plan ────────────────────────────────────────────────

function runPlan(): void {
  const bundleId = requireArg(flags, "bundle");
  const agentCount = optionalNumericArg(flags, "agents") ?? 3;
  const targetCoverage = optionalNumericArg(flags, "coverage") ?? 2;
  const maxSeeds = optionalNumericArg(flags, "max-seeds") ?? 500;
  const baseSeed = optionalNumericArg(flags, "seed") ?? 0;

  const spec = resolveSpec(bundleId);
  const bundle = resolveBundle(bundleId);
  const atomCallMap = buildAtomCallMap(spec);

  // All atoms from coverage manifest
  const manifest = generateProtocolCoverageManifest(spec);
  const allAtoms = [...manifest.baseAtoms, ...manifest.protocolAtoms];
  const allAtomIds = new Set(
    allAtoms.map((a) => `${a.baseStateId}/${a.surfaceId}/${a.meaningId}`),
  );

  // Precompute playthroughs
  const cache = new Map<number, PlaythroughResult>();
  for (let s = baseSeed; s < baseSeed + maxSeeds; s++) {
    const result = runSinglePlaythrough(bundle, spec, s, atomCallMap);
    if (result.steps.length > 0 && result.atomsCovered.length > 0) {
      cache.set(s, result);
    }
  }

  // Greedy set cover for targetCoverage per atom
  const atomCounts = new Map<string, number>();
  for (const id of allAtomIds) atomCounts.set(id, 0);

  const selectedSeeds: number[] = [];

  while (true) {
    // Count atoms still needing coverage
    let needed = 0;
    for (const count of atomCounts.values()) {
      if (count < targetCoverage) needed++;
    }
    if (needed === 0) break;

    // Find best seed (covers most under-covered atoms)
    let bestSeed = -1;
    let bestScore = 0;
    for (const [s, result] of cache) {
      if (selectedSeeds.includes(s)) continue;
      let score = 0;
      for (const atomId of result.atomsCovered) {
        if ((atomCounts.get(atomId) ?? 0) < targetCoverage) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestSeed = s;
      }
    }

    if (bestSeed === -1 || bestScore === 0) break; // Can't improve

    selectedSeeds.push(bestSeed);
    for (const atomId of cache.get(bestSeed)!.atomsCovered) {
      atomCounts.set(atomId, (atomCounts.get(atomId) ?? 0) + 1);
    }
  }

  // Split across agents balanced by bid count (largest-first greedy)
  const seedItems = selectedSeeds.map((s) => ({
    seed: s,
    bids: cache.get(s)!.steps.length,
    atoms: cache.get(s)!.atomsCovered,
  }));
  seedItems.sort((a, b) => b.bids - a.bids);

  const agents: { seeds: number[]; totalBids: number; atoms: string[] }[] = [];
  for (let i = 0; i < agentCount; i++) {
    agents.push({ seeds: [], totalBids: 0, atoms: [] });
  }
  for (const item of seedItems) {
    const minAgent = agents.reduce((a, b) => (a.totalBids <= b.totalBids ? a : b));
    minAgent.seeds.push(item.seed);
    minAgent.totalBids += item.bids;
    minAgent.atoms.push(...item.atoms);
  }

  // Coverage stats
  const coveredAtTarget = [...atomCounts.values()].filter((c) => c >= targetCoverage).length;
  const uncovered = [...atomCounts.entries()]
    .filter(([, c]) => c < targetCoverage)
    .map(([id, c]) => ({ atomId: id, coverage: c }));

  console.log(JSON.stringify({
    bundle: bundleId,
    targetCoverage,
    totalAtoms: allAtomIds.size,
    atomsCoveredAtTarget: coveredAtTarget,
    uncoveredAtoms: uncovered,
    selectedSeeds: selectedSeeds.length,
    totalBids: seedItems.reduce((sum, s) => sum + s.bids, 0),
    agents: agents.map((a, i) => ({
      agentIndex: i,
      seeds: a.seeds,
      totalBids: a.totalBids,
      uniqueAtoms: [...new Set(a.atoms)].length,
    })),
  }, null, 2));
}

// ── Usage ───────────────────────────────────────────────────────────

function printUsage(): void {
  console.error("Usage: coverage-runner.ts <subcommand> [options]");
  console.error("");
  console.error("Subcommands:");
  console.error("  list      --bundle=<id>           List all coverage atoms");
  console.error("  present   --bundle=<id> --target=<state> --surface=<surface> [--seed=N]");
  console.error("            Present a hand (no correct answer)");
  console.error("  grade     --bundle=<id> --target=<state> --surface=<surface> --bid=<bid> [--seed=N]");
  console.error("            Grade a submitted bid");
  console.error("  selftest  --bundle=<id> [--seed=N]   Run strategy self-test");
  console.error("  selftest  --all [--seed=N]            Self-test all bundles");
  console.error("  trace     --bundle=<id> --phase=present [--seed=N]");
  console.error("            Get step count for a playthrough");
  console.error("  trace     --bundle=<id> --phase=present --step=N [--seed=N]");
  console.error("            Single viewport (no answer) — agent commits before next step");
  console.error("  trace     --bundle=<id> --phase=reveal [--seed=N]");
  console.error("            Full playthrough trace with all recommendations");
  console.error("  plan      --bundle=<id> --agents=N [--coverage=2] [--max-seeds=500] [--seed=0]");
  console.error("            Precompute playthrough plan for agent sweep");
  console.error("");
  console.error("Exit codes: 0=correct/pass, 1=wrong/fail, 2=arg error");
  console.error("");
  console.error("Available bundles:");
  const seen = new Set<string>();
  for (const spec of listConventionSpecs()) {
    if (seen.has(spec.id)) continue;
    seen.add(spec.id);
    console.error(`  ${spec.id} — ${spec.name}`);
  }
}
