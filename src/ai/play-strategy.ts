import type { Card } from "../engine/types";

/**
 * Pick a random card from the legal plays array.
 * Phase 5 AI: no heuristics, just random legal play.
 */
export function randomPlay(legalCards: readonly Card[]): Card {
  if (legalCards.length === 0) {
    throw new Error("No legal cards to play");
  }
  const index = Math.floor(Math.random() * legalCards.length);
  return legalCards[index]!;
}
