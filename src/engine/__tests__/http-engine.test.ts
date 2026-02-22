import { describe, test, expect } from "vitest";
import { HttpEngine } from "../http-engine";
import type { EnginePort } from "../port";
import type { DealConstraints, SeatConstraint, Hand } from "../types";
import { Seat, Suit } from "../types";

describe("HttpEngine", () => {
  test("implements EnginePort interface", () => {
    const engine: EnginePort = new HttpEngine("http://localhost:3001");
    expect(engine).toBeDefined();
    expect(engine.generateDeal).toBeTypeOf("function");
    expect(engine.evaluateHand).toBeTypeOf("function");
    expect(engine.getSuitLength).toBeTypeOf("function");
    expect(engine.isBalanced).toBeTypeOf("function");
    expect(engine.getLegalCalls).toBeTypeOf("function");
    expect(engine.addCall).toBeTypeOf("function");
    expect(engine.isAuctionComplete).toBeTypeOf("function");
    expect(engine.getContract).toBeTypeOf("function");
    expect(engine.calculateScore).toBeTypeOf("function");
    expect(engine.getLegalPlays).toBeTypeOf("function");
    expect(engine.getTrickWinner).toBeTypeOf("function");
    expect(engine.solveDeal).toBeTypeOf("function");
    expect(engine.suggestPlay).toBeTypeOf("function");
  });

  test("solveDeal throws not available", async () => {
    const engine = new HttpEngine("http://localhost:3001");
    const deal = {
      hands: {} as Record<string, Hand>,
      dealer: Seat.North,
      vulnerability: "None" as const,
    };
    // any: deal structure doesn't matter, should throw before fetch
    await expect(engine.solveDeal(deal as any)).rejects.toThrow("DDS not available");
  });

  test("suggestPlay throws not available", async () => {
    const engine = new HttpEngine("http://localhost:3001");
    await expect(engine.suggestPlay({ cards: [] }, [], null, [])).rejects.toThrow("DDS not available");
  });
});
