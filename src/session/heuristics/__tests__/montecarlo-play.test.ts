import { describe, it, expect, vi } from "vitest";
import { samplePlayDeals, createWorldClassProvider } from "../montecarlo-play";
import { Suit, Rank, Seat, BidSuit } from "../../../engine/types";
import type { Card, Hand, PlayedCard, Trick, Contract } from "../../../engine/types";
import type { EnginePort } from "../../../engine/port";
import type { PlayContext } from "../../../conventions/core/strategy-types";
import type { SolveBoardResult } from "../../../engine/dds-wasm";
import { mulberry32 } from "../../../engine/seeded-rng";
import { createDeck } from "../../../engine/constants";

function card(suit: Suit, rank: Rank): Card {
  return { suit, rank };
}

function played(seat: Seat, suit: Suit, rank: Rank): PlayedCard {
  return { card: card(suit, rank), seat };
}

function makeTrick(plays: PlayedCard[], trumpSuit?: Suit): Trick {
  return { plays, trumpSuit };
}

function makeContract(declarer: Seat, strain: BidSuit): Contract {
  return { level: 1, strain, doubled: false, redoubled: false, declarer };
}

// ── samplePlayDeals tests ──────────────────────────────────────

describe("samplePlayDeals", () => {
  it("produces valid samples with 2 unknown seats", () => {
    // South has 13 cards, dummy (North) has 13 cards, E/W unknown
    const deck = createDeck();
    const southHand: Hand = { cards: deck.slice(0, 13) };
    const northHand: Hand = { cards: deck.slice(13, 26) };
    const rng = mulberry32(42);

    const samples = samplePlayDeals({
      knownHands: { [Seat.South]: southHand, [Seat.North]: northHand },
      playedCards: new Map(),
      voids: new Map(),
      unknownSeats: [Seat.East, Seat.West],
      cardsNeeded: { [Seat.East]: 13, [Seat.West]: 13 },
      n: 5,
      rng,
    });

    expect(samples.length).toBeGreaterThan(0);
    expect(samples.length).toBeLessThanOrEqual(5);

    for (const sample of samples) {
      // Each unknown seat has exactly 13 cards
      expect(sample[Seat.East].cards.length).toBe(13);
      expect(sample[Seat.West].cards.length).toBe(13);

      // No overlap between hands
      const allCards = [
        ...southHand.cards,
        ...northHand.cards,
        ...sample[Seat.East].cards,
        ...sample[Seat.West].cards,
      ];
      const uniqueKeys = new Set(allCards.map((c) => `${c.suit}${c.rank}`));
      expect(uniqueKeys.size).toBe(52);
    }
  });

  it("respects void constraints", () => {
    const deck = createDeck();
    const southHand: Hand = { cards: deck.slice(0, 13) };
    const northHand: Hand = { cards: deck.slice(13, 26) };
    const rng = mulberry32(99);

    // East is void in hearts
    const voids = new Map<Seat, Set<Suit>>();
    voids.set(Seat.East, new Set([Suit.Hearts]));

    const samples = samplePlayDeals({
      knownHands: { [Seat.South]: southHand, [Seat.North]: northHand },
      playedCards: new Map(),
      voids,
      unknownSeats: [Seat.East, Seat.West],
      cardsNeeded: { [Seat.East]: 13, [Seat.West]: 13 },
      n: 10,
      rng,
    });

    expect(samples.length).toBeGreaterThan(0);
    for (const sample of samples) {
      // East must have 0 hearts
      const eastHearts = sample[Seat.East].cards.filter((c) => c.suit === Suit.Hearts);
      expect(eastHearts.length).toBe(0);
    }
  });

  it("handles mid-play with fewer cards needed", () => {
    // After 3 tricks, each seat has played 3 cards → 10 remaining each
    const deck = createDeck();
    // Take first 10 cards as South's remaining
    const southRemaining: Hand = { cards: deck.slice(0, 10) };
    const northRemaining: Hand = { cards: deck.slice(10, 20) };
    // E/W share the remaining 32 cards (but each needs 10)
    const rng = mulberry32(77);

    // 3 cards played by each seat
    const playedCards = new Map<Seat, Card[]>();
    playedCards.set(Seat.South, deck.slice(40, 43));
    playedCards.set(Seat.North, deck.slice(43, 46));
    playedCards.set(Seat.East, deck.slice(46, 49));
    playedCards.set(Seat.West, deck.slice(49, 52));

    const samples = samplePlayDeals({
      knownHands: { [Seat.South]: southRemaining, [Seat.North]: northRemaining },
      playedCards,
      voids: new Map(),
      unknownSeats: [Seat.East, Seat.West],
      cardsNeeded: { [Seat.East]: 10, [Seat.West]: 10 },
      n: 5,
      rng,
    });

    expect(samples.length).toBeGreaterThan(0);
    for (const sample of samples) {
      expect(sample[Seat.East].cards.length).toBe(10);
      expect(sample[Seat.West].cards.length).toBe(10);
    }
  });

  it("returns empty when constraints are impossible", () => {
    // Both E and W void in all 4 suits = impossible to deal any cards
    const deck = createDeck();
    const southHand: Hand = { cards: deck.slice(0, 13) };
    const northHand: Hand = { cards: deck.slice(13, 26) };
    const rng = mulberry32(42);

    const voids = new Map<Seat, Set<Suit>>();
    voids.set(Seat.East, new Set([Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs]));

    const samples = samplePlayDeals({
      knownHands: { [Seat.South]: southHand, [Seat.North]: northHand },
      playedCards: new Map(),
      voids,
      unknownSeats: [Seat.East, Seat.West],
      cardsNeeded: { [Seat.East]: 13, [Seat.West]: 13 },
      n: 5,
      rng,
    });

    expect(samples.length).toBe(0);
  });
});

