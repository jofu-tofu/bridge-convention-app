import { describe, it, expect } from "vitest";
import {
  evaluateProposal,
  classifyIntoSets,
} from "../evaluation/arbitration-helpers";
import type { PipelineCarrier } from "../pipeline-types";
import { BidSuit } from "../../../engine/types";
import {
  makeArbitrationInput,
  makeMeaningProposal,
  makeCall,
  makePass,
  makeRanking,
  makeEligibility,
} from "./pipeline-test-helpers";

// ─── evaluateProposal ───────────────────────────────────────

describe("evaluateProposal", () => {
  it("returns carrier with passedAllGates=true when all gates pass", () => {
    const input = makeArbitrationInput();
    const result = evaluateProposal(input);

    expect(result.passedAllGates).toBe(true);
    expect(result.carrier.traces.elimination).toBeUndefined();
    expect(result.carrier.eligibility.hand.satisfied).toBe(true);
    expect(result.carrier.eligibility.encoding.legal).toBe(true);
  });

  it("returns carrier with elimination trace when semantic fails", () => {
    const input = makeArbitrationInput({ allSatisfied: false });
    const result = evaluateProposal(input);

    expect(result.passedAllGates).toBe(false);
    expect(result.carrier.traces.elimination).toBeDefined();
    expect(result.carrier.traces.elimination!.stage).toBe("applicability");
    expect(result.carrier.traces.elimination!.reason).toBe("Your hand doesn't meet one or more requirements");
  });

  it("returns carrier with elimination trace when call is illegal", () => {
    const call = makeCall(2, BidSuit.Clubs);
    const legalCalls = [makeCall(1, BidSuit.Clubs)]; // 2C is not legal
    const input = makeArbitrationInput({ allSatisfied: true }, call);

    const result = evaluateProposal(input, legalCalls);

    expect(result.passedAllGates).toBe(false);
    expect(result.carrier.traces.elimination).toBeDefined();
    expect(result.carrier.traces.elimination!.stage).toBe("legality");
    expect(result.carrier.traces.elimination!.strength).toBe("hard");
    expect(result.carrier.traces.elimination!.reason).toContain("isn't legal");
  });

  it("sets addToAcceptable=true for failed-semantic may-band proposals", () => {
    const input = makeArbitrationInput({
      allSatisfied: false,
      ranking: { ...makeRanking({ recommendationBand: "may" }), specificity: 0 },
    });

    const result = evaluateProposal(input);

    expect(result.addToAcceptable).toBe(true);
    expect(result.passedAllGates).toBe(false);
    expect(result.carrier.traces.elimination).toBeDefined();
  });

  it("sets addToAcceptable=true for failed-semantic should-band proposals", () => {
    const input = makeArbitrationInput({
      allSatisfied: false,
      ranking: { ...makeRanking({ recommendationBand: "should" }), specificity: 0 },
    });

    const result = evaluateProposal(input);

    expect(result.addToAcceptable).toBe(true);
    expect(result.carrier).toBeDefined();
  });

  it("sets addToAcceptable=false for failed-semantic avoid-band proposals", () => {
    const input = makeArbitrationInput({
      allSatisfied: false,
      ranking: { ...makeRanking({ recommendationBand: "avoid" }), specificity: 0 },
    });

    const result = evaluateProposal(input);

    expect(result.addToAcceptable).toBe(false);
    expect(result.passedAllGates).toBe(false);
    expect(result.carrier.traces.elimination).toBeDefined();
  });

  it("populates legality and encoding traces on every carrier", () => {
    const input = makeArbitrationInput();
    const result = evaluateProposal(input);

    expect(result.carrier.traces.legality).toBeDefined();
    expect(result.carrier.traces.legality.legal).toBe(true);
    expect(result.carrier.traces.encoding).toBeDefined();
    expect(result.carrier.traces.encoding.encoderKind).toBe("default-call");
  });

  it("populates blockedCalls with call and reason when encoding is illegal", () => {
    const call = makeCall(3, BidSuit.Hearts);
    const legalCalls = [makeCall(1, BidSuit.Clubs), makePass()];
    const input = makeArbitrationInput({ allSatisfied: true }, call);

    const result = evaluateProposal(input, legalCalls);

    expect(result.carrier.traces.encoding.blockedCalls).toHaveLength(1);
    expect(result.carrier.traces.encoding.blockedCalls[0]).toEqual({
      call,
      reason: "illegal_in_auction",
    });
    expect(result.carrier.traces.encoding.chosenCall).toBeUndefined();
  });

  it("has empty blockedCalls when encoding is legal", () => {
    const call = makeCall(1, BidSuit.Clubs);
    const legalCalls = [call, makePass()];
    const input = makeArbitrationInput({ allSatisfied: true }, call);

    const result = evaluateProposal(input, legalCalls);

    expect(result.carrier.traces.encoding.blockedCalls).toHaveLength(0);
    expect(result.carrier.traces.encoding.chosenCall).toEqual(call);
  });
});

