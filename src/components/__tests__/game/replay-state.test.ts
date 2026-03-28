import { describe, it, expect } from "vitest";
import { Seat, Suit, Rank } from "../../../engine/types";
import type { Card, Hand, Trick } from "../../../engine/types";
import {
  remainingCardsAtPosition,
  positionAtStep,
} from "../../game/replay-state";

function card(suit: Suit, rank: Rank): Card {
  return { suit, rank };
}

function hand(...cards: Card[]): Hand {
  return { cards };
}

const allHands: Record<Seat, Hand> = {
  [Seat.North]: hand(
    card(Suit.Spades, Rank.Ace),
    card(Suit.Hearts, Rank.King),
    card(Suit.Diamonds, Rank.Queen),
  ),
  [Seat.East]: hand(
    card(Suit.Spades, Rank.King),
    card(Suit.Hearts, Rank.Queen),
    card(Suit.Diamonds, Rank.Jack),
  ),
  [Seat.South]: hand(
    card(Suit.Spades, Rank.Queen),
    card(Suit.Hearts, Rank.Jack),
    card(Suit.Diamonds, Rank.Ten),
  ),
  [Seat.West]: hand(
    card(Suit.Spades, Rank.Jack),
    card(Suit.Hearts, Rank.Ten),
    card(Suit.Diamonds, Rank.Nine),
  ),
};

const tricks: readonly Trick[] = [
  {
    plays: [
      { seat: Seat.East, card: card(Suit.Hearts, Rank.Queen) },
      { seat: Seat.South, card: card(Suit.Hearts, Rank.Jack) },
      { seat: Seat.West, card: card(Suit.Hearts, Rank.Ten) },
      { seat: Seat.North, card: card(Suit.Hearts, Rank.King) },
    ],
    winner: Seat.North,
  },
  {
    plays: [
      { seat: Seat.North, card: card(Suit.Spades, Rank.Ace) },
      { seat: Seat.East, card: card(Suit.Spades, Rank.King) },
      { seat: Seat.South, card: card(Suit.Spades, Rank.Queen) },
      { seat: Seat.West, card: card(Suit.Spades, Rank.Jack) },
    ],
    winner: Seat.North,
  },
];

describe("remainingCardsAtPosition", () => {
  it("returns undefined at step 0 (no cards played)", () => {
    const pos = positionAtStep(0, tricks);
    expect(remainingCardsAtPosition(pos, tricks, allHands)).toBeUndefined();
  });

  it("removes played cards after first play", () => {
    const pos = positionAtStep(1, tricks); // trick 0, play 0 (East plays Q♥)
    const result = remainingCardsAtPosition(pos, tricks, allHands)!;
    // East should have 2 cards (Q♥ removed)
    expect(result[Seat.East]).toHaveLength(2);
    expect(result[Seat.East]).not.toContainEqual(card(Suit.Hearts, Rank.Queen));
    // Others should still have 3
    expect(result[Seat.North]).toHaveLength(3);
    expect(result[Seat.South]).toHaveLength(3);
    expect(result[Seat.West]).toHaveLength(3);
  });

  it("removes all cards from completed trick", () => {
    const pos = positionAtStep(4, tricks); // trick 0 complete (4 plays)
    const result = remainingCardsAtPosition(pos, tricks, allHands)!;
    // Each seat played one card → 2 remaining each
    expect(result[Seat.North]).toHaveLength(2);
    expect(result[Seat.East]).toHaveLength(2);
    expect(result[Seat.South]).toHaveLength(2);
    expect(result[Seat.West]).toHaveLength(2);
    // Verify specific cards removed
    expect(result[Seat.North]).not.toContainEqual(card(Suit.Hearts, Rank.King));
    expect(result[Seat.East]).not.toContainEqual(card(Suit.Hearts, Rank.Queen));
  });

  it("removes cards from multiple tricks", () => {
    const pos = positionAtStep(8, tricks); // both tricks complete
    const result = remainingCardsAtPosition(pos, tricks, allHands)!;
    // Each seat played 2 cards → 1 remaining each
    expect(result[Seat.North]).toHaveLength(1);
    expect(result[Seat.East]).toHaveLength(1);
    expect(result[Seat.South]).toHaveLength(1);
    expect(result[Seat.West]).toHaveLength(1);
    // Only diamonds remain
    expect(result[Seat.North]![0]).toEqual(card(Suit.Diamonds, Rank.Queen));
    expect(result[Seat.South]![0]).toEqual(card(Suit.Diamonds, Rank.Ten));
  });
});
