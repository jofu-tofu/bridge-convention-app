import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BidSuit } from "../../engine/types";
import type { Call } from "../../engine/types";
import { createGameStore } from "../game.svelte";
import { BidGrade } from "../../teaching/teaching-resolution";
import { createStubEngine } from "../../test-support/engine-stub";
import type { ConventionBiddingStrategy, BidResult } from "../../core/contracts";
import { makeDrillSession, makeSimpleTestDeal, flushWithFakeTimers } from "../../test-support/fixtures";

/** Strategy that always suggests 2C (Stayman-like). */
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

/** Strategy with a primary bid plus a preferred acceptable alternative. */
function makePrimaryWithAcceptableAlternativeStrategy(): ConventionBiddingStrategy {
  return {
    id: "test-with-alternative",
    name: "Test With Alternative",
    getLastEvaluation() { return null; },
    suggest(): BidResult {
      return {
        call: { type: "bid", level: 2, strain: BidSuit.Clubs },
        ruleName: "stayman-ask",
        explanation: "Bid 2C to ask for a 4-card major",
        resolvedCandidates: [
          {
            bidName: "stayman-2d-alt",
            meaning: "Alternative treatment",
            call: { type: "bid", level: 2, strain: BidSuit.Diamonds },
            resolvedCall: { type: "bid", level: 2, strain: BidSuit.Diamonds },
            isDefaultCall: true,
            legal: true,
            isMatched: false,
            priority: "preferred",
            intentType: "Alternative",
            failedConditions: [],
          },
        ],
      };
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

describe("bid feedback — user-facing behavior", () => {
  function makeStore() {
    const engine = createStubEngine({
      async isAuctionComplete() {
        return false;
      },
    });
    return createGameStore(engine);
  }

  describe("when user bids incorrectly", () => {
    it("auction pauses so user can review their mistake", async () => {
      const store = makeStore();
      store.startDrill({
        deal: makeSimpleTestDeal(),
        session: makeDrillSession(),
        strategy: make2CStrategy(),
        nsInferenceEngine: null,
        ewInferenceEngine: null,
      });
      await flushActions();

      // User is on turn
      expect(store.isUserTurn).toBe(true);
      store.userBid({ type: "pass" }); // wrong — should be 2C
      await flushActions();

      // Auction is paused: feedback is showing, input is blocked
      expect(store.bidFeedback).not.toBeNull();
      expect(store.isFeedbackBlocking).toBe(true);
    });

    it("tells user what the correct bid was", async () => {
      const store = makeStore();
      store.startDrill({
        deal: makeSimpleTestDeal(),
        session: makeDrillSession(),
        strategy: make2CStrategy(),
        nsInferenceEngine: null,
        ewInferenceEngine: null,
      });
      await flushActions();
      store.userBid({ type: "pass" });
      await flushActions();

      // Feedback contains the correct bid the user should have made
      const feedback = store.bidFeedback!;
      expect(feedback.grade).toBe(BidGrade.Incorrect);
      expect(feedback.expectedResult!.call).toEqual({
        type: "bid",
        level: 2,
        strain: BidSuit.Clubs,
      });
      expect(feedback.expectedResult!.explanation).toBe(
        "Bid 2C to ask for a 4-card major",
      );
    });

    it("user can retry after incorrect feedback (correct-path-only)", async () => {
      const store = makeStore();
      store.startDrill({
        deal: makeSimpleTestDeal(),
        session: makeDrillSession(),
        strategy: make2CStrategy(),
        nsInferenceEngine: null,
        ewInferenceEngine: null,
      });
      await flushActions();

      expect(store.bidFeedback).toBeNull();

      store.userBid({ type: "pass" }); // wrong
      await flushActions();

      expect(store.bidFeedback).not.toBeNull();
      expect(store.bidFeedback!.grade).toBe(BidGrade.Incorrect);

      store.retryBid();
      await flushActions();

      // Feedback gone, user is back on turn (auction was never modified)
      expect(store.bidFeedback).toBeNull();
      expect(store.isUserTurn).toBe(true);
    });

    it("wrong bid is not applied to the auction (correct-path-only)", async () => {
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

      // Auction unchanged — wrong bid was not applied
      expect(store.auction).toBe(auctionBefore);
    });
  });

  describe("when user bids correctly", () => {
    it("auction continues without interruption", async () => {
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

      // No feedback blocking — auction continued, it's user's turn again (AI all passed)
      expect(store.bidFeedback).toBeNull();
      expect(store.isUserTurn).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("passing is correct when convention does not apply", async () => {
      const store = makeStore();
      store.startDrill({
        deal: makeSimpleTestDeal(),
        session: makeDrillSession(),
        strategy: makeNoOpStrategy(),
        nsInferenceEngine: null,
        ewInferenceEngine: null,
      });
      await flushActions();

      store.userBid({ type: "pass" });
      await flushActions();

      // Strategy returned null → pass is the right call → no feedback
      expect(store.bidFeedback).toBeNull();
    });

    it("works without a convention strategy (no correctness checking)", async () => {
      const store = makeStore();
      store.startDrill({ deal: makeSimpleTestDeal(), session: makeDrillSession(), nsInferenceEngine: null, ewInferenceEngine: null });
      await flushActions();

      store.userBid({ type: "pass" });
      await flushActions();

      // No strategy → no correctness checking → no feedback
      expect(store.bidFeedback).toBeNull();
    });

    it("non-pass bid gets Incorrect feedback when convention does not apply", async () => {
      const store = makeStore();
      store.startDrill({
        deal: makeSimpleTestDeal(),
        session: makeDrillSession(),
        strategy: makeNoOpStrategy(),
        nsInferenceEngine: null,
        ewInferenceEngine: null,
      });
      await flushActions();

      // Strategy returned null → pass is the right call → 7NT should be rejected
      store.userBid({ type: "bid", level: 7, strain: BidSuit.NoTrump });
      await flushActions();

      expect(store.bidFeedback).not.toBeNull();
      expect(store.bidFeedback!.grade).toBe(BidGrade.Incorrect);
      expect(store.bidFeedback!.expectedResult!.call).toEqual({ type: "pass" });
      expect(store.isFeedbackBlocking).toBe(true);
    });

    it("non-pass bid is not applied to auction when convention does not apply", async () => {
      const store = makeStore();
      store.startDrill({
        deal: makeSimpleTestDeal(),
        session: makeDrillSession(),
        strategy: makeNoOpStrategy(),
        nsInferenceEngine: null,
        ewInferenceEngine: null,
      });
      await flushActions();

      const auctionBefore = store.auction;
      store.userBid({ type: "bid", level: 7, strain: BidSuit.NoTrump });
      await flushActions();

      // Auction unchanged — wrong bid was not applied
      expect(store.auction).toBe(auctionBefore);
    });
  });

  describe("multi-grade feedback", () => {
    it("acceptable bid gets Acceptable grade but blocks (correct-path-only)", async () => {
      const store = makeStore();
      store.startDrill({
        deal: makeSimpleTestDeal(),
        session: makeDrillSession(),
        strategy: makePrimaryWithAcceptableAlternativeStrategy(),
        nsInferenceEngine: null,
        ewInferenceEngine: null,
      });
      await flushActions();

      store.userBid({ type: "bid", level: 2, strain: BidSuit.Diamonds });
      await flushActions();

      // Acceptable grade is shown but blocks — only #1 truth-set winner proceeds
      expect(store.bidFeedback?.grade).toBe(BidGrade.Acceptable);
      expect(store.isFeedbackBlocking).toBe(true);

      store.retryBid();
      await flushActions();
      expect(store.bidFeedback).toBeNull();
      expect(store.isUserTurn).toBe(true);
    });

    it("incorrect bid gets Incorrect grade with retry offered", async () => {
      const store = makeStore();
      store.startDrill({
        deal: makeSimpleTestDeal(),
        session: makeDrillSession(),
        strategy: makePrimaryWithAcceptableAlternativeStrategy(),
        nsInferenceEngine: null,
        ewInferenceEngine: null,
      });
      await flushActions();

      store.userBid({ type: "bid", level: 3, strain: BidSuit.Clubs });
      await flushActions();

      expect(store.bidFeedback?.grade).toBe(BidGrade.Incorrect);
      expect(store.isFeedbackBlocking).toBe(true);

      store.retryBid();
      await flushActions();
      expect(store.bidFeedback).toBeNull();
      expect(store.isUserTurn).toBe(true);
    });

    it("acceptable bid is not applied to auction (correct-path-only)", async () => {
      const store = makeStore();
      store.startDrill({
        deal: makeSimpleTestDeal(),
        session: makeDrillSession(),
        strategy: makePrimaryWithAcceptableAlternativeStrategy(),
        nsInferenceEngine: null,
        ewInferenceEngine: null,
      });
      await flushActions();

      store.userBid({ type: "bid", level: 2, strain: BidSuit.Diamonds });
      await flushActions();

      // Acceptable bid was not applied — no user entries in bid history
      const userEntries = store.bidHistory.filter((entry) => entry.isUser);
      expect(userEntries).toHaveLength(0);
    });
  });
});
