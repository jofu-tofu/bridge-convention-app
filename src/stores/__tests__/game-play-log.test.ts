import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Seat, Suit, Rank, Vulnerability } from "../../engine/types";
import type { Hand, Deal } from "../../engine/types";
import { createGameStore } from "../game.svelte";
import { createStubEngine } from "../../components/__tests__/test-helpers";
import type { DrillSession } from "../../ai/types";
import type { PlayStrategy, PlayResult, PlayContext } from "../../shared/types";

function makeHand(cards: Array<{ suit: Suit; rank: Rank }>): Hand {
  return { cards };
}

const testCards = [
  { suit: Suit.Spades, rank: Rank.Ace },
  { suit: Suit.Spades, rank: Rank.King },
  { suit: Suit.Spades, rank: Rank.Queen },
  { suit: Suit.Hearts, rank: Rank.Jack },
  { suit: Suit.Hearts, rank: Rank.Ten },
  { suit: Suit.Hearts, rank: Rank.Nine },
  { suit: Suit.Diamonds, rank: Rank.Eight },
  { suit: Suit.Diamonds, rank: Rank.Seven },
  { suit: Suit.Diamonds, rank: Rank.Six },
  { suit: Suit.Diamonds, rank: Rank.Five },
  { suit: Suit.Clubs, rank: Rank.Four },
  { suit: Suit.Clubs, rank: Rank.Three },
  { suit: Suit.Clubs, rank: Rank.Two },
];

function makeTestDeal(): Deal {
  return {
    hands: {
      [Seat.North]: makeHand(testCards),
      [Seat.East]: makeHand(testCards),
      [Seat.South]: makeHand(testCards),
      [Seat.West]: makeHand(testCards),
    },
    dealer: Seat.North,
    vulnerability: Vulnerability.None,
  };
}

const testPlayStrategy: PlayStrategy = {
  id: "test-play",
  name: "Test Play",
  suggest(ctx: PlayContext): PlayResult {
    return { card: ctx.legalPlays[0]!, reason: "test-heuristic" };
  },
};

function makeDrillSession(
  userSeat: Seat = Seat.South,
  playStrategy?: PlayStrategy,
): DrillSession {
  return {
    config: {
      conventionId: "test",
      userSeat,
      playStrategy,
      seatStrategies: {
        [Seat.North]: {
          id: "pass",
          name: "Pass",
          suggest: () => ({
            call: { type: "pass" as const },
            ruleName: null,
            explanation: "pass",
          }),
        },
        [Seat.East]: {
          id: "pass",
          name: "Pass",
          suggest: () => ({
            call: { type: "pass" as const },
            ruleName: null,
            explanation: "pass",
          }),
        },
        [Seat.South]: "user",
        [Seat.West]: {
          id: "pass",
          name: "Pass",
          suggest: () => ({
            call: { type: "pass" as const },
            ruleName: null,
            explanation: "pass",
          }),
        },
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

describe("game store playLog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("playLog starts empty after startDrill", async () => {
    const engine = createStubEngine();
    const store = createGameStore(engine);
    const session = makeDrillSession(Seat.South, testPlayStrategy);

    const drillPromise = store.startDrill(makeTestDeal(), session);
    // Advance past AI bid delays (3 AI seats × 300ms each)
    await vi.advanceTimersByTimeAsync(1000);
    await drillPromise;
    expect(store.playLog).toEqual([]);
  });

  it("playLog getter is exposed on the store", () => {
    const engine = createStubEngine();
    const store = createGameStore(engine);
    expect(store.playLog).toBeDefined();
    expect(Array.isArray(store.playLog)).toBe(true);
  });

  it("playInferences getter is exposed on the store", () => {
    const engine = createStubEngine();
    const store = createGameStore(engine);
    expect(store.playInferences).toBeNull();
  });

  it("inferenceTimeline getter is exposed on the store", () => {
    const engine = createStubEngine();
    const store = createGameStore(engine);
    expect(store.inferenceTimeline).toEqual([]);
  });
});
