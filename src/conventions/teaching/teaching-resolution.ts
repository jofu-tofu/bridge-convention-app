import { callsMatch } from "../../engine/call-helpers";
import type { Call } from "../../engine/types";
import type { BidResult } from "../../strategy/bidding/bidding-types";
import type { ResolvedCandidateDTO } from "../pipeline/tree-evaluation";
import type { SurfaceGroup } from "./teaching-types";
import { BidGrade } from "./teaching-types";
import type { AcceptableBid, TeachingResolution } from "./teaching-types";

// Re-export contract types so existing importers continue to work
export { BidGrade };
export type { AcceptableBid, TeachingResolution };

/** Check if a candidate is eligible for teaching.
 *  Uses eligibility model when available, falls back to legacy fields.
 *  Includes pedagogical check — pedagogically unacceptable bids can be selected
 *  by the pipeline but are excluded from acceptable teaching alternatives. */
function isTeachingEligible(c: ResolvedCandidateDTO): boolean {
  if (c.eligibility) {
    return c.eligibility.hand.satisfied
      && c.eligibility.encoding.legal
      && c.eligibility.pedagogical.acceptable;
  }
  return c.legal && c.failedConditions.length === 0;
}

/** Look up the SurfaceGroup containing a given bidName. */
function findGroupForBid(bidName: string, families: readonly SurfaceGroup[]): SurfaceGroup | undefined {
  return families.find(f => f.members.includes(bidName));
}

export function resolveTeachingAnswer(
  bidResult: BidResult,
  surfaceGroups?: readonly SurfaceGroup[],
): TeachingResolution {
  const primaryBid = bidResult.call;
  const candidates = bidResult.resolvedCandidates ?? [];

  if (candidates.length === 0) {
    return {
      primaryBid,
      acceptableBids: [],
      gradingType: "exact",
      ambiguityScore: 0,
    };
  }

  // Truth-set calls: candidates that satisfy hand constraints and are legal,
  // but encode a different call than the primary recommendation.
  const truthSetCalls: Call[] = candidates
    .filter(c => c.isMatched && c.legal && !callsMatch(c.resolvedCall, primaryBid))
    .map(c => c.resolvedCall);

  // Phase 1: existing priority-based filter
  const priorityBids: AcceptableBid[] = candidates
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
        moduleId: candidate.moduleId,
      };
    });

  // Phase 2: deduplicate priority bids
  const acceptableMap = new Map<string, AcceptableBid>();
  for (const bid of priorityBids) {
    const existing = acceptableMap.get(bid.bidName);
    if (!existing || (!existing.fullCredit && bid.fullCredit)) {
      acceptableMap.set(bid.bidName, bid);
    }
  }
  const acceptableBids = [...acceptableMap.values()];

  // Phase 3: near-miss detection — candidates sharing a surface group with
  // the matched bid that have failedConditions (they qualified for a related
  // meaning but not the exact one)
  let nearMissCalls: { call: Call; reason: string }[] | undefined;
  if (surfaceGroups && surfaceGroups.length > 0) {
    const matchedCandidate2 = candidates.find(c => c.isMatched);
    if (matchedCandidate2) {
      const matchedFamily = findGroupForBid(matchedCandidate2.bidName, surfaceGroups);
      if (matchedFamily) {
        const nearMisses: { call: Call; reason: string }[] = [];
        for (const c of candidates) {
          if (c.isMatched) continue;
          if (c.failedConditions.length === 0) continue;
          if (!matchedFamily.members.includes(c.bidName)) continue;
          // Already in acceptableBids — skip
          if (acceptableMap.has(c.bidName)) continue;
          nearMisses.push({
            call: c.resolvedCall,
            reason: c.failedConditions.map(fc => fc.description).join("; "),
          });
        }
        if (nearMisses.length > 0) {
          nearMissCalls = nearMisses;
        }
      }
    }
  }

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
    truthSetCalls: truthSetCalls.length > 0 ? truthSetCalls : undefined,
    acceptableBids,
    gradingType,
    ambiguityScore,
    nearMissCalls,
  };
}

export function gradeBid(userCall: Call, resolution: TeachingResolution): BidGrade {
  if (callsMatch(userCall, resolution.primaryBid)) {
    return BidGrade.Correct;
  }
  if (resolution.truthSetCalls?.some(call => callsMatch(userCall, call))) {
    return BidGrade.CorrectNotPreferred;
  }
  if (resolution.acceptableBids.some(bid => callsMatch(userCall, bid.call))) {
    return BidGrade.Acceptable;
  }
  if (resolution.nearMissCalls?.some(entry => callsMatch(userCall, entry.call))) {
    return BidGrade.NearMiss;
  }
  return BidGrade.Incorrect;
}
