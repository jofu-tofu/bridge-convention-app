import { callsMatch } from "../engine/call-helpers";
import type { Call } from "../engine/types";
import type { BidResult, ResolvedCandidateDTO, AlternativeGroup, IntentFamily, IntentRelationship } from "../core/contracts";

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
  /** Intent family relationship, if the bid belongs to an IntentFamily. */
  readonly relationship?: IntentRelationship;
}

export interface TeachingResolution {
  readonly primaryBid: Call;
  readonly acceptableBids: readonly AcceptableBid[];
  readonly gradingType: "exact" | "primary_plus_acceptable" | "intent_based";
  readonly ambiguityScore: number;
}

/** Check if a candidate is eligible for teaching.
 *  Uses eligibility model when available, falls back to legacy fields.
 *  Includes pedagogical check — pedagogically unacceptable bids can be selected
 *  by the pipeline but are excluded from acceptable teaching alternatives. */
function isTeachingEligible(c: ResolvedCandidateDTO): boolean {
  if (c.eligibility) {
    return c.eligibility.hand.satisfied
      && c.eligibility.encoding.legal
      && c.eligibility.protocol.satisfied
      && c.eligibility.pedagogical.acceptable;
  }
  return c.legal && c.failedConditions.length === 0;
}

/** Look up the IntentFamily containing a given bidName. */
function findFamilyForBid(bidName: string, families: readonly IntentFamily[]): IntentFamily | undefined {
  return families.find(f => f.members.includes(bidName));
}

export function resolveTeachingAnswer(
  bidResult: BidResult,
  alternativeGroups?: readonly AlternativeGroup[],
  intentFamilies?: readonly IntentFamily[],
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
      };
    });

  // Phase 2: alternative group lookup (bypasses tree path-condition exclusivity)
  const groupBids: AcceptableBid[] = [];
  if (alternativeGroups && alternativeGroups.length > 0) {
    const matchedCandidate = candidates.find(c => c.isMatched);
    if (matchedCandidate) {
      const matchedName = matchedCandidate.bidName;
      for (const group of alternativeGroups) {
        if (!group.members.includes(matchedName)) continue;
        if (group.whenMatched && !group.whenMatched.includes(matchedName)) continue;

        // Look up IntentFamily for relationship-aware credit
        const family = intentFamilies?.length
          ? findFamilyForBid(matchedName, intentFamilies)
          : undefined;

        for (const memberName of group.members) {
          if (memberName === matchedName) continue;
          const memberCandidate = candidates.find(c => c.bidName === memberName);
          if (!memberCandidate) continue;
          if (memberCandidate.isMatched) continue;
          if (!memberCandidate.legal) continue;

          // Credit logic: equivalent_encoding → fullCredit, otherwise group tier
          let fullCredit = group.tier === "preferred";
          if (family && family.members.includes(memberName)) {
            if (family.relationship === "equivalent_encoding") fullCredit = true;
            // mutually_exclusive and policy_alternative: keep group tier
          }

          groupBids.push({
            call: memberCandidate.resolvedCall,
            bidName: memberCandidate.bidName,
            meaning: memberCandidate.meaning,
            reason: `${group.label}: ${memberCandidate.meaning}`,
            fullCredit,
            tier: group.tier,
            relationship: family?.members.includes(memberName) ? family.relationship : undefined,
          });
        }
      }
    }
  }

  // Phase 3: deduplicate — higher-credit version wins
  const acceptableMap = new Map<string, AcceptableBid>();
  for (const bid of priorityBids) {
    acceptableMap.set(bid.bidName, bid);
  }
  for (const bid of groupBids) {
    const existing = acceptableMap.get(bid.bidName);
    if (!existing || (!existing.fullCredit && bid.fullCredit)) {
      acceptableMap.set(bid.bidName, bid);
    }
  }
  const acceptableBids = [...acceptableMap.values()];

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
