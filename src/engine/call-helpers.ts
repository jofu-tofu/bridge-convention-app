import type { Call } from "./types";

/** Check if two calls match (same type, level, and strain for contract bids). */
export function callsMatch(a: Call, b: Call): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "bid" && b.type === "bid") {
    return a.level === b.level && a.strain === b.strain;
  }
  return true; // pass === pass, double === double, etc.
}

/** Serialize a Call to a compact deterministic key (e.g., "1NT", "P", "X", "XX").
 *  Used for map keys, test IDs, and machine-readable output. */
export function callKey(call: Call): string {
  if (call.type === "bid") return `${call.level}${call.strain}`;
  if (call.type === "pass") return "P";
  if (call.type === "double") return "X";
  return "XX";
}

