/**
 * Integration tests: full game store lifecycle.
 *
 * Verifies state transitions, DOM-flush readiness (isUserTurn, isProcessing,
 * legalCalls) across the complete drill flow: startDrill → userBid → feedback →
 * explanation. Tests bidding store robustness: DEV assertions, error recovery,
 * initialAuction edge cases, and injectable delays.
 */
import { describe, it, expect } from "vitest";
import { Seat, BidSuit } from "../../engine/types";
import type { Auction, AuctionEntry } from "../../engine/types";
import { createGameStore } from "../game.svelte";
import { createStubEngine } from "../../test-support/engine-stub";
import { makeSimpleTestDeal, makeDrillSession } from "../../test-support/fixtures";

describe("Task 1: DEV-mode assertion on uninitialized store", () => {
  it("userBid() is no-op when store not initialized", () => {
    const engine = createStubEngine();
    const store = createGameStore(engine);

    // Do NOT call startDrill — store is uninitialized
    // userBid returns void (sync wrapper) — errors silently swallowed
    store.userBid({ type: "pass" });
    // The store should remain in BIDDING phase, unchanged
    expect(store.phase).toBe("BIDDING");
  });

  it("runAiBids via startDrill works after proper init", async () => {
    const engine = createStubEngine();
    const store = createGameStore(engine);

    // Calling startDrill initializes the store — should not throw
    await store.startDrill({ deal: makeSimpleTestDeal(), session: makeDrillSession(), nsInferenceEngine: null, ewInferenceEngine: null });
    expect(store.deal).not.toBeNull();
  });
});

describe("Task 2: runAiBids() error recovery keeps state consistent", () => {
  it("bidHistory and auction stay consistent when engine fails mid-loop", async () => {
    let callCount = 0;
    const engine = createStubEngine({
      async addCall(auction: Auction, entry: AuctionEntry): Promise<Auction> {
        callCount++;
        if (callCount === 2) {
          throw new Error("engine failure on 2nd call");
        }
        return { entries: [...auction.entries, entry], isComplete: false };
      },
    });
    const store = createGameStore(engine);

    // Use a deal where North is dealer, so AI bids N, E, then user is S
    // The 2nd addCall (East's bid) will fail
    await store.startDrill({ deal: makeSimpleTestDeal(), session: makeDrillSession(), nsInferenceEngine: null, ewInferenceEngine: null });

    // After error recovery: bidHistory length should match auction entries length
    expect(store.bidHistory.length).toBe(store.auction.entries.length);
  });
});

describe("Task 3: init() handles double/redouble in explanation mapping", () => {
  it("maps double calls correctly in initialAuction replay", async () => {
    const engine = createStubEngine();
    const store = createGameStore(engine);

    const initialAuction: Auction = {
      entries: [
        { seat: Seat.North, call: { type: "bid", level: 1, strain: BidSuit.Hearts } },
        { seat: Seat.East, call: { type: "double" } },
      ],
      isComplete: false,
    };

    await store.startDrill({ deal: makeSimpleTestDeal(), session: makeDrillSession(), initialAuction, nsInferenceEngine: null, ewInferenceEngine: null });

    // The double entry should NOT have "Pass" as its explanation
    const doubleEntry = store.bidHistory.find(
      (e) => e.call.type === "double",
    );
    expect(doubleEntry).toBeDefined();
    expect(doubleEntry!.explanation).toBe("Double");
  });

  it("maps redouble calls correctly in initialAuction replay", async () => {
    const engine = createStubEngine();
    const store = createGameStore(engine);

    const initialAuction: Auction = {
      entries: [
        { seat: Seat.North, call: { type: "bid", level: 1, strain: BidSuit.Hearts } },
        { seat: Seat.East, call: { type: "double" } },
        { seat: Seat.South, call: { type: "redouble" } },
      ],
      isComplete: false,
    };

    await store.startDrill({ deal: makeSimpleTestDeal(), session: makeDrillSession(), initialAuction, nsInferenceEngine: null, ewInferenceEngine: null });

    const redoubleEntry = store.bidHistory.find(
      (e) => e.call.type === "redouble",
    );
    expect(redoubleEntry).toBeDefined();
    expect(redoubleEntry!.explanation).toBe("Redouble");
  });
});

describe("Task 4: injectable AI_BID_DELAY via delayFn", () => {
  it("AI bids complete without timer advancement when using no-op delay", async () => {
    const engine = createStubEngine();
    // Use a microtask delay (Promise.resolve()) instead of setTimeout to keep Svelte reactive context happy
    const store = createGameStore(engine, { delayFn: async () => { await Promise.resolve(); } });

    // With no-op delay, startDrill should complete AI bids instantly (no fake timers needed)
    await store.startDrill({ deal: makeSimpleTestDeal(), session: makeDrillSession(), nsInferenceEngine: null, ewInferenceEngine: null });

    // AI bids happened: North (dealer) and East bid before South's turn
    expect(store.bidHistory.length).toBe(2);
    expect(store.isUserTurn).toBe(true);
  });
});
