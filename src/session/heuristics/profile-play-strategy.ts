/**
 * Factory for profile-based play strategy providers.
 *
 * Each profile assembles a different PlayHeuristic[] chain.
 * The strategy chain pattern (first non-null wins) means inference
 * heuristics are tried first, falling back to base heuristics.
 */

import type { PlayStrategy, PlayContext, PlayResult } from "../../conventions";
import type { Card, Seat } from "../../engine/types";
import type { EnginePort } from "../../engine/port";
import type { PublicBeliefs } from "../../inference/inference-types";
import type { PlayProfile, PlayStrategyProvider } from "./play-profiles";
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
  isDefender,
  isHonor,
  rankBeats,
} from "./heuristic-play";
import { inferenceHeuristics } from "./inference-play";
import { partnerSeat } from "../../engine/constants";
import { createWorldClassProvider, createMCDDSProvider } from "./montecarlo-play";

// ── Base heuristic chain (L0) ───────────────────────────────────────

const BASE_HEURISTICS: readonly PlayHeuristic[] = [
  openingLeadHeuristic,
  midGameLeadHeuristic,
  secondHandLowHeuristic,
  thirdHandHighHeuristic,
  fourthHandPlayHeuristic,
  coverHonorHeuristic,
  trumpManagementHeuristic,
  discardManagementHeuristic,
];

// ── Skip wrapper for beginner errors ────────────────────────────────

/**
 * Wraps a heuristic to probabilistically skip it (return null).
 * Simulates beginner omissions of correct technique.
 */
function withSkipProbability(
  heuristic: PlayHeuristic,
  skipRate: number,
  rng: () => number,
): PlayHeuristic {
  return {
    name: heuristic.name,
    apply(context: PlayContext): Card | null {
      if (rng() < skipRate) return null; // beginner misses this technique
      return heuristic.apply(context);
    },
  };
}

// ── Card counting heuristic (Expert) ────────────────────────────────

/**
 * Expert heuristic: counts cards played to narrow suit distributions
 * and make better follow-suit / finesse decisions.
 *
 * Tracks remaining cards per suit per seat to detect when an opponent
 * is void or has a known number of cards left in a suit.
 */
const cardCountingHeuristic: PlayHeuristic = {
  name: "card-counting",
  apply(context: PlayContext): Card | null {
    const { currentTrick, previousTricks, seat, contract, legalPlays } = context;

    // Only useful in 2nd+ position with previous play data
    if (previousTricks.length === 0 && currentTrick.length === 0) return null;
    if (!isDefender(seat, contract.declarer)) return null;

    const ledSuit = currentTrick.length > 0 ? currentTrick[0]!.card.suit : undefined;
    if (!ledSuit) return null;

    // Track which opponents showed void (didn't follow suit)
    const declarerSide = new Set([contract.declarer, partnerSeat(contract.declarer)]);
    for (const trick of previousTricks) {
      if (trick.plays.length === 0) continue;
      const trickLedSuit = trick.plays[0]!.card.suit;
      if (trickLedSuit !== ledSuit) continue;

      for (const play of trick.plays) {
        if (play.card.suit !== trickLedSuit && declarerSide.has(play.seat)) {
          // Declarer side showed void in this suit — our cards in this suit are winners
          const ourSuitCards = legalPlays.filter((c) => c.suit === ledSuit);
          if (ourSuitCards.length > 0 && currentTrick.length <= 1) {
            // Lead or play high — our cards are likely winners
            return sortByRankAsc(ourSuitCards).at(-1) ?? null;
          }
        }
      }
    }

    return null;
  },
};

// ── Restricted choice heuristic (Expert) ────────────────────────────

/**
 * Expert heuristic: restricted choice reasoning.
 * When an opponent plays an honor from possible equals (e.g., Q from QJ),
 * the other honor is more likely in the opposite hand.
 */
const restrictedChoiceHeuristic: PlayHeuristic = {
  name: "restricted-choice",
  apply(context: PlayContext): Card | null {
    const { currentTrick, previousTricks, contract, legalPlays } = context;

    // Only applies in 2nd/3rd position with previous trick data
    if (currentTrick.length !== 1 && currentTrick.length !== 2) return null;
    if (previousTricks.length === 0) return null;

    const ledSuit = currentTrick[0]!.card.suit;
    const suitCards = legalPlays.filter((c) => c.suit === ledSuit);
    if (suitCards.length === 0) return null;

    // Look at recent tricks for honor plays that suggest restricted choice
    const lastTrick = previousTricks.at(-1);
    if (!lastTrick || lastTrick.plays.length < 4) return null;

    // Check if an opponent played an honor from possible equals in the same suit
    const declarerSide = new Set([contract.declarer, partnerSeat(contract.declarer)]);
    for (const play of lastTrick.plays) {
      if (play.card.suit !== ledSuit) continue;
      if (declarerSide.has(play.seat)) continue; // only opponents relevant for defenders
      if (!isHonor(play.card.rank)) continue;

      // This opponent played an honor — by restricted choice, the adjacent honor
      // is more likely with the OTHER opponent. If we're choosing between playing
      // high and low, this tips toward playing high if the other opponent likely
      // has the missing honor.
      const hasHigherHonor = suitCards.some(
        (c) => isHonor(c.rank) && rankBeats(c.rank, play.card.rank),
      );
      if (hasHigherHonor) {
        // Play our higher honor — the missing intermediate honor is likely elsewhere
        const sorted = suitCards.filter(
          (c) => isHonor(c.rank) && rankBeats(c.rank, play.card.rank),
        );
        return sortByRankAsc(sorted)[0] ?? null;
      }
    }

    return null;
  },
};

