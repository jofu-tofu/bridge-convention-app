import type { Call } from "./types";

/** Check if two calls match (same type, level, and strain for contract bids). */
export function callsMatch(a: Call, b: Call): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "bid" && b.type === "bid") {
    return a.level === b.level && a.strain === b.strain;
  }
  return true; // pass === pass, double === double, etc.
}

/** Format a Call object into a short string (e.g., "1NT", "P", "X", "XX"). */
export function formatCallString(call: Call): string {
  if (call.type === "bid") return `${call.level}${call.strain}`;
  if (call.type === "pass") return "P";
  if (call.type === "double") return "X";
  return "XX";
}

/** Format a Call as a human-readable string for evidence output (e.g., "1NT", "Pass", "Double"). */
export function formatCallForEvidence(call: Call): string {
  if (call.type !== "bid") {
    return call.type.charAt(0).toUpperCase() + call.type.slice(1);
  }
  return `${call.level}${call.strain}`;
}
