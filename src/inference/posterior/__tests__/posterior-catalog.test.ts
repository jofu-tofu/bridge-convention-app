import { describe, it, expect } from "vitest";
import {
  createPosteriorFactEvaluators,
  createPosteriorFactProvider,
  createPosteriorFactProviderFromBackend,
} from "../posterior-catalog";
import type { SeatPosterior, PosteriorFactRequest, PosteriorFactValue } from "../../../core/contracts/posterior";
import type { PosteriorFactProvider as PosteriorFactProviderType } from "../../../core/contracts/posterior";
import { SHARED_POSTERIOR_FACT_IDS } from "../../../core/contracts/posterior";
import type { PublicHandSpace, LikelihoodModel } from "../../../core/contracts/posterior";
import type { PosteriorState, WeightedParticle } from "../../../core/contracts/posterior-backend";
import type { ConditioningContext } from "../../../core/contracts/posterior-query";
import type { Hand } from "../../../engine/types";
import { Suit, Rank } from "../../../engine/types";

function makeMockProvider(values: Record<string, PosteriorFactValue | null>): PosteriorFactProviderType {
  return {
    queryFact(request) { return values[request.factId] ?? null; },
    getBeliefView() { return null; },
  };
}

function makeMockSeatPosterior(probabilities: Record<string, number>): SeatPosterior {
  const handSpace: PublicHandSpace = { seatId: "N", constraints: [] };
  const likelihoodModel: LikelihoodModel = { factors: [], combinationRule: "independent" };
  return {
    seatId: "N",
    handSpace,
    likelihoodModel,
    effectiveSampleSize: 200,
    probability(query: PosteriorFactRequest): number {
      return probabilities[query.factId] ?? 0;
    },
    distribution() { return []; },
  };
}

describe("createPosteriorFactEvaluators", () => {
  it("returns map with exactly 3 entries by default, keys matching SHARED_POSTERIOR_FACT_IDS", () => {
    const evaluators = createPosteriorFactEvaluators();
    expect(evaluators.size).toBe(3);
    for (const id of SHARED_POSTERIOR_FACT_IDS) {
      expect(evaluators.has(id)).toBe(true);
    }
  });

  it("returns map with custom IDs when explicit factIds are provided", () => {
    const customIds = [
      "bridge.partnerHas4HeartsLikely",
      "bridge.combinedHcpInRangeLikely",
      "bridge.nsHaveEightCardFitLikely",
      "bridge.openerStillBalancedLikely",
      "bridge.openerHasSecondMajorLikely",
    ];
    const evaluators = createPosteriorFactEvaluators(customIds);
    expect(evaluators.size).toBe(5);
    for (const id of customIds) {
      expect(evaluators.has(id)).toBe(true);
    }
  });

  it("evaluator returns provider value when provider returns non-null", () => {
    const evaluators = createPosteriorFactEvaluators();
    const entry = evaluators.get("bridge.partnerHas4HeartsLikely")!;
    const provider = makeMockProvider({
      "bridge.partnerHas4HeartsLikely": {
        factId: "bridge.partnerHas4HeartsLikely",
        seatId: "N",
        expectedValue: 0.73,
        confidence: 1,
      },
    });
    const result = entry.evaluate(provider, { factId: "bridge.partnerHas4HeartsLikely", seatId: "" });
    expect(result.factId).toBe("bridge.partnerHas4HeartsLikely");
    expect(result.value).toBe(0.73);
  });

  it("evaluator returns value 0 when provider returns null (fail-open)", () => {
    const evaluators = createPosteriorFactEvaluators();
    const entry = evaluators.get("bridge.partnerHas4HeartsLikely")!;
    const provider = makeMockProvider({});
    const result = entry.evaluate(provider, { factId: "bridge.partnerHas4HeartsLikely", seatId: "" });
    expect(result.factId).toBe("bridge.partnerHas4HeartsLikely");
    expect(result.value).toBe(0);
  });

  it("entries with conditions carry conditionedOn", () => {
    const conditionsMap = new Map([["bridge.combinedHcpInRangeLikely", ["25", "40"] as readonly string[]]]);
    const evaluators = createPosteriorFactEvaluators(
      ["bridge.combinedHcpInRangeLikely", "bridge.openerStillBalancedLikely"],
      conditionsMap,
    );
    expect(evaluators.size).toBe(2);
    expect(evaluators.get("bridge.combinedHcpInRangeLikely")!.conditionedOn).toEqual(["25", "40"]);
    expect(evaluators.get("bridge.openerStillBalancedLikely")!.conditionedOn).toBeUndefined();
  });
});

