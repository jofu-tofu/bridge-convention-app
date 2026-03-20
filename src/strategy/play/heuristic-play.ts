import type { PlayStrategy, PlayContext, PlayResult } from "../../core/contracts";
import type { Card, Suit, Seat, PlayedCard, Trick } from "../../engine/types";
import { Rank } from "../../engine/types";
import { RANK_INDEX, partnerSeat } from "../../engine/constants";

type PlayHeuristic = {
  readonly name: string;
  apply(context: PlayContext): Card | null;
};

function isHonor(rank: Rank): boolean {
  return (
    rank === Rank.Jack ||
    rank === Rank.Queen ||
    rank === Rank.King ||
    rank === Rank.Ace
  );
}

function rankBeats(a: Rank, b: Rank): boolean {
  return RANK_INDEX[a] > RANK_INDEX[b];
}

/** Determine the current winning PlayedCard in an in-progress trick. */
function getTrickWinnerSoFar(
  plays: readonly PlayedCard[],
  trumpSuit: Suit | undefined,
): PlayedCard | null {
  if (plays.length === 0) return null;

  const ledSuit = plays[0]!.card.suit;
  let winner = plays[0]!;

  for (let i = 1; i < plays.length; i++) {
    const play = plays[i]!;
    const isTrump = trumpSuit !== undefined && play.card.suit === trumpSuit;
    const winnerIsTrump =
      trumpSuit !== undefined && winner.card.suit === trumpSuit;

    if (isTrump && !winnerIsTrump) {
      // Trump beats non-trump
      winner = play;
    } else if (isTrump && winnerIsTrump) {
      // Both trump: higher wins
      if (rankBeats(play.card.rank, winner.card.rank)) {
        winner = play;
      }
    } else if (!isTrump && play.card.suit === ledSuit) {
      // Same suit as led: higher wins
      if (rankBeats(play.card.rank, winner.card.rank)) {
        winner = play;
      }
    }
    // Off-suit non-trump: does not win
  }

  return winner;
}

function sortByRankAsc(cards: readonly Card[]): Card[] {
  return [...cards].sort((a, b) => RANK_INDEX[a.rank] - RANK_INDEX[b.rank]);
}

function sortByRankDesc(cards: readonly Card[]): Card[] {
  return [...cards].sort((a, b) => RANK_INDEX[b.rank] - RANK_INDEX[a.rank]);
}

/** Check if ranks form touching honors starting from the top (e.g., KQJ, QJT). */
function topOfTouchingHonors(suitCards: Card[]): Card | null {
  const sorted = sortByRankDesc(suitCards);
  if (sorted.length < 2) return null;

  // Need at least two consecutive honors
  const top = sorted[0]!;
  if (!isHonor(top.rank) && top.rank !== Rank.Ten) return null;

  let consecutive = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (RANK_INDEX[sorted[i]!.rank] === RANK_INDEX[sorted[i - 1]!.rank] - 1) {
      consecutive++;
      if (consecutive >= 3 || (consecutive >= 2 && isHonor(top.rank))) {
        return top;
      }
    } else {
      break;
    }
  }

  // Two touching honors (e.g., KQ) is enough if both are honors
  if (consecutive >= 2 && isHonor(top.rank) && isHonor(sorted[1]!.rank)) {
    return top;
  }

  return null;
}

function isDefender(seat: Seat, declarer: Seat): boolean {
  return seat !== declarer && seat !== partnerSeat(declarer);
}

/** Check if a card is in legalPlays. */
function isLegalPlay(card: Card, legalPlays: readonly Card[]): boolean {
  return legalPlays.some((c) => c.suit === card.suit && c.rank === card.rank);
}

/** Group hand cards by suit. */
function groupBySuit(cards: readonly Card[]): Record<string, Card[]> {
  const groups: Record<string, Card[]> = {};
  for (const c of cards) {
    if (!groups[c.suit]) groups[c.suit] = [];
    groups[c.suit]!.push(c);
  }
  return groups;
}

/** Extract suit keys from a suit-grouped record. */
function getSuitKeys(suitGroups: Record<string, Card[]>): Suit[] {
  return Object.keys(suitGroups) as Suit[];
}

