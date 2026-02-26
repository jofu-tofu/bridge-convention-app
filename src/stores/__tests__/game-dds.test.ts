import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Seat, BidSuit } from "../../engine/types";
import type { DDSolution } from "../../engine/types";
import { createGameStore } from "../game.svelte";
import { createStubEngine } from "../../test-support/engine-stub";
import { makeDrillSession, makeSimpleTestDeal } from "../../test-support/fixtures";

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

describe("game store DDS state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Start drill and advance timers past AI bid delays. Skips DECLARER_PROMPT if reached. */
  async function startDrillWithTimers(
    store: ReturnType<typeof createGameStore>,
    deal = makeSimpleTestDeal(),
    session = makeDrillSession(),
    { skipPrompt = true }: { skipPrompt?: boolean } = {},
  ) {
    const promise = store.startDrill(deal, session);
    // Advance past AI bid delays (3 AI seats × 300ms each)
    await vi.advanceTimersByTimeAsync(1200);
    await promise;
    // Skip past DECLARER_PROMPT to reach EXPLANATION for DDS tests
    if (skipPrompt && store.phase === "DECLARER_PROMPT") {
      if (store.isSouthDeclarerPrompt) {
        store.declineSouthPlay();
      } else if (store.isDefenderPrompt) {
        store.declineDefend();
      } else {
        store.declineDeclarerSwap();
      }
    }
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

    const deal = makeSimpleTestDeal();
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

  it("triggers DDS solve after skipFromFeedback completes the auction", async () => {
    const solveDeal = vi.fn().mockResolvedValue(fakeDDSolution);
    let auctionLength = 0;
    const engine = createStubEngine({
      solveDeal,
      async addCall(auction, entry) {
        const newEntries = [...auction.entries, entry];
        auctionLength = newEntries.length;
        return {
          entries: newEntries,
          // Auction completes after 4 passes (N, E, S, W all pass)
          isComplete: newEntries.length >= 4,
        };
      },
      async isAuctionComplete(auction) {
        return auction.entries.length >= 4;
      },
      async getContract() {
        // Return a contract once auction is complete
        return auctionLength >= 4
          ? {
              level: 1 as const,
              strain: BidSuit.NoTrump,
              doubled: false,
              redoubled: false,
              declarer: Seat.North,
            }
          : null;
      },
    });
    const store = createGameStore(engine);

    // Start drill with dealer=North. AI bids N(pass), E(pass), then it's user's turn (S).
    const deal = makeSimpleTestDeal();
    const session = makeDrillSession();
    const startPromise = store.startDrill(deal, session);
    await vi.advanceTimersByTimeAsync(1200);
    await startPromise;

    // User makes a wrong bid (anything triggers feedback since session strategy says pass)
    expect(store.phase).toBe("BIDDING");
    await store.userBid({ type: "bid", level: 1, strain: BidSuit.Clubs });
    await vi.advanceTimersByTimeAsync(600);

    // Should have feedback showing
    expect(store.bidFeedback).not.toBeNull();

    // Skip from feedback — should complete auction and trigger DDS
    const skipPromise = store.skipFromFeedback();
    // Advance timers past AI bid delays (runAiBids uses 300ms delays)
    await vi.advanceTimersByTimeAsync(1200);
    await skipPromise;

    expect(store.phase).toBe("EXPLANATION");
    expect(store.contract).not.toBeNull();
    expect(solveDeal).toHaveBeenCalledWith(deal);

    // Flush for DDS resolve
    await vi.advanceTimersByTimeAsync(0);
    expect(store.ddsSolution).toEqual(fakeDDSolution);
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
