import type { HandEvaluation } from "../engine/types";

/** Shape-order suit symbols: ♠ ♥ ♦ ♣ */
const SHAPE_SUIT_SYMBOLS = ["\u2660", "\u2665", "\u2666", "\u2663"] as const;

export function formatHandSummary(evaluation: HandEvaluation): string {
  const shape = SHAPE_SUIT_SYMBOLS
    .map((sym, i) => `${evaluation.shape[i]}${sym}`)
    .join(" ");
  return `${shape}, ${evaluation.hcp} HCP`;
}
