import { Suit, Rank } from "../types";
import type { Card, Hand } from "../types";
import { createHand } from "../constants";

const SUIT_MAP: Record<string, Suit> = {
  S: Suit.Spades,
  H: Suit.Hearts,
  D: Suit.Diamonds,
  C: Suit.Clubs,
};

const RANK_MAP: Record<string, Rank> = {
  A: Rank.Ace,
  K: Rank.King,
  Q: Rank.Queen,
  J: Rank.Jack,
  T: Rank.Ten,
  "9": Rank.Nine,
  "8": Rank.Eight,
  "7": Rank.Seven,
  "6": Rank.Six,
  "5": Rank.Five,
  "4": Rank.Four,
  "3": Rank.Three,
  "2": Rank.Two,
};

function parseCard(notation: string): Card {
  const suitChar = notation[0];
  if (!suitChar) throw new Error(`Invalid card notation: ${notation}`);
  const suit = SUIT_MAP[suitChar];
  const rank = RANK_MAP[notation.slice(1)];
  if (!suit || !rank) throw new Error(`Invalid card notation: ${notation}`);
  return { suit, rank };
}

/** Shorthand card construction: card('SA') → { suit: Spades, rank: Ace } */
export function card(notation: string): Card {
  return parseCard(notation);
}

/** Create a Hand from shorthand notations: hand('SA', 'HK', ...) */
export function hand(...notations: string[]): Hand {
  const cards = notations.map(parseCard);
  return createHand(cards);
}
