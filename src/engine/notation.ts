import { Suit, Rank } from "./types";
import type { Card, Hand } from "./types";
import { createHand } from "./constants";

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

/** Parse card notation like 'SA' (Ace of Spades) into a Card object. */
export function parseCard(notation: string): Card {
  const suitChar = notation[0];
  if (!suitChar) throw new Error(`Invalid card notation: ${notation}`);
  const suit = SUIT_MAP[suitChar];
  const rank = RANK_MAP[notation.slice(1)];
  if (!suit || !rank) throw new Error(`Invalid card notation: ${notation}`);
  return { suit, rank };
}

/** Parse an array of card notations into a Hand (must be exactly 13 cards). */
export function parseHand(notations: string[]): Hand {
  return createHand(notations.map(parseCard));
}
