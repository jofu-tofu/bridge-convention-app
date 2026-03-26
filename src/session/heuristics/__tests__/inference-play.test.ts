import { describe, it, expect } from "vitest";
import {
  auctionAwareLeadHeuristic,
  inferenceHonorPlayHeuristic,
  inferenceAwareDiscardHeuristic,
} from "../inference-play";
import type { PlayContext } from "../../../conventions/core/strategy-types";
import { Suit, Rank, Seat, BidSuit } from "../../../engine/types";
import type { Card, Contract, PlayedCard } from "../../../engine/types";
import type { PublicBeliefs, DerivedRanges } from "../../../inference/inference-types";

function card(suit: Suit, rank: Rank): Card {
  return { suit, rank };
}

function playedCard(seat: Seat, suit: Suit, rank: Rank): PlayedCard {
  return { card: card(suit, rank), seat };
}

function makeContract(declarer: Seat, strain: BidSuit): Contract {
  return { level: 3, strain, doubled: false, redoubled: false, declarer };
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

function makeRanges(overrides: Partial<DerivedRanges>): DerivedRanges {
  return {
    hcp: { min: 0, max: 40 },
    suitLengths: {
      [Suit.Spades]: { min: 0, max: 13 },
      [Suit.Hearts]: { min: 0, max: 13 },
      [Suit.Diamonds]: { min: 0, max: 13 },
      [Suit.Clubs]: { min: 0, max: 13 },
    },
    isBalanced: undefined,
    ...overrides,
  };
}

function makeBeliefs(seat: Seat, ranges: DerivedRanges): PublicBeliefs {
  return { seat, constraints: [], ranges, qualitative: [] };
}

// ── auctionAwareLeadHeuristic ───────────────────────────────────────

describe("auctionAwareLeadHeuristic", () => {
  it("returns null when not on opening lead", () => {
    const ctx = makeContext({
      currentTrick: [playedCard(Seat.North, Suit.Hearts, Rank.Five)],
      seat: Seat.West,
    });
    expect(auctionAwareLeadHeuristic.apply(ctx)).toBeNull();
  });

  it("returns null when no inferences available", () => {
    const ctx = makeContext({
      currentTrick: [],
      previousTricks: [],
      seat: Seat.West,
      hand: { cards: [card(Suit.Hearts, Rank.Five)] },
      legalPlays: [card(Suit.Hearts, Rank.Five)],
    });
    expect(auctionAwareLeadHeuristic.apply(ctx)).toBeNull();
  });

  it("returns null for declarer (not a defender)", () => {
    const ctx = makeContext({
      currentTrick: [],
      previousTricks: [],
      seat: Seat.South, // declarer
      contract: makeContract(Seat.South, BidSuit.NoTrump),
      hand: { cards: [card(Suit.Hearts, Rank.Five)] },
      legalPlays: [card(Suit.Hearts, Rank.Five)],
      inferences: {
        [Seat.North]: makeBeliefs(Seat.North, makeRanges({})),
        [Seat.East]: makeBeliefs(Seat.East, makeRanges({})),
        [Seat.South]: makeBeliefs(Seat.South, makeRanges({})),
        [Seat.West]: makeBeliefs(Seat.West, makeRanges({})),
      },
    });
    expect(auctionAwareLeadHeuristic.apply(ctx)).toBeNull();
  });

  it("leads partner's long suit over declarer's long suit", () => {
    const partnerRanges = makeRanges({
      suitLengths: {
        [Suit.Spades]: { min: 1, max: 3 },
        [Suit.Hearts]: { min: 5, max: 7 },
        [Suit.Diamonds]: { min: 2, max: 3 },
        [Suit.Clubs]: { min: 2, max: 3 },
      },
    });
    const declarerRanges = makeRanges({
      suitLengths: {
        [Suit.Spades]: { min: 5, max: 7 },
        [Suit.Hearts]: { min: 2, max: 3 },
        [Suit.Diamonds]: { min: 2, max: 4 },
        [Suit.Clubs]: { min: 2, max: 4 },
      },
    });

    const ctx = makeContext({
      currentTrick: [],
      previousTricks: [],
      seat: Seat.West,
      contract: makeContract(Seat.South, BidSuit.NoTrump),
      hand: {
        cards: [
          card(Suit.Spades, Rank.Jack),
          card(Suit.Spades, Rank.Eight),
          card(Suit.Spades, Rank.Five),
          card(Suit.Hearts, Rank.Six),
          card(Suit.Hearts, Rank.Four),
          card(Suit.Hearts, Rank.Two),
          card(Suit.Diamonds, Rank.King),
          card(Suit.Diamonds, Rank.Nine),
          card(Suit.Clubs, Rank.Queen),
          card(Suit.Clubs, Rank.Ten),
          card(Suit.Clubs, Rank.Seven),
          card(Suit.Clubs, Rank.Three),
          card(Suit.Clubs, Rank.Two),
        ],
      },
      legalPlays: [
        card(Suit.Spades, Rank.Jack),
        card(Suit.Spades, Rank.Eight),
        card(Suit.Spades, Rank.Five),
        card(Suit.Hearts, Rank.Six),
        card(Suit.Hearts, Rank.Four),
        card(Suit.Hearts, Rank.Two),
        card(Suit.Diamonds, Rank.King),
        card(Suit.Diamonds, Rank.Nine),
        card(Suit.Clubs, Rank.Queen),
        card(Suit.Clubs, Rank.Ten),
        card(Suit.Clubs, Rank.Seven),
        card(Suit.Clubs, Rank.Three),
        card(Suit.Clubs, Rank.Two),
      ],
      inferences: {
        [Seat.North]: makeBeliefs(Seat.North, makeRanges({})),
        [Seat.East]: makeBeliefs(Seat.East, partnerRanges),
        [Seat.South]: makeBeliefs(Seat.South, declarerRanges),
        [Seat.West]: makeBeliefs(Seat.West, makeRanges({})),
      },
    });

    const result = auctionAwareLeadHeuristic.apply(ctx);
    expect(result).not.toBeNull();
    expect(result!.suit).toBe(Suit.Hearts);
  });
});

// ── inferenceHonorPlayHeuristic ─────────────────────────────────────

describe("inferenceHonorPlayHeuristic", () => {
  it("returns null when not in 2nd or 3rd position", () => {
    const ctx = makeContext({
      currentTrick: [], // 0th position (on lead)
      seat: Seat.West,
    });
    expect(inferenceHonorPlayHeuristic.apply(ctx)).toBeNull();
  });

  it("returns null without inferences", () => {
    const ctx = makeContext({
      currentTrick: [playedCard(Seat.North, Suit.Hearts, Rank.Five)],
      seat: Seat.East,
      legalPlays: [card(Suit.Hearts, Rank.King), card(Suit.Hearts, Rank.Three)],
    });
    expect(inferenceHonorPlayHeuristic.apply(ctx)).toBeNull();
  });

  it("plays low when declarer is strong (>60% of combined HCP)", () => {
    const declarerRanges = makeRanges({ hcp: { min: 15, max: 17 } });
    const dummyRanges = makeRanges({ hcp: { min: 6, max: 8 } });

    const ctx = makeContext({
      currentTrick: [playedCard(Seat.North, Suit.Hearts, Rank.Five)],
      seat: Seat.East,
      contract: makeContract(Seat.South, BidSuit.NoTrump),
      legalPlays: [card(Suit.Hearts, Rank.King), card(Suit.Hearts, Rank.Three)],
      inferences: {
        [Seat.North]: makeBeliefs(Seat.North, dummyRanges),
        [Seat.East]: makeBeliefs(Seat.East, makeRanges({})),
        [Seat.South]: makeBeliefs(Seat.South, declarerRanges),
        [Seat.West]: makeBeliefs(Seat.West, makeRanges({})),
      },
    });

    const result = inferenceHonorPlayHeuristic.apply(ctx);
    // Declarer has ~16 HCP, dummy ~7 → strength = 16/23 ≈ 0.70 > 0.6
    // Should play low
    expect(result).not.toBeNull();
    expect(result!.rank).toBe(Rank.Three);
  });
});

// ── inferenceAwareDiscardHeuristic ──────────────────────────────────

describe("inferenceAwareDiscardHeuristic", () => {
  it("returns null when following suit", () => {
    const ctx = makeContext({
      currentTrick: [playedCard(Seat.North, Suit.Hearts, Rank.Five)],
      seat: Seat.East,
      legalPlays: [card(Suit.Hearts, Rank.Three)],
      inferences: {
        [Seat.North]: makeBeliefs(Seat.North, makeRanges({})),
        [Seat.East]: makeBeliefs(Seat.East, makeRanges({})),
        [Seat.South]: makeBeliefs(Seat.South, makeRanges({})),
        [Seat.West]: makeBeliefs(Seat.West, makeRanges({})),
      },
    });
    expect(inferenceAwareDiscardHeuristic.apply(ctx)).toBeNull();
  });

  it("returns null without inferences", () => {
    const ctx = makeContext({
      currentTrick: [playedCard(Seat.North, Suit.Hearts, Rank.Five)],
      seat: Seat.East,
      contract: makeContract(Seat.South, BidSuit.NoTrump),
      legalPlays: [card(Suit.Spades, Rank.Three), card(Suit.Diamonds, Rank.Five)],
    });
    expect(inferenceAwareDiscardHeuristic.apply(ctx)).toBeNull();
  });
});
