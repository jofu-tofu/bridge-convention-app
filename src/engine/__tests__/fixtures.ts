import { parseCard, parseHand } from "../notation";
import type { Card, Hand } from "../types";

/** Shorthand card construction: card('SA') → { suit: Spades, rank: Ace } */
export function card(notation: string): Card {
  return parseCard(notation);
}

/** Create a Hand from shorthand notations: hand('SA', 'HK', ...) */
export function hand(...notations: string[]): Hand {
  return parseHand(notations);
}
