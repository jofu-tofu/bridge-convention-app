/**
 * L1 inference-enhanced play heuristics — reads PublicBeliefs from PlayContext.inferences
 * to make smarter decisions than the purely mechanical base heuristics.
 *
 * Used by Club Player and Expert profiles. Degrades gracefully when inferences are absent.
 */

import type { PlayContext } from "../../conventions";
import type { Card, Suit, Seat } from "../../engine/types";
import type { PublicBeliefs, DerivedRanges } from "../../inference/inference-types";
import { partnerSeat } from "../../engine/constants";
import {
  type PlayHeuristic,
  isDefender,
  isHonor,
  sortByRankAsc,
  sortByRankDesc,
  groupBySuit,
} from "./heuristic-play";

// ── Helpers ─────────────────────────────────────────────────────────

function getBeliefs(
  inferences: Record<Seat, PublicBeliefs> | undefined,
  seat: Seat,
): PublicBeliefs | null {
  if (!inferences) return null;
  return inferences[seat] ?? null;
}

function getRanges(
  inferences: Record<Seat, PublicBeliefs> | undefined,
  seat: Seat,
): DerivedRanges | null {
  const beliefs = getBeliefs(inferences, seat);
  return beliefs?.ranges ?? null;
}

/** Estimate expected suit length from DerivedRanges. */
function expectedSuitLength(ranges: DerivedRanges, suit: Suit): number {
  const range = ranges.suitLengths[suit];
  if (!range) return 3.25; // fallback: uniform 13/4
  return (range.min + range.max) / 2;
}

/** Get all suit keys from a suit-grouped record. */
function getSuitKeys(groups: Record<string, Card[]>): Suit[] {
  return Object.keys(groups) as Suit[];
}

// ── Auction-aware opening lead ──────────────────────────────────────

/**
 * Inference-enhanced opening lead: prefer partner's shown suit,
 * avoid declarer's known long suits.
 *
 * Only applies on the very first lead by a defender.
 */
export const auctionAwareLeadHeuristic: PlayHeuristic = {
  name: "auction-aware-lead",
  apply(context: PlayContext): Card | null {
    const { currentTrick, previousTricks, seat, contract, legalPlays, hand, inferences } = context;

    // Only applies on the opening lead by a defender
    if (currentTrick.length !== 0 || previousTricks.length !== 0) return null;
    if (!isDefender(seat, contract.declarer)) return null;
    if (!inferences) return null;

    const partner = partnerSeat(seat);
    const declarer = contract.declarer;
    const partnerRanges = getRanges(inferences, partner);
    const declarerRanges = getRanges(inferences, declarer);
    const isNT = context.trumpSuit === undefined;

    const suitGroups = groupBySuit(hand.cards);
    const suits = getSuitKeys(suitGroups);

    // Score each suit: higher is better to lead
    const scored = suits
      .filter((suit) => suit !== context.trumpSuit) // don't lead trumps for inference lead
      .map((suit) => {
        let score = 0;
        const cards = suitGroups[suit]!;

        // Prefer partner's long suits
        if (partnerRanges) {
          const partnerLen = expectedSuitLength(partnerRanges, suit);
          score += partnerLen * 2; // weight partner length highly
        }

        // Avoid declarer's long suits
        if (declarerRanges) {
          const declarerLen = expectedSuitLength(declarerRanges, suit);
          score -= declarerLen * 1.5;
        }

        // Prefer our own longer suits (for establishing)
        if (isNT) {
          score += cards.length * 1;
        }

        return { suit, score, cards };
      });

    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best || best.cards.length === 0) return null;

    // Lead 4th best from chosen suit if 4+ cards, otherwise low
    const sorted = sortByRankDesc(best.cards);
    if (sorted.length >= 4) {
      const fourthBest = sorted[3]!;
      if (legalPlays.some((c) => c.suit === fourthBest.suit && c.rank === fourthBest.rank)) {
        return fourthBest;
      }
    }

    // Otherwise lead low
    const low = sortByRankAsc(best.cards)[0];
    if (low && legalPlays.some((c) => c.suit === low.suit && c.rank === low.rank)) {
      return low;
    }

    return null;
  },
};

// ── Inference-based honor play / finesse direction ──────────────────

/**
 * When following suit in 2nd or 3rd position and holding an honor,
 * use HCP inference to decide finesse direction.
 *
 * If the opponent who hasn't played yet has more expected HCP,
 * they're more likely to hold the missing honor — finesse toward them.
 */
