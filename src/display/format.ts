import { Suit, BidSuit } from "../engine/types";
import type { Call } from "../engine/types";

export const SUIT_SYMBOLS: Record<Suit, string> = {
  [Suit.Spades]: "\u2660",
  [Suit.Hearts]: "\u2665",
  [Suit.Diamonds]: "\u2666",
  [Suit.Clubs]: "\u2663",
};

export const STRAIN_SYMBOLS: Record<BidSuit, string> = {
  [BidSuit.Spades]: "\u2660",
  [BidSuit.Hearts]: "\u2665",
  [BidSuit.Diamonds]: "\u2666",
  [BidSuit.Clubs]: "\u2663",
  [BidSuit.NoTrump]: "NT",
};

export function formatCall(call: Call): string {
  if (call.type === "bid") {
    return `${call.level}${STRAIN_SYMBOLS[call.strain]}`;
  }
  if (call.type === "double") return "X";
  if (call.type === "redouble") return "XX";
  return "Pass";
}

/** Known bridge abbreviations that should be fully uppercased. */
const BRIDGE_ABBREVIATIONS = new Set(["nt", "sayc", "hcp", "dont"]);

/** Convert kebab-case rule name to Title Case display name.
 *  e.g., "stayman-ask" → "Stayman Ask", "sayc-open-1nt" → "SAYC Open 1NT" */
export function formatRuleName(name: string): string {
  if (name === "") return "";
  return name
    .split("-")
    .map((w) => {
      const lower = w.toLowerCase();
      if (BRIDGE_ABBREVIATIONS.has(lower)) return w.toUpperCase();
      // Handle numeric prefix + abbreviation, e.g., "1nt" → "1NT"
      const match = lower.match(/^(\d+)(.+)$/);
      if (match && BRIDGE_ABBREVIATIONS.has(match[2]!)) {
        return match[1] + match[2]!.toUpperCase();
      }
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

export function suitColor(suit: Suit | BidSuit): "red" | "black" {
  if (
    suit === Suit.Hearts ||
    suit === Suit.Diamonds ||
    suit === BidSuit.Hearts ||
    suit === BidSuit.Diamonds
  ) {
    return "red";
  }
  return "black";
}