/** Find the first non-trump suit that partner led in previous tricks. */
function findPartnerLedSuit(
  previousTricks: readonly Trick[],
  seat: Seat,
  trumpSuit: Suit | undefined,
): Suit | null {
  const partner = partnerSeat(seat);
  for (const trick of previousTricks) {
    if (trick.plays.length > 0 && trick.plays[0]!.seat === partner) {
      const ledSuit = trick.plays[0]!.card.suit;
      if (ledSuit !== trumpSuit) {
        return ledSuit;
      }
    }
  }
  return null;
}

// ── Lead sub-helpers ───────────────────────────────────────────────

/** Suit contracts: lead ace from AK combination in a side suit. */
function leadFromAKCombination(
  suitGroups: Record<string, Card[]>,
  trumpSuit: Suit,
  legalPlays: readonly Card[],
): Card | null {
  for (const suit of getSuitKeys(suitGroups)) {
    if (suit === trumpSuit) continue;
    const cards = suitGroups[suit]!;
    const hasAce = cards.some((c) => c.rank === Rank.Ace);
    const hasKing = cards.some((c) => c.rank === Rank.King);
    if (hasAce && hasKing) {
      const ace = cards.find((c) => c.rank === Rank.Ace)!;
      if (isLegalPlay(ace, legalPlays)) {
        return ace;
      }
    }
  }
  return null;
}

/** Lead top of touching honors from any suit. */
function leadTouchingHonors(
  suitGroups: Record<string, Card[]>,
  legalPlays: readonly Card[],
): Card | null {
  for (const suit of getSuitKeys(suitGroups)) {
    const cards = suitGroups[suit]!;
    const top = topOfTouchingHonors(cards);
    if (top && isLegalPlay(top, legalPlays)) {
      return top;
    }
  }
  return null;
}

/** 4th best from longest suit in the given groups. */
function leadFourthBest(
  suitGroups: Record<string, Card[]>,
  legalPlays: readonly Card[],
): Card | null {
  let longestSuit: Suit | null = null;
  let longestLen = 0;
  for (const suit of getSuitKeys(suitGroups)) {
    const len = suitGroups[suit]!.length;
    if (len > longestLen) {
      longestLen = len;
      longestSuit = suit;
    }
  }
  if (longestSuit && longestLen >= 4) {
    const sorted = sortByRankDesc(suitGroups[longestSuit]!);
    const fourthBest = sorted[3]; // 0-indexed: 4th from top
    if (fourthBest && isLegalPlay(fourthBest, legalPlays)) {
      return fourthBest;
    }
  }
  return null;
}

/** Suit contracts: lead a singleton in a side suit. */
function leadShortSuit(
  suitGroups: Record<string, Card[]>,
  trumpSuit: Suit,
  legalPlays: readonly Card[],
): Card | null {
  for (const suit of getSuitKeys(suitGroups)) {
    if (suit === trumpSuit) continue; // Don't lead singleton trump
    const cards = suitGroups[suit]!;
    if (cards.length === 1) {
      const singletonCard = cards[0]!;
      if (isLegalPlay(singletonCard, legalPlays)) {
        return singletonCard;
      }
    }
  }
  return null;
}

// ── Heuristics ─────────────────────────────────────────────────────

