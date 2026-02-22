import { describe, it, expect } from "vitest";
import { createHeuristicPlayStrategy } from "../heuristic-play-strategy";
import type { PlayContext } from "../../shared/types";
import { Suit, Rank, Seat, BidSuit } from "../../engine/types";
import type { Card, Contract, PlayedCard, Trick } from "../../engine/types";

function card(suit: Suit, rank: Rank): Card {
  return { suit, rank };
}

function playedCard(seat: Seat, suit: Suit, rank: Rank): PlayedCard {
  return { card: card(suit, rank), seat };
}

function makeContract(declarer: Seat, strain: BidSuit): Contract {
  return { level: 4, strain, doubled: false, redoubled: false, declarer };
}

function makeContext(overrides: Partial<PlayContext>): PlayContext {
  return {
    hand: { cards: [] },
    currentTrick: [],
    previousTricks: [],
    contract: makeContract(Seat.South, BidSuit.Spades),
    seat: Seat.West,
    trumpSuit: Suit.Spades,
    legalPlays: [],
    ...overrides,
  };
}

const strategy = createHeuristicPlayStrategy();

describe("createHeuristicPlayStrategy", () => {
  describe("second hand low", () => {
    it("plays lowest card when second to play", () => {
      const ctx = makeContext({
        currentTrick: [playedCard(Seat.North, Suit.Hearts, Rank.King)],
        seat: Seat.East,
        legalPlays: [
          card(Suit.Hearts, Rank.Five),
          card(Suit.Hearts, Rank.Queen),
          card(Suit.Hearts, Rank.Three),
        ],
      });

      const result = strategy.suggest(ctx);
      expect(result.card.rank).toBe(Rank.Three);
      expect(result.reason).toBe("second-hand-low");
    });
  });

  describe("third hand high", () => {
    it("plays high enough to beat current winner when partner is not winning", () => {
      const ctx = makeContext({
        currentTrick: [
          playedCard(Seat.South, Suit.Hearts, Rank.Four),
          playedCard(Seat.West, Suit.Hearts, Rank.Jack),
        ],
        seat: Seat.North,
        contract: makeContract(Seat.East, BidSuit.NoTrump),
        trumpSuit: undefined,
        legalPlays: [
          card(Suit.Hearts, Rank.Three),
          card(Suit.Hearts, Rank.Queen),
          card(Suit.Hearts, Rank.Ace),
        ],
      });

      const result = strategy.suggest(ctx);
      // Should play Queen (just high enough to beat Jack)
      expect(result.card.rank).toBe(Rank.Queen);
      expect(result.reason).toBe("third-hand-high");
    });

    it("plays low when partner is already winning", () => {
      // North leads Ace, East plays 5, South (partner of North) is 3rd
      // Actually: partner of South is North. Let's set up correctly.
      // Trick: West leads 4H, North plays AH, East is 3rd hand
      // East's partner is West who led low. North is currently winning.
      // East should play high. Let's test the other case:
      // South leads, West plays, North is 3rd. North's partner is South.
      const ctx = makeContext({
        currentTrick: [
          playedCard(Seat.South, Suit.Hearts, Rank.Ace),
          playedCard(Seat.West, Suit.Hearts, Rank.Five),
        ],
        seat: Seat.North, // partner of South
        contract: makeContract(Seat.East, BidSuit.NoTrump),
        trumpSuit: undefined,
        legalPlays: [
          card(Suit.Hearts, Rank.Three),
          card(Suit.Hearts, Rank.King),
          card(Suit.Hearts, Rank.Queen),
        ],
      });

      const result = strategy.suggest(ctx);
      // Partner (South) is winning with Ace, play low
      expect(result.card.rank).toBe(Rank.Three);
      expect(result.reason).toBe("third-hand-high");
    });
  });

  describe("opening lead vs NT", () => {
    it("leads 4th best from longest suit", () => {
      const handCards = [
        // Spades: 5 cards (longest)
        card(Suit.Spades, Rank.King),
        card(Suit.Spades, Rank.Jack),
        card(Suit.Spades, Rank.Eight),
        card(Suit.Spades, Rank.Six),
        card(Suit.Spades, Rank.Three),
        // Hearts: 3 cards
        card(Suit.Hearts, Rank.Ace),
        card(Suit.Hearts, Rank.Ten),
        card(Suit.Hearts, Rank.Four),
        // Diamonds: 3 cards
        card(Suit.Diamonds, Rank.Queen),
        card(Suit.Diamonds, Rank.Seven),
        card(Suit.Diamonds, Rank.Two),
        // Clubs: 2 cards
        card(Suit.Clubs, Rank.Nine),
        card(Suit.Clubs, Rank.Five),
      ];

      const ctx = makeContext({
        currentTrick: [],
        previousTricks: [],
        seat: Seat.West, // defender
        contract: makeContract(Seat.South, BidSuit.NoTrump),
        trumpSuit: undefined,
        hand: { cards: handCards },
        legalPlays: handCards, // On opening lead, all cards are legal
      });

      const result = strategy.suggest(ctx);
      // 4th best from Spades (K, J, 8, 6, 3) → 4th from top = 6
      expect(result.card.suit).toBe(Suit.Spades);
      expect(result.card.rank).toBe(Rank.Six);
      expect(result.reason).toBe("opening-lead");
    });
  });

  describe("opening lead with touching honors", () => {
    it("leads top of touching honors sequence", () => {
      const handCards = [
        card(Suit.Hearts, Rank.King),
        card(Suit.Hearts, Rank.Queen),
        card(Suit.Hearts, Rank.Jack),
        card(Suit.Hearts, Rank.Five),
        card(Suit.Spades, Rank.Ace),
        card(Suit.Spades, Rank.Nine),
        card(Suit.Spades, Rank.Seven),
        card(Suit.Spades, Rank.Three),
        card(Suit.Diamonds, Rank.Ten),
        card(Suit.Diamonds, Rank.Six),
        card(Suit.Diamonds, Rank.Two),
        card(Suit.Clubs, Rank.Eight),
        card(Suit.Clubs, Rank.Four),
      ];

      const ctx = makeContext({
        currentTrick: [],
        previousTricks: [],
        seat: Seat.West,
        contract: makeContract(Seat.South, BidSuit.NoTrump),
        trumpSuit: undefined,
        hand: { cards: handCards },
        legalPlays: handCards,
      });

      const result = strategy.suggest(ctx);
      expect(result.card.suit).toBe(Suit.Hearts);
      expect(result.card.rank).toBe(Rank.King);
      expect(result.reason).toBe("opening-lead");
    });
  });

  describe("trump ruff", () => {
    it("ruffs when void in led suit and has trump", () => {
      const ctx = makeContext({
        currentTrick: [playedCard(Seat.North, Suit.Hearts, Rank.King)],
        seat: Seat.East,
        contract: makeContract(Seat.South, BidSuit.Spades),
        trumpSuit: Suit.Spades,
        legalPlays: [
          // No hearts (void in led suit)
          card(Suit.Spades, Rank.Three), // trump
          card(Suit.Spades, Rank.Seven), // trump
          card(Suit.Diamonds, Rank.Four),
          card(Suit.Clubs, Rank.Six),
        ],
      });

      const result = strategy.suggest(ctx);
      expect(result.card.suit).toBe(Suit.Spades);
      expect(result.card.rank).toBe(Rank.Three); // lowest trump
      expect(result.reason).toBe("trump-management");
    });

    it("does not ruff partner's winning trick", () => {
      // West leads, North (partner of South) plays high, East plays low
      // South is void in led suit but partner North is winning
      const ctx = makeContext({
        currentTrick: [
          playedCard(Seat.West, Suit.Hearts, Rank.Five),
          playedCard(Seat.North, Suit.Hearts, Rank.Ace),
          playedCard(Seat.East, Suit.Hearts, Rank.Three),
        ],
        seat: Seat.South,
        contract: makeContract(Seat.East, BidSuit.Diamonds), // E declares, S defends
        trumpSuit: Suit.Diamonds,
        legalPlays: [
          // Void in hearts
          card(Suit.Diamonds, Rank.Five), // trump
          card(Suit.Clubs, Rank.Two),
        ],
      });

      const result = strategy.suggest(ctx);
      // Partner North winning with Ace — should NOT ruff
      // Should discard instead
      expect(result.card.suit).not.toBe(Suit.Diamonds);
      expect(result.reason).not.toBe("trump-management");
    });
  });

  describe("discard management", () => {
    it("discards from shortest non-trump suit when void in led suit", () => {
      const ctx = makeContext({
        currentTrick: [playedCard(Seat.North, Suit.Hearts, Rank.King)],
        seat: Seat.East,
        contract: makeContract(Seat.South, BidSuit.Hearts), // Hearts trump
        trumpSuit: Suit.Hearts,
        legalPlays: [
          // No hearts (void in led suit), no trump either
          card(Suit.Diamonds, Rank.Four),
          card(Suit.Diamonds, Rank.Eight),
          card(Suit.Diamonds, Rank.Queen),
          card(Suit.Clubs, Rank.Six), // shortest suit — 1 card
        ],
      });

      const result = strategy.suggest(ctx);
      // Should discard from shortest suit (Clubs, 1 card)
      expect(result.card.suit).toBe(Suit.Clubs);
      expect(result.card.rank).toBe(Rank.Six);
      expect(result.reason).toBe("discard-management");
    });
  });

  describe("fallback", () => {
    it("plays lowest legal card when no heuristic matches", () => {
      // Opening lead as declarer (not a defender) with no touching honors etc.
      const ctx = makeContext({
        currentTrick: [],
        previousTricks: [
          {
            plays: [playedCard(Seat.South, Suit.Hearts, Rank.Ace)],
            trumpSuit: Suit.Spades,
          },
        ], // not first trick
        seat: Seat.South, // declarer leads
        contract: makeContract(Seat.South, BidSuit.Spades),
        trumpSuit: Suit.Spades,
        hand: { cards: [] },
        legalPlays: [
          card(Suit.Hearts, Rank.King),
          card(Suit.Hearts, Rank.Three),
          card(Suit.Diamonds, Rank.Ace),
        ],
      });

      const result = strategy.suggest(ctx);
      expect(result.card.rank).toBe(Rank.Three);
      expect(result.reason).toBe("default-lowest");
    });
  });

  describe("cover honor with honor", () => {
    it("covers an honor led with a higher honor in 2nd seat", () => {
      const ctx = makeContext({
        currentTrick: [playedCard(Seat.North, Suit.Diamonds, Rank.Queen)],
        seat: Seat.East,
        contract: makeContract(Seat.South, BidSuit.NoTrump),
        trumpSuit: undefined,
        legalPlays: [
          card(Suit.Diamonds, Rank.King),
          card(Suit.Diamonds, Rank.Five),
          card(Suit.Diamonds, Rank.Two),
        ],
      });

      const result = strategy.suggest(ctx);
      // When an honor is led and we hold a covering honor, cover-honor takes priority
      expect(result.card.rank).toBe(Rank.King);
      expect(result.reason).toBe("cover-honor-with-honor");
    });

    it("plays low in 2nd seat when no covering honor available", () => {
      const ctx = makeContext({
        currentTrick: [playedCard(Seat.North, Suit.Diamonds, Rank.Queen)],
        seat: Seat.East,
        contract: makeContract(Seat.South, BidSuit.NoTrump),
        trumpSuit: undefined,
        legalPlays: [
          card(Suit.Diamonds, Rank.Five),
          card(Suit.Diamonds, Rank.Two),
        ],
      });

      const result = strategy.suggest(ctx);
      // No covering honor — second-hand-low applies
      expect(result.card.rank).toBe(Rank.Two);
      expect(result.reason).toBe("second-hand-low");
    });

    it("covers an honor when in 4th seat", () => {
      // In 4th seat (last to play), cover honor applies since no earlier heuristic matches position 3
      // Actually 4th seat = currentTrick.length === 3, no specific heuristic fires before cover-honor
      const ctx = makeContext({
        currentTrick: [
          playedCard(Seat.West, Suit.Diamonds, Rank.Queen),
          playedCard(Seat.North, Suit.Diamonds, Rank.Three),
          playedCard(Seat.East, Suit.Diamonds, Rank.Five),
        ],
        seat: Seat.South,
        contract: makeContract(Seat.East, BidSuit.NoTrump),
        trumpSuit: undefined,
        legalPlays: [
          card(Suit.Diamonds, Rank.King),
          card(Suit.Diamonds, Rank.Two),
        ],
      });

      const result = strategy.suggest(ctx);
      expect(result.card.rank).toBe(Rank.King);
      expect(result.reason).toBe("cover-honor-with-honor");
    });
  });

  describe("always returns a result", () => {
    it("never returns undefined even with a single legal play", () => {
      const ctx = makeContext({
        legalPlays: [card(Suit.Clubs, Rank.Two)],
      });

      const result = strategy.suggest(ctx);
      expect(result).toBeDefined();
      expect(result.card).toEqual(card(Suit.Clubs, Rank.Two));
    });
  });
});
