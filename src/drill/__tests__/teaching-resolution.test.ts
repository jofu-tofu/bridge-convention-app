import { describe, expect, test } from "vitest";
import { BidSuit } from "../../engine/types";
import type { BidResult, ResolvedCandidateDTO } from "../../shared/types";
import { BidGrade, gradeBid, resolveTeachingAnswer } from "../teaching-resolution";

function makeCandidate(overrides: Partial<ResolvedCandidateDTO> = {}): ResolvedCandidateDTO {
  return {
    bidName: "stayman-ask",
    meaning: "Asks for a major",
    call: { type: "bid", level: 2, strain: BidSuit.Clubs },
    resolvedCall: { type: "bid", level: 2, strain: BidSuit.Clubs },
    isDefaultCall: true,
    legal: true,
    isMatched: false,
    priority: "preferred",
    intentType: "AskForMajor",
    failedConditions: [],
    ...overrides,
  };
}

function makeBidResult(candidates?: readonly ResolvedCandidateDTO[]): BidResult {
  return {
    call: { type: "bid", level: 2, strain: BidSuit.Clubs },
    ruleName: "stayman-ask",
    explanation: "Stayman ask",
    treePath: candidates === undefined
      ? undefined
      : {
          matchedNodeName: "stayman-ask",
          path: [],
          visited: [],
          resolvedCandidates: candidates,
        },
  };
}

describe("resolveTeachingAnswer", () => {
  test("returns exact grading with empty acceptableBids when treePath is undefined", () => {
    const result = resolveTeachingAnswer(makeBidResult(undefined));

    expect(result.gradingType).toBe("exact");
    expect(result.acceptableBids).toEqual([]);
    expect(result.ambiguityScore).toBe(0);
  });

  test("returns exact grading with empty acceptableBids when resolvedCandidates is empty", () => {
    const result = resolveTeachingAnswer(makeBidResult([]));

    expect(result.gradingType).toBe("exact");
    expect(result.acceptableBids).toEqual([]);
    expect(result.ambiguityScore).toBe(0);
  });

  test("returns exact grading when only matched candidate exists", () => {
    const result = resolveTeachingAnswer(
      makeBidResult([
        makeCandidate({ isMatched: true, isDefaultCall: true }),
      ]),
    );

    expect(result.gradingType).toBe("exact");
    expect(result.acceptableBids).toEqual([]);
  });

  test("includes preferred candidates as acceptable with fullCredit: true", () => {
    const result = resolveTeachingAnswer(
      makeBidResult([
        makeCandidate({
          bidName: "stayman-2h",
          meaning: "Natural 2H",
          call: { type: "bid", level: 2, strain: BidSuit.Hearts },
          resolvedCall: { type: "bid", level: 2, strain: BidSuit.Hearts },
          priority: "preferred",
        }),
      ]),
    );

    expect(result.acceptableBids).toHaveLength(1);
    expect(result.acceptableBids[0]?.fullCredit).toBe(true);
    expect(result.acceptableBids[0]?.tier).toBe("preferred");
    expect(result.gradingType).toBe("primary_plus_acceptable");
  });

  test("includes alternative candidates as acceptable with fullCredit: false", () => {
    const result = resolveTeachingAnswer(
      makeBidResult([
        makeCandidate({
          bidName: "stayman-2d",
          meaning: "Escape",
          call: { type: "bid", level: 2, strain: BidSuit.Diamonds },
          resolvedCall: { type: "bid", level: 2, strain: BidSuit.Diamonds },
          priority: "alternative",
        }),
      ]),
    );

    expect(result.acceptableBids).toHaveLength(1);
    expect(result.acceptableBids[0]?.fullCredit).toBe(false);
    expect(result.acceptableBids[0]?.tier).toBe("alternative");
    expect(result.gradingType).toBe("primary_plus_acceptable");
  });

  test("excludes illegal candidates from acceptable", () => {
    const result = resolveTeachingAnswer(
      makeBidResult([
        makeCandidate({ legal: false, priority: "preferred" }),
      ]),
    );

    expect(result.acceptableBids).toEqual([]);
  });

  test("excludes candidates with non-empty failedConditions from acceptable", () => {
    const result = resolveTeachingAnswer(
      makeBidResult([
        makeCandidate({
          failedConditions: [{ name: "hcp", description: "Not enough HCP" }],
          priority: "preferred",
        }),
      ]),
    );

    expect(result.acceptableBids).toEqual([]);
  });

  test("excludes candidates with no priority field from acceptable", () => {
    const result = resolveTeachingAnswer(
      makeBidResult([
        makeCandidate({ priority: undefined }),
      ]),
    );

    expect(result.acceptableBids).toEqual([]);
  });

  test("detects intent_based grading when matched isDefaultCall: false", () => {
    const result = resolveTeachingAnswer(
      makeBidResult([
        makeCandidate({ isMatched: true, isDefaultCall: false }),
      ]),
    );

    expect(result.gradingType).toBe("intent_based");
  });

  test("ambiguityScore 0 when no alternatives, 0.6 with one preferred, 0.8 with two preferred", () => {
    const none = resolveTeachingAnswer(makeBidResult([]));
    const onePreferred = resolveTeachingAnswer(
      makeBidResult([
        makeCandidate({
          bidName: "one",
          call: { type: "bid", level: 2, strain: BidSuit.Hearts },
          resolvedCall: { type: "bid", level: 2, strain: BidSuit.Hearts },
          priority: "preferred",
        }),
      ]),
    );
    const twoPreferred = resolveTeachingAnswer(
      makeBidResult([
        makeCandidate({
          bidName: "one",
          call: { type: "bid", level: 2, strain: BidSuit.Hearts },
          resolvedCall: { type: "bid", level: 2, strain: BidSuit.Hearts },
          priority: "preferred",
        }),
        makeCandidate({
          bidName: "two",
          call: { type: "bid", level: 2, strain: BidSuit.Diamonds },
          resolvedCall: { type: "bid", level: 2, strain: BidSuit.Diamonds },
          priority: "preferred",
        }),
      ]),
    );

    expect(none.ambiguityScore).toBe(0);
    expect(onePreferred.ambiguityScore).toBe(0.6);
    expect(twoPreferred.ambiguityScore).toBe(0.8);
  });
});