const openingLeadHeuristic: PlayHeuristic = {
  name: "opening-lead",
  apply(context: PlayContext): Card | null {
    const { currentTrick, previousTricks, seat, contract, legalPlays, hand } =
      context;

    // Only applies on the very first lead of the hand by a defender
    if (currentTrick.length !== 0 || previousTricks.length !== 0) return null;
    if (!isDefender(seat, contract.declarer)) return null;

    const isNT = context.trumpSuit === undefined;
    const suitGroups = groupBySuit(hand.cards);

    // Suit contracts: lead ace from AK combination in a side suit
    if (!isNT && context.trumpSuit !== undefined) {
      const ak = leadFromAKCombination(suitGroups, context.trumpSuit, legalPlays);
      if (ak) return ak;
    }

    // Try top of touching honors from any suit
    const touching = leadTouchingHonors(suitGroups, legalPlays);
    if (touching) return touching;

    // VS NT: 4th best from longest suit
    if (isNT) {
      const fourth = leadFourthBest(suitGroups, legalPlays);
      if (fourth) return fourth;
    }

    // Suit contracts: singleton lead
    if (!isNT && context.trumpSuit !== undefined) {
      const singleton = leadShortSuit(suitGroups, context.trumpSuit, legalPlays);
      if (singleton) return singleton;
    }

    // Suit contracts: 4th best from longest non-trump suit
    if (!isNT && context.trumpSuit !== undefined) {
      const nonTrumpGroups: Record<string, Card[]> = {};
      for (const suit of getSuitKeys(suitGroups)) {
        if (suit === context.trumpSuit) continue;
        nonTrumpGroups[suit] = suitGroups[suit]!;
      }
      const fourth = leadFourthBest(nonTrumpGroups, legalPlays);
      if (fourth) return fourth;
    }

    // General fallback: lead low from longest suit (excluding trump in suit contracts)
    let longestSuit: Suit | null = null;
    let longestLen = 0;
    for (const suit of getSuitKeys(suitGroups)) {
      if (!isNT && suit === context.trumpSuit) continue;
      const len = suitGroups[suit]!.length;
      if (len > longestLen) {
        longestLen = len;
        longestSuit = suit;
      }
    }
    if (longestSuit) {
      const sorted = sortByRankAsc(suitGroups[longestSuit]!);
      if (sorted[0] && isLegalPlay(sorted[0], legalPlays)) {
        return sorted[0];
      }
    }

    // Fallback: return null and let later heuristics / default handle it
    return null;
  },
};

const midGameLeadHeuristic: PlayHeuristic = {
  name: "mid-game-lead",
  apply(context: PlayContext): Card | null {
    const { currentTrick, previousTricks, seat, contract, legalPlays, trumpSuit } =
      context;

    // Only when on lead, but not the opening lead
    if (currentTrick.length !== 0) return null;
    if (previousTricks.length === 0) return null;

    const suitGroups = groupBySuit(legalPlays);

    // Defenders: return partner's suit
    if (isDefender(seat, contract.declarer)) {
      const partnerSuit = findPartnerLedSuit(previousTricks, seat, trumpSuit);
      if (partnerSuit && suitGroups[partnerSuit]) {
        const cards = suitGroups[partnerSuit]!;
        // Remaining doubleton or less: lead top (high-low to show count)
        if (cards.length <= 2) {
          return sortByRankDesc(cards)[0] ?? null;
        }
        // Otherwise lead low
        return sortByRankAsc(cards)[0] ?? null;
      }
    }

    // Try touching honors from any non-trump suit
    const nonTrumpGroups: Record<string, Card[]> = {};
    for (const suit of getSuitKeys(suitGroups)) {
      if (suit === trumpSuit) continue;
      nonTrumpGroups[suit] = suitGroups[suit]!;
    }
    const touching = leadTouchingHonors(nonTrumpGroups, legalPlays);
    if (touching) return touching;

    // Lead from longest non-trump suit
    let bestSuit: Suit | null = null;
    let bestLen = 0;
    for (const suit of getSuitKeys(suitGroups)) {
      if (suit === trumpSuit) continue;
      const len = suitGroups[suit]!.length;
      if (len > bestLen) {
        bestLen = len;
        bestSuit = suit;
      }
    }
    if (bestSuit && suitGroups[bestSuit]) {
      return sortByRankAsc(suitGroups[bestSuit]!)[0] ?? null;
    }

    // Only trump left: lead lowest
    return sortByRankAsc(legalPlays)[0] ?? null;
  },
};

const secondHandLowHeuristic: PlayHeuristic = {
  name: "second-hand-low",
  apply(context: PlayContext): Card | null {
    if (context.currentTrick.length !== 1) return null;

    const ledCard = context.currentTrick[0]!.card;
    const ledSuit = ledCard.suit;
    const followingSuit = context.legalPlays.some((c) => c.suit === ledSuit);

    // Only applies when we can follow suit — if void, let trump/discard heuristics handle it
    if (!followingSuit) return null;

    // Exception: if an honor was led and we hold a covering honor, defer to cover-honor heuristic
    if (isHonor(ledCard.rank)) {
      const hasCoveringHonor = context.legalPlays.some(
        (c) =>
          c.suit === ledSuit &&
          isHonor(c.rank) &&
          rankBeats(c.rank, ledCard.rank),
      );
      if (hasCoveringHonor) return null;
    }

    // Play lowest card in the led suit
    const suitCards = sortByRankAsc(
      context.legalPlays.filter((c) => c.suit === ledSuit),
    );
    return suitCards[0] ?? null;
  },
};

