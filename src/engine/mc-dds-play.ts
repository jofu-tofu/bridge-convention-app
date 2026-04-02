/**
 * MC+DDS play engine — deal sampling + batched DDS evaluation.
 *
 * Pure functions, no service/store dependencies. Used by Expert/WorldClass
 * profiles where TS drives AI card selection via playSingleCard.
 */

import type { Card, Contract, Hand, PlayedCard, Seat } from "./types";
import { BidSuit, Suit } from "./types";
import type { ServiceDerivedRanges } from "../service/response-types";
import type { SolveBoardResult } from "./dds-wasm";
import { handsToPBN, trumpToDdsIndex, seatToDdsIndex, rankToDdsValue, suitToDdsIndex } from "./dds-wasm";
import { solveBoardWasm } from "./dds-client";
import { calculateHcp } from "./hand-evaluator";

// ── Result types ─────────────────────────────────────────────────────

export interface McddResult {
  readonly bestCard: Card;
  readonly reason: string; // "mc-dds" | "mc-dds:early" | "mc-dds:extended"
  readonly scores: Map<string, { avgTricks: number; count: number }>;
  readonly samplesUsed: number;
}

// ── Card key helper ──────────────────────────────────────────────────

function cardKey(card: Card): string {
  return `${card.suit}${card.rank}`;
}

// ── Fisher-Yates shuffle ─────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

// ── Deal sampling ────────────────────────────────────────────────────

export interface SampleDealsParams {
  /** Remaining cards per seat (unplayed only). */
  remainingCards: Partial<Record<Seat, readonly Card[]>>;
  /** Seats whose cards are known (observer + dummy). */
  visibleSeats: readonly Seat[];
  /** L1 inference ranges per seat. null = no constraints. */
  constraints: Partial<Record<Seat, ServiceDerivedRanges | null>>;
  /** false for Expert (random), true for WorldClass (belief-filtered). */
  useConstraints: boolean;
  count: number;
  maxAttempts: number;
}

/** Check if a hand satisfies DerivedRanges constraints. */
function satisfiesConstraints(cards: readonly Card[], ranges: ServiceDerivedRanges): boolean {
  // HCP check
  const hcp = calculateHcp({ cards: [...cards] });
  if (hcp < ranges.hcp.min || hcp > ranges.hcp.max) return false;

  // Suit length checks
  const suitCounts = new Map<Suit, number>();
  for (const card of cards) {
    suitCounts.set(card.suit, (suitCounts.get(card.suit) ?? 0) + 1);
  }
  for (const suit of [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs]) {
    const count = suitCounts.get(suit) ?? 0;
    const range = ranges.suitLengths[suit];
    if (range && (count < range.min || count > range.max)) return false;
  }
  return true;
}

const ALL_SEATS: readonly Seat[] = ["N", "E", "S", "W"] as Seat[];

export function sampleDeals(params: SampleDealsParams): Record<Seat, Hand>[] {
  const { remainingCards, visibleSeats, constraints, useConstraints, count, maxAttempts } = params;
  const visibleSet = new Set(visibleSeats);

  // Identify non-visible seats and their card counts
  const nonVisibleSeats: Seat[] = [];
  const seatCardCounts: Map<Seat, number> = new Map();
  const unknownPool: Card[] = [];

  for (const seat of ALL_SEATS) {
    const cards = remainingCards[seat] ?? [];
    if (visibleSet.has(seat)) continue;
    nonVisibleSeats.push(seat);
    seatCardCounts.set(seat, cards.length);
    unknownPool.push(...cards);
  }

  const results: Record<Seat, Hand>[] = [];
  let attempts = 0;

  while (results.length < count && attempts < maxAttempts) {
    attempts++;
    shuffle(unknownPool);

    // Deal chunks to non-visible seats
    let offset = 0;
    const deal = {} as Record<Seat, Hand>;
    let valid = true;

    for (const seat of nonVisibleSeats) {
      const needed = seatCardCounts.get(seat) ?? 0;
      const cards = unknownPool.slice(offset, offset + needed);
      offset += needed;

      if (useConstraints) {
        const ranges = constraints[seat] ?? null;
        if (ranges && !satisfiesConstraints(cards, ranges)) {
          valid = false;
          break;
        }
      }
      deal[seat] = { cards: [...cards] };
    }

    if (!valid) continue;

    // Fill in visible seats
    for (const seat of ALL_SEATS) {
      if (visibleSet.has(seat)) {
        deal[seat] = { cards: [...(remainingCards[seat] ?? [])] };
      }
    }

    results.push(deal);
  }

  return results;
}

