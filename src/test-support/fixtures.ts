/**
 * Shared test fixtures for game store tests.
 *
 * Provides common factory functions to reduce duplication across test files.
 * Each factory creates minimal valid objects for testing.
 */
import { Seat, Suit, Rank, Vulnerability } from "../engine/types";
import type { Card, Deal } from "../engine/types";
import { OpponentMode } from "../service";
import type { DrillSeed } from "../stores/drills.svelte";

/**
 * Default snapshot used by drill-store tests. Mirrors the production
 * defaults so legacy-record healing produces predictable values.
 */
export const TEST_DRILL_SEED: DrillSeed = {
  opponentMode: OpponentMode.None,
  playProfileId: "world-class",
  vulnerabilityDistribution: { none: 1, ours: 0, theirs: 0, both: 0 },
  showEducationalAnnotations: true,
};

/** Strict-validator-passing field bundle for `drillsStore.create({...})` calls. */
export const TEST_DRILL_TUNABLES = {
  opponentMode: TEST_DRILL_SEED.opponentMode,
  playProfileId: TEST_DRILL_SEED.playProfileId,
  vulnerabilityDistribution: TEST_DRILL_SEED.vulnerabilityDistribution,
  showEducationalAnnotations: TEST_DRILL_SEED.showEducationalAnnotations,
} as const;

function makeCard(suit: Suit, rank: Rank): Card {
  return { suit, rank };
}

/** All 13 ranks in ascending order. */
const ALL_RANKS = [
  Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six,
  Rank.Seven, Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack,
  Rank.Queen, Rank.King, Rank.Ace,
] as const;

/**
 * Create a simple deal where each seat has 13 cards of one suit.
 * N=Clubs, E=Diamonds, S=Hearts, W=Spades.
 */
export function makeSimpleTestDeal(dealer: Seat = Seat.North): Deal {
  return {
    hands: {
      [Seat.North]: { cards: ALL_RANKS.map((r) => makeCard(Suit.Clubs, r)) },
      [Seat.East]: { cards: ALL_RANKS.map((r) => makeCard(Suit.Diamonds, r)) },
      [Seat.South]: { cards: ALL_RANKS.map((r) => makeCard(Suit.Hearts, r)) },
      [Seat.West]: { cards: ALL_RANKS.map((r) => makeCard(Suit.Spades, r)) },
    },
    dealer,
    vulnerability: Vulnerability.None,
  };
}
