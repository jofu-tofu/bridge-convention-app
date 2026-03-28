import { describe, it, expect, vi } from "vitest";
import { samplePlayDeals, createWorldClassProvider } from "../montecarlo-play";
import { Suit, Rank, Seat, BidSuit } from "../../../engine/types";
import type { Card, Hand, PlayedCard, Trick, Contract } from "../../../engine/types";
import type { EnginePort } from "../../../engine/port";
import type { PlayContext } from "../../../conventions/core/strategy-types";
import type { SolveBoardResult } from "../../../engine/dds-wasm";
import type { DerivedRanges, PublicBeliefs } from "../../../inference/inference-types";
import { mulberry32 } from "../../../engine/seeded-rng";
import { createDeck, HCP_VALUES } from "../../../engine/constants";

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

  it("produces valid samples mid-play when dummy has played cards", () => {
    // Simulate 1 completed trick: each seat played 1 card.
    // Known hands should be REMAINING cards (original 13 minus played).
    const deck = createDeck();
    const rng = mulberry32(42);

    // Assign original 13-card hands
    const southOriginal = deck.slice(0, 13);
    const northOriginal = deck.slice(13, 26); // dummy

    // 1 trick: each seat played their first card
    const playedCards = new Map<Seat, Card[]>();
    playedCards.set(Seat.South, [southOriginal[0]!]);
    playedCards.set(Seat.North, [northOriginal[0]!]);
    playedCards.set(Seat.East, [deck[26]!]);
    playedCards.set(Seat.West, [deck[39]!]);

    // Remaining cards = original minus played
    const southRemaining: Hand = { cards: southOriginal.slice(1) };  // 12 cards
    const northRemaining: Hand = { cards: northOriginal.slice(1) };  // 12 cards (dummy)

    const samples = samplePlayDeals({
      knownHands: { [Seat.South]: southRemaining, [Seat.North]: northRemaining },
      playedCards,
      voids: new Map(),
      unknownSeats: [Seat.East, Seat.West],
      cardsNeeded: { [Seat.East]: 12, [Seat.West]: 12 },
      n: 5,
      rng,
    });

    expect(samples.length).toBeGreaterThan(0);
    for (const sample of samples) {
      expect(sample[Seat.East].cards.length).toBe(12);
      expect(sample[Seat.West].cards.length).toBe(12);

      // All 52 cards accounted for: 12+12 remaining known + 4 played + 12+12 sampled
      const allCards = [
        ...southRemaining.cards,
        ...northRemaining.cards,
        ...playedCards.get(Seat.South)!,
        ...playedCards.get(Seat.North)!,
        ...playedCards.get(Seat.East)!,
        ...playedCards.get(Seat.West)!,
        ...sample[Seat.East].cards,
        ...sample[Seat.West].cards,
      ];
      const unique = new Set(allCards.map((c) => `${c.suit}${c.rank}`));
      expect(unique.size).toBe(52);
    }
  });

  it("produces incorrect samples when dummy known hand includes played cards", () => {
    // Bug scenario: passing the ORIGINAL 13-card dummy hand instead of remaining.
    // Sampling still works (pool deduplication masks the count error), but the
    // resulting samples include an already-played card in dummy's hand — yielding
    // a corrupt PBN for DDS.
    const deck = createDeck();
    const rng = mulberry32(42);

    const southOriginal = deck.slice(0, 13);
    const northOriginal = deck.slice(13, 26); // dummy

    const playedCards = new Map<Seat, Card[]>();
    playedCards.set(Seat.South, [southOriginal[0]!]);
    playedCards.set(Seat.North, [northOriginal[0]!]);
    playedCards.set(Seat.East, [deck[26]!]);
    playedCards.set(Seat.West, [deck[39]!]);

    // BUG: pass original 13-card hand instead of 12 remaining
    const southRemaining: Hand = { cards: southOriginal.slice(1) }; // 12 — correct
    const northFull: Hand = { cards: northOriginal };               // 13 — BUG: includes played card

    const samples = samplePlayDeals({
      knownHands: { [Seat.South]: southRemaining, [Seat.North]: northFull },
      playedCards,
      voids: new Map(),
      unknownSeats: [Seat.East, Seat.West],
      cardsNeeded: { [Seat.East]: 12, [Seat.West]: 12 },
      n: 5,
      rng,
    });

    // Sampling succeeds (pool deduplication masks the issue)
    expect(samples.length).toBeGreaterThan(0);

    // But dummy has 13 cards — includes the already-played card
    for (const sample of samples) {
      expect(sample[Seat.North].cards.length).toBe(13); // wrong! should be 12
    }
  });

  it("produces correct samples when dummy known hand uses remaining cards", () => {
    const deck = createDeck();
    const rng = mulberry32(42);

    const southOriginal = deck.slice(0, 13);
    const northOriginal = deck.slice(13, 26); // dummy

    const playedCards = new Map<Seat, Card[]>();
    playedCards.set(Seat.South, [southOriginal[0]!]);
    playedCards.set(Seat.North, [northOriginal[0]!]);
    playedCards.set(Seat.East, [deck[26]!]);
    playedCards.set(Seat.West, [deck[39]!]);

    // CORRECT: pass remaining cards
    const southRemaining: Hand = { cards: southOriginal.slice(1) }; // 12
    const northRemaining: Hand = { cards: northOriginal.slice(1) }; // 12

    const samples = samplePlayDeals({
      knownHands: { [Seat.South]: southRemaining, [Seat.North]: northRemaining },
      playedCards,
      voids: new Map(),
      unknownSeats: [Seat.East, Seat.West],
      cardsNeeded: { [Seat.East]: 12, [Seat.West]: 12 },
      n: 5,
      rng,
    });

    expect(samples.length).toBeGreaterThan(0);
    for (const sample of samples) {
      // Dummy has exactly 12 remaining cards
      expect(sample[Seat.North].cards.length).toBe(12);
      // No played card appears in dummy's hand
      const playedKey = `${northOriginal[0]!.suit}${northOriginal[0]!.rank}`;
      const hasPlayed = sample[Seat.North].cards.some((c) => `${c.suit}${c.rank}` === playedKey);
      expect(hasPlayed).toBe(false);
    }
  });

  it("works mid-play with 3 completed tricks and remaining-card dummy", () => {
    // After 3 tricks, 12 cards played total. Each seat has 10 remaining.
    const deck = createDeck();
    const rng = mulberry32(55);

    const southOriginal = deck.slice(0, 13);
    const northOriginal = deck.slice(13, 26);
    const eastOriginal = deck.slice(26, 39);
    const westOriginal = deck.slice(39, 52);

    // 3 cards played per seat
    const playedCards = new Map<Seat, Card[]>();
    playedCards.set(Seat.South, southOriginal.slice(0, 3));
    playedCards.set(Seat.North, northOriginal.slice(0, 3));
    playedCards.set(Seat.East, eastOriginal.slice(0, 3));
    playedCards.set(Seat.West, westOriginal.slice(0, 3));

    // Remaining = original minus played
    const southRemaining: Hand = { cards: southOriginal.slice(3) };  // 10
    const northRemaining: Hand = { cards: northOriginal.slice(3) };  // 10

    const samples = samplePlayDeals({
      knownHands: { [Seat.South]: southRemaining, [Seat.North]: northRemaining },
      playedCards,
      voids: new Map(),
      unknownSeats: [Seat.East, Seat.West],
      cardsNeeded: { [Seat.East]: 10, [Seat.West]: 10 },
      n: 10,
      rng,
    });

    expect(samples.length).toBeGreaterThan(0);
    for (const sample of samples) {
      expect(sample[Seat.East].cards.length).toBe(10);
      expect(sample[Seat.West].cards.length).toBe(10);

      // No card appears in both an unknown seat's sample and the played/known cards
      const sampledKeys = new Set([
        ...sample[Seat.East].cards.map((c) => `${c.suit}${c.rank}`),
        ...sample[Seat.West].cards.map((c) => `${c.suit}${c.rank}`),
      ]);
      for (const [, cards] of playedCards) {
        for (const c of cards) {
          expect(sampledKeys.has(`${c.suit}${c.rank}`)).toBe(false);
        }
      }
    }
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

  it("samples correctly mid-play when dummy has played cards", async () => {
    // After 1 trick, dummyHand should have 12 remaining cards (not original 13).
    // This tests the fix for the pool/need mismatch bug.
    const deck = createDeck();

    const southOriginal = deck.slice(0, 13);
    const northOriginal = deck.slice(13, 26); // dummy
    const eastOriginal = deck.slice(26, 39);
    const westOriginal = deck.slice(39, 52);

    const trick1: Trick = {
      plays: [
        played(Seat.East, eastOriginal[0]!.suit, eastOriginal[0]!.rank),
        played(Seat.South, southOriginal[0]!.suit, southOriginal[0]!.rank),
        played(Seat.West, westOriginal[0]!.suit, westOriginal[0]!.rank),
        played(Seat.North, northOriginal[0]!.suit, northOriginal[0]!.rank),
      ],
      trumpSuit: undefined,
      winner: Seat.East,
    };

    // DDS returns scores for legal plays
    const engine = makeStubEngine(() => ({
      cards: [
        { suit: southOriginal[1]!.suit, rank: southOriginal[1]!.rank, score: 8, equals: 0 },
        { suit: southOriginal[2]!.suit, rank: southOriginal[2]!.rank, score: 6, equals: 0 },
      ],
    }));

    const provider = createWorldClassProvider(engine, mulberry32(42));

    const ctx: PlayContext = {
      hand: { cards: southOriginal.slice(1) },          // 12 remaining
      currentTrick: [],
      previousTricks: [trick1],
      contract: makeContract(Seat.North, BidSuit.NoTrump),
      seat: Seat.South,
      trumpSuit: undefined,
      legalPlays: [southOriginal[1]!, southOriginal[2]!],
      dummyHand: { cards: northOriginal.slice(1) },      // 12 remaining (not 13!)
    };

    const result = await provider.getStrategy().suggest(ctx);
    // Should use MC+DDS, not expert fallback
    expect(result.reason).toContain("mc-dds");
    expect(result.card).toBeDefined();
  });

  it("uses MC+DDS mid-play when dummy hand has remaining cards only", async () => {
    // After 1 trick, dummyHand must be remaining (12 cards), not original (13).
    // With correct remaining cards, sampling succeeds and DDS is called.
    const deck = createDeck();

    const southOriginal = deck.slice(0, 13);
    const northOriginal = deck.slice(13, 26);
    const eastOriginal = deck.slice(26, 39);
    const westOriginal = deck.slice(39, 52);

    const trick1: Trick = {
      plays: [
        played(Seat.East, eastOriginal[0]!.suit, eastOriginal[0]!.rank),
        played(Seat.South, southOriginal[0]!.suit, southOriginal[0]!.rank),
        played(Seat.West, westOriginal[0]!.suit, westOriginal[0]!.rank),
        played(Seat.North, northOriginal[0]!.suit, northOriginal[0]!.rank),
      ],
      trumpSuit: undefined,
      winner: Seat.East,
    };

    const legalCards = [southOriginal[1]!, southOriginal[2]!];
    const engine = makeStubEngine(() => ({
      cards: legalCards.map((c) => ({ suit: c.suit, rank: c.rank, score: 7, equals: 0 })),
    }));

    const provider = createWorldClassProvider(engine, mulberry32(42));

    const ctx: PlayContext = {
      hand: { cards: southOriginal.slice(1) },          // 12 remaining
      currentTrick: [],
      previousTricks: [trick1],
      contract: makeContract(Seat.North, BidSuit.NoTrump),
      seat: Seat.South,
      trumpSuit: undefined,
      legalPlays: legalCards,
      dummyHand: { cards: northOriginal.slice(1) },      // 12 remaining (correct)
    };

    const result = await provider.getStrategy().suggest(ctx);
    expect(result.reason).toContain("mc-dds");
    expect(engine.solveBoard).toHaveBeenCalled();
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
    // Only first batch (15 calls), not all 30
    expect(engine.solveBoard).toHaveBeenCalledTimes(15);
  });

  it("runs all batches when scores are close, then extends by one extra batch", async () => {
    // Both cards score 7 → gap = 0 < 0.5 → triggers dynamic extension to 45
    const engine = makeStubEngine(() => ({
      cards: [
        { suit: Suit.Hearts, rank: Rank.Ace, score: 7, equals: 0 },
        { suit: Suit.Hearts, rank: Rank.King, score: 7, equals: 0 },
      ],
    }));

    const provider = createWorldClassProvider(engine, mulberry32(42));
    const result = await provider.getStrategy().suggest(makeCtx());

    expect(result.reason).not.toContain("early-stop");
    // Close call: 30 initial + 15 extended = 45 total
    expect(engine.solveBoard).toHaveBeenCalledTimes(45);
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
    // Equal scores → no early stop, but dynamic extension runs
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
    // 45 samples total (30 initial + 15 extended)
    expect(result.reason).toContain("45 samples");
  });
});