const thirdHandHighHeuristic: PlayHeuristic = {
  name: "third-hand-high",
  apply(context: PlayContext): Card | null {
    if (context.currentTrick.length !== 2) return null;

    const ledSuit = context.currentTrick[0]!.card.suit;
    const followingSuit = context.legalPlays.filter(
      (c) => c.suit === ledSuit,
    );

    // Void in led suit — defer to trump/discard heuristics
    if (followingSuit.length === 0) return null;

    const partner = partnerSeat(context.seat);
    const winnerSoFar = getTrickWinnerSoFar(
      context.currentTrick,
      context.trumpSuit,
    );

    // If partner is already winning, play low
    if (winnerSoFar && winnerSoFar.seat === partner) {
      return sortByRankAsc(followingSuit)[0] ?? null;
    }

    // Play just high enough to beat current winner
    if (winnerSoFar) {
      const winnerIsTrump =
        context.trumpSuit !== undefined &&
        winnerSoFar.card.suit === context.trumpSuit;

      if (!winnerIsTrump) {
        const sorted = sortByRankAsc(followingSuit);
        for (const c of sorted) {
          if (rankBeats(c.rank, winnerSoFar.card.rank)) {
            return c;
          }
        }
      }
      // Can't beat it, play lowest in suit
      return sortByRankAsc(followingSuit)[0] ?? null;
    }

    // No winner determined (shouldn't happen with 2 cards), play highest in suit
    return sortByRankDesc(followingSuit)[0] ?? null;
  },
};

const fourthHandPlayHeuristic: PlayHeuristic = {
  name: "fourth-hand-play",
  apply(context: PlayContext): Card | null {
    if (context.currentTrick.length !== 3) return null;

    const ledSuit = context.currentTrick[0]!.card.suit;
    const followingSuit = context.legalPlays.filter(
      (c) => c.suit === ledSuit,
    );

    // Void in led suit — defer to trump/discard heuristics
    if (followingSuit.length === 0) return null;

    const partner = partnerSeat(context.seat);
    const winnerSoFar = getTrickWinnerSoFar(
      context.currentTrick,
      context.trumpSuit,
    );

    // Partner is winning — play low
    if (winnerSoFar && winnerSoFar.seat === partner) {
      return sortByRankAsc(followingSuit)[0] ?? null;
    }

    // Opponent winning — win as cheaply as possible
    if (winnerSoFar) {
      const winnerIsTrump =
        context.trumpSuit !== undefined &&
        winnerSoFar.card.suit === context.trumpSuit;

      if (!winnerIsTrump) {
        const sorted = sortByRankAsc(followingSuit);
        for (const c of sorted) {
          if (rankBeats(c.rank, winnerSoFar.card.rank)) {
            return c;
          }
        }
      }
      // Can't beat — play lowest
      return sortByRankAsc(followingSuit)[0] ?? null;
    }

    // No winner (shouldn't happen), play lowest
    return sortByRankAsc(followingSuit)[0] ?? null;
  },
};

const coverHonorHeuristic: PlayHeuristic = {
  name: "cover-honor-with-honor",
  apply(context: PlayContext): Card | null {
    if (context.currentTrick.length === 0) return null;

    const ledCard = context.currentTrick[0]!.card;
    if (!isHonor(ledCard.rank)) return null;

    // Find legal plays in the led suit that are higher honors
    const higherHonors = context.legalPlays.filter(
      (c) =>
        c.suit === ledCard.suit &&
        isHonor(c.rank) &&
        rankBeats(c.rank, ledCard.rank),
    );

    if (higherHonors.length === 0) return null;

    // Play the lowest honor that covers
    const sorted = sortByRankAsc(higherHonors);
    return sorted[0] ?? null;
  },
};

