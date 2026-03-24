/**
 * Tests for practical scorer — monotonic contracts, not exact values (except one reference case).
 */
import { describe, test, expect } from "vitest";
import { BidSuit } from "../../engine/types";
import type { Call, ContractBid } from "../../engine/types";
import type { ResolvedCandidateDTO } from "../../conventions/pipeline/tree-evaluation";
import {
  scoreCandidatePractically,
  buildPracticalRecommendation,
  WEIGHTS,
} from "../bidding/practical-scorer";
import type { ScorableCandidate } from "../bidding/practical-types";
import { DistortionType } from "../bidding/pragmatic-generator";
import type { PragmaticCandidate } from "../bidding/pragmatic-generator";

function makeCandidate(overrides: Partial<ResolvedCandidateDTO> & { resolvedCall: Call }): ResolvedCandidateDTO {
  const { resolvedCall, ...rest } = overrides;
  return {
    bidName: "test-bid",
    meaning: "test meaning",
    call: resolvedCall,
    resolvedCall,
    isDefaultCall: true,
    legal: true,
    isMatched: true,
    intentType: "test",
    failedConditions: [],
    ...rest,
  };
}

const suitBid = (level: number, strain: string): ContractBid =>
  ({ type: "bid", level, strain } as ContractBid);

interface MinimalBelief {
  ownHcp: number;
  partnerMinHcp: number;
  ownSuitLength: number;
  partnerMinSuitLength: number;
}

function makeBeliefForScoring(b: MinimalBelief) {
  return {
    ownHcp: b.ownHcp,
    partnerMinHcp: b.partnerMinHcp,
    ownSuitLength: b.ownSuitLength,
    partnerMinSuitLength: b.partnerMinSuitLength,
  };
}

