/**
 * Monte Carlo + DDS play strategy provider ("World Class" profile).
 *
 * Samples N deals consistent with known information (own hand, dummy,
 * played cards, detected voids, auction inferences), DDS-solves each,
 * and picks the card with the highest average expected tricks.
 *
 * Falls back to expert heuristic chain when DDS is unavailable or
 * sampling fails.
 */

import type { PlayStrategy, PlayContext, PlayResult } from "../../conventions";
import type { Card, Hand, Seat, Suit } from "../../engine/types";
import type { EnginePort } from "../../engine/port";
import type { SolveBoardResult } from "../../engine/dds-wasm";
import type { PlayStrategyProvider } from "./play-profiles";
import type { PublicBeliefs, DerivedRanges } from "../../inference/inference-types";
import { PlayConstraintTracker } from "./play-constraint-tracker";
import { createDeck, SEATS, SUITS, HCP_VALUES } from "../../engine/constants";
import {
  handsToPBN,
  trumpToDdsIndex,
  seatToDdsIndex,
  suitToDdsIndex,
  rankToDdsValue,
} from "../../engine/dds-wasm";
import { shuffle } from "../../inference/posterior/posterior-sampler";
import {
  type PlayHeuristic,
  openingLeadHeuristic,
  midGameLeadHeuristic,
  secondHandLowHeuristic,
  thirdHandHighHeuristic,
  fourthHandPlayHeuristic,
  coverHonorHeuristic,
  trumpManagementHeuristic,
  discardManagementHeuristic,
  sortByRankAsc,
} from "./heuristic-play";
import { inferenceHeuristics } from "./inference-play";

// ── Default sample count ──────────────────────────────────────

const DEFAULT_SAMPLE_COUNT = 30;
const MAX_ATTEMPTS_MULTIPLIER = 20;

// ── Batched evaluation constants ─────────────────────────────

/** 3 batches of 30 → 2 early-termination checkpoints */
const BATCH_SIZE = 10;
/** 0.5 trick gap = strong edge in bridge; conservative threshold */
const EARLY_TERM_MARGIN = 0.5;

// ── Play-phase deal sampling ──────────────────────────────────

interface SamplePlayDealsParams {
  /** Known remaining hands (own + dummy if visible). */
  readonly knownHands: Partial<Record<Seat, Hand>>;
  /** Cards already played by each seat (from completed tricks + current trick). */
  readonly playedCards: ReadonlyMap<Seat, readonly Card[]>;
  /** Detected voids per seat. */
  readonly voids: ReadonlyMap<Seat, Set<Suit>>;
  /** Seats whose hands are unknown and need sampling. */
  readonly unknownSeats: readonly Seat[];
  /** Cards remaining per unknown seat (13 - cards played). */
  readonly cardsNeeded: Partial<Record<Seat, number>>;
  /** Number of samples to generate. */
  readonly n: number;
  /** Seeded RNG function. */
  readonly rng: () => number;
  /** Auction-inferred belief constraints per seat (optional). */
  readonly beliefConstraints?: Partial<Record<Seat, DerivedRanges>>;
}

/**
 * Sample deal layouts for unknown seats during play.
 * Returns remaining cards for unknown seats (not full 13-card hands).
 */
