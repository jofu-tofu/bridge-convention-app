import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BidSuit } from "../../engine/types";
import type { Call } from "../../engine/types";
import { createGameStore } from "../game.svelte";
import type { BidResult } from "../../service";
import type { ConventionStrategy } from "../../conventions";
import { makeDrillSession, makeSimpleTestDeal, flushWithFakeTimers, createTestServiceSession } from "../../test-support/fixtures";
import type { DrillBundle } from "../../session/drill-types";
import { createLocalService } from "../../service";
import { createStubEngine } from "../../test-support/engine-stub";

/** Strategy that always suggests 2C. */
function make2CStrategy(): ConventionStrategy {
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

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const flushActions = flushWithFakeTimers;

function makeEngine() {
  return createStubEngine({
    async isAuctionComplete() { return false; },
  });
}

async function startWithBundle(bundle: DrillBundle) {
  const engine = makeEngine();
  const store = createGameStore(createLocalService(engine));
  const { service, handle } = await createTestServiceSession(engine, bundle);
  void store.startDrillFromHandle(handle, service);
  await flushActions();
  return store;
}

describe("session stats — per-bid tracking", () => {
  it("increments correct count on correct bid", async () => {
    const store = await startWithBundle({
      deal: makeSimpleTestDeal(),
      session: makeDrillSession(),
      strategy: make2CStrategy(),
      nsInferenceEngine: null,
      ewInferenceEngine: null,
    });

    expect(store.sessionStats.correct).toBe(0);
    expect(store.sessionStats.incorrect).toBe(0);

    const correctBid: Call = { type: "bid", level: 2, strain: BidSuit.Clubs };
    store.userBid(correctBid);
    await flushActions();

    expect(store.sessionStats.correct).toBe(1);
    expect(store.sessionStats.incorrect).toBe(0);
    expect(store.sessionStats.streak).toBe(1);
  });

  it("increments incorrect count on wrong bid", async () => {
    const store = await startWithBundle({
      deal: makeSimpleTestDeal(),
      session: makeDrillSession(),
      strategy: make2CStrategy(),
      nsInferenceEngine: null,
      ewInferenceEngine: null,
    });

    // Pass when 2C expected → wrong
    store.userBid({ type: "pass" });
    await flushActions();

    expect(store.sessionStats.correct).toBe(0);
    expect(store.sessionStats.incorrect).toBe(1);
    expect(store.sessionStats.streak).toBe(0);
  });

  it("retry does not double-count", async () => {
    const store = await startWithBundle({
      deal: makeSimpleTestDeal(),
      session: makeDrillSession(),
      strategy: make2CStrategy(),
      nsInferenceEngine: null,
      ewInferenceEngine: null,
    });

    // Wrong bid → counted as incorrect
    store.userBid({ type: "pass" });
    await flushActions();
    expect(store.sessionStats.incorrect).toBe(1);

    // Retry + correct bid → should NOT add to stats
    store.retryBid();
    await flushActions();

    const correctBid: Call = { type: "bid", level: 2, strain: BidSuit.Clubs };
    store.userBid(correctBid);
    await flushActions();

    expect(store.sessionStats.incorrect).toBe(1); // unchanged
    expect(store.sessionStats.correct).toBe(0); // retry doesn't count
  });

  it("resets on store.reset()", async () => {
    const store = await startWithBundle({
      deal: makeSimpleTestDeal(),
      session: makeDrillSession(),
      strategy: make2CStrategy(),
      nsInferenceEngine: null,
      ewInferenceEngine: null,
    });

    const correctBid: Call = { type: "bid", level: 2, strain: BidSuit.Clubs };
    store.userBid(correctBid);
    await flushActions();
    expect(store.sessionStats.correct).toBe(1);

    store.reset();
    expect(store.sessionStats.correct).toBe(0);
    expect(store.sessionStats.incorrect).toBe(0);
    expect(store.sessionStats.streak).toBe(0);
  });
});
