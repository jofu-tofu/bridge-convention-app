// ── CLI shared utilities ────────────────────────────────────────────
//
// Pure functions shared across CLI subcommands: argument parsing,
// settings resolution, call parsing.

import { Vulnerability, BidSuit } from "../engine/types";
import type { Call } from "../engine/types";
import { OpponentMode, PracticeMode, PracticeRole } from "../service/session-types";
import type { BaseSystemId } from "../service/session-types";

// ── Re-exports for convenience ──────────────────────────────────────

export { Vulnerability };

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

const BASE_SYSTEM_SAYC: BaseSystemId = "sayc";
const BASE_SYSTEM_ACOL: BaseSystemId = "acol";

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

// ── Call parsing ────────────────────────────────────────────────────

const STRAIN_MAP: Record<string, BidSuit> = { C: BidSuit.Clubs, D: BidSuit.Diamonds, H: BidSuit.Hearts, S: BidSuit.Spades, NT: BidSuit.NoTrump, N: BidSuit.NoTrump };

/** Parse a bid string like "2C", "P", "X", "XX" into a Call object. */
export function parseCallString(s: string): Call {
  const upper = s.toUpperCase().trim();
  if (upper === "P" || upper === "PASS") return { type: "pass" };
  if (upper === "X" || upper === "DBL" || upper === "DOUBLE") return { type: "double" };
  if (upper === "XX" || upper === "RDBL" || upper === "REDOUBLE") return { type: "redouble" };
  const match = upper.match(/^([1-7])(C|D|H|S|NT|N)$/);
  if (!match) {
    console.error(`Invalid bid: "${s}" (expected: P, X, XX, or 1C..7NT)`);
    process.exit(2);
  }
  const level = Number(match[1]) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  const strain = STRAIN_MAP[match[2]!]!;
  return { type: "bid", level, strain };
}

// ── Practice mode/role parsing ──────────────────────────────────────

const PRACTICE_MODE_MAP: Record<string, PracticeMode> = {
  "decision-drill": PracticeMode.DecisionDrill,
  "full-auction": PracticeMode.FullAuction,
  "continuation-drill": PracticeMode.ContinuationDrill,
};

export function parsePracticeMode(args: Flags): PracticeMode | undefined {
  const val = args["mode"];
  if (val === undefined || val === true) return undefined;
  const mapped = PRACTICE_MODE_MAP[val.toLowerCase()];
  if (mapped === undefined) {
    console.error(`Invalid --mode value: "${val}" (expected: decision-drill, full-auction, continuation-drill)`);
    process.exit(2);
  }
  return mapped;
}

const PRACTICE_ROLE_MAP: Record<string, PracticeRole> = {
  opener: PracticeRole.Opener,
  responder: PracticeRole.Responder,
  both: PracticeRole.Both,
};

export function parsePracticeRole(args: Flags): PracticeRole | undefined {
  const val = args["role"];
  if (val === undefined || val === true) return undefined;
  const mapped = PRACTICE_ROLE_MAP[val.toLowerCase()];
  if (mapped === undefined) {
    console.error(`Invalid --role value: "${val}" (expected: opener, responder, both)`);
    process.exit(2);
  }
  return mapped;
}