export function samplePlayDeals(
  params: SamplePlayDealsParams,
): Record<Seat, Hand>[] {
  const { knownHands, playedCards, voids, unknownSeats, cardsNeeded, n, rng, beliefConstraints } = params;

  if (unknownSeats.length === 0) return [];

  // Step 1: Build remaining card pool
  const allKnownCards = new Set<string>();
  for (const seat of SEATS) {
    const hand = knownHands[seat];
    if (hand) {
      for (const c of hand.cards) allKnownCards.add(`${c.suit}${c.rank}`);
    }
    const played = playedCards.get(seat);
    if (played) {
      for (const c of played) allKnownCards.add(`${c.suit}${c.rank}`);
    }
  }

  const fullDeck = createDeck();
  const pool = fullDeck.filter((c) => !allKnownCards.has(`${c.suit}${c.rank}`));

  // Verify pool size matches needs
  const totalNeeded = unknownSeats.reduce((sum, s) => sum + (cardsNeeded[s] ?? 0), 0);
  if (totalNeeded !== pool.length) return [];

  // Step 2: Void pre-assignment
  const preAssigned = new Map<Seat, Card[]>();
  for (const seat of unknownSeats) preAssigned.set(seat, []);

  const shufflePool: Card[] = [];
  const suitGroups = new Map<string, Card[]>();
  for (const c of pool) {
    const key = c.suit as string;
    if (!suitGroups.has(key)) suitGroups.set(key, []);
    suitGroups.get(key)!.push(c);
  }

  for (const [suit, cards] of suitGroups) {
    const seatsAllowed = unknownSeats.filter((s) => {
      const seatVoids = voids.get(s);
      return !seatVoids || !seatVoids.has(suit as Suit);
    });

    if (seatsAllowed.length === 0) {
      // Impossible — no seat can hold these cards
      return [];
    }

    if (seatsAllowed.length === 1) {
      // Deterministic assignment
      preAssigned.get(seatsAllowed[0]!)!.push(...cards);
    } else {
      shufflePool.push(...cards);
    }
  }

  // Adjust cards needed after pre-assignment
  const adjustedNeeded = new Map<Seat, number>();
  for (const seat of unknownSeats) {
    const needed = (cardsNeeded[seat] ?? 0) - preAssigned.get(seat)!.length;
    if (needed < 0) return []; // impossible — pre-assigned more than seat can hold
    adjustedNeeded.set(seat, needed);
  }

  // Verify shuffle pool size
  const totalShuffleNeeded = unknownSeats.reduce((sum, s) => sum + (adjustedNeeded.get(s) ?? 0), 0);
  if (totalShuffleNeeded !== shufflePool.length) return [];

  // Step 3: Sample via shuffle
  const maxAttempts = n * MAX_ATTEMPTS_MULTIPLIER;
  const samples: Record<Seat, Hand>[] = [];
  const workingPool = [...shufflePool];

  for (let attempt = 0; attempt < maxAttempts && samples.length < n; attempt++) {
    // Copy and shuffle
    for (let i = 0; i < shufflePool.length; i++) workingPool[i] = shufflePool[i]!;
    shuffle(workingPool, rng);

    // Deal remaining cards
    let offset = 0;
    const dealt = new Map<Seat, Card[]>();
    let valid = true;

    for (const seat of unknownSeats) {
      const needed = adjustedNeeded.get(seat) ?? 0;
      const cards = workingPool.slice(offset, offset + needed);
      offset += needed;

      // Check void constraints
      const seatVoids = voids.get(seat);
      if (seatVoids) {
        for (const c of cards) {
          if (seatVoids.has(c.suit)) {
            valid = false;
            break;
          }
        }
      }
      if (!valid) break;

      dealt.set(seat, [...preAssigned.get(seat)!, ...cards]);
    }

    if (!valid) continue;

    // Check belief constraints (auction inferences) on the full original hand
    if (beliefConstraints && !checkBeliefConstraints(dealt, playedCards, unknownSeats, beliefConstraints)) {
      continue;
    }

    // Build result
    const result = {} as Record<Seat, Hand>;
    for (const seat of SEATS) {
      const known = knownHands[seat];
      if (known) {
        result[seat] = known;
      } else {
        result[seat] = { cards: dealt.get(seat) ?? [] };
      }
    }

    samples.push(result);
  }

  return samples;
}

// ── Belief constraint validation ──────────────────────────────

/**
 * Check whether a sampled deal is consistent with auction-inferred beliefs.
 * Reconstructs each unknown seat's full original hand (remaining + played)
 * and validates HCP and suit lengths against DerivedRanges.
 */
function checkBeliefConstraints(
  dealt: Map<Seat, Card[]>,
  playedCards: ReadonlyMap<Seat, readonly Card[]>,
  unknownSeats: readonly Seat[],
  constraints: Partial<Record<Seat, DerivedRanges>>,
): boolean {
  for (const seat of unknownSeats) {
    const ranges = constraints[seat];
    if (!ranges) continue;

    // Reconstruct the full original hand: remaining dealt + already played
    const remaining = dealt.get(seat) ?? [];
    const played = playedCards.get(seat) ?? [];
    const fullHand = [...remaining, ...played];

    // HCP check
    let hcp = 0;
    for (const c of fullHand) {
      hcp += HCP_VALUES[c.rank];
    }
    if (hcp < ranges.hcp.min || hcp > ranges.hcp.max) return false;

    // Suit length checks
    for (const suit of SUITS) {
      const range = ranges.suitLengths[suit];
      if (!range) continue;
      let count = 0;
      for (const c of fullHand) {
        if (c.suit === suit) count++;
      }
      if (count < range.min || count > range.max) return false;
    }
  }
  return true;
}

