import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Seat, BidSuit, Suit, Rank, Vulnerability } from "../../engine/types";
import type { Card, Contract, Hand } from "../../engine/types";
import { createGameStore, seatController } from "../game.svelte";
import { createStubEngine } from "../../components/__tests__/test-helpers";
import type { DrillSession } from "../../ai/types";
import type { EnginePort } from "../../engine/port";

function makeCard(suit: Suit, rank: Rank): Card {
  return { suit, rank };
}

/** Create a minimal drill session for testing. */
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

/** Create a simple deal where each seat has 13 cards of one suit. */
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
      [Seat.North]: { cards: ranks.map((r) => makeCard(Suit.Clubs, r)) },
      [Seat.East]: { cards: ranks.map((r) => makeCard(Suit.Diamonds, r)) },
      [Seat.South]: { cards: ranks.map((r) => makeCard(Suit.Hearts, r)) },
      [Seat.West]: { cards: ranks.map((r) => makeCard(Suit.Spades, r)) },
    },
    dealer: Seat.North,
    vulnerability: Vulnerability.None,
  };
}

// North declares so user (South) is dummy — play phase reachable via acceptDeclarerSwap
const CONTRACT_1NT: Contract = {
  level: 1,
  strain: BidSuit.NoTrump,
  doubled: false,
  redoubled: false,
  declarer: Seat.North,
};

describe("seatController", () => {
  it("returns 'user' for user's own seat", () => {
    expect(seatController(Seat.South, Seat.South, Seat.South)).toBe("user");
  });

  it("returns 'user' for dummy when user is declarer", () => {
    expect(seatController(Seat.North, Seat.South, Seat.South)).toBe("user");
  });

  it("returns 'ai' for opponents when user is declarer", () => {
    expect(seatController(Seat.East, Seat.South, Seat.South)).toBe("ai");
    expect(seatController(Seat.West, Seat.South, Seat.South)).toBe("ai");
  });

  it("returns 'user' for South when AI is declarer (user always plays South)", () => {
    expect(seatController(Seat.South, Seat.East, Seat.South)).toBe("user");
  });

  it("returns 'ai' for all non-South seats when East is declarer", () => {
    expect(seatController(Seat.North, Seat.East, Seat.South)).toBe("ai");
    expect(seatController(Seat.East, Seat.East, Seat.South)).toBe("ai");
    expect(seatController(Seat.West, Seat.East, Seat.South)).toBe("ai");
  });
});

describe("createGameStore play phase", () => {
  let engine: EnginePort;
  let store: ReturnType<typeof createGameStore>;

  beforeEach(() => {
    vi.useFakeTimers();

    engine = createStubEngine({
      async getContract() {
        return CONTRACT_1NT;
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

  /**
   * Start a drill and advance to PLAYING phase via acceptDeclarerSwap.
   * North declares, so user (South) is dummy → DECLARER_PROMPT → accept → PLAYING.
   */
  async function startDrillWithTimers(
    drillStore: typeof store,
    deal: ReturnType<typeof makeTestDeal>,
    session: DrillSession,
  ) {
    const promise = drillStore.startDrill(deal, session);
    await vi.advanceTimersByTimeAsync(600);
    await promise;
    // North declares → DECLARER_PROMPT; accept swap to enter PLAYING
    drillStore.acceptDeclarerSwap();
  }

  it("transitions to PLAYING after auction completes", async () => {
    const deal = makeTestDeal();
    const session = makeDrillSession();

    await startDrillWithTimers(store, deal, session);

    expect(store.phase).toBe("PLAYING");
    expect(store.contract).toStrictEqual(CONTRACT_1NT);
  });

  it("sets opening leader as left of declarer", async () => {
    const deal = makeTestDeal();
    const session = makeDrillSession();

    await startDrillWithTimers(store, deal, session);

    // North is declarer → East leads (nextSeat(North))
    expect(store.currentPlayer).toBe(Seat.East);
  });

  it("sets dummy as partner of declarer", async () => {
    const deal = makeTestDeal();
    const session = makeDrillSession();

    await startDrillWithTimers(store, deal, session);

    // North is declarer → South is dummy
    expect(store.dummySeat).toBe(Seat.South);
  });

  it("skipToReview completes all tricks and transitions to EXPLANATION", async () => {
    const deal = makeTestDeal();
    const session = makeDrillSession();

    await startDrillWithTimers(store, deal, session);
    store.skipToReview();
    await vi.advanceTimersByTimeAsync(5000);

    expect(store.phase).toBe("EXPLANATION");
    expect(store.tricks.length).toBe(13);
    expect(store.score).toBe(90);
    expect(store.declarerTricksWon + store.defenderTricksWon).toBe(13);
  });

  it("getRemainingCards returns hand minus played cards", async () => {
    const deal = makeTestDeal();
    const session = makeDrillSession();

    await startDrillWithTimers(store, deal, session);

    const initialCards = store.getRemainingCards(Seat.South);
    expect(initialCards.length).toBe(13);

    store.skipToReview();
    await vi.advanceTimersByTimeAsync(5000);
    const finalCards = store.getRemainingCards(Seat.South);
    expect(finalCards.length).toBe(0);
  });

  it("reset clears all play state", async () => {
    const deal = makeTestDeal();
    const session = makeDrillSession();

    await startDrillWithTimers(store, deal, session);
    store.skipToReview();
    await vi.advanceTimersByTimeAsync(5000);

    store.reset();

    expect(store.phase).toBe("BIDDING");
    expect(store.tricks.length).toBe(0);
    expect(store.currentTrick.length).toBe(0);
    expect(store.currentPlayer).toBeNull();
    expect(store.declarerTricksWon).toBe(0);
    expect(store.defenderTricksWon).toBe(0);
    expect(store.dummySeat).toBeNull();
    expect(store.score).toBeNull();
  });
});

describe("randomPlayStrategy", () => {
  it("returns a card from the legal plays array", async () => {
    const { randomPlayStrategy } = await import("../../ai/play-strategy");
    const cards: Card[] = [
      makeCard(Suit.Hearts, Rank.Ace),
      makeCard(Suit.Spades, Rank.King),
    ];
    const result = randomPlayStrategy.suggest({
      hand: { cards: [] },
      currentTrick: [],
      previousTricks: [],
      contract: { level: 1, strain: BidSuit.NoTrump, doubled: false, redoubled: false, declarer: Seat.South },
      seat: Seat.South,
      trumpSuit: undefined,
      legalPlays: cards,
    });
    expect(cards).toContainEqual(result.card);
  });

  it("throws on empty legal plays", async () => {
    const { randomPlayStrategy } = await import("../../ai/play-strategy");
    expect(() => randomPlayStrategy.suggest({
      hand: { cards: [] },
      currentTrick: [],
      previousTricks: [],
      contract: { level: 1, strain: BidSuit.NoTrump, doubled: false, redoubled: false, declarer: Seat.South },
      seat: Seat.South,
      trumpSuit: undefined,
      legalPlays: [],
    })).toThrow("No legal cards to play");
  });
});
