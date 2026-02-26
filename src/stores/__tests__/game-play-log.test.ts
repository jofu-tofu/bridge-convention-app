import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Seat } from "../../engine/types";
import { createGameStore } from "../game.svelte";
import { createStubEngine } from "../../test-support/engine-stub";
import type { PlayStrategy, PlayContext, PlayResult } from "../../shared/types";
import { makeDrillSession, makeSimpleTestDeal } from "../../test-support/fixtures";

const testPlayStrategy: PlayStrategy = {
  id: "test-play",
  name: "Test Play",
  suggest(ctx: PlayContext): PlayResult {
    return { card: ctx.legalPlays[0]!, reason: "test-heuristic" };
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
    const store = createGameStore(engine);
    const session = makeDrillSession(Seat.South, testPlayStrategy);

    const drillPromise = store.startDrill(makeSimpleTestDeal(), session);
    // Advance past AI bid delays (3 AI seats × 300ms each)
    await vi.advanceTimersByTimeAsync(1000);
    await drillPromise;
    expect(store.playLog).toEqual([]);
  });

  it("playLog getter is exposed on the store", () => {
    const engine = createStubEngine();
    const store = createGameStore(engine);
    expect(store.playLog).toBeDefined();
    expect(Array.isArray(store.playLog)).toBe(true);
  });

  it("playInferences getter is exposed on the store", () => {
    const engine = createStubEngine();
    const store = createGameStore(engine);
    expect(store.playInferences).toBeNull();
  });

  it("inferenceTimeline getter is exposed on the store", () => {
    const engine = createStubEngine();
    const store = createGameStore(engine);
    expect(store.inferenceTimeline).toEqual([]);
  });
});
