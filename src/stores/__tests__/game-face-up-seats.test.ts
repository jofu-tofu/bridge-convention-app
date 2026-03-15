/**
 * Tests for faceUpSeats getter — centralized card visibility logic.
 *
 * Covers all phase × declarer combinations to ensure:
 * - BIDDING: only user's hand is face-up
 * - DECLARER_PROMPT (defender): only user's hand
 * - DECLARER_PROMPT (south-declarer): user + dummy (North)
 * - DECLARER_PROMPT (declarer-swap): user + declarer (North)
 * - PLAYING (user is declarer): user + dummy
 * - PLAYING (user is defending): only user's hand
 * - EXPLANATION: only user's hand (showAll is component-local)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Seat } from "../../engine/types";
import type { Hand } from "../../engine/types";
import { createGameStore } from "../game.svelte";
import { createStubEngine } from "../../test-support/engine-stub";
import { makeSimpleTestDeal, makeDrillSession, makeContract } from "../../test-support/fixtures";
import type { EnginePort } from "../../engine/port";

describe("faceUpSeats", () => {
  let engine: EnginePort;
  let store: ReturnType<typeof createGameStore>;
  const deal = makeSimpleTestDeal();
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
    const promise = store.startDrill({ deal, session, nsInferenceEngine: null, ewInferenceEngine: null });
    await vi.advanceTimersByTimeAsync(600);
    await promise;
  }

  describe("BIDDING phase", () => {
    it("only user's hand (South) is face-up", async () => {
      createEngineWithDeclarer(Seat.South);
      // Prevent auction from completing
      engine.isAuctionComplete = async () => false;
      engine.getLegalCalls = async () => [{ type: "pass" }];
      const promise = store.startDrill({ deal, session, nsInferenceEngine: null, ewInferenceEngine: null });
      await vi.advanceTimersByTimeAsync(600);
      await promise;

      expect(store.phase).toBe("BIDDING");
      expect(store.faceUpSeats).toEqual(new Set([Seat.South]));
    });
  });

  describe("DECLARER_PROMPT phase", () => {
    it("defender (East declares): only South face-up", async () => {
      createEngineWithDeclarer(Seat.East);
      await startDrillWithTimers();

      expect(store.phase).toBe("DECLARER_PROMPT");
      expect(store.promptMode).toBe("defender");
      expect(store.faceUpSeats).toEqual(new Set([Seat.South]));
    });

    it("defender (West declares): only South face-up", async () => {
      createEngineWithDeclarer(Seat.West);
      await startDrillWithTimers();

      expect(store.phase).toBe("DECLARER_PROMPT");
      expect(store.promptMode).toBe("defender");
      expect(store.faceUpSeats).toEqual(new Set([Seat.South]));
    });

    it("south-declarer (South declares): South + North face-up", async () => {
      createEngineWithDeclarer(Seat.South);
      await startDrillWithTimers();

      expect(store.phase).toBe("DECLARER_PROMPT");
      expect(store.promptMode).toBe("south-declarer");
      expect(store.faceUpSeats).toEqual(new Set([Seat.South, Seat.North]));
    });

    it("declarer-swap (North declares): South + North face-up", async () => {
      createEngineWithDeclarer(Seat.North);
      await startDrillWithTimers();

      expect(store.phase).toBe("DECLARER_PROMPT");
      expect(store.promptMode).toBe("declarer-swap");
      expect(store.faceUpSeats).toEqual(new Set([Seat.South, Seat.North]));
    });
  });

  describe("PLAYING phase", () => {
    it("user is declarer (South declares): South + North face-up", async () => {
      createEngineWithDeclarer(Seat.South);
      await startDrillWithTimers();
      store.acceptPrompt();

      expect(store.phase).toBe("PLAYING");
      expect(store.faceUpSeats).toEqual(new Set([Seat.South, Seat.North]));
    });

    it("user swaps to declarer (North declares, swap accepted): North + South face-up", async () => {
      createEngineWithDeclarer(Seat.North);
      await startDrillWithTimers();
      store.acceptPrompt();

      expect(store.phase).toBe("PLAYING");
      // effectiveUserSeat is now North; dummy is South
      expect(store.faceUpSeats).toEqual(new Set([Seat.North, Seat.South]));
    });

    it("defending (East declares): only South face-up", async () => {
      createEngineWithDeclarer(Seat.East);
      await startDrillWithTimers();
      store.acceptPrompt();

      expect(store.phase).toBe("PLAYING");
      // Dummy is West (partner of East) — opponent, not shown
      expect(store.faceUpSeats).toEqual(new Set([Seat.South]));
    });

    it("defending (West declares): only South face-up", async () => {
      createEngineWithDeclarer(Seat.West);
      await startDrillWithTimers();
      store.acceptPrompt();

      expect(store.phase).toBe("PLAYING");
      // Dummy is East (partner of West) — opponent, not shown
      expect(store.faceUpSeats).toEqual(new Set([Seat.South]));
    });
  });

  describe("EXPLANATION phase", () => {
    it("only user's hand face-up (showAll is component-local)", async () => {
      createEngineWithDeclarer(Seat.South);
      await startDrillWithTimers();
      store.declinePrompt();

      expect(store.phase).toBe("EXPLANATION");
      expect(store.faceUpSeats).toEqual(new Set([Seat.South]));
    });
  });
});

describe("promptMode", () => {
  let engine: EnginePort;
  let store: ReturnType<typeof createGameStore>;
  const deal = makeSimpleTestDeal();
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
    const promise = store.startDrill({ deal, session, nsInferenceEngine: null, ewInferenceEngine: null });
    await vi.advanceTimersByTimeAsync(600);
    await promise;
  }

  it("is null when not in DECLARER_PROMPT phase", () => {
    const eng = createStubEngine();
    const s = createGameStore(eng);
    expect(s.promptMode).toBeNull();
  });

  it("is 'defender' when East declares", async () => {
    createEngineWithDeclarer(Seat.East);
    await startDrillWithTimers();
    expect(store.promptMode).toBe("defender");
  });

  it("is 'defender' when West declares", async () => {
    createEngineWithDeclarer(Seat.West);
    await startDrillWithTimers();
    expect(store.promptMode).toBe("defender");
  });

  it("is 'south-declarer' when South declares", async () => {
    createEngineWithDeclarer(Seat.South);
    await startDrillWithTimers();
    expect(store.promptMode).toBe("south-declarer");
  });

  it("is 'declarer-swap' when North declares", async () => {
    createEngineWithDeclarer(Seat.North);
    await startDrillWithTimers();
    expect(store.promptMode).toBe("declarer-swap");
  });
});

describe("acceptPrompt / declinePrompt", () => {
  let engine: EnginePort;
  let store: ReturnType<typeof createGameStore>;
  const deal = makeSimpleTestDeal();
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
    const promise = store.startDrill({ deal, session, nsInferenceEngine: null, ewInferenceEngine: null });
    await vi.advanceTimersByTimeAsync(600);
    await promise;
  }

  it("acceptPrompt for defender keeps effectiveUserSeat as South", async () => {
    createEngineWithDeclarer(Seat.East);
    await startDrillWithTimers();
    store.acceptPrompt();
    expect(store.effectiveUserSeat).toBe(Seat.South);
    expect(store.phase).toBe("PLAYING");
  });

  it("acceptPrompt for south-declarer keeps effectiveUserSeat as South", async () => {
    createEngineWithDeclarer(Seat.South);
    await startDrillWithTimers();
    store.acceptPrompt();
    expect(store.effectiveUserSeat).toBe(Seat.South);
    expect(store.phase).toBe("PLAYING");
  });

  it("acceptPrompt for declarer-swap sets effectiveUserSeat to North", async () => {
    createEngineWithDeclarer(Seat.North);
    await startDrillWithTimers();
    store.acceptPrompt();
    expect(store.effectiveUserSeat).toBe(Seat.North);
    expect(store.phase).toBe("PLAYING");
  });

  it("declinePrompt transitions to EXPLANATION", async () => {
    createEngineWithDeclarer(Seat.East);
    await startDrillWithTimers();
    store.declinePrompt();
    expect(store.phase).toBe("EXPLANATION");
  });

  it("acceptPrompt is no-op when not in DECLARER_PROMPT", () => {
    const eng = createStubEngine();
    const s = createGameStore(eng);
    s.acceptPrompt();
    expect(s.phase).toBe("BIDDING");
  });
});