// ── Expert fallback chain ─────────────────────────────────────

const EXPERT_CHAIN: readonly PlayHeuristic[] = [
  ...inferenceHeuristics,
  ...([
    openingLeadHeuristic,
    midGameLeadHeuristic,
    secondHandLowHeuristic,
    thirdHandHighHeuristic,
    fourthHandPlayHeuristic,
    coverHonorHeuristic,
    trumpManagementHeuristic,
    discardManagementHeuristic,
  ] as const),
];

function expertFallback(context: PlayContext): PlayResult {
  for (const h of EXPERT_CHAIN) {
    const card = h.apply(context);
    if (card && context.legalPlays.some((c) => c.suit === card.suit && c.rank === card.rank)) {
      return { card, reason: `expert-fallback:${h.name}` };
    }
  }
  const sorted = sortByRankAsc(context.legalPlays);
  const fallback = sorted[0] ?? context.legalPlays[0]!;
  return { card: fallback, reason: "expert-fallback:default-lowest" };
}

// ── Monte Carlo + DDS strategy ────────────────────────────────

function buildPlayedCardsMap(
  previousTricks: readonly { plays: readonly { card: Card; seat: Seat }[] }[],
  currentTrick: readonly { card: Card; seat: Seat }[],
): Map<Seat, Card[]> {
  const result = new Map<Seat, Card[]>();
  for (const trick of previousTricks) {
    for (const play of trick.plays) {
      if (!result.has(play.seat)) result.set(play.seat, []);
      result.get(play.seat)!.push(play.card);
    }
  }
  for (const play of currentTrick) {
    if (!result.has(play.seat)) result.set(play.seat, []);
    result.get(play.seat)!.push(play.card);
  }
  return result;
}

function cardKey(c: Card): string {
  return `${c.suit}${c.rank}`;
}

// ── MC+DDS provider options ──────────────────────────────────

interface MCDDSProviderOptions {
  /** Whether to filter samples by auction-inferred belief constraints (HCP/suit ranges). */
  readonly useBeliefConstraints: boolean;
  /** Number of samples per decision (default 30). */
  readonly sampleCount?: number;
  /** Strategy ID override (default "mc-dds"). */
  readonly id?: string;
  /** Strategy display name override. */
  readonly name?: string;
}

/**
 * Create a Monte Carlo + DDS play strategy provider.
 *
 * @param engine EnginePort for DDS solveBoard calls
 * @param rng Seeded RNG for reproducible sampling
 * @param opts Controls belief constraint usage and sample count
 */
