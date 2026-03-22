import { describe, it, expect } from "vitest";
import { sampleDeals } from "../posterior-sampler";
import type { PublicHandSpace } from "../../../core/contracts/posterior";
import type { HandFactResolverFn } from "../../../core/contracts/fact-helpers";
import { Suit, Rank, Seat } from "../../../engine/types";
import type { Hand, Card } from "../../../engine/types";
import { HCP_VALUES } from "../../../engine/constants";

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

describe("sampleDeals with fact resolver", () => {
  it("with fact resolver, enforces derived fact constraints (bridge.hasFourCardMajor)", () => {
    // Create a resolver that knows about hasFourCardMajor
    const resolver: HandFactResolverFn = (hand, _eval, factId) => {
      if (factId === "bridge.hasFourCardMajor") {
        const hearts = hand.cards.filter(c => c.suit === Suit.Hearts).length;
        const spades = hand.cards.filter(c => c.suit === Suit.Spades).length;
        return hearts >= 4 || spades >= 4;
      }
      // Delegate to built-in for primitives
      if (factId === "hand.hcp") {
        return hand.cards.reduce((sum, c) => sum + HCP_VALUES[c.rank], 0);
      }
      return undefined;
    };

    const spaces: PublicHandSpace[] = [{
      seatId: "N",
      constraints: [{
        conjunction: "all",
        clauses: [
          { factId: "bridge.hasFourCardMajor", operator: "boolean", value: true },
        ],
      }],
    }];

    const samples = sampleDeals(spaces, southHand, Seat.South, 50, 42, resolver);

    expect(samples.length).toBeGreaterThan(0);

    // All sampled North hands should have 4+ hearts or 4+ spades
    for (const sample of samples) {
      const northHand = sample.hands.get("N")!;
      const hearts = northHand.cards.filter(c => c.suit === Suit.Hearts).length;
      const spades = northHand.cards.filter(c => c.suit === Suit.Spades).length;
      expect(hearts >= 4 || spades >= 4).toBe(true);
    }
  });

  it("with createHandFactResolver, enforces bridge.hasFourCardMajor from shared catalog", async () => {
    // This test imports from conventions/pipeline — it's a TEST file so that's OK
    const { createHandFactResolver } = await import("../../../conventions/pipeline/hand-fact-resolver");
    const resolver = createHandFactResolver();

    const spaces: PublicHandSpace[] = [{
      seatId: "N",
      constraints: [{
        conjunction: "all",
        clauses: [
          { factId: "bridge.hasFourCardMajor", operator: "boolean", value: true },
        ],
      }],
    }];

    const samples = sampleDeals(spaces, southHand, Seat.South, 50, 42, resolver);

    expect(samples.length).toBeGreaterThan(0);

    for (const sample of samples) {
      const northHand = sample.hands.get("N")!;
      const hearts = northHand.cards.filter(c => c.suit === Suit.Hearts).length;
      const spades = northHand.cards.filter(c => c.suit === Suit.Spades).length;
      expect(hearts >= 4 || spades >= 4).toBe(true);
    }
  });

  it("with createHandFactResolver, enforces bridge.hasShortage from shared catalog", async () => {
    const { createHandFactResolver } = await import("../../../conventions/pipeline/hand-fact-resolver");
    const resolver = createHandFactResolver();

    const spaces: PublicHandSpace[] = [{
      seatId: "N",
      constraints: [{
        conjunction: "all",
        clauses: [
          { factId: "bridge.hasShortage", operator: "boolean", value: true },
        ],
      }],
    }];

    const samples = sampleDeals(spaces, southHand, Seat.South, 50, 42, resolver);

    expect(samples.length).toBeGreaterThan(0);

    for (const sample of samples) {
      const northHand = sample.hands.get("N")!;
      const spades = northHand.cards.filter(c => c.suit === Suit.Spades).length;
      const hearts = northHand.cards.filter(c => c.suit === Suit.Hearts).length;
      const diamonds = northHand.cards.filter(c => c.suit === Suit.Diamonds).length;
      const clubs = northHand.cards.filter(c => c.suit === Suit.Clubs).length;
      const hasShortage = spades <= 1 || hearts <= 1 || diamonds <= 1 || clubs <= 1;
      expect(hasShortage).toBe(true);
    }
  });

  it("without resolver, existing behavior is preserved (backward compat)", () => {
    // Same test as original — no resolver parameter
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
      const hcp = calculateHcp(northHand!);
      expect(hcp).toBeGreaterThanOrEqual(15);
      expect(hcp).toBeLessThanOrEqual(17);
    }
  });
});