const trumpManagementHeuristic: PlayHeuristic = {
  name: "trump-management",
  apply(context: PlayContext): Card | null {
    if (context.trumpSuit === undefined) return null;
    if (context.currentTrick.length === 0) return null;

    const ledSuit = context.currentTrick[0]!.card.suit;
    const hasLedSuit = context.legalPlays.some((c) => c.suit === ledSuit);

    // Only applies when void in led suit
    if (hasLedSuit) return null;

    const trumpCards = context.legalPlays.filter(
      (c) => c.suit === context.trumpSuit,
    );
    if (trumpCards.length === 0) return null;

    const partner = partnerSeat(context.seat);
    const winnerSoFar = getTrickWinnerSoFar(
      context.currentTrick,
      context.trumpSuit,
    );

    if (winnerSoFar) {
      const winnerIsTrump = winnerSoFar.card.suit === context.trumpSuit;

      // Partner winning — don't ruff partner's trick
      if (winnerSoFar.seat === partner) {
        return null; // Let discard heuristic handle it
      }

      // Opponent winning with trump — overruff if possible
      if (winnerIsTrump) {
        const sorted = sortByRankAsc(trumpCards);
        for (const c of sorted) {
          if (rankBeats(c.rank, winnerSoFar.card.rank)) {
            return c;
          }
        }
        // Can't overruff — don't waste trump, discard instead
        return null;
      }
    }

    // Opponent winning with non-trump (or no specific winner) — ruff with lowest trump
    const sorted = sortByRankAsc(trumpCards);
    return sorted[0] ?? null;
  },
};

const discardManagementHeuristic: PlayHeuristic = {
  name: "discard-management",
  apply(context: PlayContext): Card | null {
    if (context.currentTrick.length === 0) return null;

    const ledSuit = context.currentTrick[0]!.card.suit;
    const hasLedSuit = context.legalPlays.some((c) => c.suit === ledSuit);

    // Only applies when void in led suit (and can't/shouldn't trump)
    if (hasLedSuit) return null;

    // Already handled by trump management if we have trump
    // This handles: no trump suit, or choosing not to ruff

    // Collect non-trump suits available for discard
    const suitGroups: Partial<Record<Suit, Card[]>> = {};
    for (const c of context.legalPlays) {
      if (c.suit === context.trumpSuit) continue; // Don't discard trump
      if (!suitGroups[c.suit]) suitGroups[c.suit] = [];
      suitGroups[c.suit]!.push(c);
    }

    const suits = getSuitKeys(suitGroups);
    if (suits.length === 0) return null;

    // Score each suit: prefer discarding from suits without honors,
    // avoid baring an honor (e.g. Kx -> lone K), then prefer shorter suits
    const scored = suits.map((suit) => {
      const cards = suitGroups[suit]!;
      const honorCount = cards.filter((c) => isHonor(c.rank)).length;
      const wouldBareHonor = cards.length === 2 && honorCount > 0;
      return { suit, cards, honorCount, wouldBareHonor, length: cards.length };
    });

    scored.sort((a, b) => {
      // Never bare an honor if alternatives exist
      if (a.wouldBareHonor && !b.wouldBareHonor) return 1;
      if (!a.wouldBareHonor && b.wouldBareHonor) return -1;
      // Prefer suits without honors
      if (a.honorCount === 0 && b.honorCount > 0) return -1;
      if (a.honorCount > 0 && b.honorCount === 0) return 1;
      // Then shortest
      return a.length - b.length;
    });

    const best = scored[0];
    if (!best) return null;

    // Discard lowest from chosen suit
    const sorted = sortByRankAsc(best.cards);
    return sorted[0] ?? null;
  },
};

export function createHeuristicPlayStrategy(): PlayStrategy {
  const heuristics: PlayHeuristic[] = [
    openingLeadHeuristic,
    midGameLeadHeuristic,
    secondHandLowHeuristic,
    thirdHandHighHeuristic,
    fourthHandPlayHeuristic,
    coverHonorHeuristic,
    trumpManagementHeuristic,
    discardManagementHeuristic,
  ];

  return {
    id: "heuristic",
    name: "Heuristic Play",
    suggest(context: PlayContext): PlayResult {
      if (context.legalPlays.length === 0) {
        throw new Error("No legal plays available");
      }

      for (const h of heuristics) {
        const card = h.apply(context);
        if (card) {
          // Verify the card is in legalPlays
          if (
            context.legalPlays.some(
              (c) => c.suit === card.suit && c.rank === card.rank,
            )
          ) {
            return { card, reason: h.name };
          }
        }
      }
      // Fallback: lowest legal card (legalPlays is non-empty per guard above)
      const sorted = sortByRankAsc(context.legalPlays);
      const fallback = sorted[0] ?? context.legalPlays[0]!;
      return { card: fallback, reason: "default-lowest" };
    },
  };
}
