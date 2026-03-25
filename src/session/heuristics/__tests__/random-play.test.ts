import { describe, it, expect } from "vitest";
import {
  createRandomPlayStrategy,
  randomPlayStrategy,
} from "../random-play";
import type { PlayContext } from "../../../conventions/core/strategy-types";
import { Suit, Rank, Seat, BidSuit } from "../../../engine/types";
import type { Card, Contract } from "../../../engine/types";

function card(suit: Suit, rank: Rank): Card {
  return { suit, rank };
}

function makeContract(declarer: Seat, strain: BidSuit): Contract {
  return { level: 1, strain, doubled: false, redoubled: false, declarer };
}

function makeContext(overrides: Partial<PlayContext>): PlayContext {
  return {
    hand: { cards: [] },
    currentTrick: [],
    previousTricks: [],
    contract: makeContract(Seat.South, BidSuit.NoTrump),
    seat: Seat.West,
    trumpSuit: undefined,
    legalPlays: [],
    ...overrides,
  };
}

describe("createRandomPlayStrategy", () => {
  it("throws when no legal plays", () => {
    const strategy = createRandomPlayStrategy();
    expect(() => strategy.suggest(makeContext({ legalPlays: [] }))).toThrow(
      "No legal cards to play",
    );
  });

  it("returns the only legal card when one is available", () => {
    const strategy = createRandomPlayStrategy();
    const only = card(Suit.Hearts, Rank.Ace);
    const result = strategy.suggest(makeContext({ legalPlays: [only] }));
    expect(result.card).toEqual(only);
    expect(result.reason).toBe("random");
  });

  it("selects deterministically with a seeded rng", () => {
    const cards = [
      card(Suit.Spades, Rank.Two),
      card(Suit.Hearts, Rank.King),
      card(Suit.Diamonds, Rank.Ten),
      card(Suit.Clubs, Rank.Ace),
    ];
    // rng returns 0.5 → floor(0.5 * 4) = index 2
    const strategy = createRandomPlayStrategy(() => 0.5);
    const result = strategy.suggest(makeContext({ legalPlays: cards }));
    expect(result.card).toEqual(cards[2]);
  });

  it("selects first card when rng returns 0", () => {
    const cards = [
      card(Suit.Spades, Rank.Ace),
      card(Suit.Hearts, Rank.King),
    ];
    const strategy = createRandomPlayStrategy(() => 0);
    const result = strategy.suggest(makeContext({ legalPlays: cards }));
    expect(result.card).toEqual(cards[0]);
  });

  it("selects last card when rng returns 0.999", () => {
    const cards = [
      card(Suit.Spades, Rank.Ace),
      card(Suit.Hearts, Rank.King),
      card(Suit.Diamonds, Rank.Queen),
    ];
    const strategy = createRandomPlayStrategy(() => 0.999);
    const result = strategy.suggest(makeContext({ legalPlays: cards }));
    expect(result.card).toEqual(cards[2]);
  });
});

describe("randomPlayStrategy (default instance)", () => {
  it("has correct id and name", () => {
    expect(randomPlayStrategy.id).toBe("random");
    expect(randomPlayStrategy.name).toBe("Random Play");
  });

  it("returns a card from legal plays", () => {
    const cards = [
      card(Suit.Spades, Rank.Two),
      card(Suit.Hearts, Rank.King),
    ];
    const result = randomPlayStrategy.suggest(
      makeContext({ legalPlays: cards }),
    );
    expect(cards).toContainEqual(result.card);
  });
});
