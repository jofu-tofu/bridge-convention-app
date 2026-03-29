import { describe, it, expect } from "vitest";
import {
  BAND_PRIORITY,
  compareRanking,
  FactOperator,
  RecommendationBand,
  type MeaningProposal,
  type RankingMetadata,
} from "../evaluation/meaning";
import { ConditionRole } from "../evidence-bundle";

function makeRanking(overrides: Partial<RankingMetadata> = {}): RankingMetadata {
  return {
    recommendationBand: RecommendationBand.Should,
    specificity: 1,
    modulePrecedence: 1,
    declarationOrder: 1,
    ...overrides,
  };
}

describe("BAND_PRIORITY", () => {
  it("assigns lower values to higher-priority bands", () => {
    expect(BAND_PRIORITY[RecommendationBand.Must]).toBeLessThan(BAND_PRIORITY[RecommendationBand.Should]);
    expect(BAND_PRIORITY[RecommendationBand.Should]).toBeLessThan(BAND_PRIORITY[RecommendationBand.May]);
    expect(BAND_PRIORITY[RecommendationBand.May]).toBeLessThan(BAND_PRIORITY[RecommendationBand.Avoid]);
  });

  it("covers all four bands", () => {
    const bands: RecommendationBand[] = [RecommendationBand.Must, RecommendationBand.Should, RecommendationBand.May, RecommendationBand.Avoid];
    for (const band of bands) {
      expect(BAND_PRIORITY[band]).toBeTypeOf("number");
    }
  });
});

describe("compareRanking", () => {
  it("ranks must above should", () => {
    const a = makeRanking({ recommendationBand: RecommendationBand.Must });
    const b = makeRanking({ recommendationBand: RecommendationBand.Should });
    expect(compareRanking(a, b)).toBeLessThan(0);
  });

  it("ranks should above may", () => {
    const a = makeRanking({ recommendationBand: RecommendationBand.Should });
    const b = makeRanking({ recommendationBand: RecommendationBand.May });
    expect(compareRanking(a, b)).toBeLessThan(0);
  });

  it("ranks may above avoid", () => {
    const a = makeRanking({ recommendationBand: RecommendationBand.May });
    const b = makeRanking({ recommendationBand: RecommendationBand.Avoid });
    expect(compareRanking(a, b)).toBeLessThan(0);
  });

  it("ranks avoid below must", () => {
    const a = makeRanking({ recommendationBand: RecommendationBand.Avoid });
    const b = makeRanking({ recommendationBand: RecommendationBand.Must });
    expect(compareRanking(a, b)).toBeGreaterThan(0);
  });

  it("breaks band tie with specificity (higher specificity ranks higher)", () => {
    const a = makeRanking({ specificity: 5 });
    const b = makeRanking({ specificity: 2 });
    expect(compareRanking(a, b)).toBeLessThan(0);
  });

  it("breaks band+specificity tie with modulePrecedence (lower wins)", () => {
    const a = makeRanking({ modulePrecedence: 1 });
    const b = makeRanking({ modulePrecedence: 3 });
    expect(compareRanking(a, b)).toBeLessThan(0);
  });

  it("breaks all-else-equal tie with declarationOrder (lower wins)", () => {
    const a = makeRanking({ declarationOrder: 2 });
    const b = makeRanking({ declarationOrder: 5 });
    expect(compareRanking(a, b)).toBeLessThan(0);
  });

  it("returns 0 for identical metadata", () => {
    const a = makeRanking();
    const b = makeRanking();
    expect(compareRanking(a, b)).toBe(0);
  });

  it("is antisymmetric (swapping a and b negates the result)", () => {
    const a = makeRanking({ recommendationBand: RecommendationBand.Must, specificity: 3 });
    const b = makeRanking({ recommendationBand: RecommendationBand.Should, specificity: 1 });
    expect(Math.sign(compareRanking(a, b))).toBe(
      -Math.sign(compareRanking(b, a)),
    );
  });
});

describe("MeaningProposal", () => {
  it("can be constructed as an object literal with all required fields", () => {
    const proposal: MeaningProposal = {
      meaningId: "stayman:ask-major",
      semanticClassId: "bridge:major-ask",
      moduleId: "stayman",
      clauses: [
        {
          factId: "hand.hcp",
          operator: FactOperator.Gte,
          value: 8,
          satisfied: true,
          description: "At least 8 HCP",
        },
      ],
      ranking: makeRanking({ recommendationBand: RecommendationBand.Must }),
      evidence: {
        factDependencies: ["hand.hcp"],
        evaluatedConditions: [
          {
            conditionId: "hasEnoughHCP",
            satisfied: true,
            description: "HCP >= 8",
            conditionRole: ConditionRole.Semantic,
          },
        ],
        provenance: {
          moduleId: "stayman",
          roundName: "response",
          nodeName: "stayman-ask",
          origin: "meaning-pipeline",
        },
      },
      sourceIntent: {
        type: "stayman-ask",
        params: { suit: "major" },
      },
      modulePriority: "preferred",
    };

    expect(proposal.meaningId).toBe("stayman:ask-major");
    expect(proposal.semanticClassId).toBe("bridge:major-ask");
    expect(proposal.moduleId).toBe("stayman");
    expect(proposal.clauses).toHaveLength(1);
    expect(proposal.ranking.recommendationBand).toBe("must");
    expect(proposal.evidence.provenance.origin).toBe("meaning-pipeline");
    expect(proposal.sourceIntent.type).toBe("stayman-ask");
    expect(proposal.modulePriority).toBe("preferred");
  });
});
