import { describe, expect, test } from "vitest";
import { BidSuit } from "../../engine/types";
import type { BidResult, ResolvedCandidateDTO, AlternativeGroup } from "../../core/contracts";
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

  // ─── Alternative Groups ──────────────────────────────────────

  test("alternative group adds group members as acceptable when matched intent is in group", () => {
    const groups: AlternativeGroup[] = [
      {
        label: "strength raises",
        members: ["game-raise", "limit-raise", "constructive-raise"],
        tier: "alternative",
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
          call: { type: "bid", level: 3, strain: BidSuit.Clubs },
          resolvedCall: { type: "bid", level: 3, strain: BidSuit.Clubs },
          failedConditions: [{ name: "hcp", description: "13+ HCP" }],
        }),
        makeCandidate({
          bidName: "constructive-raise",
          call: { type: "bid", level: 3, strain: BidSuit.Hearts },
          resolvedCall: { type: "bid", level: 3, strain: BidSuit.Hearts },
          failedConditions: [{ name: "hcp", description: "7-10 HCP" }],
        }),
      ]),
      groups,
    );

    expect(result.acceptableBids).toHaveLength(2);
    const names = result.acceptableBids.map(b => b.bidName);
    expect(names).toContain("game-raise");
    expect(names).toContain("constructive-raise");
    expect(result.acceptableBids.every(b => b.tier === "alternative")).toBe(true);
    expect(result.acceptableBids.every(b => !b.fullCredit)).toBe(true);
  });

  test("alternative group with preferred tier gives fullCredit: true", () => {
    const groups: AlternativeGroup[] = [
      {
        label: "raises",
        members: ["game-raise", "limit-raise"],
        tier: "preferred",
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
          call: { type: "bid", level: 3, strain: BidSuit.Clubs },
          resolvedCall: { type: "bid", level: 3, strain: BidSuit.Clubs },
          failedConditions: [{ name: "hcp", description: "13+ HCP" }],
        }),
      ]),
      groups,
    );

    expect(result.acceptableBids).toHaveLength(1);
    expect(result.acceptableBids[0]?.fullCredit).toBe(true);
    expect(result.acceptableBids[0]?.tier).toBe("preferred");
  });

  test("alternative group skips illegal candidates", () => {
    const groups: AlternativeGroup[] = [
      {
        label: "raises",
        members: ["game-raise", "limit-raise"],
        tier: "alternative",
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
          legal: false,
          call: { type: "bid", level: 3, strain: BidSuit.Clubs },
          resolvedCall: { type: "bid", level: 3, strain: BidSuit.Clubs },
        }),
      ]),
      groups,
    );

    expect(result.acceptableBids).toEqual([]);
  });

  test("alternative group respects whenMatched — only activates for specified members", () => {
    const groups: AlternativeGroup[] = [
      {
        label: "raises",
        members: ["game-raise", "limit-raise", "constructive-raise"],
        tier: "alternative",
        whenMatched: ["limit-raise"],
      },
    ];
    // When matched is limit-raise (in whenMatched list): group activates
    const result1 = resolveTeachingAnswer(
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
      groups,
    );
    expect(result1.acceptableBids).toHaveLength(1);
    expect(result1.acceptableBids[0]?.bidName).toBe("game-raise");

    // When matched is game-raise (NOT in whenMatched list): group does NOT activate
    const result2 = resolveTeachingAnswer(
      makeBidResult([
        makeCandidate({
          bidName: "game-raise",
          isMatched: true,
          call: { type: "bid", level: 3, strain: BidSuit.Clubs },
          resolvedCall: { type: "bid", level: 3, strain: BidSuit.Clubs },
        }),
        makeCandidate({
          bidName: "limit-raise",
          call: { type: "bid", level: 3, strain: BidSuit.Diamonds },
          resolvedCall: { type: "bid", level: 3, strain: BidSuit.Diamonds },
          failedConditions: [{ name: "hcp", description: "10-12 HCP" }],
        }),
      ]),
      groups,
    );
    expect(result2.acceptableBids).toEqual([]);
  });

  test("alternative group does not re-add the matched bid", () => {
    const groups: AlternativeGroup[] = [
      {
        label: "raises",
        members: ["game-raise", "limit-raise"],
        tier: "alternative",
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
      ]),
      groups,
    );

    // limit-raise is matched — should not appear as acceptable
    expect(result.acceptableBids).toEqual([]);
  });

  test("deduplicates: priority-filter result kept over group result when both apply", () => {
    const groups: AlternativeGroup[] = [
      {
        label: "raises",
        members: ["game-raise", "limit-raise"],
        tier: "alternative",
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
          call: { type: "bid", level: 3, strain: BidSuit.Clubs },
          resolvedCall: { type: "bid", level: 3, strain: BidSuit.Clubs },
          priority: "preferred",
        }),
      ]),
      groups,
    );

    // game-raise qualifies via BOTH priority filter (preferred) AND group (alternative).
    // Higher-credit version (preferred/fullCredit:true) should win.
    expect(result.acceptableBids).toHaveLength(1);
    expect(result.acceptableBids[0]?.bidName).toBe("game-raise");
    expect(result.acceptableBids[0]?.fullCredit).toBe(true);
    expect(result.acceptableBids[0]?.tier).toBe("preferred");
  });

  test("backward compatible: no groups passed means same behavior as before", () => {
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

    // Without groups, game-raise has failedConditions → filtered out
    expect(result.acceptableBids).toEqual([]);
  });

  test("alternative group skips members not found in candidates", () => {
    const groups: AlternativeGroup[] = [
      {
        label: "raises",
        members: ["game-raise", "limit-raise", "nonexistent-raise"],
        tier: "alternative",
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
          call: { type: "bid", level: 3, strain: BidSuit.Clubs },
          resolvedCall: { type: "bid", level: 3, strain: BidSuit.Clubs },
          failedConditions: [{ name: "hcp", description: "13+ HCP" }],
        }),
      ]),
      groups,
    );

    // nonexistent-raise not in candidates → silently skipped
    // game-raise has failedConditions but is added via group (bypasses tree eligibility)
    expect(result.acceptableBids).toHaveLength(1);
    expect(result.acceptableBids[0]?.bidName).toBe("game-raise");
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
