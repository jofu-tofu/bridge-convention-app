import { describe, test, expect } from "vitest";
import { TauriIpcEngine } from "../tauri-ipc-engine";
import type { Hand } from "../types";
import { Seat } from "../types";

describe("TauriIpcEngine", () => {
  // Type-level test: TauriIpcEngine satisfies EnginePort
  // This is verified by tsc --noEmit since the class implements EnginePort
  test("is constructible", () => {
    // TauriIpcEngine requires @tauri-apps/api at runtime, but we can check the class exists
    expect(TauriIpcEngine).toBeDefined();
    expect(TauriIpcEngine.prototype.generateDeal).toBeTypeOf("function");
    expect(TauriIpcEngine.prototype.evaluateHand).toBeTypeOf("function");
    expect(TauriIpcEngine.prototype.getSuitLength).toBeTypeOf("function");
    expect(TauriIpcEngine.prototype.isBalanced).toBeTypeOf("function");
    expect(TauriIpcEngine.prototype.getLegalCalls).toBeTypeOf("function");
    expect(TauriIpcEngine.prototype.addCall).toBeTypeOf("function");
    expect(TauriIpcEngine.prototype.isAuctionComplete).toBeTypeOf("function");
    expect(TauriIpcEngine.prototype.getContract).toBeTypeOf("function");
    expect(TauriIpcEngine.prototype.calculateScore).toBeTypeOf("function");
    expect(TauriIpcEngine.prototype.getLegalPlays).toBeTypeOf("function");
    expect(TauriIpcEngine.prototype.getTrickWinner).toBeTypeOf("function");
  });

  test("solveDeal throws not available", async () => {
    const engine = new TauriIpcEngine();
    const deal = {
      hands: {} as Record<string, Hand>,
      dealer: Seat.North,
      vulnerability: "None" as const,
    };
    await expect(engine.solveDeal(deal as any)).rejects.toThrow("DDS not available");
  });

  test("suggestPlay throws not available", async () => {
    const engine = new TauriIpcEngine();
    await expect(engine.suggestPlay({ cards: [] }, [], null, [])).rejects.toThrow("DDS not available");
  });
});
