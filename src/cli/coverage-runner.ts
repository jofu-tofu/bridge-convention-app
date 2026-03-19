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
  /** Whether this is a user (player) decision point vs partner auto-bid. */
  readonly isUserStep: boolean;
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
      isUserStep: activeSeat === userSeat,
    });

    entries.push({ seat: activeSeat, call: result.call });
  }

  return { seed, steps, atomsCovered };
}

// ── Subcommand: trace ───────────────────────────────────────────────
//
// Per-step modes:
//   trace --phase=present --step=0
//     Viewport only (hand, auction, legal calls). No answer.
//
//   trace --phase=present --step=0 --bid=2C
//     Submit a bid → get viewport + grade + feedback in one shot.
//     Mirrors the app: bid, then immediately see if you're right and why.
//     Exit code: 0=correct, 1=wrong.
//
// Utility modes:
//   trace --phase=present
//     (no --step) Just returns totalSteps.
//
//   trace --phase=reveal
//     Full trace with all recommendations and atom IDs.
//
// Protocol:
//   1. trace --phase=present           → learn totalSteps
//   2. trace --phase=present --step=0  → see viewport, decide answer
//   3. trace --phase=present --step=0 --bid=2C  → submit, get feedback
//   4. If wrong: record finding, stop. If right: move to step 1.
//   5. trace --phase=reveal            → full comparison at end

function runTrace(): void {
  const bundleId = requireArg(flags, "bundle");
  const seed = optionalNumericArg(flags, "seed") ?? 42;
  const phase = (flags["phase"] as string) ?? "reveal";
  const stepIdx = optionalNumericArg(flags, "step");
  const bidStr = flags["bid"] as string | undefined;

  if (phase !== "present" && phase !== "reveal") {
    console.error("trace --phase must be 'present' or 'reveal'");
    process.exit(2);
  }

  const spec = resolveSpec(bundleId);
  const bundle = resolveBundle(bundleId);
  const atomCallMap = buildAtomCallMap(spec);

  const result = runSinglePlaythrough(bundle, spec, seed, atomCallMap);
  const userSteps = result.steps.filter((s) => s.isUserStep);

  if (phase === "present") {
    if (stepIdx === undefined) {
      console.log(JSON.stringify({
        bundle: bundleId,
        seed,
        phase: "present",
        totalSteps: userSteps.length,
      }, null, 2));
    } else {
      if (stepIdx < 0 || stepIdx >= userSteps.length) {
        console.error(`Step ${stepIdx} out of range (0-${userSteps.length - 1})`);
        process.exit(2);
      }
      const s = userSteps[stepIdx]!;
      const viewport = {
        stepIndex: stepIdx,
        seat: s.seat,
        hand: s.hand,
        hcp: s.hcp,
        auctionSoFar: s.auctionSoFar,
        legalCalls: s.legalCalls,
      };

      if (bidStr && bidStr !== "true") {
        // --bid provided: grade and return feedback
        let submittedCall: Call;
        try {
          submittedCall = parsePatternCall(bidStr);
        } catch {
          console.error(`Invalid bid: "${bidStr}"`);
          process.exit(2);
        }

        const appCall = parsePatternCall(s.recommendation);
        const isCorrect = callsMatch(submittedCall, appCall);

        console.log(JSON.stringify({
          bundle: bundleId,
          seed,
          phase: "present",
          totalSteps: userSteps.length,
          step: viewport,
          grade: {
            yourBid: callKey(submittedCall),
            appBid: s.recommendation,
            correct: isCorrect,
            meaning: s.meaningLabel,
            stateId: s.stateId,
            atomId: s.atomId,
            feedback: isCorrect
              ? `Correct! ${s.meaningLabel ?? ""}`
              : `Expected ${s.recommendation}, got ${callKey(submittedCall)}.${s.meaningLabel ? " The correct bid is: " + s.meaningLabel + "." : ""}`,
          },
        }, null, 2));
        process.exit(isCorrect ? 0 : 1);
      } else {
        // No --bid: viewport only
        console.log(JSON.stringify({
          bundle: bundleId,
          seed,
          phase: "present",
          totalSteps: userSteps.length,
          step: viewport,
        }, null, 2));
      }
    }
  } else {
    // Reveal: full trace — all steps (user + partner) with answers
    console.log(JSON.stringify({
      bundle: bundleId,
      seed,
      phase: "reveal",
      totalSteps: result.steps.length,
      userSteps: userSteps.length,
      steps: result.steps,
      atomsCovered: result.atomsCovered,
    }, null, 2));
  }
}

// ── Subcommand: plan ────────────────────────────────────────────────
//
// Per-atom BFS-ordered plan with dependency tree.
//
// For each atom, finds a seed where the strategy recommends the atom's
// expected bid at the target state. Atoms are sorted by BFS depth so
// agents test shallow states first. Dependency info lets agents skip
// subtrees when an upstream bid is found to be wrong.

function getExpectedCallForAtom(
  spec: ConventionSpec,
  atom: { baseStateId: string; meaningId: string },
): Call | null {
  for (const track of getBaseModules(spec)) {
    const state = track.states[atom.baseStateId];
    if (!state?.surface) continue;
    const fragment = spec.surfaces[state.surface];
    if (!fragment) continue;
    for (const surface of fragment.surfaces) {
      if (surface.meaningId === atom.meaningId) {
        return surface.encoding?.defaultCall ?? null;
      }
    }
  }
  return null;
}