describe("gradeBid", () => {
  test("returns Correct for primary match", () => {
    const resolution = resolveTeachingAnswer(makeBidResult([]));

    const grade = gradeBid({ type: "bid", level: 2, strain: BidSuit.Clubs }, resolution);
    expect(grade).toBe(BidGrade.Correct);
  });

  test("returns Acceptable for preferred alternative", () => {
    const resolution = resolveTeachingAnswer(
      makeBidResult([
        makeCandidate({
          bidName: "stayman-2h",
          call: { type: "bid", level: 2, strain: BidSuit.Hearts },
          resolvedCall: { type: "bid", level: 2, strain: BidSuit.Hearts },
          priority: "preferred",
        }),
      ]),
    );

    const grade = gradeBid({ type: "bid", level: 2, strain: BidSuit.Hearts }, resolution);
    expect(grade).toBe(BidGrade.Acceptable);
  });

  test("returns Acceptable for alternative-tier bid", () => {
    const resolution = resolveTeachingAnswer(
      makeBidResult([
        makeCandidate({
          bidName: "stayman-2d",
          call: { type: "bid", level: 2, strain: BidSuit.Diamonds },
          resolvedCall: { type: "bid", level: 2, strain: BidSuit.Diamonds },
          priority: "alternative",
        }),
      ]),
    );

    const grade = gradeBid({ type: "bid", level: 2, strain: BidSuit.Diamonds }, resolution);
    expect(grade).toBe(BidGrade.Acceptable);
  });

  test("returns Incorrect for unrelated bid", () => {
    const resolution = resolveTeachingAnswer(
      makeBidResult([
        makeCandidate({
          bidName: "stayman-2h",
          call: { type: "bid", level: 2, strain: BidSuit.Hearts },
          resolvedCall: { type: "bid", level: 2, strain: BidSuit.Hearts },
          priority: "preferred",
        }),
      ]),
    );

    const grade = gradeBid({ type: "bid", level: 3, strain: BidSuit.Clubs }, resolution);
    expect(grade).toBe(BidGrade.Incorrect);
  });
});
