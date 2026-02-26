/**
 * Isolated tests for the DDS sub-store.
 *
 * Verifies triggerSolve lifecycle (solving → resolved/error/timeout),
 * stale-result guard, and reset behavior.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Seat, BidSuit } from "../../engine/types";
import type { DDSolution } from "../../engine/types";
import { createStubEngine } from "../../components/__tests__/test-helpers";
import { createDDSStore } from "../dds.svelte";
import { makeSimpleTestDeal, makeContract } from "./fixtures";

const fakeDDSolution: DDSolution = {
  tricks: {
    [Seat.North]: { [BidSuit.Clubs]: 10, [BidSuit.Diamonds]: 9, [BidSuit.Hearts]: 8, [BidSuit.Spades]: 11, [BidSuit.NoTrump]: 9 },
    [Seat.East]: { [BidSuit.Clubs]: 3, [BidSuit.Diamonds]: 4, [BidSuit.Hearts]: 5, [BidSuit.Spades]: 2, [BidSuit.NoTrump]: 4 },
    [Seat.South]: { [BidSuit.Clubs]: 10, [BidSuit.Diamonds]: 9, [BidSuit.Hearts]: 8, [BidSuit.Spades]: 11, [BidSuit.NoTrump]: 9 },
    [Seat.West]: { [BidSuit.Clubs]: 3, [BidSuit.Diamonds]: 4, [BidSuit.Hearts]: 5, [BidSuit.Spades]: 2, [BidSuit.NoTrump]: 4 },
  },
  par: { score: 400, contracts: [{ level: 3, strain: BidSuit.NoTrump, declarer: Seat.South, doubled: false, overtricks: 0 }] },
};

describe("createDDSStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with null/false/null initial state", () => {
    const engine = createStubEngine();
    const dds = createDDSStore(engine);
    expect(dds.ddsSolution).toBeNull();
    expect(dds.ddsSolving).toBe(false);
    expect(dds.ddsError).toBeNull();
  });

  it("triggerSolve sets ddsSolving=true then resolves with solution", async () => {
    const solveDeal = vi.fn().mockResolvedValue(fakeDDSolution);
    const engine = createStubEngine({ solveDeal });
    const dds = createDDSStore(engine);
    const deal = makeSimpleTestDeal();
    const contract = makeContract(Seat.South);

    dds.triggerSolve(deal, contract);
    expect(dds.ddsSolving).toBe(true);

    await vi.advanceTimersByTimeAsync(0);

    expect(dds.ddsSolution).toEqual(fakeDDSolution);
    expect(dds.ddsSolving).toBe(false);
    expect(dds.ddsError).toBeNull();
    expect(solveDeal).toHaveBeenCalledWith(deal);
  });

  it("sets ddsError when solveDeal rejects", async () => {
    const engine = createStubEngine({
      solveDeal: vi.fn().mockRejectedValue(new Error("DDS not available")),
    });
    const dds = createDDSStore(engine);

    dds.triggerSolve(makeSimpleTestDeal(), makeContract(Seat.South));
    await vi.advanceTimersByTimeAsync(0);

    expect(dds.ddsSolution).toBeNull();
    expect(dds.ddsSolving).toBe(false);
    expect(dds.ddsError).toBe("DDS not available");
  });

  it("times out after 10 seconds", async () => {
    const neverResolves = new Promise<DDSolution>(() => {});
    const engine = createStubEngine({
      solveDeal: vi.fn().mockReturnValue(neverResolves),
    });
    const dds = createDDSStore(engine);

    dds.triggerSolve(makeSimpleTestDeal(), makeContract(Seat.South));
    expect(dds.ddsSolving).toBe(true);

    await vi.advanceTimersByTimeAsync(10_001);

    expect(dds.ddsSolution).toBeNull();
    expect(dds.ddsSolving).toBe(false);
    expect(dds.ddsError).toBe("DDS analysis timed out");
  });

  it("ignores stale results when deal changes", async () => {
    let resolveFn: (val: DDSolution) => void;
    const solveDeal = vi.fn().mockImplementation(() => {
      return new Promise<DDSolution>((resolve) => { resolveFn = resolve; });
    });
    const engine = createStubEngine({ solveDeal });
    const dds = createDDSStore(engine);

    const deal1 = makeSimpleTestDeal();
    dds.triggerSolve(deal1, makeContract(Seat.South));
    await vi.advanceTimersByTimeAsync(0);
    expect(dds.ddsSolving).toBe(true);

    // Reset starts a new context (simulates new drill)
    dds.reset();
    expect(dds.ddsSolving).toBe(false);

    // Old solve resolves — should be ignored
    resolveFn!(fakeDDSolution);
    await vi.advanceTimersByTimeAsync(0);
    expect(dds.ddsSolution).toBeNull();
  });

  it("reset() clears all state", async () => {
    const engine = createStubEngine({
      solveDeal: vi.fn().mockResolvedValue(fakeDDSolution),
    });
    const dds = createDDSStore(engine);

    dds.triggerSolve(makeSimpleTestDeal(), makeContract(Seat.South));
    await vi.advanceTimersByTimeAsync(0);
    expect(dds.ddsSolution).not.toBeNull();

    dds.reset();
    expect(dds.ddsSolution).toBeNull();
    expect(dds.ddsSolving).toBe(false);
    expect(dds.ddsError).toBeNull();
  });

  it("does not start a second solve while one is in progress", async () => {
    const solveDeal = vi.fn().mockResolvedValue(fakeDDSolution);
    const engine = createStubEngine({ solveDeal });
    const dds = createDDSStore(engine);
    const contract = makeContract(Seat.South);

    dds.triggerSolve(makeSimpleTestDeal(), contract);
    dds.triggerSolve(makeSimpleTestDeal(), contract);

    expect(solveDeal).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(0);
  });
});
