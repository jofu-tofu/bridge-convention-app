import { describe, it, expect } from "vitest";
import { PlayConstraintTracker } from "../play-constraint-tracker";
import { Suit, Rank, Seat } from "../../../engine/types";
import type { Card, PlayedCard, Trick } from "../../../engine/types";

function card(suit: Suit, rank: Rank): Card {
  return { suit, rank };
}

function played(seat: Seat, suit: Suit, rank: Rank): PlayedCard {
  return { card: card(suit, rank), seat };
}

function makeTrick(plays: PlayedCard[], trumpSuit?: Suit): Trick {
  return { plays, trumpSuit };
}

describe("PlayConstraintTracker", () => {
  describe("void detection", () => {
    it("detects void when player follows off-suit", () => {
      const tracker = new PlayConstraintTracker();
      // North leads hearts, East plays a diamond (void in hearts)
      const trick = makeTrick([
        played(Seat.North, Suit.Hearts, Rank.King),
        played(Seat.East, Suit.Diamonds, Rank.Three),
        played(Seat.South, Suit.Hearts, Rank.Ace),
        played(Seat.West, Suit.Hearts, Rank.Two),
      ]);

      tracker.update([trick], []);

      const voids = tracker.getVoids();
      expect(voids.get(Seat.East)?.has(Suit.Hearts)).toBe(true);
      // Others followed suit — no voids
      expect(voids.get(Seat.South)?.has(Suit.Hearts)).toBeFalsy();
      expect(voids.get(Seat.West)?.has(Suit.Hearts)).toBeFalsy();
    });

    it("detects void from current trick (incomplete)", () => {
      const tracker = new PlayConstraintTracker();
      // North leads spades, East discards a club
      const currentTrick: PlayedCard[] = [
        played(Seat.North, Suit.Spades, Rank.Ace),
        played(Seat.East, Suit.Clubs, Rank.Two),
      ];

      tracker.update([], currentTrick);

      const voids = tracker.getVoids();
      expect(voids.get(Seat.East)?.has(Suit.Spades)).toBe(true);
    });
  });

  describe("cursor-based updates", () => {
    it("is idempotent when called with same tricks", () => {
      const tracker = new PlayConstraintTracker();
      const trick = makeTrick([
        played(Seat.North, Suit.Hearts, Rank.King),
        played(Seat.East, Suit.Diamonds, Rank.Three),
        played(Seat.South, Suit.Hearts, Rank.Ace),
        played(Seat.West, Suit.Hearts, Rank.Two),
      ]);

      tracker.update([trick], []);
      tracker.update([trick], []);
      tracker.update([trick], []);

      const voids = tracker.getVoids();
      expect(voids.get(Seat.East)?.has(Suit.Hearts)).toBe(true);
      // Still only one void recorded
      expect(voids.get(Seat.East)?.size).toBe(1);
    });

    it("processes new tricks incrementally", () => {
      const tracker = new PlayConstraintTracker();
      const trick1 = makeTrick([
        played(Seat.North, Suit.Hearts, Rank.King),
        played(Seat.East, Suit.Diamonds, Rank.Three), // East void in hearts
        played(Seat.South, Suit.Hearts, Rank.Ace),
        played(Seat.West, Suit.Hearts, Rank.Two),
      ]);

      tracker.update([trick1], []);

      const trick2 = makeTrick([
        played(Seat.South, Suit.Spades, Rank.King),
        played(Seat.West, Suit.Clubs, Rank.Four), // West void in spades
        played(Seat.North, Suit.Spades, Rank.Ace),
        played(Seat.East, Suit.Spades, Rank.Five),
      ]);

      tracker.update([trick1, trick2], []);

      const voids = tracker.getVoids();
      expect(voids.get(Seat.East)?.has(Suit.Hearts)).toBe(true);
      expect(voids.get(Seat.West)?.has(Suit.Spades)).toBe(true);
    });
  });

  describe("suit count tracking", () => {
    it("tracks cards played per seat per suit", () => {
      const tracker = new PlayConstraintTracker();
      const trick = makeTrick([
        played(Seat.North, Suit.Hearts, Rank.King),
        played(Seat.East, Suit.Hearts, Rank.Queen),
        played(Seat.South, Suit.Hearts, Rank.Ace),
        played(Seat.West, Suit.Hearts, Rank.Two),
      ]);

      tracker.update([trick], []);

      // Each seat played 1 heart
      expect(tracker.getPlayedCount(Seat.North, Suit.Hearts)).toBe(1);
      expect(tracker.getPlayedCount(Seat.East, Suit.Hearts)).toBe(1);
    });

    it("accumulates over multiple tricks", () => {
      const tracker = new PlayConstraintTracker();
      const trick1 = makeTrick([
        played(Seat.North, Suit.Hearts, Rank.King),
        played(Seat.East, Suit.Hearts, Rank.Queen),
        played(Seat.South, Suit.Hearts, Rank.Ace),
        played(Seat.West, Suit.Hearts, Rank.Two),
      ]);
      const trick2 = makeTrick([
        played(Seat.South, Suit.Hearts, Rank.Jack),
        played(Seat.West, Suit.Hearts, Rank.Three),
        played(Seat.North, Suit.Hearts, Rank.Ten),
        played(Seat.East, Suit.Hearts, Rank.Four),
      ]);

      tracker.update([trick1, trick2], []);

      expect(tracker.getPlayedCount(Seat.North, Suit.Hearts)).toBe(2);
      expect(tracker.getPlayedCount(Seat.East, Suit.Hearts)).toBe(2);
    });
  });

  describe("no false voids from trump play", () => {
    it("does not mark trump play as void when following suit with trump in trump contract", () => {
      const tracker = new PlayConstraintTracker();
      // Hearts led, East plays a heart (following suit) — no void
      const trick = makeTrick([
        played(Seat.North, Suit.Hearts, Rank.King),
        played(Seat.East, Suit.Hearts, Rank.Five),
        played(Seat.South, Suit.Hearts, Rank.Ace),
        played(Seat.West, Suit.Hearts, Rank.Two),
      ], Suit.Spades);

      tracker.update([trick], []);

      const voids = tracker.getVoids();
      // Nobody showed a void — all followed suit
      expect(voids.get(Seat.East)?.has(Suit.Hearts)).toBeFalsy();
    });
  });
});
