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

  /** Start drill via service and advance timers past AI bid delays. Skips DECLARER_PROMPT if reached. */
  async function startDrillWithTimers(
    store: ReturnType<typeof createGameStore>,
    enginePort: ReturnType<typeof createStubEngine>,
    deal = makeSimpleTestDeal(),
    session = makeDrillSession(),
    { skipPrompt = true }: { skipPrompt?: boolean } = {},
  ) {
    const bundle: DrillBundle = { deal, session, nsInferenceEngine: null, ewInferenceEngine: null };
    const { service: svc, handle } = await createTestServiceSession(enginePort, bundle);
    const promise = store.startDrillFromHandle(handle, svc);
    // Advance past AI bid delays (3 AI seats x 300ms each)
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
    const store = createGameStore(createLocalService(engine));

    expect(store.ddsSolution).toBeNull();
    expect(store.ddsSolving).toBe(false);
    expect(store.ddsError).toBeNull();
  });

  // DDS solve is triggered by the service's acceptPrompt("skip") when transitioning
  // to EXPLANATION. The store's triggerDDSSolve does NOT fire (deal is null in service
  // path), but the service-side DDSController does fire.
  it("DDS solve is triggered by service when skipping to explanation", async () => {
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
    const store = createGameStore(createLocalService(engine));

    await startDrillWithTimers(store, engine);

    expect(store.phase).toBe("EXPLANATION");
    // DDS solve triggered by service-side DDSController via acceptPrompt("skip")
    expect(solveDeal).toHaveBeenCalled();
  });

  it("resets DDS state on reset()", async () => {
    const engine = createStubEngine({
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
    const store = createGameStore(createLocalService(engine));

    await startDrillWithTimers(store, engine);

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
    const store = createGameStore(createLocalService(engine));

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
    void store.startDrillFromHandle(handle, service);
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

  it("DDS solve triggers via service when transitioning to EXPLANATION", async () => {
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
    const store = createGameStore(createLocalService(engine));

    await startDrillWithTimers(store, engine);

    // DDS solve fires via service.getDDSSolution() on transition to EXPLANATION
    expect(store.phase).toBe("EXPLANATION");
    // Flush microtasks for DDS solve to complete
    await vi.advanceTimersByTimeAsync(0);
    expect(store.ddsSolution).toEqual(fakeDDSolution);
    expect(store.ddsSolving).toBe(false);
  });
});