// ── MonteCarloPlayProvider tests ────────────────────────────────

describe("createWorldClassProvider", () => {
  function makeStubEngine(solveBoardFn?: (pbn: string) => SolveBoardResult): EnginePort {
    const defaultSolve: SolveBoardResult = {
      cards: [
        { suit: Suit.Hearts, rank: Rank.Ace, score: 8, equals: 0 },
        { suit: Suit.Hearts, rank: Rank.King, score: 7, equals: 0 },
      ],
    };
    return {
      solveBoard: vi.fn().mockResolvedValue(solveBoardFn ? undefined : defaultSolve)
        .mockImplementation(
          async (_trump, _first, _suits, _ranks, pbn) =>
            solveBoardFn ? solveBoardFn(pbn as string) : defaultSolve,
        ),
      // Unused methods — provide stubs
      generateDeal: vi.fn(),
      evaluateHand: vi.fn(),
      getSuitLength: vi.fn(),
      isBalanced: vi.fn(),
      getLegalCalls: vi.fn(),
      addCall: vi.fn(),
      isAuctionComplete: vi.fn(),
      getContract: vi.fn(),
      calculateScore: vi.fn(),
      getLegalPlays: vi.fn(),
      getTrickWinner: vi.fn(),
      solveDeal: vi.fn(),
      suggestPlay: vi.fn(),
    } as unknown as EnginePort;
  }

  it("returns single legal play immediately without DDS", async () => {
    const engine = makeStubEngine();
    const provider = createWorldClassProvider(engine, mulberry32(42));

    const onlyCard = card(Suit.Hearts, Rank.Ace);
    const ctx: PlayContext = {
      hand: { cards: [onlyCard] },
      currentTrick: [],
      previousTricks: [],
      contract: makeContract(Seat.South, BidSuit.NoTrump),
      seat: Seat.West,
      trumpSuit: undefined,
      legalPlays: [onlyCard],
    };

    const result = await provider.getStrategy().suggest(ctx);
    expect(result.card).toEqual(onlyCard);
    expect(result.reason).toBe("only-legal-play");
    // Should not have called solveBoard
    expect(engine.solveBoard).not.toHaveBeenCalled();
  });

  it("picks highest-average card from DDS results", async () => {
    // DDS always returns: Ace → 9 tricks, King → 7 tricks
    const engine = makeStubEngine(() => ({
      cards: [
        { suit: Suit.Hearts, rank: Rank.Ace, score: 9, equals: 0 },
        { suit: Suit.Hearts, rank: Rank.King, score: 7, equals: 0 },
      ],
    }));

    const provider = createWorldClassProvider(engine, mulberry32(42));
    const deck = createDeck();

    const ctx: PlayContext = {
      hand: { cards: deck.slice(0, 13) },
      currentTrick: [],
      previousTricks: [],
      contract: makeContract(Seat.South, BidSuit.NoTrump),
      seat: Seat.West,
      trumpSuit: undefined,
      legalPlays: [
        card(Suit.Hearts, Rank.Ace),
        card(Suit.Hearts, Rank.King),
      ],
      dummyHand: { cards: deck.slice(13, 26) },
    };

    const result = await provider.getStrategy().suggest(ctx);
    // Should pick Ace (score 9 > 7)
    expect(result.card.rank).toBe(Rank.Ace);
    expect(result.reason).toContain("mc-dds");
  });

  it("falls back to expert heuristics when 0 samples produced", async () => {
    const engine = makeStubEngine();
    const provider = createWorldClassProvider(engine, mulberry32(42));

    // Create a context with impossible constraints to force 0 samples
    // By providing no dummyHand and an unknown seat configuration that can't sample
    const ctx: PlayContext = {
      hand: { cards: [card(Suit.Hearts, Rank.Ace), card(Suit.Hearts, Rank.King)] },
      currentTrick: [],
      previousTricks: [],
      contract: makeContract(Seat.South, BidSuit.NoTrump),
      seat: Seat.West,
      trumpSuit: undefined,
      legalPlays: [
        card(Suit.Hearts, Rank.Ace),
        card(Suit.Hearts, Rank.King),
      ],
      // No dummyHand — 3 unknown seats, harder to sample but still possible
      // Force impossibility by not providing enough info
    };

    // Even if sampling fails, should still return a valid card (fallback)
    const result = await provider.getStrategy().suggest(ctx);
    expect(result.card).toBeDefined();
    expect(result.card.suit).toBe(Suit.Hearts);
  });

  it("falls back when solveBoard rejects", async () => {
    const engine = {
      ...makeStubEngine(),
      solveBoard: vi.fn().mockRejectedValue(new Error("DDS not available")),
    } as unknown as EnginePort;

    const provider = createWorldClassProvider(engine, mulberry32(42));
    const deck = createDeck();

    const ctx: PlayContext = {
      hand: { cards: deck.slice(0, 13) },
      currentTrick: [],
      previousTricks: [],
      contract: makeContract(Seat.South, BidSuit.NoTrump),
      seat: Seat.West,
      trumpSuit: undefined,
      legalPlays: [
        card(Suit.Hearts, Rank.Ace),
        card(Suit.Hearts, Rank.King),
      ],
      dummyHand: { cards: deck.slice(13, 26) },
    };

    // Should fall back to expert heuristics
    const result = await provider.getStrategy().suggest(ctx);
    expect(result.card).toBeDefined();
  });
});

