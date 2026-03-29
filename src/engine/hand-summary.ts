import { Suit } from "./types";
import type { HandEvaluation } from "./types";

/** Unicode suit symbols keyed by Suit enum. */
const SUIT_SYMBOLS: Record<Suit, string> = {
  [Suit.Spades]: "\u2660",
  [Suit.Hearts]: "\u2665",
  [Suit.Diamonds]: "\u2666",
  [Suit.Clubs]: "\u2663",
};

/** Shape-order suit symbols: ♠ ♥ ♦ ♣ */
const SHAPE_SUIT_SYMBOLS = [
  SUIT_SYMBOLS[Suit.Spades],
  SUIT_SYMBOLS[Suit.Hearts],
  SUIT_SYMBOLS[Suit.Diamonds],
  SUIT_SYMBOLS[Suit.Clubs],
] as const;

export function formatHandSummary(evaluation: HandEvaluation): string {
  const shape = SHAPE_SUIT_SYMBOLS
    .map((sym, i) => `${evaluation.shape[i]}${sym}`)
    .join(" ");
  return `${shape}, ${evaluation.hcp} HCP`;
}
