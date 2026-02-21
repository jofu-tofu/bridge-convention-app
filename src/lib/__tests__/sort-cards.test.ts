import { describe, it, expect } from "vitest";
import { sortCards } from "../sort-cards";
import { Suit, Rank } from "../../engine/types";
import type { Card } from "../../engine/types";

function card(suit: Suit, rank: Rank): Card {
  return { suit, rank };
}

describe("sortCards", () => {
  it("sorts by SUIT_ORDER: spades first, then hearts, diamonds, clubs", () => {
    const cards = [
      card(Suit.Clubs, Rank.Ace),
      card(Suit.Spades, Rank.King),
      card(Suit.Diamonds, Rank.Queen),
      card(Suit.Hearts, Rank.Jack),
    ];
    const sorted = sortCards(cards);
    expect(sorted.map((c) => c.suit)).toEqual([
      Suit.Spades,
      Suit.Hearts,
      Suit.Diamonds,
      Suit.Clubs,
    ]);
  });

  it("sorts by rank descending within each suit", () => {
    const cards = [
      card(Suit.Spades, Rank.Two),
      card(Suit.Spades, Rank.Ace),
      card(Suit.Spades, Rank.Ten),
    ];
    const sorted = sortCards(cards);
    expect(sorted.map((c) => c.rank)).toEqual([Rank.Ace, Rank.Ten, Rank.Two]);
  });

  it("handles empty array", () => {
    expect(sortCards([])).toEqual([]);
  });

  it("handles single card", () => {
    const cards = [card(Suit.Hearts, Rank.Five)];
    const sorted = sortCards(cards);
    expect(sorted).toHaveLength(1);
    expect(sorted[0]).toEqual(card(Suit.Hearts, Rank.Five));
  });

  it("preserves all cards (no duplication or loss)", () => {
    const cards = [
      card(Suit.Clubs, Rank.Ace),
      card(Suit.Spades, Rank.King),
      card(Suit.Diamonds, Rank.Queen),
      card(Suit.Hearts, Rank.Jack),
      card(Suit.Spades, Rank.Two),
    ];
    const sorted = sortCards(cards);
    expect(sorted).toHaveLength(5);
    for (const c of cards) {
      expect(sorted).toContainEqual(c);
    }
  });
});
