import { describe, expect, test } from "vitest";
import { BidSuit } from "../../../engine/types";
import type { BidResult } from "../../../strategy/bidding/bidding-types";
import type { ResolvedCandidateDTO } from "../../pipeline/tree-evaluation";
import type { SurfaceGroup } from "../teaching-types";
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
    resolvedCandidates: candidates,
  };
}

describe("resolveTeachingAnswer", () => {
  test("returns exact grading with empty acceptableBids when candidateSet is undefined", () => {
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

  // ─── Truth-set calls ───────────────────────────────────────

  test("truthSetCalls populated when matched candidates encode a different call than primaryBid", () => {
    const result = resolveTeachingAnswer(
      makeBidResult([
        makeCandidate({
          bidName: "stayman-ask",
          isMatched: true,
          call: { type: "bid", level: 2, strain: BidSuit.Clubs },
          resolvedCall: { type: "bid", level: 2, strain: BidSuit.Clubs },
        }),
        makeCandidate({
          bidName: "alt-meaning",
          isMatched: true,
          legal: true,
          call: { type: "bid", level: 2, strain: BidSuit.Diamonds },
          resolvedCall: { type: "bid", level: 2, strain: BidSuit.Diamonds },
        }),
      ]),
    );

    expect(result.truthSetCalls).toBeDefined();
    expect(result.truthSetCalls!).toHaveLength(1);
    expect(result.truthSetCalls![0]).toEqual({ type: "bid", level: 2, strain: BidSuit.Diamonds });
  });

  test("truthSetCalls undefined when no matched candidates encode a different call", () => {
    const result = resolveTeachingAnswer(
      makeBidResult([
        makeCandidate({
          bidName: "stayman-ask",
          isMatched: true,
          call: { type: "bid", level: 2, strain: BidSuit.Clubs },
          resolvedCall: { type: "bid", level: 2, strain: BidSuit.Clubs },
        }),
      ]),
    );

    expect(result.truthSetCalls).toBeUndefined();
  });

  test("truthSetCalls excludes illegal matched candidates", () => {
    const result = resolveTeachingAnswer(
      makeBidResult([
        makeCandidate({
          bidName: "stayman-ask",
          isMatched: true,
          call: { type: "bid", level: 2, strain: BidSuit.Clubs },
          resolvedCall: { type: "bid", level: 2, strain: BidSuit.Clubs },
        }),
        makeCandidate({
          bidName: "alt-meaning",
          isMatched: true,
          legal: false,
          call: { type: "bid", level: 2, strain: BidSuit.Diamonds },
          resolvedCall: { type: "bid", level: 2, strain: BidSuit.Diamonds },
        }),
      ]),
    );

    expect(result.truthSetCalls).toBeUndefined();
  });

  test("backward compatible: no surfaceGroups passed means same behavior as before", () => {
    const result = resolveTeachingAnswer(
      makeBidResult([
        makeCandidate({
          bidName: "limit-raise",
          isMatched: true,
          call: { type: "bid", level: 3, strain: BidSuit.Diamonds },
          resolvedCall: { type: "bid", level: 3, strain: BidSuit.Diamonds },
        }),
        makeCandidate({
          bidName: "game-raise",
          call: { type: "bid", level: 3, strain: BidSuit.Clubs },
          resolvedCall: { type: "bid", level: 3, strain: BidSuit.Clubs },
          failedConditions: [{ name: "hcp", description: "13+ HCP" }],
        }),
      ]),
    );

    // Without surface groups, game-raise has failedConditions → filtered out
    expect(result.acceptableBids).toEqual([]);
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

describe("5-grade gradeBid", () => {
  test("returns Correct when user picks the recommended (primary) bid", () => {
    const resolution = resolveTeachingAnswer(makeBidResult([]));

    const grade = gradeBid({ type: "bid", level: 2, strain: BidSuit.Clubs }, resolution);
    expect(grade).toBe(BidGrade.Correct);
  });

  test("returns CorrectNotPreferred when user picks a truth-set bid that isn't recommended", () => {
    const resolution = resolveTeachingAnswer(makeBidResult([]));
    // Add truthSetCalls with a non-primary bid
    const resolutionWithTruth: typeof resolution = {
      ...resolution,
      truthSetCalls: [
        { type: "bid", level: 2, strain: BidSuit.Diamonds },
        { type: "bid", level: 2, strain: BidSuit.Hearts },
      ],
    };

    const grade = gradeBid({ type: "bid", level: 2, strain: BidSuit.Diamonds }, resolutionWithTruth);
    expect(grade).toBe(BidGrade.CorrectNotPreferred);
  });

  test("returns Acceptable when user picks an acceptable alternative", () => {
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

  test("returns NearMiss when user picks a bid in nearMissCalls", () => {
    const resolution = resolveTeachingAnswer(makeBidResult([]));
    const resolutionWithNearMiss: typeof resolution = {
      ...resolution,
      nearMissCalls: [
        {
          call: { type: "bid", level: 3, strain: BidSuit.Hearts },
          reason: "Right suit but wrong level — your hand is too weak for a jump",
        },
      ],
    };

    const grade = gradeBid({ type: "bid", level: 3, strain: BidSuit.Hearts }, resolutionWithNearMiss);
    expect(grade).toBe(BidGrade.NearMiss);
  });

  test("returns Incorrect for a completely wrong bid", () => {
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

    const grade = gradeBid({ type: "bid", level: 4, strain: BidSuit.Spades }, resolution);
    expect(grade).toBe(BidGrade.Incorrect);
  });

  test("backward compat: without truthSetCalls/nearMissCalls, non-primary non-acceptable bids grade as Incorrect", () => {
    const resolution = resolveTeachingAnswer(makeBidResult([]));
    // No truthSetCalls, no nearMissCalls — pure 3-grade behavior
    expect(resolution.truthSetCalls).toBeUndefined();
    expect(resolution.nearMissCalls).toBeUndefined();

    const grade = gradeBid({ type: "bid", level: 3, strain: BidSuit.Hearts }, resolution);
    expect(grade).toBe(BidGrade.Incorrect);
  });

  test("primary bid still returns Correct even when truthSetCalls is populated", () => {
    const resolution = resolveTeachingAnswer(makeBidResult([]));
    const resolutionWithTruth: typeof resolution = {
      ...resolution,
      truthSetCalls: [
        { type: "bid", level: 2, strain: BidSuit.Diamonds },
      ],
    };

    // The primary bid (2C) should still be Correct, not CorrectNotPreferred
    const grade = gradeBid({ type: "bid", level: 2, strain: BidSuit.Clubs }, resolutionWithTruth);
    expect(grade).toBe(BidGrade.Correct);
  });

  test("truth set takes priority over acceptable for grading", () => {
    // A bid that is in BOTH truthSetCalls and acceptableBids → CorrectNotPreferred (higher grade)
    const resolution = resolveTeachingAnswer(
      makeBidResult([
        makeCandidate({
          bidName: "alt-bid",
          call: { type: "bid", level: 2, strain: BidSuit.Diamonds },
          resolvedCall: { type: "bid", level: 2, strain: BidSuit.Diamonds },
          priority: "preferred",
        }),
      ]),
    );
    const resolutionWithTruth: typeof resolution = {
      ...resolution,
      truthSetCalls: [
        { type: "bid", level: 2, strain: BidSuit.Diamonds },
      ],
    };

    const grade = gradeBid({ type: "bid", level: 2, strain: BidSuit.Diamonds }, resolutionWithTruth);
    expect(grade).toBe(BidGrade.CorrectNotPreferred);
  });

  test("acceptable takes priority over near-miss for grading", () => {
    // A bid that is in BOTH acceptableBids and nearMissCalls → Acceptable (higher grade)
    const resolution = resolveTeachingAnswer(
      makeBidResult([
        makeCandidate({
          bidName: "alt-bid",
          call: { type: "bid", level: 2, strain: BidSuit.Hearts },
          resolvedCall: { type: "bid", level: 2, strain: BidSuit.Hearts },
          priority: "preferred",
        }),
      ]),
    );
    const resolutionWithNearMiss: typeof resolution = {
      ...resolution,
      nearMissCalls: [
        {
          call: { type: "bid", level: 2, strain: BidSuit.Hearts },
          reason: "Right idea, wrong context",
        },
      ],
    };

    const grade = gradeBid({ type: "bid", level: 2, strain: BidSuit.Hearts }, resolutionWithNearMiss);
    expect(grade).toBe(BidGrade.Acceptable);
  });
});

describe("resolveTeachingAnswer near-miss population", () => {
  test("populates nearMissCalls from candidates sharing surface group with matched bid that have failedConditions", () => {
    const families: SurfaceGroup[] = [
      {
        id: "raise-family",
        label: "Raises",
        members: ["limit-raise", "game-raise"],
        relationship: "mutually_exclusive",
        description: "Different raise strengths",
      },
    ];
    const result = resolveTeachingAnswer(
      makeBidResult([
        makeCandidate({
          bidName: "limit-raise",
          isMatched: true,
          call: { type: "bid", level: 3, strain: BidSuit.Diamonds },
          resolvedCall: { type: "bid", level: 3, strain: BidSuit.Diamonds },
        }),
        makeCandidate({
          bidName: "game-raise",
          call: { type: "bid", level: 4, strain: BidSuit.Diamonds },
          resolvedCall: { type: "bid", level: 4, strain: BidSuit.Diamonds },
          failedConditions: [{ name: "hcp", description: "13+ HCP required" }],
        }),
      ]),
      families,
    );

    expect(result.nearMissCalls).toBeDefined();
    expect(result.nearMissCalls!.length).toBe(1);
    expect(result.nearMissCalls![0]!.call).toEqual({ type: "bid", level: 4, strain: BidSuit.Diamonds });
    expect(result.nearMissCalls![0]!.reason).toContain("13+ HCP required");
  });

  test("does not populate nearMissCalls when no surface groups provided", () => {
    const result = resolveTeachingAnswer(
      makeBidResult([
        makeCandidate({
          bidName: "limit-raise",
          isMatched: true,
          call: { type: "bid", level: 3, strain: BidSuit.Diamonds },
          resolvedCall: { type: "bid", level: 3, strain: BidSuit.Diamonds },
        }),
        makeCandidate({
          bidName: "game-raise",
          call: { type: "bid", level: 4, strain: BidSuit.Diamonds },
          resolvedCall: { type: "bid", level: 4, strain: BidSuit.Diamonds },
          failedConditions: [{ name: "hcp", description: "13+ HCP required" }],
        }),
      ]),
    );

    expect(result.nearMissCalls).toBeUndefined();
  });

  test("does not include candidates that passed all conditions (already eligible) as near-miss", () => {
    const families: SurfaceGroup[] = [
      {
        id: "raise-family",
        label: "Raises",
        members: ["limit-raise", "game-raise"],
        relationship: "mutually_exclusive",
        description: "Different raise strengths",
      },
    ];
    const result = resolveTeachingAnswer(
      makeBidResult([
        makeCandidate({
          bidName: "limit-raise",
          isMatched: true,
          call: { type: "bid", level: 3, strain: BidSuit.Diamonds },
          resolvedCall: { type: "bid", level: 3, strain: BidSuit.Diamonds },
        }),
        makeCandidate({
          bidName: "game-raise",
          call: { type: "bid", level: 4, strain: BidSuit.Diamonds },
          resolvedCall: { type: "bid", level: 4, strain: BidSuit.Diamonds },
          failedConditions: [], // No failed conditions — not a near-miss
          priority: "preferred",
        }),
      ]),
      families,
    );

    // game-raise has no failedConditions — it should NOT be a near miss
    // (it's already picked up as an acceptable bid via priority)
    expect(result.nearMissCalls ?? []).toHaveLength(0);
  });
});
