import { describe, it, expect } from "vitest";
import {
  evaluateProposal,
  classifyIntoSets,
} from "../arbitration-helpers";
import type { EncodedProposal } from "../../../../core/contracts/module-surface";
import { BidSuit } from "../../../../engine/types";
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
  it("returns encoded proposal with no elimination when all gates pass", () => {
    const input = makeArbitrationInput();
    const result = evaluateProposal(input);

    expect(result.encoded).toBeDefined();
    expect(result.elimination).toBeUndefined();
    expect(result.provenanceElimination).toBeUndefined();
    expect(result.addToEncoded).toBe(true);
    expect(result.encoded!.eligibility.hand.satisfied).toBe(true);
    expect(result.encoded!.eligibility.encoding.legal).toBe(true);
  });

  it("returns elimination with semantic-applicability gate when semantic fails", () => {
    const input = makeArbitrationInput({ allSatisfied: false });
    const result = evaluateProposal(input);

    expect(result.elimination).toBeDefined();
    expect(result.elimination!.gateId).toBe("semantic-applicability");
    expect(result.elimination!.reason).toBe("One or more clauses not satisfied");
    expect(result.provenanceElimination).toBeDefined();
    expect(result.provenanceElimination!.stage).toBe("applicability");
  });

  it("returns elimination with concrete-legality gate when call is illegal", () => {
    const call = makeCall(2, BidSuit.Clubs);
    const legalCalls = [makeCall(1, BidSuit.Clubs)]; // 2C is not legal
    const input = makeArbitrationInput({ allSatisfied: true }, call);

    const result = evaluateProposal(input, legalCalls);

    expect(result.elimination).toBeDefined();
    expect(result.elimination!.gateId).toBe("concrete-legality");
    expect(result.elimination!.reason).toContain("not legal");
    expect(result.provenanceElimination).toBeDefined();
    expect(result.provenanceElimination!.stage).toBe("legality");
    expect(result.provenanceElimination!.strength).toBe("hard");
  });

  it("sets addToEncoded=true for failed-semantic may-band proposals", () => {
    const input = makeArbitrationInput({
      allSatisfied: false,
      ranking: makeRanking({ recommendationBand: "may" }),
    });

    const result = evaluateProposal(input);

    expect(result.addToEncoded).toBe(true);
    expect(result.encoded).toBeDefined();
    expect(result.elimination).toBeDefined();
  });

  it("sets addToEncoded=true for failed-semantic should-band proposals", () => {
    const input = makeArbitrationInput({
      allSatisfied: false,
      ranking: makeRanking({ recommendationBand: "should" }),
    });

    const result = evaluateProposal(input);

    expect(result.addToEncoded).toBe(true);
    expect(result.encoded).toBeDefined();
  });

  it("sets addToEncoded=false for failed-semantic avoid-band proposals", () => {
    const input = makeArbitrationInput({
      allSatisfied: false,
      ranking: makeRanking({ recommendationBand: "avoid" }),
    });

    const result = evaluateProposal(input);

    expect(result.addToEncoded).toBe(false);
    expect(result.encoded).toBeUndefined();
    expect(result.elimination).toBeDefined();
  });

  it("populates legality and encoding traces for every proposal", () => {
    const input = makeArbitrationInput();
    const result = evaluateProposal(input);

    expect(result.provenanceLegality).toBeDefined();
    expect(result.provenanceLegality.legal).toBe(true);
    expect(result.provenanceEncoding).toBeDefined();
    expect(result.provenanceEncoding.encoderKind).toBe("default-call");
  });

  it("populates blockedCalls with call and reason when encoding is illegal", () => {
    const call = makeCall(3, BidSuit.Hearts);
    const legalCalls = [makeCall(1, BidSuit.Clubs), makePass()];
    const input = makeArbitrationInput({ allSatisfied: true }, call);

    const result = evaluateProposal(input, legalCalls);

    expect(result.provenanceEncoding.blockedCalls).toHaveLength(1);
    expect(result.provenanceEncoding.blockedCalls[0]).toEqual({
      call,
      reason: "illegal_in_auction",
    });
    expect(result.provenanceEncoding.chosenCall).toBeUndefined();
  });

  it("has empty blockedCalls when encoding is legal", () => {
    const call = makeCall(1, BidSuit.Clubs);
    const legalCalls = [call, makePass()];
    const input = makeArbitrationInput({ allSatisfied: true }, call);

    const result = evaluateProposal(input, legalCalls);

    expect(result.provenanceEncoding.blockedCalls).toHaveLength(0);
    expect(result.provenanceEncoding.chosenCall).toEqual(call);
  });
});

