#!/usr/bin/env -S npx tsx
// ── Bridge Convention Coverage CLI ──────────────────────────────────
//
// Protocol-frame-aware coverage runner for convention evaluation.
//
// Subcommands:
//   list      — enumerate all coverage atoms for a bundle
//   eval      — per-atom evaluation (--atom, optional --bid for grading)
//   play      — playthrough evaluation (--step, --bid, --reveal)
//   selftest  — run strategy against itself for all atoms (CI)
//   plan      — precompute two-phase evaluation plan

// ── Side-effect import: registers all bundles + conventions ─────────
import "../conventions";

import { listConventionSpecs, getConventionSpec } from "../conventions/spec-registry";
import {
  generateProtocolCoverageManifest,
  enumerateBaseTrackStates,
  type BaseTrackPath,
  getBaseModules,
  replay,
} from "../conventions/core";
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
import type { ConventionSpec } from "../conventions/core";
import type { ConventionBundle } from "../conventions/core/bundle/bundle-types";
import type { BiddingContext } from "../core/contracts/bidding";
import type { ConventionBiddingStrategy } from "../core/contracts/recommendation";
import { resolveTeachingAnswer, gradeBid, BidGrade } from "../teaching/teaching-resolution";
import { buildViewportFeedback, buildTeachingDetail } from "../core/viewport/build-viewport";
import { naturalFallbackStrategy } from "../strategy/bidding/natural-fallback";
import { createStrategyChain } from "../strategy/bidding/strategy-chain";
import type { OpponentMode } from "../bootstrap/types";

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

// ── Settings parsing ────────────────────────────────────────────────

const VULN_MAP: Record<string, Vulnerability> = {
  none: Vulnerability.None,
  ns: Vulnerability.NorthSouth,
  ew: Vulnerability.EastWest,
  both: Vulnerability.Both,
};

function parseVulnerability(args: Record<string, string | true>): Vulnerability {
  const val = args["vuln"];
  if (val === undefined || val === true) return Vulnerability.None;
  const mapped = VULN_MAP[val.toLowerCase()];
  if (mapped === undefined) {
    console.error(`Invalid --vuln value: "${val}" (expected: none, ns, ew, both)`);
    process.exit(2);
  }
  return mapped;
}