describe("createPosteriorFactProvider", () => {
  it("queryFact delegates to SeatPosterior.probability and returns PosteriorFactValue", () => {
    const posterior = makeMockSeatPosterior({
      "bridge.partnerHas4HeartsLikely": 0.65,
    });
    const provider = createPosteriorFactProvider(posterior);
    const result = provider.queryFact({
      factId: "bridge.partnerHas4HeartsLikely",
      seatId: "N",
      conditionedOn: ["H"],
    });
    expect(result).not.toBeNull();
    expect(result!.factId).toBe("bridge.partnerHas4HeartsLikely");
    expect(result!.seatId).toBe("N");
    expect(result!.expectedValue).toBe(0.65);
  });

  it("confidence reflects effectiveSampleSize ratio, not hardcoded 1", () => {
    const handSpace: PublicHandSpace = { seatId: "N", constraints: [] };
    const posterior: SeatPosterior = {
      seatId: "N",
      handSpace,
      likelihoodModel: { factors: [], combinationRule: "independent" },
      effectiveSampleSize: 80,
      probability() { return 0.7; },
      distribution() { return []; },
    };
    const provider = createPosteriorFactProvider(posterior);
    const result = provider.queryFact({
      factId: "bridge.partnerHas4HeartsLikely",
      seatId: "N",
    });
    expect(result).not.toBeNull();
    // confidence should derive from effectiveSampleSize, not be hardcoded 1
    // With effectiveSampleSize = 80, confidence should be < 1
    expect(result!.confidence).toBeLessThan(1);
    expect(result!.confidence).toBeGreaterThan(0);
  });

  it("confidence is 1 when effectiveSampleSize equals default sample count", () => {
    const posterior = makeMockSeatPosterior({
      "bridge.partnerHas4HeartsLikely": 0.65,
    });
    // effectiveSampleSize = 200 (default), so confidence = 200/200 = 1
    const provider = createPosteriorFactProvider(posterior);
    const result = provider.queryFact({
      factId: "bridge.partnerHas4HeartsLikely",
      seatId: "N",
    });
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe(1);
  });

  it("getBeliefView returns null (populated separately)", () => {
    const posterior = makeMockSeatPosterior({});
    const provider = createPosteriorFactProvider(posterior);
    expect(provider.getBeliefView("N", "S")).toBeNull();
  });
});

// ─── Tests for createPosteriorFactProviderFromBackend ────────