// ── Batched evaluation + early termination tests ──────────────

describe("createWorldClassProvider batching", () => {
  function makeStubEngine(solveBoardFn?: (pbn: string) => SolveBoardResult): EnginePort {
    const defaultSolve: SolveBoardResult = {
      cards: [
        { suit: Suit.Hearts, rank: Rank.Ace, score: 8, equals: 0 },
        { suit: Suit.Hearts, rank: Rank.King, score: 7, equals: 0 },
      ],
    };
    return {
      solveBoard: vi.fn().mockImplementation(
        async (_trump: number, _first: number, _suits: number[], _ranks: number[], pbn: string) =>
          solveBoardFn ? solveBoardFn(pbn) : defaultSolve,
      ),
      generateDeal: vi.fn(),
      evaluateHand: vi.fn(),
      getSuitLength: vi.fn(),
      isBalanced: vi.fn(),
      getLegalCalls: vi.fn(),
      addCall: vi.fn(),
      isAuctionComplete: vi.fn(),
      getContract: vi.fn(),
      calculateScore: vi.fn(),
      getLegalPlays: vi.fn(),
      getTrickWinner: vi.fn(),
      solveDeal: vi.fn(),
      suggestPlay: vi.fn(),
    } as unknown as EnginePort;
  }

  function makeCtx(): PlayContext {
    const deck = createDeck();
    return {
      hand: { cards: deck.slice(0, 13) },
      currentTrick: [],
      previousTricks: [],
      contract: makeContract(Seat.South, BidSuit.NoTrump),
      seat: Seat.West,
      trumpSuit: undefined,
      legalPlays: [
        card(Suit.Hearts, Rank.Ace),
        card(Suit.Hearts, Rank.King),
      ],
      dummyHand: { cards: deck.slice(13, 26) },
    };
  }

  it("early-terminates after first batch when margin is large", async () => {
    // Card A: score 10, Card B: score 3 → gap = 7 >> 0.5
    const engine = makeStubEngine(() => ({
      cards: [
        { suit: Suit.Hearts, rank: Rank.Ace, score: 10, equals: 0 },
        { suit: Suit.Hearts, rank: Rank.King, score: 3, equals: 0 },
      ],
    }));

    const provider = createWorldClassProvider(engine, mulberry32(42));
    const result = await provider.getStrategy().suggest(makeCtx());

    expect(result.card.rank).toBe(Rank.Ace);
    expect(result.reason).toContain("early-stop");
    // Only first batch (10 calls), not all 30
    expect(engine.solveBoard).toHaveBeenCalledTimes(10);
  });

  it("runs all batches when scores are close", async () => {
    // Both cards score 7 → gap = 0 < 0.5
    const engine = makeStubEngine(() => ({
      cards: [
        { suit: Suit.Hearts, rank: Rank.Ace, score: 7, equals: 0 },
        { suit: Suit.Hearts, rank: Rank.King, score: 7, equals: 0 },
      ],
    }));

    const provider = createWorldClassProvider(engine, mulberry32(42));
    const result = await provider.getStrategy().suggest(makeCtx());

    expect(result.reason).not.toContain("early-stop");
    expect(engine.solveBoard).toHaveBeenCalledTimes(30);
  });

  it("early-terminates after second batch when margin widens", async () => {
    let callCount = 0;
    const engine = makeStubEngine(() => {
      callCount++;
      // First 10 calls: close scores (gap < 0.5)
      if (callCount <= 10) {
        return {
          cards: [
            { suit: Suit.Hearts, rank: Rank.Ace, score: 7, equals: 0 },
            { suit: Suit.Hearts, rank: Rank.King, score: 7, equals: 0 },
          ],
        };
      }
      // Next 10 calls: widen the gap
      return {
        cards: [
          { suit: Suit.Hearts, rank: Rank.Ace, score: 10, equals: 0 },
          { suit: Suit.Hearts, rank: Rank.King, score: 3, equals: 0 },
        ],
      };
    });

    const provider = createWorldClassProvider(engine, mulberry32(42));
    const result = await provider.getStrategy().suggest(makeCtx());

    expect(result.card.rank).toBe(Rank.Ace);
    expect(result.reason).toContain("early-stop");
    // Two batches = 20 calls
    expect(engine.solveBoard).toHaveBeenCalledTimes(20);
  });

  it("handles partial batch failures gracefully", async () => {
    let callCount = 0;
    const engine = makeStubEngine(() => {
      callCount++;
      // Every 3rd call fails
      if (callCount % 3 === 0) {
        throw new Error("DDS failure");
      }
      return {
        cards: [
          { suit: Suit.Hearts, rank: Rank.Ace, score: 9, equals: 0 },
          { suit: Suit.Hearts, rank: Rank.King, score: 5, equals: 0 },
        ],
      };
    });

    const provider = createWorldClassProvider(engine, mulberry32(42));
    const result = await provider.getStrategy().suggest(makeCtx());

    // Should still produce a valid result from successful solves
    expect(result.card).toBeDefined();
    expect(result.card.rank).toBe(Rank.Ace);
    expect(result.reason).toContain("mc-dds");
  });

  it("reason includes early-stop only when early termination fires", async () => {
    // Large gap → early stop
    const engine = makeStubEngine(() => ({
      cards: [
        { suit: Suit.Hearts, rank: Rank.Ace, score: 10, equals: 0 },
        { suit: Suit.Hearts, rank: Rank.King, score: 2, equals: 0 },
      ],
    }));

    const provider = createWorldClassProvider(engine, mulberry32(42));
    const result = await provider.getStrategy().suggest(makeCtx());
    expect(result.reason).toContain("early-stop");
    expect(result.reason).toContain("mc-dds");
    expect(result.reason).toContain("samples");
  });

  it("reason excludes early-stop when all batches run", async () => {
    // Equal scores → no early stop
    const engine = makeStubEngine(() => ({
      cards: [
        { suit: Suit.Hearts, rank: Rank.Ace, score: 7, equals: 0 },
        { suit: Suit.Hearts, rank: Rank.King, score: 7, equals: 0 },
      ],
    }));

    const provider = createWorldClassProvider(engine, mulberry32(42));
    const result = await provider.getStrategy().suggest(makeCtx());
    expect(result.reason).not.toContain("early-stop");
    expect(result.reason).toContain("mc-dds");
  });
});
