import { describe, it, expect, vi } from "vitest";
import { meaningBundleToStrategy } from "../bidding/meaning-strategy";
import type { PosteriorBackend, PosteriorState, WeightedParticle } from "../../core/contracts/posterior-backend";
import type { ConditioningContext } from "../../core/contracts/posterior-query";
import type { MeaningSurface } from "../../core/contracts/meaning-surface";
import type { Auction, Seat, Hand, HandEvaluation } from "../../engine/types";
import { Suit, Rank, Seat as SeatEnum, BidSuit } from "../../engine/types";
import type { BiddingContext } from "../../core/contracts";
import { createBiddingContext } from "../../conventions/core";
import { createFactCatalog } from "../../core/contracts/fact-catalog";
import { createSharedFactCatalog } from "../../conventions/core/pipeline/fact-evaluator";
import { staymanFacts } from "../../conventions/definitions/nt-bundle/facts";

// 10 HCP responder hand: AK532 Q62 J74 83
const responderHand: Hand = {
  cards: [
    { suit: Suit.Spades, rank: Rank.Ace },
    { suit: Suit.Spades, rank: Rank.King },
    { suit: Suit.Spades, rank: Rank.Five },
    { suit: Suit.Spades, rank: Rank.Three },
    { suit: Suit.Spades, rank: Rank.Two },
    { suit: Suit.Hearts, rank: Rank.Queen },
    { suit: Suit.Hearts, rank: Rank.Six },
    { suit: Suit.Hearts, rank: Rank.Two },
    { suit: Suit.Diamonds, rank: Rank.Jack },
    { suit: Suit.Diamonds, rank: Rank.Seven },
    { suit: Suit.Diamonds, rank: Rank.Four },
    { suit: Suit.Clubs, rank: Rank.Eight },
    { suit: Suit.Clubs, rank: Rank.Three },
  ],
};

const responderEval: HandEvaluation = {
  hcp: 10,
  shape: [5, 3, 3, 2],
  distribution: { shortness: 1, length: 1, total: 2 },
  totalPoints: 12,
  strategy: "standard",
};

// Minimal meaning surface for testing — always matches
const testSurface: MeaningSurface = {
  meaningId: "test-bid",
  semanticClassId: "test:bid",
  moduleId: "test-module",
  encoding: { defaultCall: { type: "bid", level: 2, strain: BidSuit.Clubs } },
  clauses: [],
  ranking: {
    recommendationBand: "should",
    specificity: 1,
    modulePrecedence: 1,
    intraModuleOrder: 1,
  },
  sourceIntent: { type: "test-intent", params: {} },
  teachingLabel: "Test bid",
};

// 1NT auction: North opens 1NT, East passes
function make1NTAuction(): Auction {
  return {
    entries: [
      { seat: SeatEnum.North, call: { type: "bid", level: 1, strain: BidSuit.NoTrump } },
      { seat: SeatEnum.East, call: { type: "pass" } },
    ],
    isComplete: false,
  };
}

function makeContext(auction?: Auction): BiddingContext {
  return createBiddingContext({
    hand: responderHand,
    auction: auction ?? make1NTAuction(),
    seat: SeatEnum.South,
    evaluation: responderEval,
  });
}

// 17 HCP balanced hand for North: AQ94 KT8 AJ6 K72
const northHand: Hand = {
  cards: [
    { suit: Suit.Spades, rank: Rank.Ace },
    { suit: Suit.Spades, rank: Rank.Queen },
    { suit: Suit.Spades, rank: Rank.Nine },
    { suit: Suit.Spades, rank: Rank.Four },
    { suit: Suit.Hearts, rank: Rank.King },
    { suit: Suit.Hearts, rank: Rank.Ten },
    { suit: Suit.Hearts, rank: Rank.Eight },
    { suit: Suit.Diamonds, rank: Rank.Ace },
    { suit: Suit.Diamonds, rank: Rank.Jack },
    { suit: Suit.Diamonds, rank: Rank.Six },
    { suit: Suit.Clubs, rank: Rank.King },
    { suit: Suit.Clubs, rank: Rank.Seven },
    { suit: Suit.Clubs, rank: Rank.Two },
  ],
};

