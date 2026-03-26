import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Seat } from "../../engine/types";
import { createGameStore } from "../game.svelte";
import { createStubEngine } from "../../test-support/engine-stub";
import type { PlayStrategy, PlayContext, PlayResult } from "../../service";
import { makeDrillSession, makeSimpleTestDeal, createTestServiceSession } from "../../test-support/fixtures";
import { createLocalService } from "../../service";

const testPlayStrategy: PlayStrategy = {
  id: "test-play",
  name: "Test Play",
  suggest(ctx: PlayContext): Promise<PlayResult> {
    return Promise.resolve({ card: ctx.legalPlays[0]!, reason: "test-heuristic" });
  },
};

describe("game store playLog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("playLog starts empty after startDrill", async () => {
    const engine = createStubEngine();
    const store = createGameStore(createLocalService(engine));
    const session = makeDrillSession(Seat.South, testPlayStrategy);

    const bundle = { deal: makeSimpleTestDeal(), session, nsInferenceEngine: null, ewInferenceEngine: null };
    const { service, handle } = await createTestServiceSession(engine, bundle);
    const drillPromise = store.startDrillFromHandle(handle, service);
    // Advance past AI bid delays (3 AI seats × 300ms each)
    await vi.advanceTimersByTimeAsync(1000);
    await drillPromise;
    expect(store.playLog).toEqual([]);
  });

  it("playLog getter is exposed on the store", () => {
    const engine = createStubEngine();
    const store = createGameStore(createLocalService(engine));
    expect(store.playLog).toBeDefined();
    expect(Array.isArray(store.playLog)).toBe(true);
  });

  it("playInferences getter is exposed on the store", () => {
    const engine = createStubEngine();
    const store = createGameStore(createLocalService(engine));
    expect(store.playInferences).toBeNull();
  });

  it("inferenceTimeline getter is exposed on the store", () => {
    const engine = createStubEngine();
    const store = createGameStore(createLocalService(engine));
    expect(store.inferenceTimeline).toEqual([]);
  });
});
