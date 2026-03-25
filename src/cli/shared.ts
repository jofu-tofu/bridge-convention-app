// ── CLI shared utilities ────────────────────────────────────────────
//
// Pure functions shared across CLI subcommands: argument parsing,
// settings resolution, spec/bundle lookup, deal generation,
// auction construction, hand formatting, and viewport construction.

import { getBundleInput, listBundleInputs, resolveBundle as resolveBundleFn, specFromBundle, createBiddingContext } from "../conventions";
import { generateDeal } from "../engine/deal-generator";
import { mulberry32 } from "../engine/seeded-rng";
import { evaluateHand } from "../engine/hand-evaluator";
import { callKey } from "../engine/call-helpers";
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
import type { ConventionSpec, ConventionBundle } from "../conventions";
import type { BiddingContext, BidHistoryEntry } from "../service";
import type { BiddingStrategy } from "../service";
import type { OpponentMode } from "../session/drill-types";
import type { DrillSettings } from "../session/drill-types";
import { DEFAULT_DRILL_TUNING } from "../session/drill-types";
import type { BaseSystemId } from "../conventions/definitions/system-config";
import { BASE_SYSTEM_SAYC, BASE_SYSTEM_ACOL } from "../conventions/definitions/system-config";
import { getSystemConfig } from "../conventions/definitions/system-config";
import type { BiddingViewport } from "../service/response-types";
import { buildBiddingViewport } from "../session/build-viewport";

// ── Re-exports for convenience ──────────────────────────────────────

export { Seat, Vulnerability };
export { callKey, parsePatternCall, getLegalCalls, evaluateHand };
export { buildBiddingViewport };
export type { Auction, Call, Hand, Deal, Card, ConventionSpec, ConventionBundle, BiddingContext, OpponentMode, BiddingViewport, BidHistoryEntry, DrillSettings, BaseSystemId };

// ── Flags type ──────────────────────────────────────────────────────

export type Flags = Record<string, string | true>;

// ── Argument parsing ────────────────────────────────────────────────

