// Practical scorer — scores normative and pragmatic candidates by fit, HCP, and convention distance.
// Pure functions. No side effects.

import type { Call } from "../../engine/types";
import { BidSuit } from "../../engine/types";
import type { ResolvedCandidateDTO, PracticalRecommendation, PracticalScoreBreakdown } from "../../core/contracts";
import type { PragmaticCandidate } from "./pragmatic-generator";
import type { ScoredCandidate, ScorableCandidate } from "./practical-types";

export const LEVEL_HCP_TABLE: Record<number, number> = {
  1: 20, 2: 23, 3: 26, 4: 26, 5: 29, 6: 33, 7: 37,
};

export const WEIGHTS = {
  fit: 2.0,
  hcp: 1.5,
  conventionDistance: -4.0,
  misunderstandingRisk: -3.0,
};

export interface ScoringInput {
  readonly ownHcp: number;
  readonly partnerMinHcp: number;
  readonly ownSuitLength: number;
  readonly partnerMinSuitLength: number;
}

/** Score a normative (convention pipeline) candidate. */
export function scoreCandidatePractically(
  candidate: ResolvedCandidateDTO,
  belief: ScoringInput,
  misunderstandingRisk?: number,
): ScoredCandidate;

/** Score a scorable candidate (normative or pragmatic). */
export function scoreCandidatePractically(
  candidate: ScorableCandidate,
  belief: ScoringInput,
  misunderstandingRisk?: number,
): ScoredCandidate;

export function scoreCandidatePractically(
  candidateOrScorable: ResolvedCandidateDTO | ScorableCandidate,
  belief: ScoringInput,
  misunderstandingRisk = 0,
): ScoredCandidate {
  // Normalize to ScorableCandidate
  const scorable = normalizeToScorable(candidateOrScorable);

  if (scorable.kind === "normative") {
    return scoreNormative(scorable.candidate, belief, misunderstandingRisk);
  }
  return scorePragmatic(scorable.candidate, belief);
}

function normalizeToScorable(input: ResolvedCandidateDTO | ScorableCandidate): ScorableCandidate {
  if ("kind" in input) return input;
  return { kind: "normative", candidate: input };
}

function scoreNormative(
  candidate: ResolvedCandidateDTO,
  belief: ScoringInput,
  misunderstandingRisk: number,
): ScoredCandidate {
  const call = candidate.resolvedCall;

  // Pass/double/redouble → score 0
  if (call.type !== "bid") {
    const breakdown: PracticalScoreBreakdown = {
      fitScore: 0, hcpScore: 0, conventionDistance: 0, misunderstandingRisk: 0, totalScore: 0,
    };
    return { candidate, practicalScore: 0, scoreBreakdown: breakdown, source: "normative" };
  }

  const isSuitBid = call.strain !== BidSuit.NoTrump;
  const fitScore = isSuitBid ? (belief.ownSuitLength + belief.partnerMinSuitLength) : 0;
  const hcpScore = (belief.ownHcp + belief.partnerMinHcp) - (LEVEL_HCP_TABLE[call.level] ?? 20);

  const conventionDistance = candidate.isMatched ? 0
    : candidate.priority === "preferred" ? 1
    : 2;

  const totalScore =
    WEIGHTS.fit * fitScore
    + WEIGHTS.hcp * hcpScore
    + WEIGHTS.conventionDistance * conventionDistance
    + WEIGHTS.misunderstandingRisk * misunderstandingRisk;

  const breakdown: PracticalScoreBreakdown = {
    fitScore, hcpScore, conventionDistance, misunderstandingRisk, totalScore,
  };

  return { candidate, practicalScore: totalScore, scoreBreakdown: breakdown, source: "normative" };
}

function scorePragmatic(candidate: PragmaticCandidate, belief: ScoringInput): ScoredCandidate {
  const call = candidate.call;

  // Pass/double/redouble → score 0
  if (call.type !== "bid") {
    const breakdown: PracticalScoreBreakdown = {
      fitScore: 0, hcpScore: 0, conventionDistance: 3, misunderstandingRisk: 0, totalScore: WEIGHTS.conventionDistance * 3,
    };
    return { candidate, practicalScore: WEIGHTS.conventionDistance * 3, scoreBreakdown: breakdown, source: "pragmatic" };
  }

  const bid = call;
  const isSuitBid = bid.strain !== BidSuit.NoTrump;
  const fitScore = isSuitBid ? (belief.ownSuitLength + belief.partnerMinSuitLength) : 0;
  const hcpScore = (belief.ownHcp + belief.partnerMinHcp) - (LEVEL_HCP_TABLE[bid.level] ?? 20);
  const conventionDistance = 3; // highest penalty for pragmatic candidates

  const totalScore =
    WEIGHTS.fit * fitScore
    + WEIGHTS.hcp * hcpScore
    + WEIGHTS.conventionDistance * conventionDistance
    + WEIGHTS.misunderstandingRisk * 0; // no misunderstandingRisk for pragmatic yet

  const breakdown: PracticalScoreBreakdown = {
    fitScore, hcpScore, conventionDistance, misunderstandingRisk: 0, totalScore,
  };

  return { candidate, practicalScore: totalScore, scoreBreakdown: breakdown, source: "pragmatic" };
}

export function buildPracticalRecommendation(
  scored: readonly ScoredCandidate[],
): PracticalRecommendation | null {
  if (scored.length === 0) return null;

  // Sort descending by score (stable — preserves input order on ties)
  const sorted = [...scored].sort((a, b) => b.practicalScore - a.practicalScore);
  const top = sorted[0]!;

  // Extract call and display fields from either candidate type
  const topCall = getCallFromCandidate(top);
  const topBidName = getBidNameFromCandidate(top);
  const topMeaning = getMeaningFromCandidate(top);

  return {
    topCandidateBidName: topBidName,
    topCandidateCall: topCall,
    topScore: top.practicalScore,
    rationale: topMeaning,
    scoreBreakdown: top.scoreBreakdown,
  };
}

function getCallFromCandidate(scored: ScoredCandidate): Call {
  if (scored.source === "normative") {
    return scored.candidate.resolvedCall;
  }
  return scored.candidate.call;
}

function getBidNameFromCandidate(scored: ScoredCandidate): string {
  if (scored.source === "normative") {
    return scored.candidate.bidName;
  }
  return scored.candidate.distortionType;
}

function getMeaningFromCandidate(scored: ScoredCandidate): string {
  if (scored.source === "normative") {
    return scored.candidate.meaning;
  }
  return scored.candidate.rationale;
}