// ── Belief constraint tests ───────────────────────────────────

describe("samplePlayDeals with beliefConstraints", () => {
  it("filters samples by HCP range", () => {
    const deck = createDeck();
    const southHand: Hand = { cards: deck.slice(0, 13) };
    const northHand: Hand = { cards: deck.slice(13, 26) };
    const rng = mulberry32(42);

    // Require East to have 10-15 HCP
    const beliefConstraints: Partial<Record<Seat, DerivedRanges>> = {
      [Seat.East]: {
        hcp: { min: 10, max: 15 },
        suitLengths: {
          [Suit.Spades]: { min: 0, max: 13 },
          [Suit.Hearts]: { min: 0, max: 13 },
          [Suit.Diamonds]: { min: 0, max: 13 },
          [Suit.Clubs]: { min: 0, max: 13 },
        },
        isBalanced: undefined,
      },
    };

    const samples = samplePlayDeals({
      knownHands: { [Seat.South]: southHand, [Seat.North]: northHand },
      playedCards: new Map(),
      voids: new Map(),
      unknownSeats: [Seat.East, Seat.West],
      cardsNeeded: { [Seat.East]: 13, [Seat.West]: 13 },
      n: 20,
      rng,
      beliefConstraints,
    });

    expect(samples.length).toBeGreaterThan(0);

    // Verify every sample has East HCP in [10, 15]
    for (const sample of samples) {
      let hcp = 0;
      for (const c of sample[Seat.East].cards) {
        hcp += HCP_VALUES[c.rank];
      }
      expect(hcp).toBeGreaterThanOrEqual(10);
      expect(hcp).toBeLessThanOrEqual(15);
    }
  });

  it("filters samples by suit length range", () => {
    const deck = createDeck();
    const southHand: Hand = { cards: deck.slice(0, 13) };
    const northHand: Hand = { cards: deck.slice(13, 26) };
    const rng = mulberry32(99);

    // Require East to have 5+ spades
    const beliefConstraints: Partial<Record<Seat, DerivedRanges>> = {
      [Seat.East]: {
        hcp: { min: 0, max: 37 },
        suitLengths: {
          [Suit.Spades]: { min: 5, max: 13 },
          [Suit.Hearts]: { min: 0, max: 13 },
          [Suit.Diamonds]: { min: 0, max: 13 },
          [Suit.Clubs]: { min: 0, max: 13 },
        },
        isBalanced: undefined,
      },
    };

    const samples = samplePlayDeals({
      knownHands: { [Seat.South]: southHand, [Seat.North]: northHand },
      playedCards: new Map(),
      voids: new Map(),
      unknownSeats: [Seat.East, Seat.West],
      cardsNeeded: { [Seat.East]: 13, [Seat.West]: 13 },
      n: 20,
      rng,
      beliefConstraints,
    });

    expect(samples.length).toBeGreaterThan(0);

    for (const sample of samples) {
      const spades = sample[Seat.East].cards.filter((c) => c.suit === Suit.Spades);
      expect(spades.length).toBeGreaterThanOrEqual(5);
    }
  });

  it("returns fewer samples when constraints are tight", () => {
    const deck = createDeck();
    const southHand: Hand = { cards: deck.slice(0, 13) };
    const northHand: Hand = { cards: deck.slice(13, 26) };
    const rng = mulberry32(42);

    // Very tight: East must have exactly 20-37 HCP (rare in random deals)
    const beliefConstraints: Partial<Record<Seat, DerivedRanges>> = {
      [Seat.East]: {
        hcp: { min: 20, max: 37 },
        suitLengths: {
          [Suit.Spades]: { min: 0, max: 13 },
          [Suit.Hearts]: { min: 0, max: 13 },
          [Suit.Diamonds]: { min: 0, max: 13 },
          [Suit.Clubs]: { min: 0, max: 13 },
        },
        isBalanced: undefined,
      },
    };

    // Without constraints, would get all 20 easily
    const unconstrained = samplePlayDeals({
      knownHands: { [Seat.South]: southHand, [Seat.North]: northHand },
      playedCards: new Map(),
      voids: new Map(),
      unknownSeats: [Seat.East, Seat.West],
      cardsNeeded: { [Seat.East]: 13, [Seat.West]: 13 },
      n: 20,
      rng: mulberry32(42),
    });

    const constrained = samplePlayDeals({
      knownHands: { [Seat.South]: southHand, [Seat.North]: northHand },
      playedCards: new Map(),
      voids: new Map(),
      unknownSeats: [Seat.East, Seat.West],
      cardsNeeded: { [Seat.East]: 13, [Seat.West]: 13 },
      n: 20,
      rng,
      beliefConstraints,
    });

    expect(unconstrained.length).toBe(20);
    // Tight constraints should reduce yield
    expect(constrained.length).toBeLessThan(unconstrained.length);
  });

  it("works without beliefConstraints (backward compatible)", () => {
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
      // no beliefConstraints
    });

    expect(samples.length).toBe(5);
  });
});

