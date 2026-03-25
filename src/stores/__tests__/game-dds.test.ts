import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Seat, BidSuit } from "../../engine/types";
import type { DDSolution } from "../../engine/types";
import { createGameStore } from "../game.svelte";
import { createStubEngine } from "../../test-support/engine-stub";
import { makeDrillSession, makeSimpleTestDeal, createTestServiceSession } from "../../test-support/fixtures";
import type { DrillBundle } from "../../session/drill-types";
import { createLocalService } from "../../service";

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
    const promise = store.startDrill({ deal, session, nsInferenceEngine: null, ewInferenceEngine: null });
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
    const store = createGameStore(engine, createLocalService(engine));

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
    const store = createGameStore(engine, createLocalService(engine));

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
    const store = createGameStore(engine, createLocalService(engine));

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
    const store = createGameStore(engine, createLocalService(engine));

    await startDrillWithTimers(store);
    await vi.advanceTimersByTimeAsync(0);
    expect(store.ddsSolution).not.toBeNull();

    await store.reset();
    expect(store.ddsSolution).toBeNull();
    expect(store.ddsSolving).toBe(false);
    expect(store.ddsError).toBeNull();
  });

  it("wrong bid does not advance auction when convention is active (correct-path-only)", async () => {
    const solveDeal = vi.fn().mockResolvedValue(fakeDDSolution);
    const engine = createStubEngine({
      solveDeal,
      async isAuctionComplete(auction) {
        return auction.entries.length >= 4;
      },
    });
    const store = createGameStore(engine, createLocalService(engine));

    // Strategy that always suggests pass — any non-pass bid is wrong
    const strategy = {
      id: "test", name: "Test",
      getLastEvaluation() { return null; },
      suggest() { return { call: { type: "pass" as const }, ruleName: null, explanation: "Pass" }; },
    };

    const deal = makeSimpleTestDeal();
    const session = makeDrillSession();
    const bundle: DrillBundle = { deal, session, strategy, nsInferenceEngine: null, ewInferenceEngine: null };
    const { service, handle } = await createTestServiceSession(engine, bundle);
    void store.startDrill(bundle, service, handle);
    await vi.advanceTimersByTimeAsync(1200);

    // User makes a wrong bid (strategy says pass)
    expect(store.phase).toBe("BIDDING");
    await store.userBid({ type: "bid", level: 1, strain: BidSuit.Clubs });
    await vi.advanceTimersByTimeAsync(600);

    // Should have feedback showing, auction not advanced
    expect(store.bidFeedback).not.toBeNull();
    expect(store.phase).toBe("BIDDING");

    // Retry clears feedback, user can try again
    store.retryBid();
    await vi.advanceTimersByTimeAsync(100);

    expect(store.bidFeedback).toBeNull();
    expect(store.isUserTurn).toBe(true);
    // DDS was never triggered
    expect(solveDeal).not.toHaveBeenCalled();
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
    const store = createGameStore(engine, createLocalService(engine));

    await startDrillWithTimers(store);
    expect(store.ddsSolving).toBe(true);

    // Advance past the 10s timeout
    await vi.advanceTimersByTimeAsync(10_001);

    expect(store.ddsSolution).toBeNull();
    expect(store.ddsSolving).toBe(false);
    expect(store.ddsError).toBe("DDS analysis timed out");
  });
});
