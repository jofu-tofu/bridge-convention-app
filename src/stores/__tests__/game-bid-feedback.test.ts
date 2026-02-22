import { describe, it, expect } from "vitest";
import { Seat, BidSuit, Vulnerability, Rank, Suit } from "../../engine/types";
import type { Call } from "../../engine/types";
import { createGameStore } from "../game.svelte";
import { createStubEngine } from "../../components/__tests__/test-helpers";
import type { DrillSession } from "../../ai/types";
import type { BiddingStrategy, BidResult } from "../../shared/types";

/** Strategy that always suggests 2C (Stayman-like). */
function make2CStrategy(): BiddingStrategy {
  return {
    id: "test-strategy",
    name: "Test Convention",
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
function makeNoOpStrategy(): BiddingStrategy {
  return {
    id: "noop",
    name: "No-Op",
    suggest(): null {
      return null;
    },
  };
}

function makeTestDeal() {
  const ranks = [
    Rank.Two,
    Rank.Three,
    Rank.Four,
    Rank.Five,
    Rank.Six,
    Rank.Seven,
    Rank.Eight,
    Rank.Nine,
    Rank.Ten,
    Rank.Jack,
    Rank.Queen,
    Rank.King,
    Rank.Ace,
  ];
  return {
    hands: {
      [Seat.North]: {
        cards: ranks.map((r) => ({ suit: Suit.Clubs, rank: r })),
      },
      [Seat.East]: {
        cards: ranks.map((r) => ({ suit: Suit.Diamonds, rank: r })),
      },
      [Seat.South]: {
        cards: ranks.map((r) => ({ suit: Suit.Hearts, rank: r })),
      },
      [Seat.West]: {
        cards: ranks.map((r) => ({ suit: Suit.Spades, rank: r })),
      },
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
      await store.startDrill(
        makeTestDeal(),
        makeDrillSession(),
        undefined,
        make2CStrategy(),
      );

      // User is on turn
      expect(store.isUserTurn).toBe(true);
      await store.userBid({ type: "pass" }); // wrong — should be 2C

      // Auction is paused: feedback is showing, not user's turn
      expect(store.bidFeedback).not.toBeNull();
      expect(store.isUserTurn).toBe(false);
    });

    it("tells user what the correct bid was", async () => {
      const store = makeStore();
      await store.startDrill(
        makeTestDeal(),
        makeDrillSession(),
        undefined,
        make2CStrategy(),
      );
      await store.userBid({ type: "pass" });

      // Feedback contains the correct bid the user should have made
      const feedback = store.bidFeedback!;
      expect(feedback.isCorrect).toBe(false);
      expect(feedback.expectedResult!.call).toEqual({
        type: "bid",
        level: 2,
        strain: BidSuit.Clubs,
      });
      expect(feedback.expectedResult!.explanation).toBe(
        "Bid 2C to ask for a 4-card major",
      );
    });

    it("auction resumes when user dismisses feedback", async () => {
      const store = makeStore();
      await store.startDrill(
        makeTestDeal(),
        makeDrillSession(),
        undefined,
        make2CStrategy(),
      );
      await store.userBid({ type: "pass" });

      expect(store.bidFeedback).not.toBeNull();

      await store.dismissBidFeedback();

      // Feedback gone, auction has moved on
      expect(store.bidFeedback).toBeNull();
      expect(store.isUserTurn).toBe(true); // AI all passed, back to user
    });

    it("user can skip directly to review", async () => {
      const store = makeStore();
      await store.startDrill(
        makeTestDeal(),
        makeDrillSession(),
        undefined,
        make2CStrategy(),
      );
      await store.userBid({ type: "pass" });

      await store.skipFromFeedback();

      expect(store.phase).toBe("EXPLANATION");
      expect(store.bidFeedback).toBeNull();
    });
  });

  describe("when user bids correctly", () => {
    it("auction continues without interruption", async () => {
      const store = makeStore();
      await store.startDrill(
        makeTestDeal(),
        makeDrillSession(),
        undefined,
        make2CStrategy(),
      );

      const correctBid: Call = { type: "bid", level: 2, strain: BidSuit.Clubs };
      await store.userBid(correctBid);

      // No feedback blocking — auction continued, it's user's turn again (AI all passed)
      expect(store.bidFeedback).toBeNull();
      expect(store.isUserTurn).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("passing is correct when convention does not apply", async () => {
      const store = makeStore();
      await store.startDrill(
        makeTestDeal(),
        makeDrillSession(),
        undefined,
        makeNoOpStrategy(),
      );

      await store.userBid({ type: "pass" });

      // Strategy returned null → pass is the right call → no feedback
      expect(store.bidFeedback).toBeNull();
    });

    it("works without a convention strategy (no correctness checking)", async () => {
      const store = makeStore();
      await store.startDrill(makeTestDeal(), makeDrillSession());

      await store.userBid({ type: "pass" });

      // No strategy → compares against pass → correct → no feedback
      expect(store.bidFeedback).toBeNull();
    });
  });
});