export const inferenceHonorPlayHeuristic: PlayHeuristic = {
  name: "inference-honor-play",
  apply(context: PlayContext): Card | null {
    const { currentTrick, legalPlays, seat, inferences, contract } = context;

    // Only applies in 2nd or 3rd position
    if (currentTrick.length !== 1 && currentTrick.length !== 2) return null;
    if (!inferences) return null;
    if (!isDefender(seat, contract.declarer)) return null;

    const ledSuit = currentTrick[0]!.card.suit;
    const suitCards = legalPlays.filter((c) => c.suit === ledSuit);
    if (suitCards.length === 0) return null;

    // Only interesting if we have both honor and non-honor options
    const honors = suitCards.filter((c) => isHonor(c.rank));
    const nonHonors = suitCards.filter((c) => !isHonor(c.rank));
    if (honors.length === 0 || nonHonors.length === 0) return null;

    // Compare HCP of the two opponents (declarer + dummy vs our side)
    // For a defender, the relevant question is: does declarer have the missing high card?
    const declarerRanges = getRanges(inferences, contract.declarer);
    const dummySeat = partnerSeat(contract.declarer);
    const dummyRanges = getRanges(inferences, dummySeat);

    if (!declarerRanges || !dummyRanges) return null;

    const declarerMidHcp = (declarerRanges.hcp.min + declarerRanges.hcp.max) / 2;
    const dummyMidHcp = (dummyRanges.hcp.min + dummyRanges.hcp.max) / 2;

    // If declarer is shown to be maximum range, play more conservatively (low)
    // If declarer is minimum range, be more aggressive (honor)
    const declarerStrength = declarerMidHcp / Math.max(1, declarerMidHcp + dummyMidHcp);

    if (declarerStrength > 0.6) {
      // Declarer likely has the missing honor — play low to avoid wasting ours
      return sortByRankAsc(suitCards)[0] ?? null;
    }

    if (declarerStrength < 0.4) {
      // Declarer less likely to have missing honor — play our honor to win
      return sortByRankAsc(honors)[0] ?? null; // lowest covering honor
    }

    // Uncertain — defer to base heuristics
    return null;
  },
};

// ── Inference-aware discard ─────────────────────────────────────────

/**
 * When discarding, avoid discarding from suits where partner is known to have length.
 * Prefer discarding from declarer's known long suits (already established).
 */
export const inferenceAwareDiscardHeuristic: PlayHeuristic = {
  name: "inference-aware-discard",
  apply(context: PlayContext): Card | null {
    const { currentTrick, legalPlays, seat, contract, inferences, trumpSuit } = context;

    if (currentTrick.length === 0) return null;
    if (!inferences) return null;
    if (!isDefender(seat, contract.declarer)) return null;

    const ledSuit = currentTrick[0]!.card.suit;
    const hasLedSuit = legalPlays.some((c) => c.suit === ledSuit);
    if (hasLedSuit) return null; // following suit, not discarding

    const partner = partnerSeat(seat);
    const partnerRanges = getRanges(inferences, partner);
    const declarerRanges = getRanges(inferences, contract.declarer);
    if (!partnerRanges && !declarerRanges) return null;

    // Collect discard candidates (non-trump, non-led-suit)
    const discardCandidates = legalPlays.filter(
      (c) => c.suit !== trumpSuit && c.suit !== ledSuit,
    );
    if (discardCandidates.length === 0) return null;

    const suitGroups = groupBySuit(discardCandidates);
    const suits = getSuitKeys(suitGroups);

    const scored = suits.map((suit) => {
      let score = 0;
      const cards = suitGroups[suit]!;

      // Penalize discarding from partner's long suits
      if (partnerRanges) {
        const partnerLen = expectedSuitLength(partnerRanges, suit);
        score -= partnerLen * 2;
      }

      // Prefer discarding from declarer's long suits (already covered)
      if (declarerRanges) {
        const declarerLen = expectedSuitLength(declarerRanges, suit);
        score += declarerLen * 1;
      }

      // Prefer discarding from suits without honors
      const honorCount = cards.filter((c) => isHonor(c.rank)).length;
      score -= honorCount * 3;

      return { suit, score, cards };
    });

    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best) return null;

    // Discard lowest from chosen suit
    const sorted = sortByRankAsc(best.cards);
    return sorted[0] ?? null;
  },
};

/** All L1 inference heuristics in priority order. */
export const inferenceHeuristics: readonly PlayHeuristic[] = [
  auctionAwareLeadHeuristic,
  inferenceHonorPlayHeuristic,
  inferenceAwareDiscardHeuristic,
];
