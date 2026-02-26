import { describe, test, expect } from "vitest";
import { HttpEngine, cleanConstraints } from "../http-engine";
import type { EnginePort } from "../port";
import type { Hand, Deal, DealConstraints } from "../types";
import { Seat } from "../types";
import { mulberry32 } from "../../util/seeded-rng";

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

  test("solveDeal rejects with invalid deal", async () => {
    const engine = new HttpEngine("http://localhost:3001");
    const deal = {
      hands: {} as Record<string, Hand>,
      dealer: Seat.North,
      vulnerability: "None" as const,
    };
    // solveDeal delegates to the HTTP server — rejects with validation or network error
    // any: deal is intentionally incomplete to test error handling
    await expect(engine.solveDeal(deal as unknown as Deal)).rejects.toThrow();
  });

  test("suggestPlay throws not available", async () => {
    const engine = new HttpEngine("http://localhost:3001");
    await expect(
      engine.suggestPlay({ cards: [] }, [], null, []),
    ).rejects.toThrow("DDS not available");
  });
});

describe("cleanConstraints", () => {
  test("strips rng function from constraints", () => {
    const constraints: DealConstraints = {
      seats: [],
      rng: mulberry32(42),
    };
    const cleaned = cleanConstraints(constraints);
    expect(cleaned).not.toHaveProperty("rng");
  });

  test("includes seed field when rng and seed are present", () => {
    const constraints: DealConstraints = {
      seats: [],
      rng: mulberry32(42),
      seed: 42,
    };
    const cleaned = cleanConstraints(constraints);
    expect(cleaned).toHaveProperty("seed", 42);
    expect(cleaned).not.toHaveProperty("rng");
  });

  test("preserves other constraint fields", () => {
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.North, minHcp: 12 }],
      maxAttempts: 5000,
      seed: 99,
    };
    const cleaned = cleanConstraints(constraints);
    expect(cleaned).toHaveProperty("maxAttempts", 5000);
    expect(cleaned).toHaveProperty("seed", 99);
  });

  test("strips customCheck from seat constraints", () => {
    const constraints: DealConstraints = {
      seats: [{ seat: Seat.South, customCheck: () => true }],
    };
    const cleaned = cleanConstraints(constraints) as { seats: object[] };
    expect(cleaned.seats[0]).not.toHaveProperty("customCheck");
    expect(cleaned.seats[0]).toHaveProperty("seat", Seat.South);
  });
});
