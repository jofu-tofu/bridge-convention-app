import { describe, it, expect } from "vitest";
import {
  arbitrateMeanings,
  type ArbitrationInput,
} from "../meaning-arbitrator";
import type { MeaningProposal } from "../../../../core/contracts/meaning";
import { BidSuit } from "../../../../engine/types";
import type { Call } from "../../../../engine/types";

function makeCall(level: 1 | 2 | 3 | 4 | 5 | 6 | 7, strain: BidSuit): Call {
  return { type: "bid", level, strain };
}

function makeProposal(
  overrides: Partial<MeaningProposal> & { allSatisfied?: boolean } = {},
): MeaningProposal {
  const { allSatisfied = true, ...rest } = overrides;
  return {
    meaningId: "test:meaning",
    moduleId: "test",
    clauses: [
      {
        factId: "hand.hcp",
        operator: "gte",
        value: 8,
        satisfied: allSatisfied,
        description: "8+ HCP",
      },
    ],
    ranking: {
      recommendationBand: "should",
      specificity: 1,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    evidence: {
      factDependencies: ["hand.hcp"],
      evaluatedConditions: [
        { name: "hcp", passed: allSatisfied, description: "8+ HCP" },
      ],
      provenance: {
        moduleId: "test",
        nodeName: "test-node",
        origin: "tree",
      },
    },
    sourceIntent: { type: "test-intent", params: {} },
    ...rest,
  };
}

function makeInput(
  proposalOverrides: Partial<MeaningProposal> & { allSatisfied?: boolean } = {},
  call: Call = makeCall(2, BidSuit.Clubs),
): ArbitrationInput {
  return {
    proposal: makeProposal(proposalOverrides),
    surface: { encoding: { defaultCall: call } },
  };
}

describe("semantic class aliasing in arbitrateMeanings", () => {
  it("without aliases, two proposals with different semanticClassIds both remain in truth set", () => {
    const input1 = makeInput(
      {
        meaningId: "stayman:ask-major",
        semanticClassId: "stayman:ask-major",
        ranking: {
          recommendationBand: "should",
          specificity: 5,
          modulePrecedence: 0,
          intraModuleOrder: 0,
        },
      },
      makeCall(2, BidSuit.Clubs),
    );

    const input2 = makeInput(
      {
        meaningId: "precision-stayman:ask-major",
        semanticClassId: "precision-stayman:ask-major",
        ranking: {
          recommendationBand: "should",
          specificity: 3,
          modulePrecedence: 1,
          intraModuleOrder: 0,
        },
      },
      makeCall(2, BidSuit.Clubs),
    );

    const result = arbitrateMeanings([input1, input2]);

    // Without aliases, both remain -- different semanticClassIds are not deduplicated
    expect(result.truthSet).toHaveLength(2);
    expect(result.selected!.proposal.meaningId).toBe("stayman:ask-major");
  });

  it("deduplicates proposals whose semanticClassIds are aliased to the same canonical ID", () => {
    const input1 = makeInput(
      {
        meaningId: "stayman:ask-major",
        semanticClassId: "stayman:ask-major",
        ranking: {
          recommendationBand: "should",
          specificity: 5,
          modulePrecedence: 0,
          intraModuleOrder: 0,
        },
      },
      makeCall(2, BidSuit.Clubs),
    );

    const input2 = makeInput(
      {
        meaningId: "precision-stayman:ask-major",
        semanticClassId: "precision-stayman:ask-major",
        ranking: {
          recommendationBand: "should",
          specificity: 3,
          modulePrecedence: 1,
          intraModuleOrder: 0,
        },
      },
      makeCall(2, BidSuit.Clubs),
    );

    const result = arbitrateMeanings([input1, input2], {
      semanticClassAliases: [
        { from: "stayman:ask-major", to: "bridge:ask-major" },
        { from: "precision-stayman:ask-major", to: "bridge:ask-major" },
      ],
    });

    // Higher-ranked proposal wins; lower-ranked is eliminated from truth set
    expect(result.truthSet).toHaveLength(1);
    expect(result.truthSet[0]!.proposal.meaningId).toBe("stayman:ask-major");
    expect(result.selected!.proposal.meaningId).toBe("stayman:ask-major");

    // The eliminated proposal appears in eliminations with alias dedup reason
    expect(result.eliminations.some(
      (e) => e.candidateBidName === "precision-stayman:ask-major",
    )).toBe(true);
  });

  it("does not deduplicate proposals with no aliases (backward compatible)", () => {
    const input1 = makeInput(
      {
        meaningId: "transfer:hearts",
        semanticClassId: "transfer:hearts",
        ranking: {
          recommendationBand: "should",
          specificity: 3,
          modulePrecedence: 0,
          intraModuleOrder: 0,
        },
      },
      makeCall(2, BidSuit.Diamonds),
    );

    const input2 = makeInput(
      {
        meaningId: "natural:weak-diamonds",
        semanticClassId: "natural:weak-diamonds",
        ranking: {
          recommendationBand: "may",
          specificity: 1,
          modulePrecedence: 1,
          intraModuleOrder: 0,
        },
      },
      makeCall(2, BidSuit.Diamonds),
    );

    // Pass aliases but none that match these proposals
    const result = arbitrateMeanings([input1, input2], {
      semanticClassAliases: [
        { from: "stayman:ask-major", to: "bridge:ask-major" },
      ],
    });

    // Both remain -- their semanticClassIds are not aliased together
    expect(result.truthSet).toHaveLength(2);
  });

  it("transitive aliasing: two proposals aliased to the same target are deduplicated", () => {
    // Three proposals, two share the same alias target, one is unrelated
    const inputA = makeInput(
      {
        meaningId: "moduleA:nt-invite",
        semanticClassId: "moduleA:nt-invite",
        ranking: {
          recommendationBand: "must",
          specificity: 5,
          modulePrecedence: 0,
          intraModuleOrder: 0,
        },
      },
      makeCall(2, BidSuit.NoTrump),
    );

    const inputB = makeInput(
      {
        meaningId: "moduleB:nt-invite",
        semanticClassId: "moduleB:nt-invite",
        ranking: {
          recommendationBand: "should",
          specificity: 3,
          modulePrecedence: 1,
          intraModuleOrder: 0,
        },
      },
      makeCall(2, BidSuit.NoTrump),
    );

    const inputC = makeInput(
      {
        meaningId: "moduleC:pass",
        semanticClassId: "bridge:pass",
        ranking: {
          recommendationBand: "may",
          specificity: 1,
          modulePrecedence: 0,
          intraModuleOrder: 0,
        },
      },
      makeCall(2, BidSuit.NoTrump),
    );

    const result = arbitrateMeanings([inputA, inputB, inputC], {
      semanticClassAliases: [
        { from: "moduleA:nt-invite", to: "bridge:nt-invite" },
        { from: "moduleB:nt-invite", to: "bridge:nt-invite" },
      ],
    });

    // A and B are aliased to the same canonical ID -- only A (higher rank) survives
    // C is unrelated and survives
    expect(result.truthSet).toHaveLength(2);
    const truthSetIds = result.truthSet.map((e) => e.proposal.meaningId);
    expect(truthSetIds).toContain("moduleA:nt-invite");
    expect(truthSetIds).toContain("moduleC:pass");
    expect(truthSetIds).not.toContain("moduleB:nt-invite");
  });

  it("proposals without semanticClassId are never affected by aliases", () => {
    const inputWithClass = makeInput(
      {
        meaningId: "stayman:ask-major",
        semanticClassId: "stayman:ask-major",
        ranking: {
          recommendationBand: "should",
          specificity: 5,
          modulePrecedence: 0,
          intraModuleOrder: 0,
        },
      },
      makeCall(2, BidSuit.Clubs),
    );

    const inputWithoutClass = makeInput(
      {
        meaningId: "other:bid",
        // no semanticClassId
        ranking: {
          recommendationBand: "should",
          specificity: 3,
          modulePrecedence: 1,
          intraModuleOrder: 0,
        },
      },
      makeCall(2, BidSuit.Clubs),
    );

    const result = arbitrateMeanings([inputWithClass, inputWithoutClass], {
      semanticClassAliases: [
        { from: "stayman:ask-major", to: "bridge:ask-major" },
      ],
    });

    // Both remain -- proposal without semanticClassId cannot be alias-deduplicated
    expect(result.truthSet).toHaveLength(2);
  });
});
