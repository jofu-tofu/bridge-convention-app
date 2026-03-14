import { describe, it, expect } from "vitest";
import {
  arbitrateMeanings,
  zipProposalsWithSurfaces,
  type ArbitrationInput,
} from "../meaning-arbitrator";
import type { MeaningProposal } from "../../../../core/contracts/meaning";
import { BidSuit } from "../../../../engine/types";
import type { Call } from "../../../../engine/types";
import { makeCall, makeMeaningProposal, makeArbitrationInput } from "./pipeline-test-helpers";

describe("arbitrateMeanings", () => {
  it("selects a single proposal that passes all gates", () => {
    const input = makeArbitrationInput();
    const result = arbitrateMeanings([input]);

    expect(result.selected).not.toBeNull();
    expect(result.selected!.call).toEqual(makeCall(2, BidSuit.Clubs));
    expect(result.truthSet).toHaveLength(1);
    expect(result.eliminations).toHaveLength(0);
  });

  it("does not select a proposal that fails semantic gate", () => {
    const input = makeArbitrationInput({ allSatisfied: false });
    const result = arbitrateMeanings([input]);

    expect(result.selected).toBeNull();
    expect(result.truthSet).toHaveLength(0);
    expect(result.eliminations).toHaveLength(1);
    expect(result.eliminations[0]!.gateId).toBe("semantic-applicability");
  });

  it("selects highest band when multiple proposals have different bands", () => {
    const mustInput = makeArbitrationInput({
      meaningId: "test:must",
      ranking: {
        recommendationBand: "must",
        specificity: 1,
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
    }, makeCall(2, BidSuit.Hearts));

    const shouldInput = makeArbitrationInput({
      meaningId: "test:should",
      ranking: {
        recommendationBand: "should",
        specificity: 1,
        modulePrecedence: 0,
        intraModuleOrder: 1,
      },
    }, makeCall(2, BidSuit.Clubs));

    const mayInput = makeArbitrationInput({
      meaningId: "test:may",
      ranking: {
        recommendationBand: "may",
        specificity: 1,
        modulePrecedence: 0,
        intraModuleOrder: 2,
      },
    }, makeCall(2, BidSuit.Diamonds));

    const result = arbitrateMeanings([mayInput, shouldInput, mustInput]);

    expect(result.selected).not.toBeNull();
    expect(result.selected!.proposal.meaningId).toBe("test:must");
    expect(result.recommended).toHaveLength(3);
    expect(result.recommended[0]!.proposal.meaningId).toBe("test:must");
  });

  it("selects higher specificity when bands are equal", () => {
    const specificInput = makeArbitrationInput({
      meaningId: "test:specific",
      ranking: {
        recommendationBand: "should",
        specificity: 5,
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
    }, makeCall(2, BidSuit.Hearts));

    const generalInput = makeArbitrationInput({
      meaningId: "test:general",
      ranking: {
        recommendationBand: "should",
        specificity: 1,
        modulePrecedence: 0,
        intraModuleOrder: 1,
      },
    }, makeCall(2, BidSuit.Clubs));

    const result = arbitrateMeanings([generalInput, specificInput]);

    expect(result.selected!.proposal.meaningId).toBe("test:specific");
  });

  it("eliminates proposal with illegal call when legalCalls provided", () => {
    const legalCalls: Call[] = [
      { type: "bid", level: 1, strain: BidSuit.Clubs },
      { type: "pass" },
    ];

    const input = makeArbitrationInput({}, makeCall(2, BidSuit.Clubs));
    const result = arbitrateMeanings([input], { legalCalls });

    expect(result.selected).toBeNull();
    expect(result.truthSet).toHaveLength(0);
    expect(result.eliminations).toHaveLength(1);
    expect(result.eliminations[0]!.reason).toContain("not legal");
  });

  it("threads blockedCalls through to DecisionProvenance.encoding when call is illegal", () => {
    const illegalCall = makeCall(2, BidSuit.Clubs);
    const legalCalls: Call[] = [
      { type: "bid", level: 1, strain: BidSuit.Clubs },
      { type: "pass" },
    ];

    const input = makeArbitrationInput({ meaningId: "test:blocked" }, illegalCall);
    const result = arbitrateMeanings([input], { legalCalls });

    expect(result.provenance).toBeDefined();
    expect(result.provenance!.encoding).toHaveLength(1);
    expect(result.provenance!.encoding[0]!.blockedCalls).toHaveLength(1);
    expect(result.provenance!.encoding[0]!.blockedCalls[0]).toEqual({
      call: illegalCall,
      reason: "illegal_in_auction",
    });
    expect(result.provenance!.encoding[0]!.chosenCall).toBeUndefined();
  });

  it("threads empty blockedCalls through to DecisionProvenance.encoding when call is legal", () => {
    const legalCall = makeCall(1, BidSuit.Clubs);
    const legalCalls: Call[] = [legalCall, { type: "pass" }];

    const input = makeArbitrationInput({}, legalCall);
    const result = arbitrateMeanings([input], { legalCalls });

    expect(result.provenance).toBeDefined();
    expect(result.provenance!.encoding).toHaveLength(1);
    expect(result.provenance!.encoding[0]!.blockedCalls).toHaveLength(0);
    expect(result.provenance!.encoding[0]!.chosenCall).toEqual(legalCall);
  });

  it("returns null selected and empty truthSet for empty proposals", () => {
    const result = arbitrateMeanings([]);

    expect(result.selected).toBeNull();
    expect(result.truthSet).toHaveLength(0);
    expect(result.acceptableSet).toHaveLength(0);
    expect(result.recommended).toHaveLength(0);
    expect(result.eliminations).toHaveLength(0);
  });

  it("places failed-semantic may-band legal proposals in acceptableSet", () => {
    const input = makeArbitrationInput({
      allSatisfied: false,
      ranking: {
        recommendationBand: "may",
        specificity: 1,
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
    });

    const result = arbitrateMeanings([input]);

    expect(result.selected).toBeNull();
    expect(result.truthSet).toHaveLength(0);
    expect(result.acceptableSet).toHaveLength(1);
    expect(result.acceptableSet[0]!.proposal.ranking.recommendationBand).toBe("may");
  });

  it("keeps two proposals with same call both in truthSet (no dedup)", () => {
    const call = makeCall(2, BidSuit.Clubs);
    const input1 = makeArbitrationInput({ meaningId: "test:a" }, call);
    const input2 = makeArbitrationInput({ meaningId: "test:b" }, call);

    const result = arbitrateMeanings([input1, input2]);

    expect(result.truthSet).toHaveLength(2);
    expect(result.recommended).toHaveLength(2);
  });

  it("builds correct eligibility with failed conditions", () => {
    const input: ArbitrationInput = {
      proposal: {
        meaningId: "test:fail",
        moduleId: "test",
        clauses: [
          { factId: "hand.hcp", operator: "gte", value: 8, satisfied: false, description: "8+ HCP" },
          { factId: "bridge.hasFourCardMajor", operator: "boolean", value: true, satisfied: true, description: "Has 4-card major" },
        ],
        ranking: { recommendationBand: "should", specificity: 1, modulePrecedence: 0, intraModuleOrder: 0 },
        evidence: {
          factDependencies: ["hand.hcp", "bridge.hasFourCardMajor"],
          evaluatedConditions: [],
          provenance: { moduleId: "test", nodeName: "test-node", origin: "tree" },
        },
        sourceIntent: { type: "test", params: {} },
      },
      surface: { encoding: { defaultCall: makeCall(2, BidSuit.Clubs) } },
    };

    const result = arbitrateMeanings([input]);

    // Eliminated due to semantic failure; "should" band (priority 1) <= "may" (priority 2)
    // so it IS in acceptableSet. Verify the eligibility shape on that entry.
    expect(result.eliminations).toHaveLength(1);
    expect(result.acceptableSet).toHaveLength(1);
    const acceptable = result.acceptableSet[0]!;
    expect(acceptable.eligibility.hand.satisfied).toBe(false);
    expect(acceptable.eligibility.hand.failedConditions).toHaveLength(1);
    expect(acceptable.eligibility.hand.failedConditions[0]!.name).toBe("hand.hcp");
    expect(acceptable.eligibility.encoding.legal).toBe(true);
  });

  it("places failed-semantic should-band proposals in acceptableSet", () => {
    const input = makeArbitrationInput({
      allSatisfied: false,
      ranking: {
        recommendationBand: "should",
        specificity: 1,
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
    });

    const result = arbitrateMeanings([input]);

    // "should" band priority (1) <= "may" band priority (2), so it's in acceptableSet
    expect(result.acceptableSet).toHaveLength(1);
  });

  it("does NOT place failed-semantic avoid-band proposals in acceptableSet", () => {
    const input = makeArbitrationInput({
      allSatisfied: false,
      ranking: {
        recommendationBand: "avoid",
        specificity: 1,
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
    });

    const result = arbitrateMeanings([input]);

    expect(result.acceptableSet).toHaveLength(0);
    expect(result.eliminations).toHaveLength(1);
  });
});

describe("evidenceBundle production", () => {
  it("produces matched with satisfiedConditions including observedValues", () => {
    const input = makeArbitrationInput({
      meaningId: "test:winner",
      clauses: [
        {
          factId: "hand.hcp",
          operator: "gte",
          value: 8,
          satisfied: true,
          description: "8+ HCP",
          observedValue: 12,
        },
        {
          factId: "bridge.hasFourCardMajor",
          operator: "boolean",
          value: true,
          satisfied: true,
          description: "Has 4-card major",
          observedValue: true,
        },
      ],
    });

    const result = arbitrateMeanings([input]);

    expect(result.evidenceBundle).toBeDefined();
    expect(result.evidenceBundle!.matched).not.toBeNull();
    expect(result.evidenceBundle!.matched!.meaningId).toBe("test:winner");
    expect(result.evidenceBundle!.matched!.satisfiedConditions).toHaveLength(2);

    const firstCondition = result.evidenceBundle!.matched!.satisfiedConditions[0]!;
    expect(firstCondition.conditionId).toBe("hand.hcp");
    expect(firstCondition.factId).toBe("hand.hcp");
    expect(firstCondition.satisfied).toBe(true);
    expect(firstCondition.observedValue).toBe(12);
    expect(firstCondition.threshold).toBe(8);
  });

  it("rejected surfaces appear with clause-level failure details", () => {
    const failingInput = makeArbitrationInput({
      meaningId: "test:rejected",
      allSatisfied: false,
      ranking: {
        recommendationBand: "avoid",
        specificity: 1,
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
    });

    const result = arbitrateMeanings([failingInput]);

    expect(result.evidenceBundle).toBeDefined();
    expect(result.evidenceBundle!.rejected).toHaveLength(1);
    expect(result.evidenceBundle!.rejected[0]!.meaningId).toBe("test:rejected");
    expect(result.evidenceBundle!.rejected[0]!.moduleId).toBe("test");
    expect(result.evidenceBundle!.rejected[0]!.failedConditions.length).toBeGreaterThan(0);
  });

  it("alternatives from truth set appear with ranking", () => {
    const input1 = makeArbitrationInput({
      meaningId: "test:winner",
      ranking: {
        recommendationBand: "must",
        specificity: 5,
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
    }, makeCall(2, BidSuit.Hearts));

    const input2 = makeArbitrationInput({
      meaningId: "test:alternative",
      ranking: {
        recommendationBand: "should",
        specificity: 1,
        modulePrecedence: 0,
        intraModuleOrder: 1,
      },
    }, makeCall(2, BidSuit.Clubs));

    const result = arbitrateMeanings([input1, input2]);

    expect(result.evidenceBundle).toBeDefined();
    expect(result.evidenceBundle!.matched!.meaningId).toBe("test:winner");
    expect(result.evidenceBundle!.alternatives).toHaveLength(1);
    expect(result.evidenceBundle!.alternatives[0]!.meaningId).toBe("test:alternative");
    expect(result.evidenceBundle!.alternatives[0]!.call).toBe("2C");
    expect(result.evidenceBundle!.alternatives[0]!.ranking.band).toBe("should");
    expect(result.evidenceBundle!.alternatives[0]!.ranking.specificity).toBe(1);
  });

  it("exhaustive is true and fallbackReached is true when no surface matched", () => {
    const failingInput = makeArbitrationInput({
      allSatisfied: false,
      ranking: {
        recommendationBand: "avoid",
        specificity: 1,
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
    });

    const result = arbitrateMeanings([failingInput]);

    expect(result.evidenceBundle).toBeDefined();
    expect(result.evidenceBundle!.exhaustive).toBe(true);
    expect(result.evidenceBundle!.fallbackReached).toBe(true);
    expect(result.evidenceBundle!.matched).toBeNull();
  });

  it("fallbackReached is false when a surface was selected", () => {
    const input = makeArbitrationInput();
    const result = arbitrateMeanings([input]);

    expect(result.evidenceBundle).toBeDefined();
    expect(result.evidenceBundle!.fallbackReached).toBe(false);
  });
});

describe("handoff provenance", () => {
  it("threads provided handoffs into provenance", () => {
    const input = makeArbitrationInput();
    const handoffs = [
      { fromModuleId: "mod-a", toModuleId: "mod-b", reason: "forcing relay" },
      { fromModuleId: "mod-b", toModuleId: "mod-c", reason: "transfer completion" },
    ];

    const result = arbitrateMeanings([input], { handoffs });

    expect(result.provenance).toBeDefined();
    expect(result.provenance!.handoffs).toEqual(handoffs);
    expect(result.provenance!.handoffs).toHaveLength(2);
  });

  it("defaults handoffs to empty array when not provided", () => {
    const input = makeArbitrationInput();
    const result = arbitrateMeanings([input]);

    expect(result.provenance).toBeDefined();
    expect(result.provenance!.handoffs).toEqual([]);
  });
});

describe("zipProposalsWithSurfaces", () => {
  it("pairs proposals with their source surfaces by index", () => {
    const proposals: MeaningProposal[] = [makeMeaningProposal({ meaningId: "a" }), makeMeaningProposal({ meaningId: "b" })];
    const surfaces = [
      { meaningId: "a", moduleId: "test", encoding: { defaultCall: makeCall(1, BidSuit.Clubs) }, clauses: [], ranking: { recommendationBand: "should" as const, specificity: 1, modulePrecedence: 0, intraModuleOrder: 0 }, sourceIntent: { type: "t", params: {} } },
      { meaningId: "b", moduleId: "test", encoding: { defaultCall: makeCall(2, BidSuit.Hearts) }, clauses: [], ranking: { recommendationBand: "should" as const, specificity: 1, modulePrecedence: 0, intraModuleOrder: 1 }, sourceIntent: { type: "t", params: {} } },
    ];

    const inputs = zipProposalsWithSurfaces(proposals, surfaces);

    expect(inputs).toHaveLength(2);
    expect(inputs[0]!.proposal.meaningId).toBe("a");
    expect(inputs[0]!.surface.encoding.defaultCall).toEqual(makeCall(1, BidSuit.Clubs));
    expect(inputs[1]!.proposal.meaningId).toBe("b");
    expect(inputs[1]!.surface.encoding.defaultCall).toEqual(makeCall(2, BidSuit.Hearts));
  });
});