export function createMCDDSProvider(
  engine: EnginePort,
  rng: () => number,
  opts: MCDDSProviderOptions = { useBeliefConstraints: true },
): PlayStrategyProvider {
  const sampleCount = opts.sampleCount ?? DEFAULT_SAMPLE_COUNT;
  const tracker = new PlayConstraintTracker();
  let storedBeliefs: Record<Seat, PublicBeliefs> | null = null;

  /** Extract DerivedRanges for unknown seats from stored auction beliefs. */
  function getBeliefConstraints(unknownSeats: readonly Seat[]): Partial<Record<Seat, DerivedRanges>> | undefined {
    if (!opts.useBeliefConstraints || !storedBeliefs) return undefined;
    const result: Partial<Record<Seat, DerivedRanges>> = {};
    let hasAny = false;
    for (const seat of unknownSeats) {
      const beliefs = storedBeliefs[seat];
      if (beliefs?.ranges) {
        result[seat] = beliefs.ranges;
        hasAny = true;
      }
    }
    return hasAny ? result : undefined;
  }

  const strategy: PlayStrategy = {
    id: opts.id ?? "mc-dds",
    name: opts.name ?? "MC+DDS",

    async suggest(context: PlayContext): Promise<PlayResult> {
      // 1. Single legal play → return immediately
      if (context.legalPlays.length === 1) {
        return { card: context.legalPlays[0]!, reason: "only-legal-play" };
      }

      // 2. Update constraint tracker
      tracker.update(context.previousTricks, context.currentTrick);

      // 3. Determine known hands
      const knownHands: Partial<Record<Seat, Hand>> = {
        [context.seat]: context.hand,
      };
      if (context.dummyHand) {
        const dummySeat = findDummySeat(context);
        if (dummySeat) knownHands[dummySeat] = context.dummyHand;
      }

      // 4. Build played cards map
      const playedCards = buildPlayedCardsMap(context.previousTricks, context.currentTrick);

      // 5. Determine unknown seats and cards needed
      const unknownSeats = SEATS.filter((s) => !(s in knownHands) || !knownHands[s]);
      const cardsNeeded: Partial<Record<Seat, number>> = {};
      for (const seat of unknownSeats) {
        const played = playedCards.get(seat)?.length ?? 0;
        cardsNeeded[seat] = 13 - played;
      }

      // 6. Sample deals (with belief constraints from auction)
      const beliefConstraints = getBeliefConstraints(unknownSeats);
      const samples = samplePlayDeals({
        knownHands,
        playedCards,
        voids: tracker.getVoids(),
        unknownSeats,
        cardsNeeded,
        n: sampleCount,
        rng,
        beliefConstraints,
      });

      // 7. Fallback if no samples
      if (samples.length === 0) {
        return expertFallback(context);
      }

      // 8. DDS solve in batches with early termination
      const scores = new Map<string, { total: number; count: number }>();
      for (const c of context.legalPlays) {
        scores.set(cardKey(c), { total: 0, count: 0 });
      }

      const trump = trumpToDdsIndex(context.trumpSuit);
      const first = seatToDdsIndex(
        context.currentTrick.length > 0
          ? context.currentTrick[0]!.seat
          : context.seat,
      );

      // Build current trick DDS arrays
      const currentTrickSuit: number[] = [];
      const currentTrickRank: number[] = [];
      for (const play of context.currentTrick) {
        currentTrickSuit.push(suitToDdsIndex(play.card.suit));
        currentTrickRank.push(rankToDdsValue(play.card.rank));
      }

      let cumulativeSuccessCount = 0;
      const batches = chunk(samples, BATCH_SIZE);

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx]!;

        // Fire all DDS calls in batch concurrently
        const promises = batch.map((sample) =>
          engine.solveBoard(
            trump,
            first,
            currentTrickSuit,
            currentTrickRank,
            handsToPBN(sample),
          ),
        );
        const results = await Promise.allSettled(promises);

        // Accumulate scores from fulfilled results
        for (const result of results) {
          if (result.status === "fulfilled") {
            for (const entry of result.value.cards) {
              const key = cardKey({ suit: entry.suit, rank: entry.rank });
              const existing = scores.get(key);
              if (existing) {
                existing.total += entry.score;
                existing.count++;
              }
            }
            cumulativeSuccessCount++;
          }
        }

        // Early termination: need ≥BATCH_SIZE cumulative successful results
        // for meaningful averages, and skip check on last batch (already done)
        if (
          cumulativeSuccessCount >= BATCH_SIZE &&
          batchIdx < batches.length - 1
        ) {
          const topTwo = computeTopTwo(scores, context.legalPlays);
          if (topTwo && topTwo.bestAvg - topTwo.secondBestAvg >= EARLY_TERM_MARGIN) {
            return {
              card: topTwo.bestCard,
              reason: `mc-dds (${cumulativeSuccessCount} samples, avg ${topTwo.bestAvg.toFixed(1)} tricks, early-stop)`,
            };
          }
        }
      }

      // 9. All solves failed → expert fallback
      if (cumulativeSuccessCount === 0) {
        return expertFallback(context);
      }

      // 10. Close call? Sample + solve more batches (up to 2× default)
      const topTwoCheck = computeTopTwo(scores, context.legalPlays);
      if (
        topTwoCheck &&
        topTwoCheck.bestAvg - topTwoCheck.secondBestAvg < EARLY_TERM_MARGIN &&
        cumulativeSuccessCount < sampleCount * 2
      ) {
        const extraNeeded = sampleCount * 2 - samples.length;
        if (extraNeeded > 0) {
          const extraSamples = samplePlayDeals({
            knownHands,
            playedCards,
            voids: tracker.getVoids(),
            unknownSeats,
            cardsNeeded,
            n: extraNeeded,
            rng,
            beliefConstraints,
          });

          const extraBatches = chunk(extraSamples, BATCH_SIZE);
          for (const batch of extraBatches) {
            const promises = batch.map((sample) =>
              engine.solveBoard(
                trump,
                first,
                currentTrickSuit,
                currentTrickRank,
                handsToPBN(sample),
              ),
            );
            const results = await Promise.allSettled(promises);

            for (const result of results) {
              if (result.status === "fulfilled") {
                for (const entry of result.value.cards) {
                  const key = cardKey({ suit: entry.suit, rank: entry.rank });
                  const existing = scores.get(key);
                  if (existing) {
                    existing.total += entry.score;
                    existing.count++;
                  }
                }
                cumulativeSuccessCount++;
              }
            }

            // Early termination in extended batches
            if (cumulativeSuccessCount >= BATCH_SIZE * 2) {
              const topTwo = computeTopTwo(scores, context.legalPlays);
              if (topTwo && topTwo.bestAvg - topTwo.secondBestAvg >= EARLY_TERM_MARGIN) {
                return {
                  card: topTwo.bestCard,
                  reason: `mc-dds (${cumulativeSuccessCount} samples, avg ${topTwo.bestAvg.toFixed(1)} tricks, extended-early-stop)`,
                };
              }
            }
          }
        }
      }

      // 11. Pick card with highest average
      let bestCard = context.legalPlays[0]!;
      let bestAvg = -1;

      for (const c of context.legalPlays) {
        const entry = scores.get(cardKey(c));
        if (entry && entry.count > 0) {
          const avg = entry.total / entry.count;
          if (avg > bestAvg) {
            bestAvg = avg;
            bestCard = c;
          }
        }
      }

      return {
        card: bestCard,
        reason: `mc-dds (${cumulativeSuccessCount} samples, avg ${bestAvg.toFixed(1)} tricks)`,
      };
    },
  };

  return {
    getStrategy() {
      return strategy;
    },
    onAuctionComplete(inferences: Record<Seat, PublicBeliefs>) {
      storedBeliefs = inferences;
    },
  };
}

