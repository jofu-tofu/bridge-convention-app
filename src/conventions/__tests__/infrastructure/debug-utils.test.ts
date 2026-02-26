import { describe, it, expect } from "vitest";
import { reconstructBiddingContext } from "../../core/debug-utils";
import { Suit, Rank, Seat, BidSuit, Vulnerability } from "../../../engine/types";
import type { Deal, Auction, Hand } from "../../../engine/types";

function makeHand(cards: Array<{ suit: Suit; rank: Rank }>): Hand {
  return { cards };
}

const southHand = makeHand([
  { suit: Suit.Spades, rank: Rank.Ace },
  { suit: Suit.Spades, rank: Rank.King },
  { suit: Suit.Spades, rank: Rank.Queen },
  { suit: Suit.Hearts, rank: Rank.Jack },
  { suit: Suit.Hearts, rank: Rank.Ten },
  { suit: Suit.Diamonds, rank: Rank.Nine },
  { suit: Suit.Diamonds, rank: Rank.Eight },
  { suit: Suit.Diamonds, rank: Rank.Seven },
  { suit: Suit.Diamonds, rank: Rank.Six },
  { suit: Suit.Clubs, rank: Rank.Five },
  { suit: Suit.Clubs, rank: Rank.Four },
  { suit: Suit.Clubs, rank: Rank.Three },
  { suit: Suit.Clubs, rank: Rank.Two },
]);

const deal: Deal = {
  hands: {
    [Seat.North]: makeHand([]),
    [Seat.East]: makeHand([]),
    [Seat.South]: southHand,
    [Seat.West]: makeHand([]),
  },
  dealer: Seat.North,
  vulnerability: Vulnerability.None,
};

describe("reconstructBiddingContext", () => {
  it("produces BiddingContext with correct hand and evaluation", () => {
    const auction: Auction = { entries: [], isComplete: false };
    const ctx = reconstructBiddingContext(deal, Seat.South, auction);

    expect(ctx.hand).toBe(southHand);
    expect(ctx.seat).toBe(Seat.South);
    expect(ctx.auction).toBe(auction);
    // A K Q J = 10 HCP
    expect(ctx.evaluation.hcp).toBe(10);
  });

  it("uses provided auction prefix as auction state", () => {
    const prefix: Auction = {
      entries: [
        { seat: Seat.North, call: { type: "bid", level: 1, strain: BidSuit.NoTrump } },
      ],
      isComplete: false,
    };
    const ctx = reconstructBiddingContext(deal, Seat.South, prefix);
    expect(ctx.auction.entries).toHaveLength(1);
  });
});
