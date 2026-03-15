import type { Call, Card } from "../../../engine/types";
import { Suit } from "../../../engine/types";
import { formatCall } from "../../../core/display/format";
import { sortCards } from "../../../core/display/sort-cards";

export function fmtCall(call: Call): string {
  return formatCall(call);
}

export function formatSuitCards(cards: readonly Card[], suit: Suit): string {
  const sorted = sortCards([...cards]);
  return sorted
    .filter((c) => c.suit === suit)
    .map((c) => c.rank)
    .join("");
}

export function fmtFactValue(v: number | boolean | string): string {
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "\u2026" : s;
}
