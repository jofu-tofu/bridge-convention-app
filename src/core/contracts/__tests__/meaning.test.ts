import { describe, it, expect } from "vitest";
import {
  BAND_PRIORITY,
  compareRanking,
  type MeaningProposal,
  type RankingMetadata,
  type RecommendationBand,
} from "../meaning";

function makeRanking(overrides: Partial<RankingMetadata> = {}): RankingMetadata {
  return {
    recommendationBand: "should",
    specificity: 1,
    modulePrecedence: 1,
    intraModuleOrder: 1,
    ...overrides,
  };
}

describe("BAND_PRIORITY", () => {
  it("assigns lower values to higher-priority bands", () => {
    expect(BAND_PRIORITY.must).toBeLessThan(BAND_PRIORITY.should);
    expect(BAND_PRIORITY.should).toBeLessThan(BAND_PRIORITY.may);
    expect(BAND_PRIORITY.may).toBeLessThan(BAND_PRIORITY.avoid);
  });

  it("covers all four bands", () => {
    const bands: RecommendationBand[] = ["must", "should", "may", "avoid"];
    for (const band of bands) {
      expect(BAND_PRIORITY[band]).toBeTypeOf("number");
    }
  });
});

describe("compareRanking", () => {
  it("ranks must above should", () => {
    const a = makeRanking({ recommendationBand: "must" });
    const b = makeRanking({ recommendationBand: "should" });
    expect(compareRanking(a, b)).toBeLessThan(0);
  });

  it("ranks should above may", () => {
    const a = makeRanking({ recommendationBand: "should" });
    const b = makeRanking({ recommendationBand: "may" });
    expect(compareRanking(a, b)).toBeLessThan(0);
  });

  it("ranks may above avoid", () => {
    const a = makeRanking({ recommendationBand: "may" });
    const b = makeRanking({ recommendationBand: "avoid" });
    expect(compareRanking(a, b)).toBeLessThan(0);
  });

  it("ranks avoid below must", () => {
    const a = makeRanking({ recommendationBand: "avoid" });
    const b = makeRanking({ recommendationBand: "must" });
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

  it("breaks all-else-equal tie with intraModuleOrder (lower wins)", () => {
    const a = makeRanking({ intraModuleOrder: 2 });
    const b = makeRanking({ intraModuleOrder: 5 });
    expect(compareRanking(a, b)).toBeLessThan(0);
  });

  it("returns 0 for identical metadata", () => {
    const a = makeRanking();
    const b = makeRanking();
    expect(compareRanking(a, b)).toBe(0);
  });

  it("is antisymmetric (swapping a and b negates the result)", () => {
    const a = makeRanking({ recommendationBand: "must", specificity: 3 });
    const b = makeRanking({ recommendationBand: "should", specificity: 1 });
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
          operator: "gte",
          value: 8,
          satisfied: true,
          description: "At least 8 HCP",
        },
      ],
      ranking: makeRanking({ recommendationBand: "must" }),
      evidence: {
        factDependencies: ["hand.hcp"],
        evaluatedConditions: [
          {
            conditionId: "hasEnoughHCP",
            satisfied: true,
            description: "HCP >= 8",
            conditionRole: "semantic",
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
