import type { Call } from "./types";

/** Check if two calls match (same type, level, and strain for contract bids). */
export function callsMatch(a: Call, b: Call): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "bid" && b.type === "bid") {
    return a.level === b.level && a.strain === b.strain;
  }
  return true; // pass === pass, double === double, etc.
}