// ─── classifyIntoSets ───────────────────────────────────────

describe("classifyIntoSets", () => {
  function makeEncodedProposal(overrides?: {
    handSatisfied?: boolean;
    legal?: boolean;
    meaningId?: string;
  }): EncodedProposal {
    const handSatisfied = overrides?.handSatisfied ?? true;
    const legal = overrides?.legal ?? true;
    return {
      proposal: makeMeaningProposal({
        meaningId: overrides?.meaningId ?? "test:meaning",
        allSatisfied: handSatisfied,
      }),
      call: makeCall(2, BidSuit.Clubs),
      isDefaultEncoding: true,
      legal,
      allEncodings: [{ call: makeCall(2, BidSuit.Clubs), legal }],
      eligibility: makeEligibility({
        hand: { satisfied: handSatisfied, failedConditions: [] },
        encoding: { legal },
      }),
    };
  }

  it("places hand-satisfied + legal proposals in truthSet", () => {
    const encoded = [makeEncodedProposal({ handSatisfied: true, legal: true })];
    const { truthSet, acceptableSet } = classifyIntoSets(encoded);

    expect(truthSet).toHaveLength(1);
    expect(acceptableSet).toHaveLength(0);
  });

  it("places hand-unsatisfied + legal proposals in acceptableSet", () => {
    const encoded = [makeEncodedProposal({ handSatisfied: false, legal: true })];
    const { truthSet, acceptableSet } = classifyIntoSets(encoded);

    expect(truthSet).toHaveLength(0);
    expect(acceptableSet).toHaveLength(1);
  });

  it("places hand-unsatisfied + illegal proposals in neither set", () => {
    const encoded = [makeEncodedProposal({ handSatisfied: false, legal: false })];
    const { truthSet, acceptableSet } = classifyIntoSets(encoded);

    expect(truthSet).toHaveLength(0);
    expect(acceptableSet).toHaveLength(0);
  });

  it("places hand-satisfied + illegal proposals in neither set", () => {
    const encoded = [makeEncodedProposal({ handSatisfied: true, legal: false })];
    const { truthSet, acceptableSet } = classifyIntoSets(encoded);

    expect(truthSet).toHaveLength(0);
    expect(acceptableSet).toHaveLength(0);
  });

  it("correctly classifies a mixed set", () => {
    const encoded = [
      makeEncodedProposal({ handSatisfied: true, legal: true, meaningId: "truth:a" }),
      makeEncodedProposal({ handSatisfied: false, legal: true, meaningId: "acceptable:b" }),
      makeEncodedProposal({ handSatisfied: false, legal: false, meaningId: "neither:c" }),
      makeEncodedProposal({ handSatisfied: true, legal: true, meaningId: "truth:d" }),
    ];
    const { truthSet, acceptableSet } = classifyIntoSets(encoded);

    expect(truthSet).toHaveLength(2);
    expect(acceptableSet).toHaveLength(1);
    expect(truthSet.map((e) => e.proposal.meaningId)).toEqual(["truth:a", "truth:d"]);
    expect(acceptableSet.map((e) => e.proposal.meaningId)).toEqual(["acceptable:b"]);
  });

  it("returns empty sets for empty input", () => {
    const { truthSet, acceptableSet } = classifyIntoSets([]);

    expect(truthSet).toHaveLength(0);
    expect(acceptableSet).toHaveLength(0);
  });
});
