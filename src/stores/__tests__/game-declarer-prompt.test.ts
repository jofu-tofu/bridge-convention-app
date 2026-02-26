import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Seat } from "../../engine/types";
import type { Hand } from "../../engine/types";
import { createGameStore } from "../game.svelte";
import { createStubEngine } from "../../components/__tests__/test-helpers";
import type { EnginePort } from "../../engine/port";
import { makeDrillSession, makeSimpleTestDeal, makeContract } from "./fixtures";

describe("DECLARER_PROMPT phase", () => {
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

  it("enters DECLARER_PROMPT when South declares (user is declarer)", async () => {
    createEngineWithDeclarer(Seat.South);
    await startDrillWithTimers();
    expect(store.phase).toBe("DECLARER_PROMPT");
  });

  it("isSouthDeclarerPrompt is true when South declares", async () => {
    createEngineWithDeclarer(Seat.South);
    await startDrillWithTimers();
    expect(store.phase).toBe("DECLARER_PROMPT");
    expect(store.isSouthDeclarerPrompt).toBe(true);
    expect(store.isDefenderPrompt).toBe(false);
  });

  it("acceptSouthPlay starts play with effectiveUserSeat remaining South", async () => {
    createEngineWithDeclarer(Seat.South);
    await startDrillWithTimers();
    expect(store.phase).toBe("DECLARER_PROMPT");
    store.acceptSouthPlay();
    expect(store.effectiveUserSeat).toBe(Seat.South);
    expect(store.phase).toBe("PLAYING");
  });

  it("declineSouthPlay skips to EXPLANATION phase", async () => {
    createEngineWithDeclarer(Seat.South);
    await startDrillWithTimers();
    expect(store.phase).toBe("DECLARER_PROMPT");
    store.declineSouthPlay();
    expect(store.phase).toBe("EXPLANATION");
  });

  it("enters DECLARER_PROMPT when East declares (user=South is defender)", async () => {
    createEngineWithDeclarer(Seat.East);
    await startDrillWithTimers();
    expect(store.phase).toBe("DECLARER_PROMPT");
  });

  it("enters DECLARER_PROMPT when West declares (user=South is defender)", async () => {
    createEngineWithDeclarer(Seat.West);
    await startDrillWithTimers();
    expect(store.phase).toBe("DECLARER_PROMPT");
  });

  it("isDefenderPrompt is true when E/W declares", async () => {
    createEngineWithDeclarer(Seat.East);
    await startDrillWithTimers();
    expect(store.phase).toBe("DECLARER_PROMPT");
    expect(store.isDefenderPrompt).toBe(true);
  });

  it("isDefenderPrompt is false when North declares (user is dummy)", async () => {
    createEngineWithDeclarer(Seat.North);
    await startDrillWithTimers();
    expect(store.phase).toBe("DECLARER_PROMPT");
    expect(store.isDefenderPrompt).toBe(false);
  });

  it("acceptDefend starts play with effectiveUserSeat remaining South", async () => {
    createEngineWithDeclarer(Seat.East);
    await startDrillWithTimers();
    expect(store.phase).toBe("DECLARER_PROMPT");
    store.acceptDefend();
    expect(store.effectiveUserSeat).toBe(Seat.South);
    expect(store.phase).toBe("PLAYING");
  });

  it("declineDefend skips to EXPLANATION phase", async () => {
    createEngineWithDeclarer(Seat.West);
    await startDrillWithTimers();
    expect(store.phase).toBe("DECLARER_PROMPT");
    store.declineDefend();
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