describe("scoreCandidatePractically", () => {
  test("better fit → higher or equal score (all else equal)", () => {
    const candidate = makeCandidate({ resolvedCall: suitBid(2, BidSuit.Hearts), isMatched: true });
    const lowFit = makeBeliefForScoring({ ownHcp: 10, partnerMinHcp: 10, ownSuitLength: 3, partnerMinSuitLength: 2 });
    const highFit = makeBeliefForScoring({ ownHcp: 10, partnerMinHcp: 10, ownSuitLength: 5, partnerMinSuitLength: 4 });

    const lowScore = scoreCandidatePractically(candidate, lowFit);
    const highScore = scoreCandidatePractically(candidate, highFit);

    expect(highScore.practicalScore).toBeGreaterThanOrEqual(lowScore.practicalScore);
  });

  test("higher combined HCP → higher or equal score (all else equal)", () => {
    const candidate = makeCandidate({ resolvedCall: suitBid(2, BidSuit.Hearts), isMatched: true });
    const lowHcp = makeBeliefForScoring({ ownHcp: 8, partnerMinHcp: 8, ownSuitLength: 4, partnerMinSuitLength: 4 });
    const highHcp = makeBeliefForScoring({ ownHcp: 14, partnerMinHcp: 14, ownSuitLength: 4, partnerMinSuitLength: 4 });

    const lowScore = scoreCandidatePractically(candidate, lowHcp);
    const highScore = scoreCandidatePractically(candidate, highHcp);

    expect(highScore.practicalScore).toBeGreaterThanOrEqual(lowScore.practicalScore);
  });

  test("matched candidate outscores preferred (all else equal)", () => {
    const belief = makeBeliefForScoring({ ownHcp: 12, partnerMinHcp: 12, ownSuitLength: 4, partnerMinSuitLength: 4 });
    const matched = makeCandidate({ resolvedCall: suitBid(2, BidSuit.Hearts), isMatched: true });
    const preferred = makeCandidate({ resolvedCall: suitBid(2, BidSuit.Hearts), isMatched: false, priority: "preferred" });

    const matchedScore = scoreCandidatePractically(matched, belief);
    const preferredScore = scoreCandidatePractically(preferred, belief);

    expect(matchedScore.practicalScore).toBeGreaterThan(preferredScore.practicalScore);
  });

  test("preferred outscores alternative (all else equal)", () => {
    const belief = makeBeliefForScoring({ ownHcp: 12, partnerMinHcp: 12, ownSuitLength: 4, partnerMinSuitLength: 4 });
    const preferred = makeCandidate({ resolvedCall: suitBid(2, BidSuit.Hearts), isMatched: false, priority: "preferred" });
    const alternative = makeCandidate({ resolvedCall: suitBid(2, BidSuit.Hearts), isMatched: false, priority: "alternative" });

    const prefScore = scoreCandidatePractically(preferred, belief);
    const altScore = scoreCandidatePractically(alternative, belief);

    expect(prefScore.practicalScore).toBeGreaterThan(altScore.practicalScore);
  });

  test("NT candidate uses HCP only (fitScore = 0)", () => {
    const candidate = makeCandidate({ resolvedCall: suitBid(1, BidSuit.NoTrump), isMatched: true });
    const belief = makeBeliefForScoring({ ownHcp: 15, partnerMinHcp: 8, ownSuitLength: 4, partnerMinSuitLength: 3 });

    const result = scoreCandidatePractically(candidate, belief);

    expect(result.scoreBreakdown.fitScore).toBe(0);
  });

  test("pass candidate scores exactly 0", () => {
    const candidate = makeCandidate({ resolvedCall: { type: "pass" } });
    const belief = makeBeliefForScoring({ ownHcp: 15, partnerMinHcp: 15, ownSuitLength: 5, partnerMinSuitLength: 5 });

    const result = scoreCandidatePractically(candidate, belief);

    expect(result.practicalScore).toBe(0);
  });

  test("higher misunderstandingRisk -> lower score (all else equal)", () => {
    const candidate = makeCandidate({ resolvedCall: suitBid(2, BidSuit.Hearts), isMatched: true });
    const belief = makeBeliefForScoring({ ownHcp: 12, partnerMinHcp: 10, ownSuitLength: 5, partnerMinSuitLength: 3 });

    const lowRisk = scoreCandidatePractically(candidate, belief, 0.1);
    const highRisk = scoreCandidatePractically(candidate, belief, 0.9);

    expect(lowRisk.practicalScore).toBeGreaterThan(highRisk.practicalScore);
    expect(highRisk.scoreBreakdown.misunderstandingRisk).toBe(0.9);
  });

  test("exact score for reference case (locks formula)", () => {
    // 2H bid, matched, own 12 HCP + partner min 10, own 5 hearts + partner min 3
    const candidate = makeCandidate({ resolvedCall: suitBid(2, BidSuit.Hearts), isMatched: true });
    const belief = makeBeliefForScoring({ ownHcp: 12, partnerMinHcp: 10, ownSuitLength: 5, partnerMinSuitLength: 3 });

    const result = scoreCandidatePractically(candidate, belief);

    // fitScore = 5 + 3 = 8
    // hcpScore = (12 + 10) - LEVEL_HCP_TABLE[2] = 22 - 23 = -1
    // conventionDistance = 0 (matched)
    // totalScore = 2.0*8 + 1.5*(-1) + (-4.0)*0 + (-3.0)*0 = 16 - 1.5 = 14.5
    expect(result.scoreBreakdown.fitScore).toBe(8);
    expect(result.scoreBreakdown.hcpScore).toBe(-1);
    expect(result.scoreBreakdown.conventionDistance).toBe(0);
    expect(result.practicalScore).toBe(14.5);
  });
});

