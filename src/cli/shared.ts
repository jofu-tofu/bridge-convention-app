// ── CLI shared utilities ────────────────────────────────────────────
//
// Pure functions shared across CLI subcommands: argument parsing,
// settings resolution, call parsing.

import { Vulnerability, BidSuit } from "../service";
import type { Call } from "../service";
import { OpponentMode, PracticeMode, PracticeRole } from "../service";
import type { BaseSystemId } from "../service";

// ── Re-exports for convenience ──────────────────────────────────────

export { Vulnerability };

// ── Flags type ──────────────────────────────────────────────────────

export type Flags = Record<string, string | true>;

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function parseMappedArg<T>(
  args: Flags,
  name: string,
  map: Record<string, T>,
  expected: string,
  defaultValue?: T,
): T | undefined {
  const val = args[name];
  if (val === undefined || val === true) return defaultValue;
  const mapped = map[val.toLowerCase()];
  if (mapped === undefined) {
    fail(`Invalid --${name} value: "${val}" (expected: ${expected})`);
  }
  return mapped;
}

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
    fail(`Missing required argument: --${name}`);
  }
  return val;
}

export function optionalNumericArg(args: Flags, name: string): number | undefined {
  const val = args[name];
  if (val === undefined || val === true) return undefined;
  const n = Number(val);
  if (isNaN(n)) {
    fail(`Invalid numeric argument: --${name}=${val}`);
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
  return parseMappedArg(args, "vuln", VULN_MAP, "none, ns, ew, both", Vulnerability.None) ?? Vulnerability.None;
}

const SYSTEM_MAP: Record<string, BaseSystemId> = {
  sayc: "sayc",
  "two-over-one": "two-over-one",
  acol: "acol",
};

export function parseBaseSystem(args: Flags): BaseSystemId {
  return parseMappedArg(args, "system", SYSTEM_MAP, "sayc, two-over-one, acol", "sayc") ?? "sayc";
}

export function parseOpponentMode(args: Flags): OpponentMode {
  return parseMappedArg(
    args,
    "opponents",
    {
      natural: OpponentMode.Natural,
      none: OpponentMode.None,
    },
    "natural, none",
    OpponentMode.Natural,
  ) ?? OpponentMode.Natural;
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
    fail(`Invalid bid: "${s}" (expected: P, X, XX, or 1C..7NT)`);
  }
  const level = Number(match[1]) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  const strain = STRAIN_MAP[match[2]!]!;
  return { type: "bid", level, strain };
}

// ── Practice mode/role parsing ──────────────────────────────────────

const PRACTICE_MODE_MAP: Record<string, PracticeMode> = {
  "decision-drill": PracticeMode.DecisionDrill,
  "full-auction": PracticeMode.FullAuction,
};

export function parsePracticeMode(args: Flags): PracticeMode | undefined {
  return parseMappedArg(args, "mode", PRACTICE_MODE_MAP, "decision-drill, full-auction");
}

const PRACTICE_ROLE_MAP: Record<string, PracticeRole> = {
  opener: PracticeRole.Opener,
  responder: PracticeRole.Responder,
  both: PracticeRole.Both,
};

export function parsePracticeRole(args: Flags): PracticeRole | undefined {
  return parseMappedArg(args, "role", PRACTICE_ROLE_MAP, "opener, responder, both");
}
