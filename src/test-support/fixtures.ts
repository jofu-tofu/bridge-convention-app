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
import type { DrillSession } from "../drill/types";
import type { PlayStrategy } from "../shared/types";

export function makeCard(suit: Suit, rank: Rank): Card {
  return { suit, rank };
}

/** All 13 ranks in ascending order. */
export const ALL_RANKS = [
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

/** Create a minimal drill session for testing. All AI seats pass. */
export function makeDrillSession(
  userSeat: Seat = Seat.South,
  playStrategy?: PlayStrategy,
): DrillSession {
  const passStrategy = {
    id: "pass",
    name: "Pass",
    suggest: () => ({
      call: { type: "pass" as const },
      ruleName: null,
      explanation: "pass",
    }),
  };
  return {
    config: {
      conventionId: "test",
      userSeat,
      playStrategy,
      seatStrategies: {
        [Seat.North]: passStrategy,
        [Seat.East]: passStrategy,
        [Seat.South]: "user",
        [Seat.West]: passStrategy,
      },
    },
    getNextBid(seat) {
      if (seat === userSeat) return null;
      return { call: { type: "pass" }, ruleName: null, explanation: "AI pass" };
    },
    isUserSeat(seat) {
      return seat === userSeat;
    },
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

/**
 * Flush all pending async work when using real timers.
 * AI_BID_DELAY is 300ms × up to 4 AI bids = 1200ms max.
 */
export async function flushWithRealTimers() {
  await new Promise((r) => setTimeout(r, 1500));
  await tick();
}
