/**
 * Integration tests: full game store lifecycle.
 *
 * Verifies state transitions, DOM-flush readiness (isUserTurn, isProcessing,
 * legalCalls) across the complete drill flow: startDrill → userBid → feedback →
 * explanation. Tests bidding store robustness: DEV assertions, error recovery,
 * initialAuction edge cases, and injectable delays.
 */
import { describe, it, expect } from "vitest";
import { Seat, BidSuit, Vulnerability, Rank, Suit } from "../../engine/types";
import type { Auction, AuctionEntry } from "../../engine/types";
import { createGameStore } from "../game.svelte";
import { createStubEngine } from "../../components/__tests__/test-helpers";
import type { DrillSession } from "../../drill/types";

function makeTestDeal() {
  const ranks = [
    Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven,
    Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen, Rank.King, Rank.Ace,
  ];
  return {
    hands: {
      [Seat.North]: { cards: ranks.map((r) => ({ suit: Suit.Clubs, rank: r })) },
      [Seat.East]: { cards: ranks.map((r) => ({ suit: Suit.Diamonds, rank: r })) },
      [Seat.South]: { cards: ranks.map((r) => ({ suit: Suit.Hearts, rank: r })) },
      [Seat.West]: { cards: ranks.map((r) => ({ suit: Suit.Spades, rank: r })) },
    },
    dealer: Seat.North,
    vulnerability: Vulnerability.None,
  };
}

function makeDrillSession(userSeat: Seat = Seat.South): DrillSession {
  return {
    config: {
      conventionId: "test",
      userSeat,
      seatStrategies: {
        [Seat.North]: { id: "pass", name: "Pass", suggest: () => ({ call: { type: "pass" as const }, ruleName: null, explanation: "pass" }) },
        [Seat.East]: { id: "pass", name: "Pass", suggest: () => ({ call: { type: "pass" as const }, ruleName: null, explanation: "pass" }) },
        [Seat.South]: "user",
        [Seat.West]: { id: "pass", name: "Pass", suggest: () => ({ call: { type: "pass" as const }, ruleName: null, explanation: "pass" }) },
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
    await store.startDrill(makeTestDeal(), makeDrillSession());
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
    await store.startDrill(makeTestDeal(), makeDrillSession());

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

    await store.startDrill(makeTestDeal(), makeDrillSession(), initialAuction);

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

    await store.startDrill(makeTestDeal(), makeDrillSession(), initialAuction);

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
    await store.startDrill(makeTestDeal(), makeDrillSession());

    // AI bids happened: North (dealer) and East bid before South's turn
    expect(store.bidHistory.length).toBe(2);
    expect(store.isUserTurn).toBe(true);
  });
});