// ── DDS evaluation ───────────────────────────────────────────────────

export interface EvaluateCardsParams {
  legalCards: readonly Card[];
  sampledDeals: Record<Seat, Hand>[];
  trump: number;
  currentSeat: number;
  currentTrickSuit: number[];
  currentTrickRank: number[];
  batchSize: number;
  maxBatches: number;
}

export async function evaluateCards(params: EvaluateCardsParams): Promise<McddResult | null> {
  const { legalCards, sampledDeals, trump, currentSeat, currentTrickSuit, currentTrickRank, batchSize, maxBatches } = params;

  if (sampledDeals.length === 0 || legalCards.length === 0) return null;

  // Accumulator: cardKey → { totalTricks, count }
  const accum = new Map<string, { totalTricks: number; count: number }>();
  for (const card of legalCards) {
    accum.set(cardKey(card), { totalTricks: 0, count: 0 });
  }

  let dealIdx = 0;
  let batchesRun = 0;
  let reason = "mc-dds";

  for (let batch = 0; batch < maxBatches && dealIdx < sampledDeals.length; batch++) {
    const batchEnd = Math.min(dealIdx + batchSize, sampledDeals.length);

    for (; dealIdx < batchEnd; dealIdx++) {
      const deal = sampledDeals[dealIdx]!;
      const pbn = handsToPBN(deal);

      try {
        const result: SolveBoardResult = await solveBoardWasm(
          trump, currentSeat, currentTrickSuit, currentTrickRank, pbn,
        );

        // Map DDS results to our legal cards
        for (const entry of result.cards) {
          const key = cardKey({ suit: entry.suit, rank: entry.rank });
          const a = accum.get(key);
          if (a) {
            a.totalTricks += entry.score;
            a.count++;
          }
        }
      } catch {
        // DDS error for this deal — skip it
      }
    }

    batchesRun++;

    // Early termination: after first batch, check if top-2 cards diverge by >=0.5
    if (batchesRun >= 1) {
      const sorted = [...accum.entries()]
        .filter(([, v]) => v.count > 0)
        .sort((a, b) => (b[1].totalTricks / b[1].count) - (a[1].totalTricks / a[1].count));

      if (sorted.length >= 2) {
        const avg1 = sorted[0]![1].totalTricks / sorted[0]![1].count;
        const avg2 = sorted[1]![1].totalTricks / sorted[1]![1].count;
        if (avg1 - avg2 >= 0.5) {
          reason = "mc-dds:early";
          break;
        }
      }
    }
  }

  // Check if we have any successful solves
  const totalSolves = [...accum.values()].reduce((sum, v) => sum + v.count, 0);
  if (totalSolves === 0) return null;

  // Close-call extension: if margin < 0.5 after all batches, run one more batch
  if (reason === "mc-dds" && dealIdx < sampledDeals.length) {
    const sorted = [...accum.entries()]
      .filter(([, v]) => v.count > 0)
      .sort((a, b) => (b[1].totalTricks / b[1].count) - (a[1].totalTricks / a[1].count));

    if (sorted.length >= 2) {
      const avg1 = sorted[0]![1].totalTricks / sorted[0]![1].count;
      const avg2 = sorted[1]![1].totalTricks / sorted[1]![1].count;
      if (avg1 - avg2 < 0.5) {
        const extensionEnd = Math.min(dealIdx + batchSize, sampledDeals.length);
        for (; dealIdx < extensionEnd; dealIdx++) {
          const deal = sampledDeals[dealIdx]!;
          const pbn = handsToPBN(deal);
          try {
            const result = await solveBoardWasm(
              trump, currentSeat, currentTrickSuit, currentTrickRank, pbn,
            );
            for (const entry of result.cards) {
              const key = cardKey({ suit: entry.suit, rank: entry.rank });
              const a = accum.get(key);
              if (a) {
                a.totalTricks += entry.score;
                a.count++;
              }
            }
          } catch {
            // skip
          }
        }
        reason = "mc-dds:extended";
      }
    }
  }

  // Find the best card
  const scores = new Map<string, { avgTricks: number; count: number }>();
  let bestKey = "";
  let bestAvg = -Infinity;

  for (const [key, v] of accum) {
    if (v.count === 0) continue;
    const avg = v.totalTricks / v.count;
    scores.set(key, { avgTricks: avg, count: v.count });
    if (avg > bestAvg) {
      bestAvg = avg;
      bestKey = key;
    }
  }

  const bestCard = legalCards.find((c) => cardKey(c) === bestKey);
  if (!bestCard) return null;

  const samplesUsed = [...accum.values()].reduce((max, v) => Math.max(max, v.count), 0);

  return { bestCard, reason, scores, samplesUsed };
}

