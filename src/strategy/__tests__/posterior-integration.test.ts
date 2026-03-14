import { describe, it, expect, vi } from "vitest";
import { meaningBundleToStrategy } from "../bidding/meaning-strategy";
import type { PosteriorEngine, PublicHandSpace, SeatPosterior } from "../../core/contracts/posterior";
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

function makeMockPosteriorEngine(): {
  engine: PosteriorEngine;
  compilePublicSpy: ReturnType<typeof vi.fn>;
} {
  const northSpace: PublicHandSpace = { seatId: "N", constraints: [] };
  const compilePublicSpy = vi.fn().mockReturnValue([northSpace]);

  const mockPosterior: SeatPosterior = {
    seatId: "N",
    handSpace: northSpace,
    likelihoodModel: { factors: [], combinationRule: "independent" },
    effectiveSampleSize: 200,
    probability(query) {
      // Return 0.73 for partnerHas4CardMajor, 0.85 for eight card fit, etc.
      const probMap: Record<string, number> = {
        "bridge.partnerHas4CardMajorLikely": 0.73,
        "bridge.nsHaveEightCardFitLikely": 0.85,
        "bridge.combinedHcpInRangeLikely": 0.60,
        "bridge.openerStillBalancedLikely": 0.95,
        "bridge.openerHasSecondMajorLikely": 0.15,
      };
      return probMap[query.factId] ?? 0;
    },
    distribution() { return []; },
  };

  const engine: PosteriorEngine = {
    compilePublic: compilePublicSpy,
    conditionOnHand() { return mockPosterior; },
    deriveActingHandFacts(space, factIds) {
      return factIds.map((factId) => ({
        factId,
        seatId: space.seatId,
        expectedValue: 0.5,
        confidence: 1,
      }));
    },
  };

  return { engine, compilePublicSpy };
}

function makeSurfaceRouter(): (auction: Auction, seat: Seat) => readonly MeaningSurface[] {
  return () => [testSurface];
}

