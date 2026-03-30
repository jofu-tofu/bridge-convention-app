/**
 * Shared test fixtures for game store tests.
 *
 * Provides common factory functions to reduce duplication across test files.
 * Each factory creates minimal valid objects for testing.
 */
import { vi } from "vitest";
import { tick } from "svelte";
import { Seat, BidSuit, Suit, Rank, Vulnerability } from "../engine/types";
import type { Card, Contract, Deal } from "../engine/types";

export function makeCard(suit: Suit, rank: Rank): Card {
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

/** Create a 1NT contract with given declarer. */
export function makeContract(declarer: Seat): Contract {
  return {
    level: 1,
    strain: BidSuit.NoTrump,
    doubled: false,
    redoubled: false,
    declarer,
  };
}

/**
 * Flush all pending async work when using fake timers.
 * Runs all timers repeatedly to drain nested setTimeout chains.
 */
export async function flushWithFakeTimers() {
  for (let i = 0; i < 20; i++) {
    await vi.runAllTimersAsync();
  }
  await tick();
}
