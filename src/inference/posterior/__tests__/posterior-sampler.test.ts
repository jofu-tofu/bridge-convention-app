import { describe, it, expect } from "vitest";
import { sampleDeals } from "../posterior-sampler";
import type { PublicHandSpace } from "../../../core/contracts/posterior";
import { Suit, Rank, Seat } from "../../../engine/types";
import type { Hand, Card } from "../../../engine/types";

function makeHand(cards: Card[]): Hand {
  return { cards };
}

// South hand: 10 HCP (A, K, Q, J = 10), moderate shape
const southHand: Hand = makeHand([
  { suit: Suit.Spades, rank: Rank.Ace },
  { suit: Suit.Spades, rank: Rank.Five },
  { suit: Suit.Spades, rank: Rank.Three },
  { suit: Suit.Spades, rank: Rank.Two },
  { suit: Suit.Hearts, rank: Rank.King },
  { suit: Suit.Hearts, rank: Rank.Six },
  { suit: Suit.Hearts, rank: Rank.Four },
  { suit: Suit.Diamonds, rank: Rank.Queen },
  { suit: Suit.Diamonds, rank: Rank.Seven },
  { suit: Suit.Diamonds, rank: Rank.Three },
  { suit: Suit.Clubs, rank: Rank.Jack },
  { suit: Suit.Clubs, rank: Rank.Eight },
  { suit: Suit.Clubs, rank: Rank.Two },
]);

describe("sampleDeals", () => {
  it("produces valid deals satisfying all hard constraints", () => {
    // North must have 15-17 HCP
    const spaces: PublicHandSpace[] = [
      {
        seatId: "N",
        constraints: [
          {
            conjunction: "all",
            clauses: [
              { factId: "hand.hcp", operator: "gte", value: 15 },
              { factId: "hand.hcp", operator: "lte", value: 17 },
            ],
          },
        ],
      },
    ];

    const samples = sampleDeals(spaces, southHand, Seat.South, 10, 42);

    expect(samples.length).toBeGreaterThan(0);

    for (const sample of samples) {
      const northHand = sample.hands.get("N");
      expect(northHand).toBeDefined();
      // Verify HCP constraint
      const hcp = calculateHcp(northHand!);
      expect(hcp).toBeGreaterThanOrEqual(15);
      expect(hcp).toBeLessThanOrEqual(17);
    }
  });

  it("produces deals where own hand cards do not appear elsewhere", () => {
    const spaces: PublicHandSpace[] = [];
    const samples = sampleDeals(spaces, southHand, Seat.South, 5, 42);

    expect(samples.length).toBeGreaterThan(0);

    const ownCardKeys = new Set(
      southHand.cards.map((c) => `${c.suit}${c.rank}`),
    );

    for (const sample of samples) {
      for (const [seatId, hand] of sample.hands) {
        if (seatId === "S") continue;
        for (const card of hand.cards) {
          expect(ownCardKeys.has(`${card.suit}${card.rank}`)).toBe(false);
        }
      }
    }
  });

  it("deals exactly 13 cards to each hand", () => {
    const spaces: PublicHandSpace[] = [];
    const samples = sampleDeals(spaces, southHand, Seat.South, 5, 42);

    expect(samples.length).toBeGreaterThan(0);

    for (const sample of samples) {
      for (const [, hand] of sample.hands) {
        expect(hand.cards).toHaveLength(13);
      }
    }
  });

  it("produces deterministic results with the same seed", () => {
    const spaces: PublicHandSpace[] = [];
    const samples1 = sampleDeals(spaces, southHand, Seat.South, 5, 42);
    const samples2 = sampleDeals(spaces, southHand, Seat.South, 5, 42);

    expect(samples1.length).toBe(samples2.length);

    for (let i = 0; i < samples1.length; i++) {
      const hands1 = samples1[i]!.hands;
      const hands2 = samples2[i]!.hands;
      for (const seat of ["N", "E", "W"]) {
        const h1 = hands1.get(seat)!;
        const h2 = hands2.get(seat)!;
        expect(h1.cards).toEqual(h2.cards);
      }
    }
  });
});

// Helper to calculate HCP from a hand
function calculateHcp(hand: Hand): number {
  const hcpValues: Record<string, number> = {
    [Rank.Jack]: 1,
    [Rank.Queen]: 2,
    [Rank.King]: 3,
    [Rank.Ace]: 4,
  };
  return hand.cards.reduce(
    (sum, card) => sum + (hcpValues[card.rank] ?? 0),
    0,
  );
}
