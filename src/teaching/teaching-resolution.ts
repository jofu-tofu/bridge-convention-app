import { callsMatch } from "../engine/call-helpers";
import type { Call } from "../engine/types";
import type { BidResult, ResolvedCandidateDTO } from "../core/contracts";

export enum BidGrade {
  Correct = "correct",
  Acceptable = "acceptable",
  Incorrect = "incorrect",
}

export interface AcceptableBid {
  readonly call: Call;
  readonly bidName: string;
  readonly meaning: string;
  readonly reason: string;
  readonly fullCredit: boolean;
  readonly tier: "preferred" | "alternative";
}

export interface TeachingResolution {
  readonly primaryBid: Call;
  readonly acceptableBids: readonly AcceptableBid[];
  readonly gradingType: "exact" | "primary_plus_acceptable" | "intent_based";
  readonly ambiguityScore: number;
}

/** Check if a candidate is eligible for teaching.
 *  Uses eligibility model when available, falls back to legacy fields. */
function isTeachingEligible(c: ResolvedCandidateDTO): boolean {
  if (c.eligibility) {
    return c.eligibility.hand.satisfied
      && c.eligibility.encoding.legal
      && c.eligibility.protocol.satisfied
      && c.eligibility.pedagogical.acceptable;
  }
  return c.legal && c.failedConditions.length === 0;
}

export function resolveTeachingAnswer(bidResult: BidResult): TeachingResolution {
  const primaryBid = bidResult.call;
  const candidates = bidResult.treePath?.resolvedCandidates ?? [];

  if (candidates.length === 0) {
    return {
      primaryBid,
      acceptableBids: [],
      gradingType: "exact",
      ambiguityScore: 0,
    };
  }

  const acceptableBids: AcceptableBid[] = candidates
    .filter(candidate =>
      !candidate.isMatched
      && isTeachingEligible(candidate)
      && (candidate.priority === "preferred" || candidate.priority === "alternative"),
    )
    .map((candidate) => {
      const tier = candidate.priority as "preferred" | "alternative";
      return {
        call: candidate.resolvedCall,
        bidName: candidate.bidName,
        meaning: candidate.meaning,
        reason: `${tier} alternative: ${candidate.meaning}`,
        fullCredit: tier === "preferred",
        tier,
      };
    });

  const matchedCandidate = candidates.find(candidate => candidate.isMatched);
  const preferredCount = acceptableBids.filter(candidate => candidate.tier === "preferred").length;

  const gradingType = matchedCandidate && !matchedCandidate.isDefaultCall
    ? "intent_based"
    : acceptableBids.length > 0
      ? "primary_plus_acceptable"
      : "exact";

  const ambiguityScore = acceptableBids.length === 0
    ? 0
    : preferredCount >= 2
      ? 0.8
      : preferredCount >= 1
        ? 0.6
        : 0.3;

  return {
    primaryBid,
    acceptableBids,
    gradingType,
    ambiguityScore,
  };
}

export function gradeBid(userCall: Call, resolution: TeachingResolution): BidGrade {
  if (callsMatch(userCall, resolution.primaryBid)) {
    return BidGrade.Correct;
  }
  if (resolution.acceptableBids.some(bid => callsMatch(userCall, bid.call))) {
    return BidGrade.Acceptable;
  }
  return BidGrade.Incorrect;
}
