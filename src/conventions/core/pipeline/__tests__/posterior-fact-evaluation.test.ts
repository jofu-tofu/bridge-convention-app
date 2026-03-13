import { describe, it, expect } from "vitest";
import { evaluateFacts, createSharedFactCatalog } from "../fact-evaluator";
import type { FactCatalog } from "../../../../core/contracts/fact-catalog";
import type { PosteriorFactEvaluatorFn } from "../../../../core/contracts/fact-catalog";
import type { PosteriorFactProvider } from "../../../../core/contracts/posterior";
import { Suit, Rank } from "../../../../engine/types";
import type { Hand, HandEvaluation } from "../../../../engine/types";

// 10 HCP hand: AK532 Q62 J74 83
const testHand: Hand = {
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

const testEvaluation: HandEvaluation = {
  hcp: 10,
  shape: [5, 3, 3, 2],
  distribution: { shortness: 1, length: 1, total: 2 },
  totalPoints: 12,
  strategy: "standard",
};

function makeProvider(values: Record<string, number | null>): PosteriorFactProvider {
  return {
    queryFact(request) {
      const val = values[request.factId];
      if (val === null || val === undefined) return null;
      return {
        factId: request.factId,
        seatId: request.seatId,
        expectedValue: val,
        confidence: 1,
      };
    },
    getBeliefView() { return null; },
  };
}

describe("evaluateFacts with posterior provider", () => {
  it("without posterior param, produces same results as before", () => {
    const result = evaluateFacts(testHand, testEvaluation);
    expect(result.facts.get("hand.hcp")!.value).toBe(10);
    expect(result.facts.has("bridge.partnerHas4CardMajorLikely")).toBe(false);
  });

  it("with posterior provider, produces posterior facts alongside standard facts", () => {
    const posteriorEval: PosteriorFactEvaluatorFn = (provider, request) => {
      const val = provider.queryFact(request);
      return { factId: request.factId, value: val?.expectedValue ?? 0 };
    };

    const catalog: FactCatalog = {
      ...createSharedFactCatalog(),
      posteriorEvaluators: new Map([
        ["bridge.partnerHas4CardMajorLikely", posteriorEval],
      ]),
    };

    const provider = makeProvider({ "bridge.partnerHas4CardMajorLikely": 0.73 });
    const result = evaluateFacts(testHand, testEvaluation, catalog, undefined, provider);

    // Standard fact still works
    expect(result.facts.get("hand.hcp")!.value).toBe(10);
    // Posterior fact is present
    expect(result.facts.get("bridge.partnerHas4CardMajorLikely")!.value).toBe(0.73);
  });

  it("null provider queryFact returns value 0 via evaluator (fail-open)", () => {
    const posteriorEval: PosteriorFactEvaluatorFn = (provider, request) => {
      const val = provider.queryFact(request);
      return { factId: request.factId, value: val?.expectedValue ?? 0 };
    };

    const catalog: FactCatalog = {
      ...createSharedFactCatalog(),
      posteriorEvaluators: new Map([
        ["bridge.partnerHas4CardMajorLikely", posteriorEval],
      ]),
    };

    // Provider returns null for all queries
    const provider = makeProvider({});
    const result = evaluateFacts(testHand, testEvaluation, catalog, undefined, provider);

    expect(result.facts.get("bridge.partnerHas4CardMajorLikely")!.value).toBe(0);
  });

  it("posterior facts are not populated when provider is not given", () => {
    const posteriorEval: PosteriorFactEvaluatorFn = (_provider, request) => {
      return { factId: request.factId, value: 0.5 };
    };

    const catalog: FactCatalog = {
      ...createSharedFactCatalog(),
      posteriorEvaluators: new Map([
        ["bridge.partnerHas4CardMajorLikely", posteriorEval],
      ]),
    };

    // No provider → posterior evaluators should not run
    const result = evaluateFacts(testHand, testEvaluation, catalog);
    expect(result.facts.has("bridge.partnerHas4CardMajorLikely")).toBe(false);
  });
});
