import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Seat, BidSuit, Vulnerability, Suit, Rank } from "../../engine/types";
import type { DDSolution, Hand } from "../../engine/types";
import { createGameStore } from "../game.svelte";
import { createStubEngine } from "../../components/__tests__/test-helpers";
import type { DrillSession } from "../../ai/types";

const fakeDDSolution: DDSolution = {
  tricks: {
    [Seat.North]: {
      [BidSuit.Clubs]: 10,
      [BidSuit.Diamonds]: 9,
      [BidSuit.Hearts]: 8,
      [BidSuit.Spades]: 11,
      [BidSuit.NoTrump]: 9,
    },
    [Seat.East]: {
      [BidSuit.Clubs]: 3,
      [BidSuit.Diamonds]: 4,
      [BidSuit.Hearts]: 5,
      [BidSuit.Spades]: 2,
      [BidSuit.NoTrump]: 4,
    },
    [Seat.South]: {
      [BidSuit.Clubs]: 10,
      [BidSuit.Diamonds]: 9,
      [BidSuit.Hearts]: 8,
      [BidSuit.Spades]: 11,
      [BidSuit.NoTrump]: 9,
    },
    [Seat.West]: {
      [BidSuit.Clubs]: 3,
      [BidSuit.Diamonds]: 4,
      [BidSuit.Hearts]: 5,
      [BidSuit.Spades]: 2,
      [BidSuit.NoTrump]: 4,
    },
  },
  par: {
    score: 400,
    contracts: [
      {
        level: 3,
        strain: BidSuit.NoTrump,
        declarer: Seat.South,
        doubled: false,
        overtricks: 0,
      },
    ],
  },
};

function makeDrillSession(userSeat: Seat = Seat.South): DrillSession {
  return {
    config: {
      conventionId: "test",
      userSeat,
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

function makeTestDeal() {
  const ranks = [
    Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six,
    Rank.Seven, Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack,
    Rank.Queen, Rank.King, Rank.Ace,
  ];
  const seatCards: Record<string, { suit: Suit; rank: Rank }[]> = {
    [Seat.North]: ranks.map((r) => ({ suit: Suit.Spades, rank: r })),
    [Seat.East]: ranks.map((r) => ({ suit: Suit.Hearts, rank: r })),
    [Seat.South]: ranks.map((r) => ({ suit: Suit.Diamonds, rank: r })),
    [Seat.West]: ranks.map((r) => ({ suit: Suit.Clubs, rank: r })),
  };
  return {
    hands: {
      [Seat.North]: { cards: seatCards[Seat.North]! },
      [Seat.East]: { cards: seatCards[Seat.East]! },
      [Seat.South]: { cards: seatCards[Seat.South]! },
      [Seat.West]: { cards: seatCards[Seat.West]! },
    },
    dealer: Seat.North,
    vulnerability: Vulnerability.None,
  };
}

describe("game store DDS state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Start drill and advance timers past AI bid delays. */
  async function startDrillWithTimers(
    store: ReturnType<typeof createGameStore>,
    deal = makeTestDeal(),
    session = makeDrillSession(),
  ) {
    const promise = store.startDrill(deal, session);
    // Advance past AI bid delays (3 AI seats × 300ms each)
    await vi.advanceTimersByTimeAsync(1200);
    await promise;
  }

  it("exposes DDS getters with null initial state", () => {
    const engine = createStubEngine();
    const store = createGameStore(engine);

    expect(store.ddsSolution).toBeNull();
    expect(store.ddsSolving).toBe(false);
    expect(store.ddsError).toBeNull();
  });

  it("triggers DDS solve when phase becomes EXPLANATION", async () => {
    const solveDeal = vi.fn().mockResolvedValue(fakeDDSolution);
    const engine = createStubEngine({
      solveDeal,
      async isAuctionComplete() {
        return true;
      },
      async getContract() {
        return {
          level: 3,
          strain: BidSuit.NoTrump,
          doubled: false,
          redoubled: false,
          declarer: Seat.South,
        };
      },
    });
    const store = createGameStore(engine);

    const deal = makeTestDeal();
    await startDrillWithTimers(store, deal);

    expect(store.phase).toBe("EXPLANATION");
    expect(solveDeal).toHaveBeenCalledWith(deal);

    // Flush microtasks for solveDeal promise to resolve
    await vi.advanceTimersByTimeAsync(0);

    expect(store.ddsSolution).toEqual(fakeDDSolution);
    expect(store.ddsSolving).toBe(false);
    expect(store.ddsError).toBeNull();
  });

  it("sets ddsError when solveDeal throws", async () => {
    const engine = createStubEngine({
      solveDeal: vi.fn().mockRejectedValue(new Error("DDS not available")),
      async isAuctionComplete() {
        return true;
      },
      async getContract() {
        return {
          level: 3,
          strain: BidSuit.NoTrump,
          doubled: false,
          redoubled: false,
          declarer: Seat.South,
        };
      },
    });
    const store = createGameStore(engine);

    await startDrillWithTimers(store);
    // Flush for rejection to propagate
    await vi.advanceTimersByTimeAsync(0);

    expect(store.ddsSolution).toBeNull();
    expect(store.ddsSolving).toBe(false);
    expect(store.ddsError).toBe("DDS not available");
  });

  it("resets DDS state on reset()", async () => {
    const engine = createStubEngine({
      solveDeal: vi.fn().mockResolvedValue(fakeDDSolution),
      async isAuctionComplete() {
        return true;
      },
      async getContract() {
        return {
          level: 3,
          strain: BidSuit.NoTrump,
          doubled: false,
          redoubled: false,
          declarer: Seat.South,
        };
      },
    });
    const store = createGameStore(engine);

    await startDrillWithTimers(store);
    await vi.advanceTimersByTimeAsync(0);
    expect(store.ddsSolution).not.toBeNull();

    await store.reset();
    expect(store.ddsSolution).toBeNull();
    expect(store.ddsSolving).toBe(false);
    expect(store.ddsError).toBeNull();
  });

  it("times out after 10 seconds", async () => {
    const neverResolves = new Promise<DDSolution>(() => {
      // intentionally never resolves
    });
    const engine = createStubEngine({
      solveDeal: vi.fn().mockReturnValue(neverResolves),
      async isAuctionComplete() {
        return true;
      },
      async getContract() {
        return {
          level: 3,
          strain: BidSuit.NoTrump,
          doubled: false,
          redoubled: false,
          declarer: Seat.South,
        };
      },
    });
    const store = createGameStore(engine);

    await startDrillWithTimers(store);
    expect(store.ddsSolving).toBe(true);

    // Advance past the 10s timeout
    await vi.advanceTimersByTimeAsync(10_001);

    expect(store.ddsSolution).toBeNull();
    expect(store.ddsSolving).toBe(false);
    expect(store.ddsError).toBe("DDS analysis timed out");
  });
});
