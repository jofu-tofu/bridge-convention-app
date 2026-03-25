// Characterization tests for arbitrateMeanings() — provenance, multi-proposal, and type guards.

import { describe, it, expect } from "vitest";
import { arbitrateMeanings } from "../evaluation/meaning-arbitrator";
import { BidSuit } from "../../../engine/types";
import { makeArbitrationInput, makeCall } from "./pipeline-test-helpers";

describe("arbitrateMeanings — provenance characterization", () => {
  it("applicability evidence from selected candidate", () => {
    const input = makeArbitrationInput({
      meaningId: "test:selected",
      clauses: [{
        factId: "hand.hcp",
        operator: "gte",
        value: 8,
        satisfied: true,
        description: "8+ HCP",
      }],
    });

    const result = arbitrateMeanings([input]);

    expect(result.applicability.factDependencies).toContain("hand.hcp");
    expect(result.applicability.evaluatedConditions).toHaveLength(1);
    expect(result.applicability.evaluatedConditions[0]!.satisfied).toBe(true);
  });

  it("legality traces on carriers for all candidates", () => {
    const input1 = makeArbitrationInput({ meaningId: "a" }, makeCall(1, BidSuit.Clubs));
    const input2 = makeArbitrationInput({ meaningId: "b" }, makeCall(2, BidSuit.Hearts));

    const result = arbitrateMeanings([input1, input2]);

    // All carriers have legality traces
    const allCarriers = [...result.truthSet, ...result.acceptableSet, ...result.eliminated];
    expect(allCarriers.length).toBeGreaterThanOrEqual(2);
    expect(allCarriers.every(c => c.traces.legality.legal)).toBe(true);
  });

  it("encoding traces on carriers for all candidates", () => {
    const input = makeArbitrationInput({ meaningId: "test:enc" });
    const result = arbitrateMeanings([input]);

    expect(result.truthSet).toHaveLength(1);
    expect(result.truthSet[0]!.traces.encoding.encoderKind).toBe("default-call");
  });

  it("arbitration traces with ranking inputs", () => {
    const input = makeArbitrationInput({
      meaningId: "test:arb",
      ranking: {
        recommendationBand: "must",
        specificity: 5,
        modulePrecedence: 1,
        declarationOrder: 0,
      },
    });

    const result = arbitrateMeanings([input]);

    expect(result.arbitration).toHaveLength(1);
    const trace = result.arbitration[0]!;
    expect(trace.truthSetMember).toBe(true);
    expect(trace.rankingInputs.recommendationBand).toBe(0); // BAND_PRIORITY["must"] = 0
    expect(trace.rankingInputs.specificity).toBe(5);
  });

  it("elimination traces on eliminated carriers track gate failures", () => {
    const input = makeArbitrationInput({ allSatisfied: false, meaningId: "test:fail" });
    const result = arbitrateMeanings([input]);

    expect(result.eliminated.length).toBeGreaterThanOrEqual(1);
    const elim = result.eliminated.find(c => c.proposal.meaningId === "test:fail");
    expect(elim).toBeDefined();
    expect(elim!.traces.elimination).toBeDefined();
    expect(elim!.traces.elimination!.stage).toBe("applicability");
  });

  it("empty applicability evidence when no candidate selected", () => {
    const result = arbitrateMeanings([]);

    expect(result.applicability.factDependencies).toEqual([]);
    expect(result.applicability.evaluatedConditions).toEqual([]);
  });
});

describe("arbitrateMeanings — multi-proposal characterization", () => {
  it("mixed outcomes: truth + eliminated + acceptable", () => {
    const truth = makeArbitrationInput({ meaningId: "truth", allSatisfied: true }, makeCall(1, BidSuit.Clubs));
    const eliminated = makeArbitrationInput({
      meaningId: "eliminated",
      allSatisfied: false,
      ranking: { recommendationBand: "avoid", specificity: 1, modulePrecedence: 0, declarationOrder: 2 },
    }, makeCall(2, BidSuit.Hearts));
    const acceptable = makeArbitrationInput({
      meaningId: "acceptable",
      allSatisfied: false,
      ranking: { recommendationBand: "may", specificity: 1, modulePrecedence: 0, declarationOrder: 1 },
    }, makeCall(2, BidSuit.Diamonds));

    const result = arbitrateMeanings([truth, eliminated, acceptable]);

    expect(result.truthSet).toHaveLength(1);
    expect(result.truthSet[0]!.proposal.meaningId).toBe("truth");
    expect(result.acceptableSet).toHaveLength(1);
    expect(result.acceptableSet[0]!.proposal.meaningId).toBe("acceptable");
    expect(result.eliminated.length).toBeGreaterThanOrEqual(1);
    expect(result.selected!.proposal.meaningId).toBe("truth");
  });
});
