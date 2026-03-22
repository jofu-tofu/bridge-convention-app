import type { Call, Card } from "../../../engine/types";
import type { Suit } from "../../../engine/types";
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

/** Grade → Tailwind class mapping for debug panels */
export const GRADE_COLORS: Record<string, string> = {
  correct: "bg-green-900/40 text-green-300 border-green-500/40",
  "correct-not-preferred": "bg-green-900/30 text-green-200 border-green-500/30",
  acceptable: "bg-teal-900/40 text-teal-300 border-teal-500/40",
  "near-miss": "bg-yellow-900/40 text-yellow-300 border-yellow-500/40",
  incorrect: "bg-red-900/40 text-red-300 border-red-500/40",
};

export const GRADE_COLOR_FALLBACK = "bg-gray-800 text-gray-300 border-gray-600";

/** Grade → border-color class for bid-log entries */
export function gradeBorderColor(grade: string | undefined | null): string {
  if (!grade) return "border-border-subtle/30";
  if (grade === "correct" || grade === "correct-not-preferred" || grade === "acceptable") {
    return "border-green-500/40";
  }
  if (grade === "near-miss") return "border-yellow-500/40";
  return "border-red-500/40";
}