function makeMockPosteriorBackend(particleCount = 200): {
  backend: PosteriorBackend;
  initializeSpy: ReturnType<typeof vi.fn>;
} {
  const particles: WeightedParticle[] = Array.from({ length: particleCount }, () => ({
    world: {
      hiddenDeal: new Map([["N", northHand]]) as ReadonlyMap<string, Hand>,
      branchAssignment: new Map() as ReadonlyMap<string, string>,
    },
    weight: 1,
  }));

  const mockState: PosteriorState = {
    particles,
    context: {
      snapshot: { publicCommitments: [] } as unknown as ConditioningContext["snapshot"],
      factorGraph: { factors: [], ambiguitySchema: [], evidencePins: [], compilationTrace: [] },
      observerSeat: "S",
    },
  };

  const initializeSpy = vi.fn().mockReturnValue(mockState);

  const backend: PosteriorBackend = {
    initialize: initializeSpy,
    query() {
      return {
        value: 0.5,
        health: {
          effectiveSampleSize: particleCount,
          totalParticles: particleCount,
          acceptanceRate: 1,
        },
      };
    },
    conditionOnHand() { return mockState; },
    introspect() { return []; },
  };

  return { backend, initializeSpy };
}

function makeSurfaceRouter(): (auction: Auction, seat: Seat) => readonly MeaningSurface[] {
  return () => [testSurface];
}

