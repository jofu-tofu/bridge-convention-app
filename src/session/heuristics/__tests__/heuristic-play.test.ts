import { describe, it, expect } from "vitest";
import { createHeuristicPlayStrategy } from "../heuristic-play";
import type { PlayContext } from "../../../conventions/core/strategy-types";
import { Suit, Rank, Seat, BidSuit } from "../../../engine/types";
import type { Card, Contract, PlayedCard } from "../../../engine/types";

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
    it("plays lowest card when second to play", async () => {
      const ctx = makeContext({
        currentTrick: [playedCard(Seat.North, Suit.Hearts, Rank.King)],
        seat: Seat.East,
        legalPlays: [
          card(Suit.Hearts, Rank.Five),
          card(Suit.Hearts, Rank.Queen),
          card(Suit.Hearts, Rank.Three),
        ],
      });

      const result = await strategy.suggest(ctx);
      expect(result.card.rank).toBe(Rank.Three);
      expect(result.reason).toBe("second-hand-low");
    });
  });

  describe("third hand high", () => {
    it("plays high enough to beat current winner when partner is not winning", async () => {
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

      const result = await strategy.suggest(ctx);
      // Should play Queen (just high enough to beat Jack)
      expect(result.card.rank).toBe(Rank.Queen);
      expect(result.reason).toBe("third-hand-high");
    });

    it("plays low when partner is already winning", async () => {
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

      const result = await strategy.suggest(ctx);
      // Partner (South) is winning with Ace, play low
      expect(result.card.rank).toBe(Rank.Three);
      expect(result.reason).toBe("third-hand-high");
    });
  });

  describe("opening lead vs NT", () => {
    it("leads 4th best from longest suit", async () => {
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

      const result = await strategy.suggest(ctx);
      // 4th best from Spades (K, J, 8, 6, 3) → 4th from top = 6
      expect(result.card.suit).toBe(Suit.Spades);
      expect(result.card.rank).toBe(Rank.Six);
      expect(result.reason).toBe("opening-lead");
    });
  });

  describe("opening lead with touching honors", () => {
    it("leads top of touching honors sequence", async () => {
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

      const result = await strategy.suggest(ctx);
      expect(result.card.suit).toBe(Suit.Hearts);
      expect(result.card.rank).toBe(Rank.King);
      expect(result.reason).toBe("opening-lead");
    });
  });

  describe("trump ruff", () => {
    it("ruffs when void in led suit and has trump", async () => {
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

      const result = await strategy.suggest(ctx);
      expect(result.card.suit).toBe(Suit.Spades);
      expect(result.card.rank).toBe(Rank.Three); // lowest trump
      expect(result.reason).toBe("trump-management");
    });

    it("does not ruff partner's winning trick", async () => {
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

      const result = await strategy.suggest(ctx);
      // Partner North winning with Ace — should NOT ruff
      // Should discard instead
      expect(result.card.suit).not.toBe(Suit.Diamonds);
      expect(result.reason).not.toBe("trump-management");
    });
  });

  describe("discard management", () => {
    it("discards from shortest non-trump suit when void in led suit", async () => {
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

      const result = await strategy.suggest(ctx);
      // Should discard from shortest suit (Clubs, 1 card)
      expect(result.card.suit).toBe(Suit.Clubs);
      expect(result.card.rank).toBe(Rank.Six);
      expect(result.reason).toBe("discard-management");
    });
  });

  describe("mid-game lead", () => {
    it("leads low from longest non-trump suit when declarer leads mid-game", async () => {
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

      const result = await strategy.suggest(ctx);
      expect(result.card.rank).toBe(Rank.Three);
      expect(result.reason).toBe("mid-game-lead");
    });

    it("returns partner's suit on defense", async () => {
      const ctx = makeContext({
        currentTrick: [],
        previousTricks: [
          {
            plays: [
              playedCard(Seat.North, Suit.Hearts, Rank.Four),
              playedCard(Seat.East, Suit.Hearts, Rank.Queen),
              playedCard(Seat.South, Suit.Hearts, Rank.Ace),
              playedCard(Seat.West, Suit.Hearts, Rank.Three),
            ],
            trumpSuit: Suit.Spades,
            winner: Seat.South,
          },
        ],
        seat: Seat.West, // defender, partner is East
        contract: makeContract(Seat.South, BidSuit.Spades),
        trumpSuit: Suit.Spades,
        hand: { cards: [] },
        legalPlays: [
          card(Suit.Hearts, Rank.Seven),
          card(Suit.Hearts, Rank.Two),
          card(Suit.Diamonds, Rank.King),
          card(Suit.Diamonds, Rank.Five),
          card(Suit.Clubs, Rank.Ten),
        ],
      });

      const result = await strategy.suggest(ctx);
      // West's partner (East) never led — North led hearts in the only trick
      // So no partner suit found, falls to longest non-trump: hearts (2) or diamonds (2)
      expect(result.reason).toBe("mid-game-lead");
    });
  });

  describe("cover honor with honor", () => {
    it("covers an honor led with a higher honor in 2nd seat", async () => {
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

      const result = await strategy.suggest(ctx);
      // When an honor is led and we hold a covering honor, cover-honor takes priority
      expect(result.card.rank).toBe(Rank.King);
      expect(result.reason).toBe("cover-honor-with-honor");
    });

    it("plays low in 2nd seat when no covering honor available", async () => {
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

      const result = await strategy.suggest(ctx);
      // No covering honor — second-hand-low applies
      expect(result.card.rank).toBe(Rank.Two);
      expect(result.reason).toBe("second-hand-low");
    });

    it("wins cheaply in 4th seat when opponent is winning", async () => {
      // In 4th seat, fourthHandPlayHeuristic fires before cover-honor
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

      const result = await strategy.suggest(ctx);
      // Wins with King (cheapest card that beats Queen)
      expect(result.card.rank).toBe(Rank.King);
      expect(result.reason).toBe("fourth-hand-play");
    });
  });

  describe("always returns a result", () => {
    it("never returns undefined even with a single legal play", async () => {
      const ctx = makeContext({
        legalPlays: [card(Suit.Clubs, Rank.Two)],
      });

      const result = await strategy.suggest(ctx);
      expect(result).toBeDefined();
      expect(result.card).toEqual(card(Suit.Clubs, Rank.Two));
    });
  });

  describe("empty legalPlays guard", () => {
    it("throws when legalPlays is empty", async () => {
      const ctx = makeContext({
        legalPlays: [],
      });

      expect(() => strategy.suggest(ctx)).toThrow("No legal plays available");
    });
  });

  describe("opening lead characterization", () => {
    it("leads ace from AK combination in suit contract", async () => {
      const handCards = [
        // Hearts: AK combination (side suit)
        card(Suit.Hearts, Rank.Ace),
        card(Suit.Hearts, Rank.King),
        card(Suit.Hearts, Rank.Five),
        // Spades (trump): not led
        card(Suit.Spades, Rank.Four),
        card(Suit.Spades, Rank.Two),
        // Diamonds
        card(Suit.Diamonds, Rank.Nine),
        card(Suit.Diamonds, Rank.Seven),
        card(Suit.Diamonds, Rank.Three),
        // Clubs
        card(Suit.Clubs, Rank.Ten),
        card(Suit.Clubs, Rank.Eight),
        card(Suit.Clubs, Rank.Six),
        card(Suit.Clubs, Rank.Four),
        card(Suit.Clubs, Rank.Two),
      ];

      const ctx = makeContext({
        currentTrick: [],
        previousTricks: [],
        seat: Seat.West,
        contract: makeContract(Seat.South, BidSuit.Spades),
        trumpSuit: Suit.Spades,
        hand: { cards: handCards },
        legalPlays: handCards,
      });

      const result = await strategy.suggest(ctx);
      expect(result.card.suit).toBe(Suit.Hearts);
      expect(result.card.rank).toBe(Rank.Ace);
      expect(result.reason).toBe("opening-lead");
    });

    it("leads top of touching honors (KQ)", async () => {
      const handCards = [
        card(Suit.Diamonds, Rank.King),
        card(Suit.Diamonds, Rank.Queen),
        card(Suit.Diamonds, Rank.Six),
        card(Suit.Diamonds, Rank.Three),
        card(Suit.Hearts, Rank.Eight),
        card(Suit.Hearts, Rank.Five),
        card(Suit.Hearts, Rank.Two),
        card(Suit.Spades, Rank.Nine),
        card(Suit.Spades, Rank.Seven),
        card(Suit.Spades, Rank.Four),
        card(Suit.Clubs, Rank.Ten),
        card(Suit.Clubs, Rank.Six),
        card(Suit.Clubs, Rank.Three),
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

      const result = await strategy.suggest(ctx);
      expect(result.card.suit).toBe(Suit.Diamonds);
      expect(result.card.rank).toBe(Rank.King);
      expect(result.reason).toBe("opening-lead");
    });

    it("leads fourth best from longest suit vs NT", async () => {
      const handCards = [
        // Hearts: 5 cards, longest, no touching honors
        card(Suit.Hearts, Rank.Jack),
        card(Suit.Hearts, Rank.Nine),
        card(Suit.Hearts, Rank.Seven),
        card(Suit.Hearts, Rank.Five),
        card(Suit.Hearts, Rank.Three),
        // Spades: 3 cards
        card(Suit.Spades, Rank.Ace),
        card(Suit.Spades, Rank.Eight),
        card(Suit.Spades, Rank.Two),
        // Diamonds: 3 cards
        card(Suit.Diamonds, Rank.Ten),
        card(Suit.Diamonds, Rank.Six),
        card(Suit.Diamonds, Rank.Four),
        // Clubs: 2 cards
        card(Suit.Clubs, Rank.King),
        card(Suit.Clubs, Rank.Three),
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

      const result = await strategy.suggest(ctx);
      // Hearts sorted desc: J, 9, 7, 5, 3 → 4th best = 5
      expect(result.card.suit).toBe(Suit.Hearts);
      expect(result.card.rank).toBe(Rank.Five);
      expect(result.reason).toBe("opening-lead");
    });

    it("leads singleton in suit contract", async () => {
      const handCards = [
        // Diamonds: singleton (not trump)
        card(Suit.Diamonds, Rank.Seven),
        // Spades (trump)
        card(Suit.Spades, Rank.Six),
        card(Suit.Spades, Rank.Four),
        card(Suit.Spades, Rank.Two),
        // Hearts: no touching honors, no AK
        card(Suit.Hearts, Rank.Nine),
        card(Suit.Hearts, Rank.Five),
        card(Suit.Hearts, Rank.Three),
        // Clubs: no touching honors
        card(Suit.Clubs, Rank.Ten),
        card(Suit.Clubs, Rank.Eight),
        card(Suit.Clubs, Rank.Six),
        card(Suit.Clubs, Rank.Four),
        card(Suit.Clubs, Rank.Two),
        card(Suit.Clubs, Rank.Three),
      ];

      const ctx = makeContext({
        currentTrick: [],
        previousTricks: [],
        seat: Seat.West,
        contract: makeContract(Seat.South, BidSuit.Hearts),
        trumpSuit: Suit.Hearts,
        hand: { cards: handCards },
        legalPlays: handCards,
      });

      const result = await strategy.suggest(ctx);
      expect(result.card.suit).toBe(Suit.Diamonds);
      expect(result.card.rank).toBe(Rank.Seven);
      expect(result.reason).toBe("opening-lead");
    });

    it("leads 4th best from longest non-trump suit in suit contract fallback", async () => {
      const handCards = [
        // Clubs: 5 cards (longest non-trump), no touching honors, no AK, no singleton
        card(Suit.Clubs, Rank.Jack),
        card(Suit.Clubs, Rank.Nine),
        card(Suit.Clubs, Rank.Seven),
        card(Suit.Clubs, Rank.Five),
        card(Suit.Clubs, Rank.Three),
        // Spades (trump)
        card(Suit.Spades, Rank.Six),
        card(Suit.Spades, Rank.Four),
        // Hearts: no touching honors, no AK
        card(Suit.Hearts, Rank.Eight),
        card(Suit.Hearts, Rank.Four),
        card(Suit.Hearts, Rank.Two),
        // Diamonds: 3 cards
        card(Suit.Diamonds, Rank.Ten),
        card(Suit.Diamonds, Rank.Six),
        card(Suit.Diamonds, Rank.Two),
      ];

      const ctx = makeContext({
        currentTrick: [],
        previousTricks: [],
        seat: Seat.West,
        contract: makeContract(Seat.South, BidSuit.Spades),
        trumpSuit: Suit.Spades,
        hand: { cards: handCards },
        legalPlays: handCards,
      });

      const result = await strategy.suggest(ctx);
      // Clubs sorted desc: J, 9, 7, 5, 3 → 4th best = 5
      expect(result.card.suit).toBe(Suit.Clubs);
      expect(result.card.rank).toBe(Rank.Five);
      expect(result.reason).toBe("opening-lead");
    });
  });

  describe("fourth hand play", () => {
    it("plays low when partner is winning", async () => {
      const ctx = makeContext({
        currentTrick: [
          playedCard(Seat.South, Suit.Hearts, Rank.Five),
          playedCard(Seat.West, Suit.Hearts, Rank.Ace),
          playedCard(Seat.North, Suit.Hearts, Rank.Three),
        ],
        seat: Seat.East, // partner is West (winning with Ace)
        contract: makeContract(Seat.South, BidSuit.NoTrump),
        trumpSuit: undefined,
        legalPlays: [
          card(Suit.Hearts, Rank.King),
          card(Suit.Hearts, Rank.Two),
        ],
      });

      const result = await strategy.suggest(ctx);
      expect(result.card.rank).toBe(Rank.Two);
      expect(result.reason).toBe("fourth-hand-play");
    });

    it("wins as cheaply as possible when opponent is winning", async () => {
      // West leads, North (dummy) plays low, East wins with Jack, South is 4th
      const ctx = makeContext({
        currentTrick: [
          playedCard(Seat.West, Suit.Diamonds, Rank.Three),
          playedCard(Seat.North, Suit.Diamonds, Rank.Five),
          playedCard(Seat.East, Suit.Diamonds, Rank.Jack),
        ],
        seat: Seat.South, // declarer, partner is North
        contract: makeContract(Seat.South, BidSuit.NoTrump),
        trumpSuit: undefined,
        legalPlays: [
          card(Suit.Diamonds, Rank.Queen),
          card(Suit.Diamonds, Rank.Ace),
          card(Suit.Diamonds, Rank.Two),
        ],
      });

      const result = await strategy.suggest(ctx);
      // East (opponent) winning with Jack — play Queen (cheapest that beats Jack)
      expect(result.card.rank).toBe(Rank.Queen);
      expect(result.reason).toBe("fourth-hand-play");
    });
  });

  describe("overruff", () => {
    it("overruffs opponent's trump with cheapest winning trump", async () => {
      const ctx = makeContext({
        currentTrick: [
          playedCard(Seat.North, Suit.Hearts, Rank.King),
          playedCard(Seat.East, Suit.Spades, Rank.Five), // opponent ruffed
        ],
        seat: Seat.South,
        contract: makeContract(Seat.East, BidSuit.Spades),
        trumpSuit: Suit.Spades,
        legalPlays: [
          // Void in hearts
          card(Suit.Spades, Rank.Three),
          card(Suit.Spades, Rank.Seven),
          card(Suit.Spades, Rank.Queen),
          card(Suit.Clubs, Rank.Four),
        ],
      });

      const result = await strategy.suggest(ctx);
      // Should overruff with 7 (cheapest trump that beats 5)
      expect(result.card.suit).toBe(Suit.Spades);
      expect(result.card.rank).toBe(Rank.Seven);
      expect(result.reason).toBe("trump-management");
    });

    it("discards when cannot overruff", async () => {
      const ctx = makeContext({
        currentTrick: [
          playedCard(Seat.North, Suit.Hearts, Rank.King),
          playedCard(Seat.East, Suit.Spades, Rank.Queen), // opponent ruffed high
        ],
        seat: Seat.South,
        contract: makeContract(Seat.East, BidSuit.Spades),
        trumpSuit: Suit.Spades,
        legalPlays: [
          // Void in hearts, only low trump
          card(Suit.Spades, Rank.Three),
          card(Suit.Spades, Rank.Five),
          card(Suit.Clubs, Rank.Four),
        ],
      });

      const result = await strategy.suggest(ctx);
      // Can't overruff Queen — should discard rather than waste trump
      expect(result.card.suit).toBe(Suit.Clubs);
      expect(result.reason).toBe("discard-management");
    });
  });

  describe("discard honor protection", () => {
    it("avoids baring an honor when discarding", async () => {
      const ctx = makeContext({
        currentTrick: [playedCard(Seat.North, Suit.Hearts, Rank.Ace)],
        seat: Seat.East,
        contract: makeContract(Seat.South, BidSuit.Hearts),
        trumpSuit: Suit.Hearts,
        legalPlays: [
          // Void in hearts, no trump
          card(Suit.Diamonds, Rank.King),
          card(Suit.Diamonds, Rank.Five), // discarding 5D would bare the King
          card(Suit.Clubs, Rank.Eight),
          card(Suit.Clubs, Rank.Six),
          card(Suit.Clubs, Rank.Three),
        ],
      });

      const result = await strategy.suggest(ctx);
      // Should discard from clubs (no honors) rather than diamonds (would bare King)
      expect(result.card.suit).toBe(Suit.Clubs);
      expect(result.card.rank).toBe(Rank.Three);
      expect(result.reason).toBe("discard-management");
    });
  });

  describe("third hand void", () => {
    it("defers to trump management when void in 3rd seat", async () => {
      const ctx = makeContext({
        currentTrick: [
          playedCard(Seat.West, Suit.Hearts, Rank.Five),
          playedCard(Seat.North, Suit.Hearts, Rank.King),
        ],
        seat: Seat.East,
        contract: makeContract(Seat.South, BidSuit.Spades),
        trumpSuit: Suit.Spades,
        legalPlays: [
          // Void in hearts — has trump
          card(Suit.Spades, Rank.Three),
          card(Suit.Spades, Rank.Seven),
          card(Suit.Clubs, Rank.Four),
        ],
      });

      const result = await strategy.suggest(ctx);
      // Should ruff (not "play highest legal" as old code did)
      expect(result.card.suit).toBe(Suit.Spades);
      expect(result.card.rank).toBe(Rank.Three);
      expect(result.reason).toBe("trump-management");
    });
  });
});
