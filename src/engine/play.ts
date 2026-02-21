import { Suit, Rank } from "./types";
import type { Card, Hand, Trick, Seat } from "./types";
import { RANK_INDEX } from "./constants";

/** Rank comparison: use RANK_INDEX lookup (Two=0 ... Ace=12) */
export function rankValue(rank: Rank): number {
  return RANK_INDEX[rank];
}

/** Get the suit of the first card played (lead suit) */
export function getLeadSuit(trick: Trick): Suit | undefined {
  return trick.plays[0]?.card.suit;
}

/**
 * Get all legal plays from a hand given the lead suit.
 * - If leadSuit is undefined (first card of trick), all cards are legal.
 * - If hand has cards in leadSuit, must play one of those (follow suit).
 * - If void in leadSuit, any card is legal (including trump — NOT required to trump).
 */
export function getLegalPlays(hand: Hand, leadSuit?: Suit): Card[] {
  if (leadSuit === undefined) return [...hand.cards];
  const followCards = hand.cards.filter((c) => c.suit === leadSuit);
  if (followCards.length > 0) return followCards;
  return [...hand.cards]; // void — any card legal
}

/**
 * Determine trick winner after all 4 cards played.
 * - If trumpSuit defined and any trump was played: highest trump wins.
 * - Otherwise: highest card of led suit wins.
 * Returns the seat of the winner.
 */
export function getTrickWinner(trick: Trick): Seat {
  if (trick.plays.length !== 4) {
    throw new Error("Trick must have exactly 4 plays");
  }

  const leadSuit = trick.plays[0]!.card.suit;
  const trumpSuit = trick.trumpSuit;

  // Check for trump cards
  if (trumpSuit !== undefined) {
    const trumpPlays = trick.plays.filter((p) => p.card.suit === trumpSuit);
    if (trumpPlays.length > 0) {
      // Highest trump wins
      return trumpPlays.reduce((best, current) =>
        rankValue(current.card.rank) > rankValue(best.card.rank)
          ? current
          : best,
      ).seat;
    }
  }

  // No trump played (or NT contract) — highest of led suit wins
  const followPlays = trick.plays.filter((p) => p.card.suit === leadSuit);
  return followPlays.reduce((best, current) =>
    rankValue(current.card.rank) > rankValue(best.card.rank) ? current : best,
  ).seat;
}