describe("meaningBundleToStrategy — posterior integration", () => {
  it("without posteriorBackend, suggest works as before (regression)", () => {
    const strategy = meaningBundleToStrategy(
      [{ moduleId: "test-module", surfaces: [testSurface] }],
      "test-bundle",
    );

    const result = strategy.suggest(makeContext());
    // Should work without posterior — surfaces match, bid returned
    expect(result).not.toBeNull();
  });

  it("with posteriorBackend, initialize is called during suggest", () => {
    const { backend, initializeSpy } = makeMockPosteriorBackend();
    const catalog = createFactCatalog(createSharedFactCatalog(), staymanFacts);

    const strategy = meaningBundleToStrategy(
      [{ moduleId: "test-module", surfaces: [testSurface] }],
      "test-bundle",
      {
        factCatalog: catalog,
        posteriorBackend: backend,
        surfaceRouterForCommitments: makeSurfaceRouter(),
      },
    );

    strategy.suggest(makeContext());
    expect(initializeSpy).toHaveBeenCalledTimes(1);
  });

  it("memoization: same auction length does not re-call initialize", () => {
    const { backend, initializeSpy } = makeMockPosteriorBackend();
    const catalog = createFactCatalog(createSharedFactCatalog(), staymanFacts);

    const strategy = meaningBundleToStrategy(
      [{ moduleId: "test-module", surfaces: [testSurface] }],
      "test-bundle",
      {
        factCatalog: catalog,
        posteriorBackend: backend,
        surfaceRouterForCommitments: makeSurfaceRouter(),
      },
    );

    const context = makeContext();
    strategy.suggest(context);
    strategy.suggest(context); // Same auction length
    expect(initializeSpy).toHaveBeenCalledTimes(1);
  });

  it("memoization: different auction length re-calls initialize", () => {
    const { backend, initializeSpy } = makeMockPosteriorBackend();
    const catalog = createFactCatalog(createSharedFactCatalog(), staymanFacts);

    const strategy = meaningBundleToStrategy(
      [{ moduleId: "test-module", surfaces: [testSurface] }],
      "test-bundle",
      {
        factCatalog: catalog,
        posteriorBackend: backend,
        surfaceRouterForCommitments: makeSurfaceRouter(),
      },
    );

    strategy.suggest(makeContext(make1NTAuction()));

    // Longer auction
    const longerAuction: Auction = {
      entries: [
        ...make1NTAuction().entries,
        { seat: SeatEnum.South, call: { type: "bid", level: 2, strain: BidSuit.Clubs } },
        { seat: SeatEnum.West, call: { type: "pass" } },
      ],
      isComplete: false,
    };
    strategy.suggest(makeContext(longerAuction));
    expect(initializeSpy).toHaveBeenCalledTimes(2);
  });

  it("empty particles from posterior backend does not crash pipeline", () => {
    const emptyState: PosteriorState = {
      particles: [],
      context: {
        snapshot: { publicCommitments: [] } as unknown as ConditioningContext["snapshot"],
        factorGraph: { factors: [], ambiguitySchema: [], evidencePins: [], compilationTrace: [] },
        observerSeat: "S",
      },
    };

    const backend: PosteriorBackend = {
      initialize: () => emptyState,
      query() {
        return {
          value: 0,
          health: { effectiveSampleSize: 0, totalParticles: 0, acceptanceRate: 0 },
        };
      },
      conditionOnHand() { return emptyState; },
      introspect() { return []; },
    };

    const catalog = createFactCatalog(createSharedFactCatalog(), staymanFacts);

    const strategy = meaningBundleToStrategy(
      [{ moduleId: "test-module", surfaces: [testSurface] }],
      "test-bundle",
      {
        factCatalog: catalog,
        posteriorBackend: backend,
        surfaceRouterForCommitments: makeSurfaceRouter(),
      },
    );

    // Should not throw — posterior provider is undefined when no particles
    const result = strategy.suggest(makeContext());
    expect(result).not.toBeNull();
  });

  it("sampleCount reflects actual backend output, not hardcoded 200", () => {
    const { backend } = makeMockPosteriorBackend(150);
    const catalog = createFactCatalog(createSharedFactCatalog(), staymanFacts);

    const strategy = meaningBundleToStrategy(
      [{ moduleId: "test-module", surfaces: [testSurface] }],
      "test-bundle",
      {
        factCatalog: catalog,
        posteriorBackend: backend,
        surfaceRouterForCommitments: makeSurfaceRouter(),
      },
    );

    strategy.suggest(makeContext());
    const summary = strategy.getLastPosteriorSummary();
    expect(summary).not.toBeNull();
    // sampleCount should reflect the actual particle count (150), not hardcoded 200
    expect(summary!.sampleCount).toBe(150);
  });

  it("confidence is derived from posterior quality, not hardcoded 1", () => {
    const { backend } = makeMockPosteriorBackend(80);
    const catalog = createFactCatalog(createSharedFactCatalog(), staymanFacts);

    const strategy = meaningBundleToStrategy(
      [{ moduleId: "test-module", surfaces: [testSurface] }],
      "test-bundle",
      {
        factCatalog: catalog,
        posteriorBackend: backend,
        surfaceRouterForCommitments: makeSurfaceRouter(),
      },
    );

    strategy.suggest(makeContext());
    const summary = strategy.getLastPosteriorSummary();
    expect(summary).not.toBeNull();
    // confidence should NOT be 1 — it should reflect the per-fact confidence values
    // With 80 particles out of 200 totalRequested, confidence = 80/200 = 0.4
    expect(summary!.confidence).not.toBe(1);
    expect(summary!.confidence).toBeGreaterThan(0);
    expect(summary!.confidence).toBeLessThanOrEqual(1);
  });

  it("EvaluationTrace.posteriorConfidence is populated when posterior is active", () => {
    const { backend } = makeMockPosteriorBackend(120);
    const catalog = createFactCatalog(createSharedFactCatalog(), staymanFacts);

    const strategy = meaningBundleToStrategy(
      [{ moduleId: "test-module", surfaces: [testSurface] }],
      "test-bundle",
      {
        factCatalog: catalog,
        posteriorBackend: backend,
        surfaceRouterForCommitments: makeSurfaceRouter(),
      },
    );

    const result = strategy.suggest(makeContext());
    expect(result).not.toBeNull();
    expect(result!.evaluationTrace).toBeDefined();
    expect(result!.evaluationTrace!.posteriorSampleCount).toBe(120);
    expect(result!.evaluationTrace!.posteriorConfidence).toBeDefined();
    expect(result!.evaluationTrace!.posteriorConfidence).not.toBe(1);
    expect(result!.evaluationTrace!.posteriorConfidence).toBeGreaterThan(0);
    expect(result!.evaluationTrace!.posteriorConfidence).toBeLessThanOrEqual(1);
  });

  it("EvaluationTrace.posteriorConfidence is undefined when posterior is not active", () => {
    const strategy = meaningBundleToStrategy(
      [{ moduleId: "test-module", surfaces: [testSurface] }],
      "test-bundle",
    );

    const result = strategy.suggest(makeContext());
    expect(result).not.toBeNull();
    expect(result!.evaluationTrace).toBeDefined();
    expect(result!.evaluationTrace!.posteriorSampleCount).toBeUndefined();
    expect(result!.evaluationTrace!.posteriorConfidence).toBeUndefined();
  });
});
