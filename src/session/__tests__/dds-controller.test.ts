import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DDSController } from "../dds-controller";
import type { EnginePort } from "../../engine/port";
import type { Deal, Contract, DDSolution } from "../../engine/types";
import { Seat, BidSuit, Vulnerability } from "../../engine/types";

// ─── Deferred promise factory ───────────────────────────────────────

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ─── Minimal fixtures ───────────────────────────────────────────────

const MOCK_DEAL: Deal = {
  hands: {
    [Seat.North]: { cards: [] },
    [Seat.East]: { cards: [] },
    [Seat.South]: { cards: [] },
    [Seat.West]: { cards: [] },
  },
  dealer: Seat.North,
  vulnerability: Vulnerability.None,
};

const MOCK_CONTRACT: Contract = {
  level: 3,
  strain: BidSuit.NoTrump,
  doubled: false,
  redoubled: false,
  declarer: Seat.South,
};

const MOCK_SOLUTION: DDSolution = {
  tricks: {
    [Seat.North]: { [BidSuit.Spades]: 7, [BidSuit.Hearts]: 8, [BidSuit.Diamonds]: 5, [BidSuit.Clubs]: 6, [BidSuit.NoTrump]: 7 },
    [Seat.East]: { [BidSuit.Spades]: 6, [BidSuit.Hearts]: 5, [BidSuit.Diamonds]: 8, [BidSuit.Clubs]: 7, [BidSuit.NoTrump]: 6 },
    [Seat.South]: { [BidSuit.Spades]: 7, [BidSuit.Hearts]: 8, [BidSuit.Diamonds]: 5, [BidSuit.Clubs]: 6, [BidSuit.NoTrump]: 7 },
    [Seat.West]: { [BidSuit.Spades]: 6, [BidSuit.Hearts]: 5, [BidSuit.Diamonds]: 8, [BidSuit.Clubs]: 7, [BidSuit.NoTrump]: 6 },
  },
  par: null,
};

function makeMockEngine(solveDeal: EnginePort["solveDeal"]): EnginePort {
  return { solveDeal } as unknown as EnginePort;
}

// ─── Tests ──────────────────────────────────────────────────────────

describe("DDSController", () => {
  let controller: DDSController;

  beforeEach(() => {
    vi.useFakeTimers();
    controller = new DDSController();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("happy path: resolves immediately", async () => {
    const engine = makeMockEngine(() => Promise.resolve(MOCK_SOLUTION));

    const result = await controller.solve(MOCK_DEAL, MOCK_CONTRACT, engine);

    expect(result.solution).toBe(MOCK_SOLUTION);
    expect(result.error).toBeNull();
    expect(controller.isSolving()).toBe(false);
  });

  it("error path: rejects with error string", async () => {
    const engine = makeMockEngine(() => Promise.reject(new Error("WASM crashed")));

    const result = await controller.solve(MOCK_DEAL, MOCK_CONTRACT, engine);

    expect(result.solution).toBeNull();
    expect(result.error).toBe("WASM crashed");
    expect(controller.isSolving()).toBe(false);
  });

  it("concurrent rejection: returns error if already solving", async () => {
    const d = deferred<DDSolution>();
    const engine = makeMockEngine(() => d.promise);

    // Start first solve (won't resolve yet)
    const firstPromise = controller.solve(MOCK_DEAL, MOCK_CONTRACT, engine);

    // Second call while first is in progress
    const secondResult = await controller.solve(MOCK_DEAL, MOCK_CONTRACT, engine);
    expect(secondResult.error).toBe("Solve already in progress");

    // Clean up first solve
    d.resolve(MOCK_SOLUTION);
    await firstPromise;
  });

  it("timeout: returns error after 10s", async () => {
    const d = deferred<DDSolution>();
    const engine = makeMockEngine(() => d.promise);

    const solvePromise = controller.solve(MOCK_DEAL, MOCK_CONTRACT, engine);

    // Advance past the 10s timeout
    await vi.advanceTimersByTimeAsync(10_001);

    const result = await solvePromise;
    expect(result.error).toBe("DDS analysis timed out");
    expect(result.solution).toBeNull();
    expect(controller.isSolving()).toBe(false);
  });

  it("stale-result guard: reset() discards old solve", async () => {
    const dA = deferred<DDSolution>();
    const dB = deferred<DDSolution>();
    let callCount = 0;
    const engine = makeMockEngine(() => {
      callCount++;
      return callCount === 1 ? dA.promise : dB.promise;
    });

    // Start first solve
    const firstPromise = controller.solve(MOCK_DEAL, MOCK_CONTRACT, engine);

    // Reset (increments generation, stops solving)
    controller.reset();
    expect(controller.isSolving()).toBe(false);

    // Start second solve
    const secondPromise = controller.solve(MOCK_DEAL, MOCK_CONTRACT, engine);

    // Resolve B
    dB.resolve(MOCK_SOLUTION);
    const secondResult = await secondPromise;
    expect(secondResult.solution).toBe(MOCK_SOLUTION);

    // Now resolve A (stale) — should not overwrite
    dA.resolve({
      tricks: {} as DDSolution["tricks"],
      par: null,
    });
    // Wait for any microtasks
    await vi.advanceTimersByTimeAsync(0);
    await firstPromise;

    // State still reflects B
    const current = controller.getResult();
    expect(current.solution).toBe(MOCK_SOLUTION);
  });

  it("reset() clears solution and error", async () => {
    const engine = makeMockEngine(() => Promise.reject(new Error("fail")));
    await controller.solve(MOCK_DEAL, MOCK_CONTRACT, engine);

    expect(controller.getResult().error).toBe("fail");

    controller.reset();

    expect(controller.getResult().solution).toBeNull();
    expect(controller.getResult().error).toBeNull();
    expect(controller.isSolving()).toBe(false);
  });

  it("getResult() returns cached state without triggering solve", () => {
    const result = controller.getResult();
    expect(result.solution).toBeNull();
    expect(result.error).toBeNull();
  });
});