// ── Top-level entry point ────────────────────────────────────────────

export interface McddSuggestParams {
  seat: Seat;
  legalPlays: readonly Card[];
  contract: Contract;
  currentTrick: readonly PlayedCard[];
  remainingCards: Partial<Record<Seat, readonly Card[]>>;
  visibleSeats: readonly Seat[];
  beliefs: Partial<Record<Seat, ServiceDerivedRanges | null>>;
  useConstraints: boolean;
}

const DEFAULT_SAMPLE_COUNT = 30;
const DEFAULT_BATCH_SIZE = 15;
const DEFAULT_MAX_BATCHES = 2;
const DEFAULT_MAX_ATTEMPTS_MULTIPLIER = 20;

export async function mcDdsSuggest(params: McddSuggestParams): Promise<McddResult | null> {
  const { seat, legalPlays, contract, currentTrick, remainingCards, visibleSeats, beliefs, useConstraints } = params;

  // Forced play shortcut
  if (legalPlays.length === 1) {
    const card = legalPlays[0]!;
    return {
      bestCard: card,
      reason: "mc-dds:forced",
      scores: new Map([[cardKey(card), { avgTricks: 0, count: 0 }]]),
      samplesUsed: 0,
    };
  }

  // Sample deals
  const sampleCount = DEFAULT_SAMPLE_COUNT;
  const sampledDeals = sampleDeals({
    remainingCards,
    visibleSeats,
    constraints: beliefs,
    useConstraints,
    count: sampleCount,
    maxAttempts: sampleCount * DEFAULT_MAX_ATTEMPTS_MULTIPLIER,
  });

  if (sampledDeals.length === 0) return null;

  // Build DDS parameters from current trick
  const trump = trumpToDdsIndex(contract.strain === BidSuit.NoTrump ? undefined : suitToSuit(contract.strain));
  const leadSeat = currentTrick.length > 0 ? currentTrick[0]!.seat : seat;
  const currentSeatIdx = seatToDdsIndex(leadSeat);

  const currentTrickSuit: number[] = [];
  const currentTrickRank: number[] = [];
  for (const play of currentTrick) {
    currentTrickSuit.push(suitToDdsIndex(play.card.suit));
    currentTrickRank.push(rankToDdsValue(play.card.rank));
  }

  return evaluateCards({
    legalCards: legalPlays,
    sampledDeals,
    trump,
    currentSeat: currentSeatIdx,
    currentTrickSuit,
    currentTrickRank,
    batchSize: DEFAULT_BATCH_SIZE,
    maxBatches: DEFAULT_MAX_BATCHES,
  });
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Convert BidSuit strain to Suit for trump mapping. */
function suitToSuit(strain: BidSuit): Suit {
  switch (strain) {
    case BidSuit.Spades: return Suit.Spades;
    case BidSuit.Hearts: return Suit.Hearts;
    case BidSuit.Diamonds: return Suit.Diamonds;
    case BidSuit.Clubs: return Suit.Clubs;
    case BidSuit.NoTrump: throw new Error("NoTrump has no suit");
  }
}
