import { describe, it, expect } from "vitest";
import { sortCards } from "../sort-cards";
import { Suit, Rank } from "../../../service";
import type { Card } from "../../../service";

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

  it("places trump suit first when trumpSuit is provided", () => {
    const cards = [
      card(Suit.Clubs, Rank.Ace),
      card(Suit.Spades, Rank.King),
      card(Suit.Diamonds, Rank.Queen),
      card(Suit.Hearts, Rank.Jack),
    ];
    const sorted = sortCards(cards, Suit.Diamonds);
    expect(sorted.map((c) => c.suit)).toEqual([
      Suit.Diamonds,
      Suit.Spades,
      Suit.Hearts,
      Suit.Clubs,
    ]);
  });

  it("keeps standard order for non-trump suits after trump", () => {
    const cards = [
      card(Suit.Clubs, Rank.Ace),
      card(Suit.Spades, Rank.King),
      card(Suit.Diamonds, Rank.Queen),
      card(Suit.Hearts, Rank.Jack),
    ];
    // Trump = clubs: clubs first, then S → H → D
    const sorted = sortCards(cards, Suit.Clubs);
    expect(sorted.map((c) => c.suit)).toEqual([
      Suit.Clubs,
      Suit.Spades,
      Suit.Hearts,
      Suit.Diamonds,
    ]);
  });

  it("sorts by rank within trump suit", () => {
    const cards = [
      card(Suit.Hearts, Rank.Two),
      card(Suit.Hearts, Rank.Ace),
      card(Suit.Hearts, Rank.Ten),
      card(Suit.Spades, Rank.King),
    ];
    const sorted = sortCards(cards, Suit.Hearts);
    expect(sorted.map((c) => `${c.suit}${c.rank}`)).toEqual([
      "HA", "HT", "H2", "SK",
    ]);
  });

  it("behaves like standard sort when trump suit is already first in SUIT_ORDER", () => {
    const cards = [
      card(Suit.Clubs, Rank.Ace),
      card(Suit.Spades, Rank.King),
      card(Suit.Diamonds, Rank.Queen),
      card(Suit.Hearts, Rank.Jack),
    ];
    const sorted = sortCards(cards, Suit.Spades);
    expect(sorted.map((c) => c.suit)).toEqual([
      Suit.Spades,
      Suit.Hearts,
      Suit.Diamonds,
      Suit.Clubs,
    ]);
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