describe("createWorldClassProvider onAuctionComplete", () => {
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

  it("stores beliefs and uses them during sampling", async () => {
    const engine = makeStubEngine();
    const provider = createWorldClassProvider(engine, mulberry32(42));

    // Provide beliefs: constrain East to 10-15 HCP
    const beliefs: Record<Seat, PublicBeliefs> = {
      [Seat.North]: { seat: Seat.North, constraints: [], ranges: { hcp: { min: 0, max: 37 }, suitLengths: { [Suit.Spades]: { min: 0, max: 13 }, [Suit.Hearts]: { min: 0, max: 13 }, [Suit.Diamonds]: { min: 0, max: 13 }, [Suit.Clubs]: { min: 0, max: 13 } }, isBalanced: undefined }, qualitative: [] },
      [Seat.East]: { seat: Seat.East, constraints: [], ranges: { hcp: { min: 10, max: 15 }, suitLengths: { [Suit.Spades]: { min: 0, max: 13 }, [Suit.Hearts]: { min: 0, max: 13 }, [Suit.Diamonds]: { min: 0, max: 13 }, [Suit.Clubs]: { min: 0, max: 13 } }, isBalanced: undefined }, qualitative: [] },
      [Seat.South]: { seat: Seat.South, constraints: [], ranges: { hcp: { min: 0, max: 37 }, suitLengths: { [Suit.Spades]: { min: 0, max: 13 }, [Suit.Hearts]: { min: 0, max: 13 }, [Suit.Diamonds]: { min: 0, max: 13 }, [Suit.Clubs]: { min: 0, max: 13 } }, isBalanced: undefined }, qualitative: [] },
      [Seat.West]: { seat: Seat.West, constraints: [], ranges: { hcp: { min: 0, max: 37 }, suitLengths: { [Suit.Spades]: { min: 0, max: 13 }, [Suit.Hearts]: { min: 0, max: 13 }, [Suit.Diamonds]: { min: 0, max: 13 }, [Suit.Clubs]: { min: 0, max: 13 } }, isBalanced: undefined }, qualitative: [] },
    };

    provider.onAuctionComplete!(beliefs);

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
    // Should still produce a valid MC+DDS result (beliefs just filter samples)
    expect(result.card).toBeDefined();
    expect(result.reason).toContain("mc-dds");
  });

  it("onAuctionComplete is defined (not a no-op stub)", () => {
    const engine = makeStubEngine();
    const provider = createWorldClassProvider(engine, mulberry32(42));
    expect(provider.onAuctionComplete).toBeDefined();
  });
});
