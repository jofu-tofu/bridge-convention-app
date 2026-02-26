import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Seat, BidSuit, Suit, Rank } from "../../engine/types";
import type { Card, Contract, Hand } from "../../engine/types";
import { createGameStore, seatController } from "../game.svelte";
import { createStubEngine } from "../../test-support/engine-stub";
import { makeCard, makeSimpleTestDeal, makeDrillSession } from "../../test-support/fixtures";
import type { DrillSession } from "../../drill/types";
import type { EnginePort } from "../../engine/port";

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
    deal: ReturnType<typeof makeSimpleTestDeal>,
    session: DrillSession,
  ) {
    const promise = drillStore.startDrill(deal, session);
    await vi.advanceTimersByTimeAsync(600);
    await promise;
    // North declares → DECLARER_PROMPT; accept swap to enter PLAYING
    drillStore.acceptDeclarerSwap();
  }

  it("transitions to PLAYING after auction completes", async () => {
    const deal = makeSimpleTestDeal();
    const session = makeDrillSession();

    await startDrillWithTimers(store, deal, session);

    expect(store.phase).toBe("PLAYING");
    expect(store.contract).toStrictEqual(CONTRACT_1NT);
  });

  it("sets opening leader as left of declarer", async () => {
    const deal = makeSimpleTestDeal();
    const session = makeDrillSession();

    await startDrillWithTimers(store, deal, session);

    // North is declarer → East leads (nextSeat(North))
    expect(store.currentPlayer).toBe(Seat.East);
  });

  it("sets dummy as partner of declarer", async () => {
    const deal = makeSimpleTestDeal();
    const session = makeDrillSession();

    await startDrillWithTimers(store, deal, session);

    // North is declarer → South is dummy
    expect(store.dummySeat).toBe(Seat.South);
  });

  it("skipToReview completes all tricks and transitions to EXPLANATION", async () => {
    const deal = makeSimpleTestDeal();
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
    const deal = makeSimpleTestDeal();
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
    const deal = makeSimpleTestDeal();
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

describe("play concurrency fixes", () => {
  let engine: EnginePort;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Start a drill and advance to PLAYING phase via acceptDeclarerSwap. */
  async function startDrillPlaying(
    store: ReturnType<typeof createGameStore>,
    _overrides: Partial<EnginePort> = {},
  ) {
    const deal = makeSimpleTestDeal();
    const session = makeDrillSession();
    const promise = store.startDrill(deal, session);
    await vi.advanceTimersByTimeAsync(600);
    await promise;
    store.acceptDeclarerSwap();
  }

  it("startPlay sets isProcessing synchronously before runAiPlays", async () => {
    // North declares, East leads (AI) → isProcessing should be true immediately
    engine = createStubEngine({
      async getContract() { return CONTRACT_1NT; },
      async isAuctionComplete() { return true; },
      async getLegalPlays(hand: Hand) { return [...hand.cards]; },
      async getTrickWinner() { return Seat.South; },
      async calculateScore() { return 90; },
    });
    const store = createGameStore(engine);

    await startDrillPlaying(store);
    // East is AI opening leader → isProcessing must be true synchronously
    expect(store.isProcessing).toBe(true);
  });

  it("skipToReview transitions to EXPLANATION even when engine throws", async () => {
    let callCount = 0;
    engine = createStubEngine({
      async getContract() { return CONTRACT_1NT; },
      async isAuctionComplete() { return true; },
      async getLegalPlays(hand: Hand) {
        callCount++;
        if (callCount > 2) throw new Error("engine failure");
        return [...hand.cards];
      },
      async getTrickWinner() { return Seat.South; },
      async calculateScore() { return 90; },
    });
    const store = createGameStore(engine);

    await startDrillPlaying(store);
    store.skipToReview();
    await vi.advanceTimersByTimeAsync(5000);

    // Should still reach EXPLANATION despite engine error
    expect(store.phase).toBe("EXPLANATION");
  });

  it("skipToReview handles null currentPlayer gracefully", async () => {
    engine = createStubEngine({
      async getContract() { return CONTRACT_1NT; },
      async isAuctionComplete() { return true; },
      async getLegalPlays(hand: Hand) { return [...hand.cards]; },
      async getTrickWinner() { return Seat.South; },
      async calculateScore() { return 90; },
    });
    const store = createGameStore(engine);

    await startDrillPlaying(store);
    // skipToReview should not throw even if currentPlayer becomes null during processing
    store.skipToReview();
    await vi.advanceTimersByTimeAsync(5000);

    expect(store.phase).toBe("EXPLANATION");
  });
});

describe("randomPlayStrategy", () => {
  it("returns a card from the legal plays array", async () => {
    const { randomPlayStrategy } = await import("../../strategy/play/random-play");
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
    const { randomPlayStrategy } = await import("../../strategy/play/random-play");
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
