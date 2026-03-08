// Practical recommender — computes PracticalRecommendation from resolved candidates.
// Fail-closed: errors → undefined, teaching path unaffected.

import type { Call, Suit } from "../../engine/types";
import { BidSuit } from "../../engine/types";
import { partnerSeat, SUIT_ORDER } from "../../engine/constants";
import type { BiddingContext } from "../../conventions/core/types";
import type { ResolvedCandidateDTO, PracticalRecommendation } from "../../core/contracts";
import type { BeliefData } from "../../conventions/core/effective-context";
import type { InferenceProvider } from "../../inference/types";
import { computePartnerInterpretation } from "../../inference/partner-interpretation";
import { scoreCandidatePractically, buildPracticalRecommendation } from "./practical-scorer";
import type { ScoringInput } from "./practical-scorer";
import type { ScorableCandidate } from "./practical-types";
import type { PragmaticCandidate } from "./pragmatic-generator";

/** Map BidSuit to SUIT_ORDER index. */
const BIDSUIT_TO_INDEX: Record<string, number> = {
  [BidSuit.Spades]: 0,
  [BidSuit.Hearts]: 1,
  [BidSuit.Diamonds]: 2,
  [BidSuit.Clubs]: 3,
};

/**
 * Compute a practical recommendation from resolved candidates and optional pragmatic candidates.
 * Returns null when no candidates or no belief data.
 * Fail-closed: any error → null + optional onError callback.
 *
 * When interpretationProvider is present, computes partner interpretation
 * per candidate and passes misunderstandingRisk into the scorer.
 *
 * Pragmatic candidates are scored alongside normative candidates with convention distance = 3.
 * They never appear in the teaching path — only in the practical recommendation.
 */
export function computePracticalRecommendation(
  candidates: readonly ResolvedCandidateDTO[],
  context: BiddingContext,
  publicBelief: BeliefData,
  teachingCall: Call,
  onError?: (error: Error) => void,
  interpretationProvider?: InferenceProvider,
  pragmaticCandidates?: readonly PragmaticCandidate[],
): PracticalRecommendation | null {
  try {
    if (candidates.length === 0 && (!pragmaticCandidates || pragmaticCandidates.length === 0)) return null;

    const partner = partnerSeat(context.seat);
    const partnerBeliefs = publicBelief.beliefs[partner];
    if (!partnerBeliefs) return null;

    const ownHcp = context.evaluation.hcp;
    const partnerMinHcp = partnerBeliefs.hcpRange.min;
    const ownShape = context.evaluation.shape;

    // Score normative candidates
    const scored = candidates
      .filter(c => c.legal && c.failedConditions.length === 0)
      .map(candidate => {
        const belief = buildScoringInput(candidate.resolvedCall, ownHcp, partnerMinHcp, ownShape, partnerBeliefs.suitLengths);
        let misunderstandingRisk = 0;
        if (interpretationProvider) {
          try {
            const interpretation = computePartnerInterpretation(
              candidate.resolvedCall,
              context.auction,
              context.seat,
              { hcp: ownHcp, shape: ownShape },
              interpretationProvider,
            );
            misunderstandingRisk = interpretation.misunderstandingRisk;
          } catch {
            // Fail-open: interpretation errors don't block scoring
            misunderstandingRisk = 0;
          }
        }
        return scoreCandidatePractically(candidate, belief, misunderstandingRisk);
      });

    // Score pragmatic candidates (filtered for legal only)
    if (pragmaticCandidates && pragmaticCandidates.length > 0) {
      for (const pragmatic of pragmaticCandidates) {
        if (!pragmatic.legal) continue;
        const scorable: ScorableCandidate = { kind: "pragmatic", candidate: pragmatic };
        const belief = buildScoringInput(pragmatic.call, ownHcp, partnerMinHcp, ownShape, partnerBeliefs.suitLengths);
        scored.push(scoreCandidatePractically(scorable, belief));
      }
    }

    return buildPracticalRecommendation(scored, teachingCall);
  } catch (e) {
    onError?.(e instanceof Error ? e : new Error(String(e)));
    return null;
  }
}

function buildScoringInput(
  call: Call,
  ownHcp: number,
  partnerMinHcp: number,
  ownShape: readonly number[],
  partnerSuitLengths: Record<Suit, { readonly min: number; readonly max: number }>,
): ScoringInput {
  if (call.type !== "bid" || call.strain === BidSuit.NoTrump) {
    return { ownHcp, partnerMinHcp, ownSuitLength: 0, partnerMinSuitLength: 0 };
  }

  const suitIndex = BIDSUIT_TO_INDEX[call.strain];
  if (suitIndex === undefined) {
    return { ownHcp, partnerMinHcp, ownSuitLength: 0, partnerMinSuitLength: 0 };
  }

  const ownSuitLength = ownShape[suitIndex] ?? 0;
  const suit = SUIT_ORDER[suitIndex]! as Suit;
  const partnerMinSuitLength = partnerSuitLengths[suit]?.min ?? 0;

  return { ownHcp, partnerMinHcp, ownSuitLength, partnerMinSuitLength };
}
