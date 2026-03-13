import { describe, it, expect } from "vitest";
import {
  createPosteriorFactEvaluators,
  createPosteriorFactProvider,
} from "../posterior-catalog";
import type { SeatPosterior, PosteriorFactRequest, PosteriorFactValue } from "../../../core/contracts/posterior";
import type { PosteriorFactProvider as PosteriorFactProviderType } from "../../../core/contracts/posterior";
import { ALL_POSTERIOR_FACT_IDS } from "../../../core/contracts/posterior";
import type { PublicHandSpace, LikelihoodModel } from "../../../core/contracts/posterior";

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
  it("returns map with exactly 5 entries, keys matching ALL_POSTERIOR_FACT_IDS", () => {
    const evaluators = createPosteriorFactEvaluators();
    expect(evaluators.size).toBe(5);
    for (const id of ALL_POSTERIOR_FACT_IDS) {
      expect(evaluators.has(id)).toBe(true);
    }
  });

  it("evaluator returns provider value when provider returns non-null", () => {
    const evaluators = createPosteriorFactEvaluators();
    const evaluator = evaluators.get("bridge.partnerHas4CardMajorLikely")!;
    const provider = makeMockProvider({
      "bridge.partnerHas4CardMajorLikely": {
        factId: "bridge.partnerHas4CardMajorLikely",
        seatId: "N",
        expectedValue: 0.73,
        confidence: 1,
      },
    });
    const result = evaluator(provider, { factId: "bridge.partnerHas4CardMajorLikely", seatId: "" });
    expect(result.factId).toBe("bridge.partnerHas4CardMajorLikely");
    expect(result.value).toBe(0.73);
  });

  it("evaluator returns value 0 when provider returns null (fail-open)", () => {
    const evaluators = createPosteriorFactEvaluators();
    const evaluator = evaluators.get("bridge.partnerHas4CardMajorLikely")!;
    const provider = makeMockProvider({});
    const result = evaluator(provider, { factId: "bridge.partnerHas4CardMajorLikely", seatId: "" });
    expect(result.factId).toBe("bridge.partnerHas4CardMajorLikely");
    expect(result.value).toBe(0);
  });
});

describe("createPosteriorFactProvider", () => {
  it("queryFact delegates to SeatPosterior.probability and returns PosteriorFactValue", () => {
    const posterior = makeMockSeatPosterior({
      "bridge.partnerHas4CardMajorLikely": 0.65,
    });
    const provider = createPosteriorFactProvider(posterior);
    const result = provider.queryFact({
      factId: "bridge.partnerHas4CardMajorLikely",
      seatId: "N",
      conditionedOn: ["H"],
    });
    expect(result).not.toBeNull();
    expect(result!.factId).toBe("bridge.partnerHas4CardMajorLikely");
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
      factId: "bridge.partnerHas4CardMajorLikely",
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
      "bridge.partnerHas4CardMajorLikely": 0.65,
    });
    // effectiveSampleSize = 200 (default), so confidence = 200/200 = 1
    const provider = createPosteriorFactProvider(posterior);
    const result = provider.queryFact({
      factId: "bridge.partnerHas4CardMajorLikely",
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