function runPlan(): void {
  const bundleId = requireArg(flags, "bundle");
  const agentCount = optionalNumericArg(flags, "agents") ?? 3;
  const targetCoverage = optionalNumericArg(flags, "coverage") ?? 2;
  const maxSeeds = optionalNumericArg(flags, "max-seeds") ?? 500;
  const baseSeed = optionalNumericArg(flags, "seed") ?? 0;

  const spec = resolveSpec(bundleId);
  const bundle = resolveBundle(bundleId);
  const strategy = protocolSpecToStrategy(spec);

  // All atoms from coverage manifest
  const manifest = generateProtocolCoverageManifest(spec);
  const allAtoms = [...manifest.baseAtoms, ...manifest.protocolAtoms];

  // Build BFS depth + parent info for each state
  const stateInfo = new Map<string, {
    depth: number;
    parentStateId: string | null;
    transitionBid: string | null;
  }>();

  for (const track of getBaseModules(spec)) {
    const paths = enumerateBaseTrackStates(track);
    for (const [stateId, path] of paths) {
      // Depth = transitions after the initial pass (first transition is opening pass)
      const depth = Math.max(0, path.transitions.length - 1);
      let parentStateId: string | null = null;
      let transitionBid: string | null = null;
      if (path.transitions.length >= 2) {
        const lastT = path.transitions[path.transitions.length - 1]!;
        parentStateId = lastT.fromStateId;
        transitionBid = lastT.call ? callKey(lastT.call) : null;
      }
      stateInfo.set(stateId, { depth, parentStateId, transitionBid });
    }
  }

  // For each atom: find seeds where the strategy recommends the expected bid
  type AtomPlan = {
    atomId: string;
    stateId: string;
    surfaceId: string;
    meaningId: string;
    meaningLabel: string;
    expectedBid: string;
    depth: number;
    parentStateId: string | null;
    transitionBid: string | null;
    seeds: number[];
  };

  const atomPlans: AtomPlan[] = [];

  for (const atom of allAtoms) {
    const expectedCall = getExpectedCallForAtom(spec, atom);
    if (!expectedCall) continue;

    const info = stateInfo.get(atom.baseStateId);
    const depth = info?.depth ?? 0;
    const parentStateId = info?.parentStateId ?? null;
    const transitionBid = info?.transitionBid ?? null;

    const seeds: number[] = [];

    for (let s = baseSeed; s < baseSeed + maxSeeds && seeds.length < targetCoverage; s++) {
      try {
        const deal = generateSeededDeal(bundle, s);
        const userSeat = resolveUserSeat(bundle, deal);
        const { auction, targeted } = resolveAuction(bundle, spec, deal, atom.baseStateId, userSeat);
        if (!targeted) continue;

        const activeSeat = auction.entries.length > 0
          ? nextSeatClockwise(auction.entries[auction.entries.length - 1]!.seat)
          : userSeat;
        const hand = deal.hands[activeSeat];
        const context = buildContext(hand, auction, activeSeat);
        const result = strategy.suggest(context);

        if (result && callsMatch(result.call, expectedCall)) {
          seeds.push(s);
        }
      } catch {
        // Skip seeds that error
      }
    }

    atomPlans.push({
      atomId: `${atom.baseStateId}/${atom.surfaceId}/${atom.meaningId}`,
      stateId: atom.baseStateId,
      surfaceId: atom.surfaceId,
      meaningId: atom.meaningId,
      meaningLabel: atom.meaningLabel,
      expectedBid: callKey(expectedCall),
      depth,
      parentStateId,
      transitionBid,
      seeds,
    });
  }

  // Sort by depth (BFS order)
  atomPlans.sort((a, b) => a.depth - b.depth);

  // Split across agents, balanced by atom count, preserving BFS order
  const agents: { atoms: AtomPlan[] }[] = [];
  for (let i = 0; i < agentCount; i++) {
    agents.push({ atoms: [] });
  }
  for (const atom of atomPlans) {
    // Assign each atom to the agent with fewest atoms (round-robin by load)
    const minAgent = agents.reduce((a, b) => (a.atoms.length <= b.atoms.length ? a : b));
    minAgent.atoms.push(atom);
  }

  // Stats
  const covered = atomPlans.filter((a) => a.seeds.length >= targetCoverage).length;
  const uncovered = atomPlans
    .filter((a) => a.seeds.length < targetCoverage)
    .map((a) => ({ atomId: a.atomId, seedsFound: a.seeds.length }));

  console.log(JSON.stringify({
    bundle: bundleId,
    targetCoverage,
    totalAtoms: atomPlans.length,
    atomsCoveredAtTarget: covered,
    uncoveredAtoms: uncovered,
    maxDepth: Math.max(0, ...atomPlans.map((a) => a.depth)),
    agents: agents.map((a, i) => ({
      agentIndex: i,
      totalAtoms: a.atoms.length,
      // Atoms in BFS order with all info the agent needs
      atoms: a.atoms.map((ap) => ({
        atomId: ap.atomId,
        stateId: ap.stateId,
        surfaceId: ap.surfaceId,
        meaningLabel: ap.meaningLabel,
        expectedBid: ap.expectedBid,
        depth: ap.depth,
        parentStateId: ap.parentStateId,
        transitionBid: ap.transitionBid,
        seeds: ap.seeds,
      })),
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
