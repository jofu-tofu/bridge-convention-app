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
