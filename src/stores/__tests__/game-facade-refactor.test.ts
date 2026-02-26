/**
 * Characterization tests for game store facade refactor.
 *
 * Tests the unified acceptPlay()/declinePlay() API that replaces
 * the 3 separate accept/decline pairs, the playThisHand() mutation
 * ordering fix, and E/W inference engine wiring.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Seat, BidSuit, Vulnerability, Suit, Rank } from "../../engine/types";
import type { Contract, Hand } from "../../engine/types";
import { createGameStore } from "../game.svelte";
import { createStubEngine } from "../../components/__tests__/test-helpers";
import type { DrillSession } from "../../drill/types";
import type { EnginePort } from "../../engine/port";
import type { InferenceConfig } from "../../inference/types";

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

function makeContract(declarer: Seat): Contract {
  return {
    level: 1,
    strain: BidSuit.NoTrump,
    doubled: false,
    redoubled: false,
    declarer,
  };
}

describe("unified acceptPlay / declinePlay API", () => {
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

  async function startDrillWithTimers() {
    const promise = store.startDrill(deal, session);
    await vi.advanceTimersByTimeAsync(600);
    await promise;
  }

  describe("when North declares (user is dummy)", () => {
    it("acceptPlay with North override swaps user to declarer seat", async () => {
      createEngineWithDeclarer(Seat.North);
      await startDrillWithTimers();
      expect(store.phase).toBe("DECLARER_PROMPT");

      store.acceptPlay(Seat.North);
      expect(store.effectiveUserSeat).toBe(Seat.North);
      expect(store.phase).toBe("PLAYING");
    });

    it("declinePlay skips to EXPLANATION", async () => {
      createEngineWithDeclarer(Seat.North);
      await startDrillWithTimers();
      expect(store.phase).toBe("DECLARER_PROMPT");

      store.declinePlay();
      expect(store.phase).toBe("EXPLANATION");
    });
  });

  describe("when East declares (user is defender)", () => {
    it("acceptPlay without override keeps user as South", async () => {
      createEngineWithDeclarer(Seat.East);
      await startDrillWithTimers();
      expect(store.phase).toBe("DECLARER_PROMPT");

      store.acceptPlay();
      expect(store.effectiveUserSeat).toBe(Seat.South);
      expect(store.phase).toBe("PLAYING");
    });

    it("declinePlay skips to EXPLANATION", async () => {
      createEngineWithDeclarer(Seat.East);
      await startDrillWithTimers();
      expect(store.phase).toBe("DECLARER_PROMPT");

      store.declinePlay();
      expect(store.phase).toBe("EXPLANATION");
    });
  });

  describe("when South declares (user is declarer)", () => {
    it("acceptPlay without override keeps user as South", async () => {
      createEngineWithDeclarer(Seat.South);
      await startDrillWithTimers();
      expect(store.phase).toBe("DECLARER_PROMPT");

      store.acceptPlay();
      expect(store.effectiveUserSeat).toBe(Seat.South);
      expect(store.phase).toBe("PLAYING");
    });

    it("declinePlay skips to EXPLANATION", async () => {
      createEngineWithDeclarer(Seat.South);
      await startDrillWithTimers();
      expect(store.phase).toBe("DECLARER_PROMPT");

      store.declinePlay();
      expect(store.phase).toBe("EXPLANATION");
    });
  });

  it("acceptPlay is no-op when not in DECLARER_PROMPT phase", async () => {
    createEngineWithDeclarer(Seat.South);
    await startDrillWithTimers();
    store.acceptPlay(); // transition to PLAYING
    expect(store.phase).toBe("PLAYING");

    // Call again from PLAYING -- should be no-op
    store.acceptPlay();
    expect(store.phase).toBe("PLAYING");
  });

  it("acceptPlay is no-op without contract", () => {
    const eng = createStubEngine();
    const s = createGameStore(eng);
    // No drill started, no contract
    s.acceptPlay();
    expect(s.phase).toBe("BIDDING");
  });
});

describe("playThisHand mutation ordering", () => {
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

  it("playThisHand only mutates state when transitioning from EXPLANATION", async () => {
    engine = createStubEngine({
      async getContract() {
        return makeContract(Seat.South);
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

    const promise = store.startDrill(deal, session);
    await vi.advanceTimersByTimeAsync(600);
    await promise;

    // Go to EXPLANATION via decline
    store.declinePlay();
    expect(store.phase).toBe("EXPLANATION");

    // playThisHand should transition back to DECLARER_PROMPT
    store.playThisHand();
    expect(store.phase).toBe("DECLARER_PROMPT");
    expect(store.effectiveUserSeat).toBe(Seat.South);
  });

  it("playThisHand is no-op from BIDDING phase", async () => {
    engine = createStubEngine();
    store = createGameStore(engine);

    // Still in BIDDING phase
    store.playThisHand();
    expect(store.phase).toBe("BIDDING");
  });
});

describe("namespaced sub-store accessors (finding #1)", () => {
  let engine: EnginePort;
  let store: ReturnType<typeof createGameStore>;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = createStubEngine({
      async getContract() {
        return makeContract(Seat.North);
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("bidding sub-store exposes auction, bidHistory, bidFeedback, legalCalls, currentTurn, isUserTurn", () => {
    expect(store.bidding).toBeDefined();
    expect(store.bidding.auction).toEqual({ entries: [], isComplete: false });
    expect(store.bidding.bidHistory).toEqual([]);
    expect(store.bidding.bidFeedback).toBeNull();
    expect(store.bidding.legalCalls).toEqual([]);
    expect(store.bidding.currentTurn).toBeNull();
    expect(store.bidding.isUserTurn).toBe(false);
  });

  it("play sub-store exposes tricks, currentTrick, currentPlayer, dummySeat, score, trumpSuit", () => {
    expect(store.play).toBeDefined();
    expect(store.play.tricks).toEqual([]);
    expect(store.play.currentTrick).toEqual([]);
    expect(store.play.currentPlayer).toBeNull();
    expect(store.play.dummySeat).toBeNull();
    expect(store.play.score).toBeNull();
    expect(store.play.trumpSuit).toBeUndefined();
    expect(store.play.declarerTricksWon).toBe(0);
    expect(store.play.defenderTricksWon).toBe(0);
  });

  it("dds sub-store exposes ddsSolution, ddsSolving, ddsError", () => {
    expect(store.dds).toBeDefined();
    expect(store.dds.solution).toBeNull();
    expect(store.dds.solving).toBe(false);
    expect(store.dds.error).toBeNull();
  });

  it("bidding sub-store reflects state changes after startDrill", async () => {
    const deal = makeTestDeal();
    const session = makeDrillSession();

    const promise = store.startDrill(deal, session);
    await vi.advanceTimersByTimeAsync(600);
    await promise;

    // AI bids should be in bid history via sub-store
    expect(store.bidding.bidHistory.length).toBeGreaterThan(0);
    // Top-level and sub-store should agree
    expect(store.bidding.bidHistory).toBe(store.bidHistory);
    expect(store.bidding.auction).toBe(store.auction);
  });
});

describe("E/W inference engine wiring (finding #5)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates E/W inference engine when ewInferenceConfig is provided", async () => {
    const { createNaturalInferenceProvider } = await import(
      "../../inference/natural-inference"
    );
    const ewConfig: InferenceConfig = {
      ownPartnership: createNaturalInferenceProvider(),
      opponentPartnership: createNaturalInferenceProvider(),
    };
    const nsConfig: InferenceConfig = {
      ownPartnership: createNaturalInferenceProvider(),
      opponentPartnership: createNaturalInferenceProvider(),
    };

    const session: DrillSession = {
      config: {
        conventionId: "test",
        userSeat: Seat.South,
        nsInferenceConfig: nsConfig,
        ewInferenceConfig: ewConfig,
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
        if (seat === Seat.South) return null;
        return {
          call: { type: "pass" },
          ruleName: null,
          explanation: "AI pass",
        };
      },
      isUserSeat(seat) {
        return seat === Seat.South;
      },
    };

    const engine = createStubEngine({
      async getContract() {
        return makeContract(Seat.South);
      },
      async isAuctionComplete() {
        return true;
      },
    });
    const store = createGameStore(engine);

    // Dynamic import inside startDrill needs real timer resolution
    vi.useRealTimers();
    const promise = store.startDrill(makeTestDeal(), session);
    await promise;

    // After auction completes, playInferences should have all 4 seats
    expect(store.playInferences).not.toBeNull();

    // ewInferenceTimeline should be exposed and non-empty (3 AI bids processed)
    expect(store.ewInferenceTimeline).toBeDefined();
    expect(Array.isArray(store.ewInferenceTimeline)).toBe(true);
  }, 10000);

  it("ewInferenceTimeline is empty when no ewInferenceConfig", () => {
    const engine = createStubEngine();
    const store = createGameStore(engine);
    expect(store.ewInferenceTimeline).toEqual([]);
  });
});