// ─── classifyIntoSets ───────────────────────────────────────

describe("classifyIntoSets", () => {
  function makeCarrier(overrides?: {
    handSatisfied?: boolean;
    legal?: boolean;
    meaningId?: string;
  }): PipelineCarrier {
    const handSatisfied = overrides?.handSatisfied ?? true;
    const legal = overrides?.legal ?? true;
    const call = makeCall(2, BidSuit.Clubs);
    return {
      proposal: makeMeaningProposal({
        meaningId: overrides?.meaningId ?? "test:meaning",
        allSatisfied: handSatisfied,
      }),
      call,
      isDefaultEncoding: true,
      legal,
      allEncodings: [{ call, legal }],
      eligibility: makeEligibility({
        hand: { satisfied: handSatisfied, failedConditions: [] },
        encoding: { legal },
      }),
      traces: {
        encoding: { encoderId: "test", encoderKind: "default-call", consideredCalls: [call], chosenCall: call, blockedCalls: [] },
        legality: { call, legal },
      },
    };
  }

  it("places hand-satisfied + legal carriers in truthSet", () => {
    const carriers = [makeCarrier({ handSatisfied: true, legal: true })];
    const { truthSet, acceptableSet } = classifyIntoSets(carriers);

    expect(truthSet).toHaveLength(1);
    expect(acceptableSet).toHaveLength(0);
  });

  it("places hand-unsatisfied + legal carriers in acceptableSet", () => {
    const carriers = [makeCarrier({ handSatisfied: false, legal: true })];
    const { truthSet, acceptableSet } = classifyIntoSets(carriers);

    expect(truthSet).toHaveLength(0);
    expect(acceptableSet).toHaveLength(1);
  });

  it("places hand-unsatisfied + illegal carriers in neither set", () => {
    const carriers = [makeCarrier({ handSatisfied: false, legal: false })];
    const { truthSet, acceptableSet } = classifyIntoSets(carriers);

    expect(truthSet).toHaveLength(0);
    expect(acceptableSet).toHaveLength(0);
  });

  it("places hand-satisfied + illegal carriers in neither set", () => {
    const carriers = [makeCarrier({ handSatisfied: true, legal: false })];
    const { truthSet, acceptableSet } = classifyIntoSets(carriers);

    expect(truthSet).toHaveLength(0);
    expect(acceptableSet).toHaveLength(0);
  });

  it("correctly classifies a mixed set", () => {
    const carriers = [
      makeCarrier({ handSatisfied: true, legal: true, meaningId: "truth:a" }),
      makeCarrier({ handSatisfied: false, legal: true, meaningId: "acceptable:b" }),
      makeCarrier({ handSatisfied: false, legal: false, meaningId: "neither:c" }),
      makeCarrier({ handSatisfied: true, legal: true, meaningId: "truth:d" }),
    ];
    const { truthSet, acceptableSet } = classifyIntoSets(carriers);

    expect(truthSet).toHaveLength(2);
    expect(acceptableSet).toHaveLength(1);
    expect(truthSet.map((c) => c.proposal.meaningId)).toEqual(["truth:a", "truth:d"]);
    expect(acceptableSet.map((c) => c.proposal.meaningId)).toEqual(["acceptable:b"]);
  });

  it("returns empty sets for empty input", () => {
    const { truthSet, acceptableSet } = classifyIntoSets([]);

    expect(truthSet).toHaveLength(0);
    expect(acceptableSet).toHaveLength(0);
  });
});