// ── Expert-only heuristics ──────────────────────────────────────────

const EXPERT_HEURISTICS: readonly PlayHeuristic[] = [
  cardCountingHeuristic,
  restrictedChoiceHeuristic,
];

// ── Strategy builder from heuristic chain ───────────────────────────

function buildPlayStrategy(
  id: string,
  name: string,
  heuristics: readonly PlayHeuristic[],
): PlayStrategy {
  return {
    id,
    name,
    suggest(context: PlayContext): Promise<PlayResult> {
      if (context.legalPlays.length === 0) {
        throw new Error("No legal plays available");
      }

      for (const h of heuristics) {
        const card = h.apply(context);
        if (card) {
          if (context.legalPlays.some((c) => c.suit === card.suit && c.rank === card.rank)) {
            return Promise.resolve({ card, reason: h.name });
          }
        }
      }

      // Fallback: lowest legal card
      const sorted = sortByRankAsc(context.legalPlays);
      const fallback = sorted[0] ?? context.legalPlays[0]!;
      return Promise.resolve({ card: fallback, reason: "default-lowest" });
    },
  };
}

// ── Provider factories ──────────────────────────────────────────────

function createBeginnerProvider(
  profile: PlayProfile,
  rng: () => number,
): PlayStrategyProvider {
  const chain: PlayHeuristic[] = BASE_HEURISTICS.map((h) => {
    if (profile.skippableHeuristics.includes(h.name)) {
      return withSkipProbability(h, profile.heuristicSkipRate, rng);
    }
    return h;
  });

  const strategy = buildPlayStrategy("beginner", "Beginner Play", chain);

  return {
    getStrategy() {
      return strategy;
    },
  };
}

function createClubPlayerProvider(
  _profile: PlayProfile,
  _rng: () => number,
): PlayStrategyProvider {
  // Club player: inference + expert-only (card counting, restricted choice) + base chain
  const chain: PlayHeuristic[] = [
    ...inferenceHeuristics,
    ...EXPERT_HEURISTICS,
    ...BASE_HEURISTICS,
  ];
  const strategy = buildPlayStrategy("club-player", "Club Player Play", chain);

  return {
    getStrategy() {
      return strategy;
    },
  };
}

function createExpertProvider(
  _profile: PlayProfile,
  rng: () => number,
  engine?: EnginePort,
): PlayStrategyProvider {
  // Expert: MC+DDS with void constraints but WITHOUT auction belief constraints.
  // Falls back to heuristic chain when no engine is available.
  if (engine) {
    return createMCDDSProvider(engine, rng, {
      useBeliefConstraints: false,
      id: "expert",
      name: "Expert (MC+DDS)",
    });
  }

  // No engine → heuristic fallback (inference + expert-only + base)
  const chain: PlayHeuristic[] = [
    ...inferenceHeuristics,
    ...EXPERT_HEURISTICS,
    ...BASE_HEURISTICS,
  ];
  const strategy = buildPlayStrategy("expert", "Expert Play", chain);
  return {
    getStrategy() {
      return strategy;
    },
    onAuctionComplete() {
      // No-op in heuristic fallback — inferences read from PlayContext directly
    },
  };
}

// ── Public factory ──────────────────────────────────────────────────

interface ProfileStrategyOptions {
  readonly rng?: () => number;
  readonly engine?: EnginePort;
}

/**
 * Creates a PlayStrategyProvider for the given profile.
 * - Beginner: base heuristics with skip probability on selected heuristics
 * - Club Player: inference + expert-only (card counting, restricted choice) + base
 * - Expert: MC+DDS without belief constraints (falls back to heuristic chain if no engine)
 * - World Class: MC+DDS with full belief constraints (requires engine)
 */
export function createProfileStrategyProvider(
  profile: PlayProfile,
  options?: ProfileStrategyOptions,
): PlayStrategyProvider {
  const rng = options?.rng ?? Math.random;

  switch (profile.id) {
    case "beginner":
      return createBeginnerProvider(profile, rng);
    case "club-player":
      return createClubPlayerProvider(profile, rng);
    case "expert":
      return createExpertProvider(profile, rng, options?.engine);
    case "world-class":
      if (!options?.engine) {
        // Fall back to expert when no engine provided (DDS requires engine)
        return createExpertProvider(profile, rng);
      }
      return createWorldClassProvider(options.engine, rng);
  }
}
