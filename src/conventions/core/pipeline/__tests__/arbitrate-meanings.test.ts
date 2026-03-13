// Characterization tests for arbitrateMeanings() — provenance, multi-proposal, and type guards.
// Transform handling moved to composeSurfaces() in surface-composer.ts.

import { describe, it, expect } from "vitest";
import { arbitrateMeanings } from "../meaning-arbitrator";
import { BidSuit } from "../../../../engine/types";
import { makeArbitrationInput, makeCall } from "./pipeline-test-helpers";

describe("arbitrateMeanings — type guard", () => {
  it("does not accept transforms option (moved to composeSurfaces)", () => {
    const input = makeArbitrationInput();
    // @ts-expect-error transforms removed from arbitrateMeanings options
    arbitrateMeanings([input], { transforms: [] });
  });
});

describe("arbitrateMeanings — provenance characterization", () => {
  it("provenance includes applicability evidence from selected candidate", () => {
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

    expect(result.provenance).toBeDefined();
    expect(result.provenance!.applicability.factDependencies).toContain("hand.hcp");
    expect(result.provenance!.applicability.evaluatedConditions).toHaveLength(1);
    expect(result.provenance!.applicability.evaluatedConditions[0]!.satisfied).toBe(true);
  });

  it("provenance includes legality traces for all candidates", () => {
    const input1 = makeArbitrationInput({ meaningId: "a" }, makeCall(1, BidSuit.Clubs));
    const input2 = makeArbitrationInput({ meaningId: "b" }, makeCall(2, BidSuit.Hearts));

    const result = arbitrateMeanings([input1, input2]);

    expect(result.provenance!.legality).toHaveLength(2);
    expect(result.provenance!.legality.every(l => l.legal)).toBe(true);
  });

  it("provenance includes encoding traces for all candidates", () => {
    const input = makeArbitrationInput({ meaningId: "test:enc" });
    const result = arbitrateMeanings([input]);

    expect(result.provenance!.encoding).toHaveLength(1);
    expect(result.provenance!.encoding[0]!.encoderKind).toBe("default-call");
  });

  it("provenance includes arbitration traces with ranking inputs", () => {
    const input = makeArbitrationInput({
      meaningId: "test:arb",
      ranking: {
        recommendationBand: "must",
        specificity: 5,
        modulePrecedence: 1,
        intraModuleOrder: 0,
      },
    });

    const result = arbitrateMeanings([input]);

    expect(result.provenance!.arbitration).toHaveLength(1);
    const trace = result.provenance!.arbitration[0]!;
    expect(trace.truthSetMember).toBe(true);
    expect(trace.rankingInputs.recommendationBand).toBe(0); // BAND_PRIORITY["must"] = 0
    expect(trace.rankingInputs.specificity).toBe(5);
  });

  it("provenance elimination traces track gate failures", () => {
    const input = makeArbitrationInput({ allSatisfied: false, meaningId: "test:fail" });
    const result = arbitrateMeanings([input]);

    expect(result.provenance!.eliminations.length).toBeGreaterThanOrEqual(1);
    const elim = result.provenance!.eliminations.find(e => e.candidateId === "test:fail");
    expect(elim).toBeDefined();
    expect(elim!.stage).toBe("applicability");
  });

  it("provenance.transforms is empty (transforms handled upstream by composeSurfaces)", () => {
    const input = makeArbitrationInput({ meaningId: "test:bid" });
    const result = arbitrateMeanings([input]);

    expect(result.provenance!.transforms).toHaveLength(0);
  });

  it("empty applicability evidence when no candidate selected", () => {
    const result = arbitrateMeanings([]);

    expect(result.provenance!.applicability.factDependencies).toEqual([]);
    expect(result.provenance!.applicability.evaluatedConditions).toEqual([]);
  });
});

describe("arbitrateMeanings — multi-proposal characterization", () => {
  it("mixed outcomes: truth + eliminated + acceptable", () => {
    const truth = makeArbitrationInput({ meaningId: "truth", allSatisfied: true }, makeCall(1, BidSuit.Clubs));
    const eliminated = makeArbitrationInput({
      meaningId: "eliminated",
      allSatisfied: false,
      ranking: { recommendationBand: "avoid", specificity: 1, modulePrecedence: 0, intraModuleOrder: 2 },
    }, makeCall(2, BidSuit.Hearts));
    const acceptable = makeArbitrationInput({
      meaningId: "acceptable",
      allSatisfied: false,
      ranking: { recommendationBand: "may", specificity: 1, modulePrecedence: 0, intraModuleOrder: 1 },
    }, makeCall(2, BidSuit.Diamonds));

    const result = arbitrateMeanings([truth, eliminated, acceptable]);

    expect(result.truthSet).toHaveLength(1);
    expect(result.truthSet[0]!.proposal.meaningId).toBe("truth");
    expect(result.acceptableSet).toHaveLength(1);
    expect(result.acceptableSet[0]!.proposal.meaningId).toBe("acceptable");
    expect(result.eliminations.length).toBeGreaterThanOrEqual(1);
    expect(result.selected!.proposal.meaningId).toBe("truth");
  });
});