function parseOpponentMode(args: Record<string, string | true>): OpponentMode {
  const val = args["opponents"];
  if (val === undefined || val === true) return "none";
  if (val === "natural" || val === "none") return val;
  console.error(`Invalid --opponents value: "${val}" (expected: natural, none)`);
  process.exit(2);
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
  vulnerability?: Vulnerability,
): Deal {
  const rng = mulberry32(seed);
  const constraints: DealConstraints = {
    ...bundle.dealConstraints,
    ...(vulnerability !== undefined ? { vulnerability } : {}),
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
  vulnerability: Vulnerability = Vulnerability.None,
): BiddingContext {
  const evaluation = evaluateHand(hand);
  return createBiddingContext({
    hand,
    auction,
    seat,
    evaluation,
    vulnerability,
    dealer: auction.entries.length > 0 ? auction.entries[0]!.seat : Seat.North,
  });
}

// ── Hand formatting ─────────────────────────────────────────────────

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

// Settings flags (shared across subcommands)
const vuln = parseVulnerability(flags);
const opponentMode = parseOpponentMode(flags);

if (!subcommand || subcommand === "--help" || subcommand === "-h") {
  printUsage();
  process.exit(2);
}

switch (subcommand) {
  case "list":
    runList();
    break;
  case "eval":
    runEval();
    break;
  case "play":
    runPlay();
    break;
  case "selftest":
    runSelftest();
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

// ── Subcommand: eval ────────────────────────────────────────────────
//
// Per-atom evaluation. The --atom flag takes an atomId from the plan
// (e.g., "responder-r1/sf:responder-r1/stayman:ask-major") and
// internally parses it into target state + surface.
//
//   eval --bundle=X --atom=ATOM_ID --seed=N
//     Returns sanitized viewport: seat, hand, hcp, auction, legalCalls.
//     No correct answer, no internal identifiers beyond seat.
//
//   eval --bundle=X --atom=ATOM_ID --seed=N --bid=2C
//     Returns viewport + full teaching feedback (ViewportBidFeedback + TeachingDetail).
//     Exit code: 0=correct/acceptable, 1=wrong.

function parseAtomId(atomId: string): { stateId: string; surfaceId: string; meaningId: string } {
  const parts = atomId.split("/");
  if (parts.length < 3) {
    console.error(`Invalid atom ID: "${atomId}" (expected stateId/surfaceId/meaningId)`);
    process.exit(2);
  }
  return {
    stateId: parts[0]!,
    surfaceId: parts[1]!,
    meaningId: parts.slice(2).join("/"),
  };
}

function runEval(): void {
  const bundleId = requireArg(flags, "bundle");
  const atomId = requireArg(flags, "atom");
  const seed = optionalNumericArg(flags, "seed") ?? 42;
  const bidStr = flags["bid"] as string | undefined;

  const { stateId } = parseAtomId(atomId);
  const spec = resolveSpec(bundleId);
  const bundle = resolveBundle(bundleId);

  const deal = generateSeededDeal(bundle, seed, vuln);
  const userSeat = resolveUserSeat(bundle, deal);
  const { auction, targeted } = resolveAuction(bundle, spec, deal, stateId, userSeat);

  const activeSeat = auction.entries.length > 0
    ? nextSeatClockwise(auction.entries[auction.entries.length - 1]!.seat)
    : userSeat;
  const hand = deal.hands[activeSeat];
  const legalCalls = getLegalCalls(auction, activeSeat).map(callKey);

  // Viewport — always included, always sanitized
  const viewport = {
    seat: activeSeat as string,
    hand: formatHandBySuit(hand),
    hcp: evaluateHand(hand).hcp,
    auction: auction.entries.map((e) => ({
      seat: e.seat as string,
      call: callKey(e.call),
    })),
    legalCalls,
  };

  if (!bidStr || bidStr === "true") {
    // No bid: return viewport only
    console.log(JSON.stringify(viewport, null, 2));
    return;
  }

  // Bid submitted: grade with full teaching feedback
  let submittedCall: Call;
  try {
    submittedCall = parsePatternCall(bidStr);
  } catch {
    console.error(`Invalid bid: "${bidStr}"`);
    process.exit(2);
  }

  const strategy = protocolSpecToStrategy(spec);
  const context = buildContext(hand, auction, activeSeat, vuln);
  const result = strategy.suggest(context);

  if (!result) {
    console.log(JSON.stringify({
      viewport,
      grade: "skip",
      correct: false,
      skip: true,
      feedback: null,
      teaching: null,
    }, null, 2));
    process.exit(0);
    return;
  }

  const strategyEval = (strategy as ConventionBiddingStrategy).getLastEvaluation?.() ?? null;
  const teachingResolution = resolveTeachingAnswer(
    result,
    strategyEval?.acceptableAlternatives ?? undefined,
    strategyEval?.intentFamilies ?? undefined,
  );
  const grade = gradeBid(submittedCall, teachingResolution);
  const bidFeedback = {
    grade,
    userCall: submittedCall,
    expectedResult: result,
    teachingResolution,
    practicalRecommendation: strategyEval?.practicalRecommendation ?? null,
    teachingProjection: strategyEval?.teachingProjection ?? null,
    practicalScoreBreakdown: strategyEval?.practicalRecommendation?.scoreBreakdown ?? null,
    evaluationExhaustive: (strategyEval?.arbitration as any)?.evidenceBundle?.exhaustive ?? false,
    fallbackReached: (strategyEval?.arbitration as any)?.evidenceBundle?.fallbackReached ?? false,
  };

  const viewportFeedback = buildViewportFeedback(bidFeedback);
  const teachingDetail = buildTeachingDetail(bidFeedback);
  const isCorrect = grade === BidGrade.Correct || grade === BidGrade.CorrectNotPreferred;
  const isAcceptable = grade === BidGrade.Acceptable;

  console.log(JSON.stringify({
    viewport,
    yourBid: callKey(submittedCall),
    correctBid: callKey(result.call),
    grade,
    correct: isCorrect,
    acceptable: isAcceptable,
    skip: false,
    feedback: viewportFeedback,
    teaching: teachingDetail,
  }, null, 2));
  process.exit(isCorrect || isAcceptable ? 0 : 1);
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
        const deal = generateSeededDeal(bundle, atomSeed, vuln);
        const userSeat = resolveUserSeat(bundle, deal);

        // Build targeted auction to reach the atom's state
        const { auction, targeted } = resolveAuction(bundle, spec, deal, atom.baseStateId, userSeat);

        // Determine active seat at the target state
        const activeSeat = auction.entries.length > 0
          ? nextSeatClockwise(auction.entries[auction.entries.length - 1]!.seat)
          : userSeat;
        const hand = deal.hands[activeSeat];

        // Build context from the active seat's perspective
        const context = buildContext(hand, auction, activeSeat, vuln);

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
  /** Whether this is a convention-player decision point (user or partner) vs opponent pass. */
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
  vulnerability: Vulnerability = Vulnerability.None,
  opponents: OpponentMode = "none",
): PlaythroughResult {
  const deal = generateSeededDeal(bundle, seed, vulnerability);
  const userSeat = resolveUserSeat(bundle, deal);
  const partner = partnerOf(userSeat);
  const strategy = protocolSpecToStrategy(spec);
  const ewStrategy = opponents === "natural"
    ? createStrategyChain([naturalFallbackStrategy])
    : null;

  const initAuction = buildInitialAuction(bundle, userSeat, deal);
  const entries: { seat: Seat; call: Call }[] = [...initAuction.entries];

  const steps: PlaythroughStep[] = [];
  const atomsCovered: string[] = [];
  const maxIter = 30; // safety limit

  for (let iter = 0; iter < maxIter; iter++) {
    const activeSeat = entries.length > 0
      ? nextSeatClockwise(entries[entries.length - 1]!.seat)
      : userSeat;

    // Opponent turn
    if (activeSeat !== userSeat && activeSeat !== partner) {
      let opponentCall: Call = { type: "pass" };
      if (ewStrategy) {
        const hand = deal.hands[activeSeat];
        const auction: Auction = { entries: [...entries], isComplete: false };
        const ctx = buildContext(hand, auction, activeSeat, vulnerability);
        const ewResult = ewStrategy.suggest(ctx);
        if (ewResult) opponentCall = ewResult.call;
      }
      entries.push({ seat: activeSeat, call: opponentCall });
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
    const context = buildContext(hand, auction, activeSeat, vulnerability);
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
      isUserStep: activeSeat === userSeat || activeSeat === partner,
    });

    entries.push({ seat: activeSeat, call: result.call });
  }

  return { seed, steps, atomsCovered };
}

// ── Subcommand: play ────────────────────────────────────────────────
//
// Playthrough evaluation. Runs a full auction for a seed and lets the
// agent step through each convention-player decision point.
//
//   play --bundle=X --seed=N
//     Returns { totalSteps, step: <first viewport> }
//
//   play --bundle=X --seed=N --step=N
//     Returns viewport for step N (hand, seat, auction, legal calls)
//
//   play --bundle=X --seed=N --step=N --bid=2C
//     Returns { step: <viewport>, grade: <feedback+teaching>, nextStep: <next viewport> | null }
//     One fewer round-trip: grade + next viewport in one call.
//     Exit code: 0=correct/acceptable, 1=wrong.
//
//   play --bundle=X --seed=N --reveal
//     Full trace with all recommendations and atom IDs.

function buildStepViewport(s: PlaythroughStep): Record<string, unknown> {
  return {
    index: s.stepIndex,
    seat: s.seat,
    hand: s.hand,
    hcp: s.hcp,
    auctionSoFar: s.auctionSoFar,
    legalCalls: s.legalCalls,
  };
}

function gradePlaythroughStep(
  s: PlaythroughStep,
  submittedCall: Call,
  spec: ConventionSpec,
  bundle: ConventionBundle,
  seed: number,
  vulnerability: Vulnerability = Vulnerability.None,
): { viewportFeedback: ReturnType<typeof buildViewportFeedback>; teachingDetail: ReturnType<typeof buildTeachingDetail>; isCorrect: boolean; isAcceptable: boolean } {
  // Rebuild context for this step to get full teaching feedback
  const deal = generateSeededDeal(bundle, seed, vulnerability);
  const activeSeat = s.seat as Seat;
  const hand = deal.hands[activeSeat];
  const auction: Auction = { entries: s.auctionSoFar.map((e) => ({ seat: e.seat as Seat, call: parsePatternCall(e.call) })), isComplete: false };
  const context = buildContext(hand, auction, activeSeat, vulnerability);

  const strategy = protocolSpecToStrategy(spec);
  const result = strategy.suggest(context);

  if (!result) {
    const fallbackResult: import("../core/contracts").BidResult = {
      call: { type: "pass" },
      ruleName: null,
      explanation: "No convention bid applies",
    };
    const fallbackResolution = resolveTeachingAnswer(fallbackResult);
    const emptyFeedback = buildViewportFeedback({
      grade: BidGrade.Incorrect,
      userCall: submittedCall,
      expectedResult: fallbackResult,
      teachingResolution: fallbackResolution,
      practicalRecommendation: null,
      teachingProjection: null,
      practicalScoreBreakdown: null,
      evaluationExhaustive: false,
      fallbackReached: true,
    });
    const emptyTeaching = buildTeachingDetail({
      grade: BidGrade.Incorrect,
      userCall: submittedCall,
      expectedResult: fallbackResult,
      teachingResolution: fallbackResolution,
      practicalRecommendation: null,
      teachingProjection: null,
      practicalScoreBreakdown: null,
      evaluationExhaustive: false,
      fallbackReached: true,
    });
    return { viewportFeedback: emptyFeedback, teachingDetail: emptyTeaching, isCorrect: false, isAcceptable: false };
  }

  const strategyEval = (strategy as ConventionBiddingStrategy).getLastEvaluation?.() ?? null;
  const teachingResolution = resolveTeachingAnswer(
    result,
    strategyEval?.acceptableAlternatives ?? undefined,
    strategyEval?.intentFamilies ?? undefined,
  );
  const grade = gradeBid(submittedCall, teachingResolution);
  const bidFeedback = {
    grade,
    userCall: submittedCall,
    expectedResult: result,
    teachingResolution,
    practicalRecommendation: strategyEval?.practicalRecommendation ?? null,
    teachingProjection: strategyEval?.teachingProjection ?? null,
    practicalScoreBreakdown: strategyEval?.practicalRecommendation?.scoreBreakdown ?? null,
    evaluationExhaustive: (strategyEval?.arbitration as any)?.evidenceBundle?.exhaustive ?? false,
    fallbackReached: (strategyEval?.arbitration as any)?.evidenceBundle?.fallbackReached ?? false,
  };

  return {
    viewportFeedback: buildViewportFeedback(bidFeedback),
    teachingDetail: buildTeachingDetail(bidFeedback),
    isCorrect: grade === BidGrade.Correct || grade === BidGrade.CorrectNotPreferred,
    isAcceptable: grade === BidGrade.Acceptable,
  };
}

function runPlay(): void {
  const bundleId = requireArg(flags, "bundle");
  const seed = optionalNumericArg(flags, "seed") ?? 42;
  const stepIdx = optionalNumericArg(flags, "step");
  const bidStr = flags["bid"] as string | undefined;
  const reveal = flags["reveal"] === true;

  const spec = resolveSpec(bundleId);
  const bundle = resolveBundle(bundleId);
  const atomCallMap = buildAtomCallMap(spec);

  const result = runSinglePlaythrough(bundle, spec, seed, atomCallMap, vuln, opponentMode);
  const userSteps = result.steps.filter((s) => s.isUserStep);

  if (reveal) {
    // Full trace with all recommendations and atom IDs
    console.log(JSON.stringify({
      seed,
      totalSteps: userSteps.length,
      steps: result.steps,
      atomsCovered: result.atomsCovered,
    }, null, 2));
    return;
  }

  if (stepIdx === undefined) {
    // No step: return totalSteps + first viewport
    console.log(JSON.stringify({
      seed,
      totalSteps: userSteps.length,
      step: userSteps.length > 0 ? buildStepViewport(userSteps[0]!) : null,
    }, null, 2));
    return;
  }

  if (stepIdx < 0 || stepIdx >= userSteps.length) {
    console.error(`Step ${stepIdx} out of range (0-${userSteps.length - 1})`);
    process.exit(2);
  }

  const s = userSteps[stepIdx]!;
  const viewport = buildStepViewport(s);

  if (!bidStr || bidStr === "true") {
    // No bid: viewport only for this step
    console.log(JSON.stringify({
      seed,
      totalSteps: userSteps.length,
      step: viewport,
    }, null, 2));
    return;
  }

  // Bid submitted: grade + next viewport
  let submittedCall: Call;
  try {
    submittedCall = parsePatternCall(bidStr);
  } catch {
    console.error(`Invalid bid: "${bidStr}"`);
    process.exit(2);
  }

  const { viewportFeedback, teachingDetail, isCorrect, isAcceptable } =
    gradePlaythroughStep(s, submittedCall, spec, bundle, seed, vuln);

  const nextStepIdx = stepIdx + 1;
  const nextStep = nextStepIdx < userSteps.length
    ? buildStepViewport(userSteps[nextStepIdx]!)
    : null;

  console.log(JSON.stringify({
    seed,
    totalSteps: userSteps.length,
    step: viewport,
    yourBid: callKey(submittedCall),
    grade: viewportFeedback.grade,
    correct: isCorrect,
    acceptable: isAcceptable,
    feedback: viewportFeedback,
    teaching: teachingDetail,
    nextStep,
    complete: nextStep === null,
  }, null, 2));

  process.exit(isCorrect || isAcceptable ? 0 : 1);
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

  // Build dependency graph for stop-on-error propagation
  const dependencyGraph: Record<string, {
    depth: number;
    parentStateId: string | null;
    children: string[];
  }> = {};

  for (const [stateId, info] of stateInfo) {
    dependencyGraph[stateId] = {
      depth: info.depth,
      parentStateId: info.parentStateId,
      children: [],
    };
  }

  for (const [stateId, info] of stateInfo) {
    if (info.parentStateId && dependencyGraph[info.parentStateId]) {
      dependencyGraph[info.parentStateId]!.children.push(stateId);
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
        const deal = generateSeededDeal(bundle, s, vuln);
        const userSeat = resolveUserSeat(bundle, deal);
        const { auction, targeted } = resolveAuction(bundle, spec, deal, atom.baseStateId, userSeat);
        if (!targeted) continue;

        const activeSeat = auction.entries.length > 0
          ? nextSeatClockwise(auction.entries[auction.entries.length - 1]!.seat)
          : userSeat;
        const hand = deal.hands[activeSeat];
        const context = buildContext(hand, auction, activeSeat, vuln);
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

  // Phase 1 atoms are orchestrator-driven (no per-agent split needed)

  // ── Phase 2: Playthrough seed selection ──
  // Use unique seeds from Phase 1 — they're known to exercise interesting states.
  // Run playthroughs to get step counts for balanced agent distribution.
  const atomCallMap = buildAtomCallMap(spec);
  const uniqueSeeds = [...new Set(atomPlans.flatMap((a) => a.seeds))];

  const playthroughInfo: { seed: number; userSteps: number; atomsCovered: string[] }[] = [];
  for (const seed of uniqueSeeds) {
    try {
      const result = runSinglePlaythrough(bundle, spec, seed, atomCallMap, vuln, opponentMode);
      const userSteps = result.steps.filter((s) => s.isUserStep);
      playthroughInfo.push({
        seed,
        userSteps: userSteps.length,
        atomsCovered: [...result.atomsCovered],
      });
    } catch {
      // Skip seeds that error during playthrough
    }
  }

  // Distribute across agents balanced by step count
  const phase2Agents: { agentIndex: number; seeds: number[]; estimatedSteps: number }[] = [];
  for (let i = 0; i < agentCount; i++) {
    phase2Agents.push({ agentIndex: i, seeds: [], estimatedSteps: 0 });
  }

  // Sort by step count descending — assign largest first for better balance
  playthroughInfo.sort((a, b) => b.userSteps - a.userSteps);

  for (const pt of playthroughInfo) {
    const minAgent = phase2Agents.reduce((a, b) =>
      a.estimatedSteps <= b.estimatedSteps ? a : b,
    );
    minAgent.seeds.push(pt.seed);
    minAgent.estimatedSteps += pt.userSteps;
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

    // Phase 1: Per-atom targeted evaluation (orchestrator-private)
    phase1: {
      description: "Per-atom targeted evaluation. Orchestrator walks atoms in BFS order, calls `eval --atom=ATOM_ID --seed=N` for viewports, grades with `eval --atom=ATOM_ID --seed=N --bid=X`, enforces stop-on-error via dependency graph.",
      atoms: atomPlans.map((ap) => ({
        atomId: ap.atomId,
        stateId: ap.stateId,
        surfaceId: ap.surfaceId,
        meaningId: ap.meaningId,
        meaningLabel: ap.meaningLabel,
        expectedBid: ap.expectedBid,
        depth: ap.depth,
        parentStateId: ap.parentStateId,
        transitionBid: ap.transitionBid,
        seeds: ap.seeds,
      })),
      dependencyGraph,
    },

    // Phase 2: Playthrough integration testing (agent-driven)
    phase2: {
      description: "Playthrough integration testing. Agents run full playthroughs end-to-end using `play` command. Seeds are from Phase 1, balanced by step count.",
      totalPlaythroughSeeds: playthroughInfo.length,
      agents: phase2Agents.map((a) => ({
        agentIndex: a.agentIndex,
        bundleId,
        seeds: a.seeds,
        estimatedSteps: a.estimatedSteps,
      })),
    },
  }, null, 2));
}

// ── Usage ───────────────────────────────────────────────────────────

function printUsage(): void {
  console.error("Usage: coverage-runner.ts <subcommand> [options]");
  console.error("");
  console.error("── Global settings (apply to all subcommands) ────────────────");
  console.error("  --vuln=<none|ns|ew|both>        Vulnerability (default: none)");
  console.error("  --opponents=<natural|none>      Opponent bidding mode (default: none)");
  console.error("");
  console.error("── Planning & diagnostics ──────────────────────────────────────");
  console.error("  list      --bundle=<id>                    List all coverage atoms");
  console.error("  plan      --bundle=<id> --agents=N [--coverage=2] [--max-seeds=500] [--seed=0]");
  console.error("            Precompute two-phase evaluation plan");
  console.error("  selftest  --bundle=<id> [--seed=N]         Strategy self-test");
  console.error("  selftest  --all [--seed=N]                 Self-test all bundles");
  console.error("");
  console.error("── Per-atom evaluation (Phase 1, orchestrator-driven) ─────────");
  console.error("  eval      --bundle=<id> --atom=<atomId> --seed=N");
  console.error("            Returns sanitized viewport (seat, hand, hcp, auction, legal calls)");
  console.error("  eval      --bundle=<id> --atom=<atomId> --seed=N --bid=<bid>");
  console.error("            Returns viewport + full teaching feedback + grade");
  console.error("");
  console.error("── Playthrough evaluation (Phase 2, agent-driven) ─────────────");
  console.error("  play      --bundle=<id> --seed=N");
  console.error("            Returns { totalSteps, step: <first viewport> }");
  console.error("  play      --bundle=<id> --seed=N --step=N");
  console.error("            Returns viewport for step N");
  console.error("  play      --bundle=<id> --seed=N --step=N --bid=<bid>");
  console.error("            Returns grade + teaching + next step viewport");
  console.error("  play      --bundle=<id> --seed=N --reveal");
  console.error("            Full trace with all recommendations and atom IDs");
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
