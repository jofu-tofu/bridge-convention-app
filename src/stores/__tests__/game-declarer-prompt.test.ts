import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Seat, BidSuit, Vulnerability, Suit, Rank } from "../../engine/types";
import type { Contract, Hand } from "../../engine/types";
import { createGameStore } from "../game.svelte";
import { createStubEngine } from "../../components/__tests__/test-helpers";
import type { DrillSession } from "../../ai/types";
import type { EnginePort } from "../../engine/port";

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

function makeContract(declarer: Seat): Contract {
  return {
    level: 1,
    strain: BidSuit.NoTrump,
    doubled: false,
    redoubled: false,
    declarer,
  };
}

describe("DECLARER_PROMPT phase", () => {
  let engine: EnginePort;
  let store: ReturnType<typeof createGameStore>;
  const deal = makeTestDeal();
  const session = makeDrillSession();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createEngineWithDeclarer(declarer: Seat) {
    engine = createStubEngine({
      async getContract() {
        return makeContract(declarer);
      },
      async isAuctionComplete() {
        return true;
      },
      async getLegalPlays(hand: Hand) {
        return [...hand.cards];
      },
      async getTrickWinner() {
        return Seat.South;
      },
      async calculateScore() {
        return 90;
      },
    });
    store = createGameStore(engine);
  }

  /** Start drill and advance timers past AI bid delays only. */
  async function startDrillWithTimers() {
    const promise = store.startDrill(deal, session);
    await vi.advanceTimersByTimeAsync(600);
    await promise;
  }

  it("enters DECLARER_PROMPT when North declares (user=South is dummy)", async () => {
    createEngineWithDeclarer(Seat.North);
    await startDrillWithTimers();
    expect(store.phase).toBe("DECLARER_PROMPT");
  });

  it("goes directly to EXPLANATION when South declares (user is declarer)", async () => {
    createEngineWithDeclarer(Seat.South);
    await startDrillWithTimers();
    expect(store.phase).toBe("EXPLANATION");
  });

  it("goes directly to EXPLANATION when East declares", async () => {
    createEngineWithDeclarer(Seat.East);
    await startDrillWithTimers();
    expect(store.phase).toBe("EXPLANATION");
  });

  it("goes directly to EXPLANATION when West declares", async () => {
    createEngineWithDeclarer(Seat.West);
    await startDrillWithTimers();
    expect(store.phase).toBe("EXPLANATION");
  });

  it("acceptDeclarerSwap sets effectiveUserSeat to North and phase to PLAYING", async () => {
    createEngineWithDeclarer(Seat.North);
    await startDrillWithTimers();
    expect(store.phase).toBe("DECLARER_PROMPT");
    store.acceptDeclarerSwap();
    expect(store.effectiveUserSeat).toBe(Seat.North);
    expect(store.phase).toBe("PLAYING");
  });

  it("declineDeclarerSwap skips to EXPLANATION phase", async () => {
    createEngineWithDeclarer(Seat.North);
    await startDrillWithTimers();
    expect(store.phase).toBe("DECLARER_PROMPT");
    store.declineDeclarerSwap();
    expect(store.phase).toBe("EXPLANATION");
  });

  it("startDrill resets effectiveUserSeat to null", async () => {
    createEngineWithDeclarer(Seat.North);
    await startDrillWithTimers();
    store.acceptDeclarerSwap();
    expect(store.effectiveUserSeat).toBe(Seat.North);
    // Start a new drill — reset engine to prevent immediate auction completion
    engine.isAuctionComplete = async () => false;
    engine.getLegalCalls = async () => [{ type: "pass" }];
    const promise = store.startDrill(deal, session);
    await vi.advanceTimersByTimeAsync(600);
    await promise;
    expect(store.effectiveUserSeat).toBeNull();
    expect(store.phase).toBe("BIDDING");
  });
});