// Own hand for observer (South): 10 HCP, 5 spades
const ownHand: Hand = {
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

// North hand with 4 spades, 4 hearts (balanced-ish): AQ94 KT83 AJ6 72
const northHand: Hand = {
  cards: [
    { suit: Suit.Spades, rank: Rank.Ace },
    { suit: Suit.Spades, rank: Rank.Queen },
    { suit: Suit.Spades, rank: Rank.Nine },
    { suit: Suit.Spades, rank: Rank.Four },
    { suit: Suit.Hearts, rank: Rank.King },
    { suit: Suit.Hearts, rank: Rank.Ten },
    { suit: Suit.Hearts, rank: Rank.Eight },
    { suit: Suit.Hearts, rank: Rank.Three },
    { suit: Suit.Diamonds, rank: Rank.Ace },
    { suit: Suit.Diamonds, rank: Rank.Jack },
    { suit: Suit.Diamonds, rank: Rank.Six },
    { suit: Suit.Clubs, rank: Rank.Seven },
    { suit: Suit.Clubs, rank: Rank.Two },
  ],
};

function makeMockPosteriorState(particleCount: number, hand: Hand): PosteriorState {
  const particles: WeightedParticle[] = Array.from({ length: particleCount }, () => ({
    world: {
      hiddenDeal: new Map([["N", hand]]) as ReadonlyMap<string, Hand>,
      branchAssignment: new Map() as ReadonlyMap<string, string>,
    },
    weight: 1,
  }));

  return {
    particles,
    context: {
      snapshot: { publicCommitments: [] } as unknown as ConditioningContext["snapshot"],
      factorGraph: { factors: [], ambiguitySchema: [], evidencePins: [] },
      observerSeat: "S",
    },
  };
}

describe("createPosteriorFactProviderFromBackend", () => {
  it("delegates to POSTERIOR_FACT_HANDLERS for known fact IDs", () => {
    // North has 4 hearts — partnerHas4HeartsLikely should be 1.0
    const state = makeMockPosteriorState(100, northHand);
    const provider = createPosteriorFactProviderFromBackend(state, ownHand, 200);

    const result = provider.queryFact({
      factId: "bridge.partnerHas4HeartsLikely",
      seatId: "N",
      conditionedOn: ["H"],
    });

    expect(result).not.toBeNull();
    expect(result!.factId).toBe("bridge.partnerHas4HeartsLikely");
    expect(result!.seatId).toBe("N");
    // All particles have 4 hearts → expectedValue should be 1.0
    expect(result!.expectedValue).toBe(1);
    // confidence = 100/200 = 0.5
    expect(result!.confidence).toBe(0.5);
  });

  it("returns null for unknown fact IDs", () => {
    const state = makeMockPosteriorState(100, northHand);
    const provider = createPosteriorFactProviderFromBackend(state, ownHand, 200);

    const result = provider.queryFact({
      factId: "bridge.unknownFact",
      seatId: "N",
    });

    expect(result).toBeNull();
  });

  it("handles zero particles gracefully", () => {
    const state = makeMockPosteriorState(0, northHand);
    const provider = createPosteriorFactProviderFromBackend(state, ownHand, 200);

    const result = provider.queryFact({
      factId: "bridge.partnerHas4HeartsLikely",
      seatId: "N",
      conditionedOn: ["H"],
    });

    expect(result).not.toBeNull();
    expect(result!.expectedValue).toBe(0);
    expect(result!.confidence).toBe(0);
  });

  it("confidence reflects particle count vs totalRequested", () => {
    const state = makeMockPosteriorState(80, northHand);
    const provider = createPosteriorFactProviderFromBackend(state, ownHand, 200);

    const result = provider.queryFact({
      factId: "bridge.partnerHas4HeartsLikely",
      seatId: "N",
      conditionedOn: ["H"],
    });

    expect(result).not.toBeNull();
    // 80 particles out of 200 requested = 0.4 confidence
    expect(result!.confidence).toBe(0.4);
  });

  it("getBeliefView returns null", () => {
    const state = makeMockPosteriorState(100, northHand);
    const provider = createPosteriorFactProviderFromBackend(state, ownHand, 200);

    expect(provider.getBeliefView("N", "S")).toBeNull();
  });

  it("nsHaveEightCardFitLikely uses ownHand + particle hands correctly", () => {
    // ownHand has 5 spades, northHand has 4 spades → combined = 9 ≥ 8 → fit
    const state = makeMockPosteriorState(100, northHand);
    const provider = createPosteriorFactProviderFromBackend(state, ownHand, 100);

    const result = provider.queryFact({
      factId: "bridge.nsHaveEightCardFitLikely",
      seatId: "N",
    });

    expect(result).not.toBeNull();
    // All particles: 5 own spades + 4 partner spades = 9 ≥ 8 → fit in every sample
    expect(result!.expectedValue).toBe(1);
  });
});