describe("meaningBundleToStrategy — posterior integration", () => {
  it("without posteriorEngine, suggest works as before (regression)", () => {
    const strategy = meaningBundleToStrategy(
      [{ moduleId: "test-module", surfaces: [testSurface] }],
      "test-bundle",
    );

    const result = strategy.suggest(makeContext());
    // Should work without posterior — surfaces match, bid returned
    expect(result).not.toBeNull();
  });

  it("with posteriorEngine, compilePublic is called during suggest", () => {
    const { engine, compilePublicSpy } = makeMockPosteriorEngine();
    const catalog = createFactCatalog(createSharedFactCatalog(), staymanFacts);

    const strategy = meaningBundleToStrategy(
      [{ moduleId: "test-module", surfaces: [testSurface] }],
      "test-bundle",
      {
        factCatalog: catalog,
        posteriorEngine: engine,
        surfaceRouterForCommitments: makeSurfaceRouter(),
      },
    );

    strategy.suggest(makeContext());
    expect(compilePublicSpy).toHaveBeenCalledTimes(1);
  });

  it("memoization: same auction length does not re-call compilePublic", () => {
    const { engine, compilePublicSpy } = makeMockPosteriorEngine();
    const catalog = createFactCatalog(createSharedFactCatalog(), staymanFacts);

    const strategy = meaningBundleToStrategy(
      [{ moduleId: "test-module", surfaces: [testSurface] }],
      "test-bundle",
      {
        factCatalog: catalog,
        posteriorEngine: engine,
        surfaceRouterForCommitments: makeSurfaceRouter(),
      },
    );

    const context = makeContext();
    strategy.suggest(context);
    strategy.suggest(context); // Same auction length
    expect(compilePublicSpy).toHaveBeenCalledTimes(1);
  });

  it("memoization: different auction length re-calls compilePublic", () => {
    const { engine, compilePublicSpy } = makeMockPosteriorEngine();
    const catalog = createFactCatalog(createSharedFactCatalog(), staymanFacts);

    const strategy = meaningBundleToStrategy(
      [{ moduleId: "test-module", surfaces: [testSurface] }],
      "test-bundle",
      {
        factCatalog: catalog,
        posteriorEngine: engine,
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
    expect(compilePublicSpy).toHaveBeenCalledTimes(2);
  });

  it("empty hand spaces from posterior engine does not crash pipeline", () => {
    const engine: PosteriorEngine = {
      compilePublic: () => [], // No hand spaces
      conditionOnHand() { throw new Error("should not be called"); },
      deriveActingHandFacts() { return []; },
    };

    const catalog = createFactCatalog(createSharedFactCatalog(), staymanFacts);

    const strategy = meaningBundleToStrategy(
      [{ moduleId: "test-module", surfaces: [testSurface] }],
      "test-bundle",
      {
        factCatalog: catalog,
        posteriorEngine: engine,
        surfaceRouterForCommitments: makeSurfaceRouter(),
      },
    );

    // Should not throw — posterior provider is undefined when no partner space
    const result = strategy.suggest(makeContext());
    expect(result).not.toBeNull();
  });

  it("sampleCount reflects actual engine output, not hardcoded 200", () => {
    const northSpace: PublicHandSpace = { seatId: "N", constraints: [] };

    const mockPosterior: SeatPosterior = {
      seatId: "N",
      handSpace: northSpace,
      likelihoodModel: { factors: [], combinationRule: "independent" },
      effectiveSampleSize: 150,
      probability() { return 0.5; },
      distribution() { return []; },
    };

    const engine: PosteriorEngine = {
      compilePublic: () => [northSpace],
      conditionOnHand() { return mockPosterior; },
      deriveActingHandFacts(space, factIds) {
        return factIds.map((factId) => ({
          factId, seatId: space.seatId, expectedValue: 0.5, confidence: 0.75,
        }));
      },
    };

    const catalog = createFactCatalog(createSharedFactCatalog(), staymanFacts);
    const strategy = meaningBundleToStrategy(
      [{ moduleId: "test-module", surfaces: [testSurface] }],
      "test-bundle",
      {
        factCatalog: catalog,
        posteriorEngine: engine,
        surfaceRouterForCommitments: makeSurfaceRouter(),
      },
    );

    strategy.suggest(makeContext());
    const summary = strategy.getLastPosteriorSummary();
    expect(summary).not.toBeNull();
    // sampleCount should reflect the actual effectiveSampleSize (150), not hardcoded 200
    expect(summary!.sampleCount).toBe(150);
  });

  it("confidence is derived from posterior quality, not hardcoded 1", () => {
    const northSpace: PublicHandSpace = { seatId: "N", constraints: [] };

    const mockPosterior: SeatPosterior = {
      seatId: "N",
      handSpace: northSpace,
      likelihoodModel: { factors: [], combinationRule: "independent" },
      effectiveSampleSize: 80,
      probability() { return 0.6; },
      distribution() { return []; },
    };

    const engine: PosteriorEngine = {
      compilePublic: () => [northSpace],
      conditionOnHand() { return mockPosterior; },
      deriveActingHandFacts(space, factIds) {
        return factIds.map((factId) => ({
          factId, seatId: space.seatId, expectedValue: 0.5, confidence: 0.4,
        }));
      },
    };

    const catalog = createFactCatalog(createSharedFactCatalog(), staymanFacts);
    const strategy = meaningBundleToStrategy(
      [{ moduleId: "test-module", surfaces: [testSurface] }],
      "test-bundle",
      {
        factCatalog: catalog,
        posteriorEngine: engine,
        surfaceRouterForCommitments: makeSurfaceRouter(),
      },
    );

    strategy.suggest(makeContext());
    const summary = strategy.getLastPosteriorSummary();
    expect(summary).not.toBeNull();
    // confidence should NOT be 1 — it should reflect the per-fact confidence values
    expect(summary!.confidence).not.toBe(1);
    expect(summary!.confidence).toBeGreaterThan(0);
    expect(summary!.confidence).toBeLessThanOrEqual(1);
  });

  it("EvaluationTrace.posteriorConfidence is populated when posterior is active", () => {
    const northSpace: PublicHandSpace = { seatId: "N", constraints: [] };

    const mockPosterior: SeatPosterior = {
      seatId: "N",
      handSpace: northSpace,
      likelihoodModel: { factors: [], combinationRule: "independent" },
      effectiveSampleSize: 120,
      probability() { return 0.7; },
      distribution() { return []; },
    };

    const engine: PosteriorEngine = {
      compilePublic: () => [northSpace],
      conditionOnHand() { return mockPosterior; },
      deriveActingHandFacts(space, factIds) {
        return factIds.map((factId) => ({
          factId, seatId: space.seatId, expectedValue: 0.5, confidence: 0.6,
        }));
      },
    };

    const catalog = createFactCatalog(createSharedFactCatalog(), staymanFacts);
    const strategy = meaningBundleToStrategy(
      [{ moduleId: "test-module", surfaces: [testSurface] }],
      "test-bundle",
      {
        factCatalog: catalog,
        posteriorEngine: engine,
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