/**
 * Legacy wrapper: creates MC+DDS provider with full belief constraints.
 * Use createMCDDSProvider directly for fine-grained control.
 */
export function createWorldClassProvider(
  engine: EnginePort,
  rng: () => number,
  sampleCount: number = DEFAULT_SAMPLE_COUNT,
): PlayStrategyProvider {
  return createMCDDSProvider(engine, rng, {
    useBeliefConstraints: true,
    sampleCount,
    id: "world-class",
    name: "World Class (MC+DDS)",
  });
}

// ── Helpers ───────────────────────────────────────────────────

/** Split array into chunks of at most `size` elements. */
function chunk<T>(arr: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size) as T[]);
  }
  return result;
}

/** Compute top-two average scores from accumulated DDS results. */
function computeTopTwo(
  scores: Map<string, { total: number; count: number }>,
  legalPlays: readonly Card[],
): { bestCard: Card; bestAvg: number; secondBestAvg: number } | undefined {
  let bestCard: Card | undefined;
  let bestAvg = -1;
  let secondBestAvg = -1;

  for (const c of legalPlays) {
    const entry = scores.get(cardKey(c));
    if (entry && entry.count > 0) {
      const avg = entry.total / entry.count;
      if (avg > bestAvg) {
        secondBestAvg = bestAvg;
        bestAvg = avg;
        bestCard = c;
      } else if (avg > secondBestAvg) {
        secondBestAvg = avg;
      }
    }
  }

  if (!bestCard || secondBestAvg < 0) return undefined;
  return { bestCard, bestAvg, secondBestAvg };
}

function findDummySeat(context: PlayContext): Seat | undefined {
  if (!context.dummyHand) return undefined;
  // Dummy is declarer's partner
  const declarer = context.contract.declarer;
  const partnerMap: Record<Seat, Seat> = {
    N: "S" as Seat,
    S: "N" as Seat,
    E: "W" as Seat,
    W: "E" as Seat,
  };
  return partnerMap[declarer];
}
