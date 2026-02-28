import type { Hand } from "../engine/types";
import type { BiddingContext } from "../conventions/core/types";
import { Seat, Suit, Rank } from "../engine/types";
import { createBiddingContext } from "../conventions/core/context-factory";
import { evaluateHand } from "../engine/hand-evaluator";

/** Minimal dummy hand for resolving convention calls in display contexts.
 *  4-3-3-3 shape, 9 HCP (A=4 + K=3 + Q=2). */
export const DUMMY_HAND: Hand = {
  cards: [
    { suit: Suit.Spades, rank: Rank.Ace },
    { suit: Suit.Spades, rank: Rank.Ten },
    { suit: Suit.Spades, rank: Rank.Five },
    { suit: Suit.Spades, rank: Rank.Three },
    { suit: Suit.Hearts, rank: Rank.King },
    { suit: Suit.Hearts, rank: Rank.Eight },
    { suit: Suit.Hearts, rank: Rank.Four },
    { suit: Suit.Diamonds, rank: Rank.Queen },
    { suit: Suit.Diamonds, rank: Rank.Six },
    { suit: Suit.Diamonds, rank: Rank.Two },
    { suit: Suit.Clubs, rank: Rank.Nine },
    { suit: Suit.Clubs, rank: Rank.Five },
    { suit: Suit.Clubs, rank: Rank.Three },
  ],
};

/** Create a BiddingContext with the dummy hand and empty auction.
 *  Used by display components that need to resolve convention calls
 *  without a real game context. */
export function createDummyContext(): BiddingContext {
  return createBiddingContext({
    hand: DUMMY_HAND,
    auction: { entries: [], isComplete: false },
    seat: Seat.South,
    evaluation: evaluateHand(DUMMY_HAND),
  });
}