describe("scoreCandidatePractically with ScorableCandidate", () => {
  function makePragmatic(overrides: Partial<PragmaticCandidate> & { call: Call }): PragmaticCandidate {
    return {
      distortionType: DistortionType.CompetitiveOvercall,
      rationale: "test rationale",
      legal: true,
      ...overrides,
    };
  }

  test("pragmatic candidate gets convention distance 3", () => {
    const pragmatic: ScorableCandidate = {
      kind: "pragmatic",
      candidate: makePragmatic({ call: suitBid(2, BidSuit.Hearts) }),
    };
    const belief = makeBeliefForScoring({ ownHcp: 12, partnerMinHcp: 10, ownSuitLength: 5, partnerMinSuitLength: 3 });

    const result = scoreCandidatePractically(pragmatic, belief);

    expect(result.scoreBreakdown.conventionDistance).toBe(3);
    expect(result.source).toBe("pragmatic");
  });

  test("pragmatic candidate scores lower than matched normative (same call, same belief)", () => {
    const belief = makeBeliefForScoring({ ownHcp: 12, partnerMinHcp: 10, ownSuitLength: 5, partnerMinSuitLength: 3 });
    const normative = makeCandidate({ resolvedCall: suitBid(2, BidSuit.Hearts), isMatched: true });
    const pragmatic: ScorableCandidate = {
      kind: "pragmatic",
      candidate: makePragmatic({ call: suitBid(2, BidSuit.Hearts) }),
    };

    const normScore = scoreCandidatePractically(normative, belief);
    const pragScore = scoreCandidatePractically(pragmatic, belief);

    // Pragmatic has conventionDistance=3 vs normative matched=0, penalty is -4*3=-12
    expect(normScore.practicalScore).toBeGreaterThan(pragScore.practicalScore);
  });

  test("pragmatic pass/double scores with distance penalty", () => {
    const pragmatic: ScorableCandidate = {
      kind: "pragmatic",
      candidate: makePragmatic({
        call: { type: "double" },
        distortionType: DistortionType.ProtectiveDouble,
      }),
    };
    const belief = makeBeliefForScoring({ ownHcp: 12, partnerMinHcp: 10, ownSuitLength: 0, partnerMinSuitLength: 0 });

    const result = scoreCandidatePractically(pragmatic, belief);

    // Non-bid pragmatic: conventionDistance penalty only
    expect(result.scoreBreakdown.conventionDistance).toBe(3);
    expect(result.practicalScore).toBe(WEIGHTS.conventionDistance * 3);
    expect(result.source).toBe("pragmatic");
  });
});

describe("buildPracticalRecommendation", () => {
  test("returns top candidate fields when candidates present", () => {
    const scored = [{
      candidate: makeCandidate({ resolvedCall: suitBid(2, BidSuit.Clubs), bidName: "stayman-ask", meaning: "Asks for a 4-card major" }),
      practicalScore: 10,
      scoreBreakdown: { fitScore: 0, hcpScore: 5, conventionDistance: 0, misunderstandingRisk: 0, totalScore: 10 },
      source: "normative" as const,
    }];

    const result = buildPracticalRecommendation(scored);

    expect(result).not.toBeNull();
    expect(result!.topCandidateBidName).toBe("stayman-ask");
    expect(result!.topCandidateCall).toEqual(suitBid(2, BidSuit.Clubs));
    expect(result!.topScore).toBe(10);
  });

  test("returns null for empty scored candidates", () => {
    const result = buildPracticalRecommendation([]);
    expect(result).toBeNull();
  });

  test("works with pragmatic scored candidate as top", () => {
    const pragmaticCandidate: PragmaticCandidate = {
      call: suitBid(1, BidSuit.Hearts),
      distortionType: DistortionType.CompetitiveOvercall,
      rationale: "5-card heart suit overcall",
      legal: true,
    };
    const scored = [{
      candidate: pragmaticCandidate,
      practicalScore: 5,
      scoreBreakdown: { fitScore: 8, hcpScore: -1, conventionDistance: 3, misunderstandingRisk: 0, totalScore: 5 },
      source: "pragmatic" as const,
    }];

    const result = buildPracticalRecommendation(scored);

    expect(result).not.toBeNull();
    expect(result!.topCandidateBidName).toBe(DistortionType.CompetitiveOvercall);
    expect(result!.rationale).toBe("5-card heart suit overcall");
  });
});
