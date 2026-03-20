/**
 * Characterization tests for bidding behavior.
 *
 * Written BEFORE extracting logic from bidding.svelte.ts to lock existing behavior.
 * Must pass before AND after extraction.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BidSuit, Seat } from "../../engine/types";
import type { Call, Auction } from "../../engine/types";
import { createGameStore } from "../game.svelte";
import { BidGrade } from "../../teaching/teaching-resolution";
import { createStubEngine } from "../../test-support/engine-stub";
import type { ConventionBiddingStrategy, BidResult } from "../../core/contracts";
import { makeDrillSession, makeSimpleTestDeal, flushWithFakeTimers } from "../../test-support/fixtures";

/** Strategy that always suggests 2C. */
function make2CStrategy(): ConventionBiddingStrategy {
  return {
    id: "test-strategy",
    name: "Test Convention",
    getLastEvaluation() { return null; },
    suggest(): BidResult {
      return {
        call: { type: "bid", level: 2, strain: BidSuit.Clubs },
        ruleName: "stayman-ask",
        explanation: "Bid 2C to ask for a 4-card major",
      };
    },
  };
}

/** Strategy that never applies (returns null → correct bid is pass). */
function makeNoOpStrategy(): ConventionBiddingStrategy {
  return {
    id: "noop",
    name: "No-Op",
    getLastEvaluation() { return null; },
    suggest(): null {
      return null;
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const flushActions = flushWithFakeTimers;

describe("bidding characterization — lock existing behavior", () => {
  function makeStore() {
    const engine = createStubEngine({
      async isAuctionComplete() { return false; },
    });
    return createGameStore(engine);
  }

  it("correct bid is accepted and applied to auction", async () => {
    const store = makeStore();
    store.startDrill({
      deal: makeSimpleTestDeal(),
      session: makeDrillSession(),
      strategy: make2CStrategy(),
      nsInferenceEngine: null,
      ewInferenceEngine: null,
    });
    await flushActions();

    const entriesBefore = store.auction.entries.length;
    const correctBid: Call = { type: "bid", level: 2, strain: BidSuit.Clubs };
    store.userBid(correctBid);
    await flushActions();

    // Auction grew — user's bid was applied
    expect(store.auction.entries.length).toBeGreaterThan(entriesBefore);
    // Feedback shows correct grade (momentarily) then clears
    expect(store.bidFeedback).toBeNull();
  });

  it("wrong bid is blocked with feedback, auction unchanged", async () => {
    const store = makeStore();
    store.startDrill({
      deal: makeSimpleTestDeal(),
      session: makeDrillSession(),
      strategy: make2CStrategy(),
      nsInferenceEngine: null,
      ewInferenceEngine: null,
    });
    await flushActions();

    const auctionBefore = store.auction;
    store.userBid({ type: "pass" }); // wrong — should be 2C
    await flushActions();

    expect(store.bidFeedback).not.toBeNull();
    expect(store.bidFeedback!.grade).not.toBe(BidGrade.Correct);
    // Auction unchanged
    expect(store.auction).toBe(auctionBefore);
  });

  it("retryBid clears feedback without changing auction", async () => {
    const store = makeStore();
    store.startDrill({
      deal: makeSimpleTestDeal(),
      session: makeDrillSession(),
      strategy: make2CStrategy(),
      nsInferenceEngine: null,
      ewInferenceEngine: null,
    });
    await flushActions();

    const auctionBefore = store.auction;
    store.userBid({ type: "pass" }); // wrong
    await flushActions();
    expect(store.bidFeedback).not.toBeNull();

    store.retryBid();
    await flushActions();

    expect(store.bidFeedback).toBeNull();
    expect(store.auction).toBe(auctionBefore);
  });

  it("AI bids run after user's correct bid", async () => {
    const store = makeStore();
    store.startDrill({
      deal: makeSimpleTestDeal(),
      session: makeDrillSession(),
      strategy: make2CStrategy(),
      nsInferenceEngine: null,
      ewInferenceEngine: null,
    });
    await flushActions();

    const correctBid: Call = { type: "bid", level: 2, strain: BidSuit.Clubs };
    store.userBid(correctBid);
    await flushActions();

    // After user's correct bid, AI bids should have run (3 AI seats pass)
    const aiEntries = store.bidHistory.filter(e => !e.isUser);
    expect(aiEntries.length).toBeGreaterThan(0);
  });

  it("auction completion triggers phase transition", async () => {
    const engine = createStubEngine({
      async isAuctionComplete() { return true; },
      async getContract() { return null; }, // passout → EXPLANATION
    });
    const store = createGameStore(engine);
    store.startDrill({
      deal: makeSimpleTestDeal(),
      session: makeDrillSession(),
      strategy: make2CStrategy(),
      nsInferenceEngine: null,
      ewInferenceEngine: null,
    });
    await flushActions();

    // isAuctionComplete returns true immediately → first AI bid completes auction
    expect(store.phase).toBe("EXPLANATION");
  });

  it("convention-exhausted suggest(null) means Pass is correct", async () => {
    const store = makeStore();
    store.startDrill({
      deal: makeSimpleTestDeal(),
      session: makeDrillSession(),
      strategy: makeNoOpStrategy(),
      nsInferenceEngine: null,
      ewInferenceEngine: null,
    });
    await flushActions();

    // Pass should be accepted
    store.userBid({ type: "pass" });
    await flushActions();
    expect(store.bidFeedback).toBeNull();
  });

  it("convention-exhausted suggest(null) rejects non-pass bids", async () => {
    const store = makeStore();
    store.startDrill({
      deal: makeSimpleTestDeal(),
      session: makeDrillSession(),
      strategy: makeNoOpStrategy(),
      nsInferenceEngine: null,
      ewInferenceEngine: null,
    });
    await flushActions();

    // Non-pass should be rejected
    store.userBid({ type: "bid", level: 1, strain: BidSuit.Clubs });
    await flushActions();
    expect(store.bidFeedback).not.toBeNull();
    expect(store.bidFeedback!.grade).toBe(BidGrade.Incorrect);
  });

  it("no strategy = any bid accepted, no grading", async () => {
    const store = makeStore();
    store.startDrill({
      deal: makeSimpleTestDeal(),
      session: makeDrillSession(),
      nsInferenceEngine: null,
      ewInferenceEngine: null,
      // No strategy
    });
    await flushActions();

    store.userBid({ type: "pass" });
    await flushActions();

    expect(store.bidFeedback).toBeNull();
  });

  it("initialAuction entries replay into bidHistory", async () => {
    const store = makeStore();
    const initialAuction: Auction = {
      entries: [
        { seat: Seat.North, call: { type: "bid", level: 1, strain: BidSuit.NoTrump } },
      ],
      isComplete: false,
    };
    store.startDrill({
      deal: makeSimpleTestDeal(),
      session: makeDrillSession(),
      strategy: make2CStrategy(),
      initialAuction,
      nsInferenceEngine: null,
      ewInferenceEngine: null,
    });
    await flushActions();

    // Initial auction entries should be in bidHistory
    expect(store.bidHistory.length).toBeGreaterThanOrEqual(1);
    // First entry should be the 1NT from initialAuction
    expect(store.bidHistory[0]!.call).toEqual({
      type: "bid",
      level: 1,
      strain: BidSuit.NoTrump,
    });
    expect(store.bidHistory[0]!.isUser).toBe(false);
  });
});
