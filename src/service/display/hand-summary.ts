import { Suit } from "../../engine/types";
import type { HandEvaluation } from "../../engine/types";
import { SUIT_SYMBOLS } from "./format";

/** Shape-order suit symbols: \u2660 \u2665 \u2666 \u2663 */
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