export function parseArgs(argv: string[]): Flags {
  const result: Flags = {};
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

export function requireArg(args: Flags, name: string): string {
  const val = args[name];
  if (val === undefined || val === true) {
    console.error(`Missing required argument: --${name}`);
    process.exit(2);
  }
  return val;
}

export function optionalNumericArg(args: Flags, name: string): number | undefined {
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

export function parseVulnerability(args: Flags): Vulnerability {
  const val = args["vuln"];
  if (val === undefined || val === true) return Vulnerability.None;
  const mapped = VULN_MAP[val.toLowerCase()];
  if (mapped === undefined) {
    console.error(`Invalid --vuln value: "${val}" (expected: none, ns, ew, both)`);
    process.exit(2);
  }
  return mapped;
}

const SYSTEM_MAP: Record<string, BaseSystemId> = {
  sayc: BASE_SYSTEM_SAYC,
  "two-over-one": "two-over-one",
  acol: BASE_SYSTEM_ACOL,
};

export function parseBaseSystem(args: Flags): BaseSystemId {
  const val = args["system"];
  if (val === undefined || val === true) return BASE_SYSTEM_SAYC;
  const mapped = SYSTEM_MAP[val.toLowerCase()];
  if (mapped === undefined) {
    console.error(`Invalid --system value: "${val}" (expected: sayc, two-over-one, acol)`);
    process.exit(2);
  }
  return mapped;
}

export function parseOpponentMode(args: Flags): OpponentMode {
  const val = args["opponents"];
  if (val === undefined || val === true) return "natural";
  if (val === "natural" || val === "none") return val;
  console.error(`Invalid --opponents value: "${val}" (expected: natural, none)`);
  process.exit(2);
}

/** Build a DrillSettings from CLI flags.
 *  Converts a fixed --vuln value into a single-value distribution
 *  so the CLI can share the same domain type as the UI store. */
export function buildDrillSettings(args: Flags): DrillSettings {
  const vuln = parseVulnerability(args);
  return {
    opponentMode: parseOpponentMode(args),
    tuning: {
      ...DEFAULT_DRILL_TUNING,
      vulnerabilityDistribution: vulnerabilityToDistribution(vuln),
    },
  };
}

/** Convert a fixed Vulnerability into a degenerate single-value distribution. */
export function vulnerabilityToDistribution(
  v: Vulnerability,
): { none: number; ours: number; theirs: number; both: number } {
  return {
    none: v === Vulnerability.None ? 1 : 0,
    ours: v === Vulnerability.NorthSouth ? 1 : 0,
    theirs: v === Vulnerability.EastWest ? 1 : 0,
    both: v === Vulnerability.Both ? 1 : 0,
  };
}

// ── Per-seed scenario config (plan command) ─────────────────────────
//
// "fixed"  — every seed uses the same vulnerability / opponent mode.
// "mixed"  — each seed gets a deterministic assignment drawn from a
//            uniform distribution (vulnerability × opponents).

export type VulnMode =
  | { type: "fixed"; value: Vulnerability }
  | { type: "mixed" };

export type OpponentsModeConfig =
  | { type: "fixed"; value: OpponentMode }
  | { type: "mixed"; naturalRate: number };

export interface ScenarioConfig {
  vuln: VulnMode;
  opponents: OpponentsModeConfig;
}

export function parseScenarioConfig(args: Flags): ScenarioConfig {
  // Vulnerability
  let vuln: VulnMode;
  const vulnVal = args["vuln"];
  if (vulnVal === undefined || vulnVal === true) {
    vuln = { type: "fixed", value: Vulnerability.None };
  } else if (typeof vulnVal === "string" && vulnVal.toLowerCase() === "mixed") {
    vuln = { type: "mixed" };
  } else if (typeof vulnVal === "string") {
    const mapped = VULN_MAP[vulnVal.toLowerCase()];
    if (mapped === undefined) {
      console.error(`Invalid --vuln value: "${vulnVal}" (expected: none, ns, ew, both, mixed)`);
      process.exit(2);
    }
    vuln = { type: "fixed", value: mapped };
  } else {
    vuln = { type: "fixed", value: Vulnerability.None };
  }

  // Opponents
  let opponents: OpponentsModeConfig;
  const oppVal = args["opponents"];
  if (oppVal === undefined || oppVal === true) {
    opponents = { type: "fixed", value: "natural" };
  } else if (typeof oppVal === "string" && oppVal.toLowerCase() === "mixed") {
    opponents = { type: "mixed", naturalRate: 0.5 };
  } else if (oppVal === "natural" || oppVal === "none") {
    opponents = { type: "fixed", value: oppVal };
  } else {
    console.error(`Invalid --opponents value: "${oppVal}" (expected: natural, none, mixed)`);
    process.exit(2);
  }

  return { vuln, opponents };
}

/** Deterministically assign a (vulnerability, opponents) pair to a seed.
 *  Uses an RNG offset from the deal-generation RNG to avoid correlation. */
export function assignSeedScenario(
  seed: number,
  config: ScenarioConfig,
  _userSeat: Seat = Seat.South,
): { vulnerability: Vulnerability; opponents: OpponentMode } {
  const vulnerability = config.vuln.type === "fixed"
    ? config.vuln.value
    : pickVulnUniform(mulberry32(seed ^ 0x5C3A_410F)());

  const opponents = config.opponents.type === "fixed"
    ? config.opponents.value
    : (mulberry32(seed ^ 0xA7E2_B93D)() < config.opponents.naturalRate ? "natural" : "none");

  return { vulnerability, opponents };
}

/** Pick a vulnerability from a uniform distribution over all 4 states. */
function pickVulnUniform(roll: number): Vulnerability {
  if (roll < 0.25) return Vulnerability.None;
  if (roll < 0.50) return Vulnerability.NorthSouth;
  if (roll < 0.75) return Vulnerability.EastWest;
  return Vulnerability.Both;
}

// ── Resolve spec + bundle ────────────────────────────────────────────

/** Print available bundle IDs from the system registry (single source of truth). */
export function printAvailableBundles(): void {
  for (const b of listBundleInputs()) {
    if (b.internal) continue;
    console.error(`  ${b.id} — ${b.name}`);
  }
}

export function resolveSpec(bundleId: string, baseSystem: BaseSystemId = BASE_SYSTEM_SAYC): ConventionSpec {
  const input = getBundleInput(bundleId);
  if (!input) {
    console.error(`Unknown bundle: "${bundleId}"`);
    console.error("Available bundles:");
    printAvailableBundles();
    process.exit(2);
  }
  const spec = specFromBundle(input, getSystemConfig(baseSystem));
  if (!spec) {
    console.error(`No ConventionSpec derivable for "${bundleId}"`);
    process.exit(2);
  }
  return spec;
}

export function resolveBundle(bundleId: string, baseSystem: BaseSystemId = BASE_SYSTEM_SAYC): ConventionBundle {
  const input = getBundleInput(bundleId);
  if (!input) {
    console.error(`Unknown bundle: "${bundleId}"`);
    console.error("Available bundles:");
    printAvailableBundles();
    process.exit(2);
  }
  return resolveBundleFn(input, getSystemConfig(baseSystem));
}

// ── Deal generation ─────────────────────────────────────────────────

export function generateSeededDeal(
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

export function resolveUserSeat(bundle: ConventionBundle, deal: Deal): Seat {
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

export function buildInitialAuction(
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

export function buildContext(
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

export function formatHandBySuit(hand: Hand): Record<string, string[]> {
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

export function nextSeatClockwise(seat: Seat): Seat {
  switch (seat) {
    case Seat.North: return Seat.East;
    case Seat.East: return Seat.South;
    case Seat.South: return Seat.West;
    case Seat.West: return Seat.North;
  }
}

export function partnerOf(seat: Seat): Seat {
  switch (seat) {
    case Seat.North: return Seat.South;
    case Seat.South: return Seat.North;
    case Seat.East: return Seat.West;
    case Seat.West: return Seat.East;
  }
}

/** Resolve a ConventionBundle with modules for rule enumeration. */
export function resolveBundleWithRules(bundleId: string, baseSystem: BaseSystemId = BASE_SYSTEM_SAYC): ConventionBundle {
  return resolveBundle(bundleId, baseSystem);
}

// ── Viewport construction ───────────────────────────────────────────
//
// The CLI must use the SAME viewport boundary as the UI. These helpers
// bridge CLI-available data into buildBiddingViewport() inputs.

/**
 * Build a BidHistoryEntry[] from auction entries by replaying each
 * convention-player bid through the strategy to extract alert info.
 *
 * Opponent passes get no alert. Convention-player bids get the alert
 * from the strategy's BidResult (same path the UI store uses).
 */
export function buildCliBidHistory(
  auction: Auction,
  deal: Deal,
  userSeat: Seat,
  strategy: BiddingStrategy,
  vulnerability: Vulnerability = Vulnerability.None,
): BidHistoryEntry[] {
  const partner = partnerOf(userSeat);
  const history: BidHistoryEntry[] = [];

  for (let i = 0; i < auction.entries.length; i++) {
    const entry = auction.entries[i]!;
    const isConventionPlayer = entry.seat === userSeat || entry.seat === partner;

    if (!isConventionPlayer) {
      // Opponent bid — no convention alert
      history.push({
        seat: entry.seat,
        call: entry.call,
        isUser: false,
      });
      continue;
    }

    // Convention player — replay through strategy to get alert info
    const auctionBefore: Auction = {
      entries: auction.entries.slice(0, i),
      isComplete: false,
    };
    const hand = deal.hands[entry.seat];
    const ctx = buildContext(hand, auctionBefore, entry.seat, vulnerability);
    const result = strategy.suggest(ctx);

    history.push({
      seat: entry.seat,
      call: entry.call,
      meaning: result?.meaning,
      isUser: entry.seat === userSeat,
      alertLabel: result?.alert?.teachingLabel,
      annotationType: result?.alert?.annotationType,
    });
  }

  return history;
}

/**
 * Build a proper BiddingViewport for the CLI using the same
 * buildBiddingViewport() function the UI uses.
 *
 * This is the SINGLE information boundary — the CLI sees exactly
 * what a player would see in the Svelte UI.
 */
export function buildCliViewport(opts: {
  deal: Deal;
  auction: Auction;
  userSeat: Seat;
  activeSeat: Seat;
  strategy: BiddingStrategy;
  bundleName: string;
  vulnerability?: Vulnerability;
}): BiddingViewport {
  const { deal, auction, userSeat, activeSeat, strategy, bundleName, vulnerability } = opts;

  const bidHistory = buildCliBidHistory(
    auction, deal, userSeat, strategy,
    vulnerability ?? deal.vulnerability,
  );

  return buildBiddingViewport({
    deal,
    userSeat: activeSeat,
    auction,
    bidHistory,
    legalCalls: getLegalCalls(auction, activeSeat),
    faceUpSeats: new Set([activeSeat]),
    conventionName: bundleName,
    isUserTurn: true,
    currentBidder: activeSeat,
  });
}
