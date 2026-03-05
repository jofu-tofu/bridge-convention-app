// Fit-confidence ranker — scores candidates by fit with partner's inferred suit length.
// score = own suit length + partner min suit length (fit floor).
// When publicBelief is undefined, returns candidates unchanged (no-op).

import type { ResolvedCandidate } from "../../conventions/core/candidate-generator";
import type { EffectiveConventionContext } from "../../conventions/core/effective-context";
import type { Suit } from "../../engine/types";
import { BidSuit } from "../../engine/types";
import { partnerSeat } from "../../engine/constants";
import { SUIT_ORDER } from "../../engine/constants";

/** Map from BidSuit to SUIT_ORDER index. NoTrump maps to -1 (no suit fit). */
const BIDSUIT_TO_SUIT_INDEX: Record<string, number> = {
  [BidSuit.Spades]: 0,
  [BidSuit.Hearts]: 1,
  [BidSuit.Diamonds]: 2,
  [BidSuit.Clubs]: 3,
};

/**
 * Creates a ranker that scores candidates by fit with partner's inferred suit length.
 * Matches the `rankCandidates` signature on `ConventionConfig`:
 * `(candidates, context) => candidates`.
 *
 * NT candidates get score 0 (no suit fit to evaluate).
 * Pass/double/redouble candidates get score 0.
 * When publicBelief is absent, returns candidates unchanged.
 */
export function createFitConfidenceRanker(): (
  candidates: readonly ResolvedCandidate[],
  ctx: EffectiveConventionContext,
) => readonly ResolvedCandidate[] {
  return (candidates, ctx) => {
    if (!ctx.publicBelief) return candidates;

    const partner = partnerSeat(ctx.raw.seat);
    const partnerBeliefs = ctx.publicBelief.beliefs[partner];
    if (!partnerBeliefs) return candidates;

    const ownShape = ctx.raw.evaluation.shape; // [spades, hearts, diamonds, clubs]

    const scored = candidates.map(c => {
      const call = c.resolvedCall;
      if (call.type !== "bid") return { candidate: c, score: 0 };

      const strain = call.strain;
      if (strain === BidSuit.NoTrump) return { candidate: c, score: 0 };

      // BidSuit string values match Suit string values for the 4 suits
      const suitIndex = BIDSUIT_TO_SUIT_INDEX[strain];
      if (suitIndex === undefined) return { candidate: c, score: 0 };

      const ownLength = ownShape[suitIndex] ?? 0;
      const suit = SUIT_ORDER[suitIndex]! as Suit;
      const partnerMinLength = partnerBeliefs.suitLengths[suit]?.min ?? 0;

      return { candidate: c, score: ownLength + partnerMinLength };
    });

    // Stable sort by score descending
    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.candidate);
  };
}
