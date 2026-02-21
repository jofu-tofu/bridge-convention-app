import { Suit, Rank, Seat } from "./types";
import type { Card, Hand } from "./types";

export const SUITS: readonly Suit[] = [
  Suit.Clubs,
  Suit.Diamonds,
  Suit.Hearts,
  Suit.Spades,
] as const;

/** Suit ordering matching SuitLength tuple: [Spades, Hearts, Diamonds, Clubs] */
export const SUIT_ORDER: readonly Suit[] = [
  Suit.Spades,
  Suit.Hearts,
  Suit.Diamonds,
  Suit.Clubs,
] as const;

export const RANKS: readonly Rank[] = [
  Rank.Two,
  Rank.Three,
  Rank.Four,
  Rank.Five,
  Rank.Six,
  Rank.Seven,
  Rank.Eight,
  Rank.Nine,
  Rank.Ten,
  Rank.Jack,
  Rank.Queen,
  Rank.King,
  Rank.Ace,
] as const;

export const SEATS: readonly Seat[] = [
  Seat.North,
  Seat.East,
  Seat.South,
  Seat.West,
] as const;

export const SEAT_INDEX: Record<Seat, number> = {
  [Seat.North]: 0,
  [Seat.East]: 1,
  [Seat.South]: 2,
  [Seat.West]: 3,
};

export const RANK_INDEX: Record<Rank, number> = {
  [Rank.Two]: 0,
  [Rank.Three]: 1,
  [Rank.Four]: 2,
  [Rank.Five]: 3,
  [Rank.Six]: 4,
  [Rank.Seven]: 5,
  [Rank.Eight]: 6,
  [Rank.Nine]: 7,
  [Rank.Ten]: 8,
  [Rank.Jack]: 9,
  [Rank.Queen]: 10,
  [Rank.King]: 11,
  [Rank.Ace]: 12,
};

export const HCP_VALUES: Record<Rank, number> = {
  [Rank.Two]: 0,
  [Rank.Three]: 0,
  [Rank.Four]: 0,
  [Rank.Five]: 0,
  [Rank.Six]: 0,
  [Rank.Seven]: 0,
  [Rank.Eight]: 0,
  [Rank.Nine]: 0,
  [Rank.Ten]: 0,
  [Rank.Jack]: 1,
  [Rank.Queen]: 2,
  [Rank.King]: 3,
  [Rank.Ace]: 4,
};

export function createDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ suit, rank });
    }
  }
  return cards;
}

export function createHand(cards: Card[]): Hand {
  if (cards.length !== 13) {
    throw new Error(`Hand must have exactly 13 cards, got ${cards.length}`);
  }
  return { cards: [...cards] };
}

export function nextSeat(seat: Seat): Seat {
  return SEATS[(SEAT_INDEX[seat] + 1) % 4]!;
}

export function partnerSeat(seat: Seat): Seat {
  return SEATS[(SEAT_INDEX[seat] + 2) % 4]!;
}
