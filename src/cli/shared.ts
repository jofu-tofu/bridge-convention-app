// ── CLI shared utilities ────────────────────────────────────────────
//
// Pure functions shared across CLI subcommands: argument parsing,
// settings resolution, spec/bundle lookup, deal generation,
// auction construction, hand formatting, and viewport construction.

import { generateDeal } from "../engine/deal-generator";
import { mulberry32 } from "../engine/seeded-rng";
import { evaluateHand } from "../engine/hand-evaluator";
import { callKey } from "../engine/call-helpers";
import { Seat, Vulnerability } from "../engine/types";
import type {
  Auction,
  Call,
  Hand,
  Deal,
  DealConstraints,
  Card,
} from "../engine/types";
import {
  OpponentMode,
  createBiddingContext,
} from "../service/session-types";
import type { BaseSystemId, BiddingContext } from "../service/session-types";

// ── Stub types for convention catalog (now in Rust/WASM) ────────────
// These were formerly imported from conventions/. The CLI commands that
// depend on the full TS backend (info, selftest, plan, verify) have been
// removed. Remaining stubs support shared.ts functions that are still used.

export interface ConventionSpec {
  readonly id: string;
  readonly modules?: readonly unknown[];
  suggest(context: BiddingContext): { call: Call; ruleName: string | null; explanation: string } | null;
}

export interface ConventionBundle {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly category?: string;
  readonly internal?: boolean;
  readonly modules?: readonly unknown[];
  readonly dealConstraints: DealConstraints;
  readonly defaultAuction?: (seat: Seat, deal?: Deal) => Auction | undefined;
}

const BASE_SYSTEM_SAYC: BaseSystemId = "sayc";
const BASE_SYSTEM_ACOL: BaseSystemId = "acol";

// ── Re-exports for convenience ──────────────────────────────────────

export { Seat, Vulnerability };
export { callKey };
export type { Auction, Call, Deal, OpponentMode, BaseSystemId };

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
  if (val === undefined || val === true) return OpponentMode.Natural;
  if (val === (OpponentMode.Natural as string) || val === (OpponentMode.None as string)) return val as OpponentMode;
  console.error(`Invalid --opponents value: "${val}" (expected: natural, none)`);
  process.exit(2);
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
    opponents = { type: "fixed", value: OpponentMode.Natural };
  } else if (typeof oppVal === "string" && oppVal.toLowerCase() === "mixed") {
    opponents = { type: "mixed", naturalRate: 0.5 };
  } else if (oppVal === (OpponentMode.Natural as string) || oppVal === (OpponentMode.None as string)) {
    opponents = { type: "fixed", value: oppVal as OpponentMode };
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
    : (mulberry32(seed ^ 0xA7E2_B93D)() < config.opponents.naturalRate ? OpponentMode.Natural : OpponentMode.None);

  return { vulnerability, opponents };
}

/** Pick a vulnerability from a uniform distribution over all 4 states. */
function pickVulnUniform(roll: number): Vulnerability {
  if (roll < 0.25) return Vulnerability.None;
  if (roll < 0.50) return Vulnerability.NorthSouth;
  if (roll < 0.75) return Vulnerability.EastWest;
  return Vulnerability.Both;
}

// ── Resolve spec + bundle (stubs — catalog is now in Rust/WASM) ─────
// The CLI commands that used these (info, selftest, plan, verify) have
// been removed. These stubs remain for compilation but throw at runtime.

export function printAvailableBundles(): void {
  console.error("  (bundle catalog is now in Rust/WASM — use WasmService)");
}

export function resolveSpec(bundleId: string, _baseSystem: BaseSystemId = BASE_SYSTEM_SAYC): ConventionSpec {
  throw new Error(`resolveSpec("${bundleId}"): convention catalog has moved to Rust/WASM`);
}

function resolveBundle(bundleId: string, _baseSystem: BaseSystemId = BASE_SYSTEM_SAYC): ConventionBundle {
  throw new Error(`resolveBundle("${bundleId}"): convention catalog has moved to Rust/WASM`);
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

/** Resolve a ConventionBundle with modules for rule enumeration.
 *  Stub — convention catalog has moved to Rust/WASM. */
export function resolveBundleWithRules(bundleId: string, baseSystem: BaseSystemId = BASE_SYSTEM_SAYC): ConventionBundle {
  return resolveBundle(bundleId, baseSystem);
}


