import { Suit, BidSuit, Rank } from "../../engine/types";
import type { Call, Contract } from "../../engine/types";

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
  if (call.type === "double") return "Dbl";
  if (call.type === "redouble") return "Rdbl";
  return "Pass";
}

/** Format a contract as a short string, e.g. "3NT", "4\u2660X", "6\u2665XX". */
function formatContract(contract: Contract): string {
  return `${contract.level}${STRAIN_SYMBOLS[contract.strain]}${contract.doubled ? "X" : ""}${contract.redoubled ? "XX" : ""}`;
}

/** Format a contract with declarer, e.g. "3NT by N", "4\u2660X by S". */
export function formatContractWithDeclarer(contract: Contract): string {
  return `${formatContract(contract)} by ${contract.declarer}`;
}

/** Known bridge abbreviations that should be fully uppercased. */
const BRIDGE_ABBREVIATIONS = new Set(["nt", "sayc", "hcp"]);

/** Convert kebab-case rule name to Title Case display name.
 *  e.g., "stayman-ask" \u2192 "Stayman Ask", "sayc-open-1nt" \u2192 "SAYC Open 1NT" */
export function formatRuleName(name: string): string {
  if (name === "") return "";
  return name
    .split("-")
    .map((w) => {
      const lower = w.toLowerCase();
      if (BRIDGE_ABBREVIATIONS.has(lower)) return w.toUpperCase();
      // Handle numeric prefix + abbreviation, e.g., "1nt" \u2192 "1NT"
      const match = lower.match(/^(\d+)(.+)$/);
      if (match && BRIDGE_ABBREVIATIONS.has(match[2]!)) {
        return match[1] + match[2]!.toUpperCase();
      }
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/** Display a card rank for the UI. Converts "T" to "10" for user-facing display. */
export function displayRank(rank: Rank): string {
  return rank === Rank.Ten ? "10" : rank;
}

/** Full suit name for accessibility labels. */
const SUIT_FULL_NAMES: Record<Suit, string> = {
  [Suit.Spades]: "Spades",
  [Suit.Hearts]: "Hearts",
  [Suit.Diamonds]: "Diamonds",
  [Suit.Clubs]: "Clubs",
};

/** Full rank name for accessibility labels. */
const RANK_FULL_NAMES: Record<Rank, string> = {
  [Rank.Two]: "2",
  [Rank.Three]: "3",
  [Rank.Four]: "4",
  [Rank.Five]: "5",
  [Rank.Six]: "6",
  [Rank.Seven]: "7",
  [Rank.Eight]: "8",
  [Rank.Nine]: "9",
  [Rank.Ten]: "10",
  [Rank.Jack]: "Jack",
  [Rank.Queen]: "Queen",
  [Rank.King]: "King",
  [Rank.Ace]: "Ace",
};

/** Format a card for accessible aria-label: "Queen of Hearts", "10 of Spades". */
export function formatCardLabel(rank: Rank, suit: Suit): string {
  return `${RANK_FULL_NAMES[rank]} of ${SUIT_FULL_NAMES[suit]}`;
}

/** Strip internal suffixes like "(Bundle)" from convention display names. */
export function displayConventionName(name: string): string {
  return name.replace(/\s*\(Bundle\)\s*$/i, "");
}

