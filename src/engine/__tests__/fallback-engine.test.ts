import { describe, it, expect, vi } from "vitest";
import { createFallbackEngine } from "../fallback-engine";
import { createStubEngine } from "../../components/__tests__/test-helpers";
import { Vulnerability, Seat } from "../types";

describe("createFallbackEngine", () => {
  it("uses primary engine when available", async () => {
    const primary = createStubEngine({
      async isBalanced() {
        return true;
      },
    });
    const fallback = createStubEngine({
      async isBalanced() {
        return false;
      },
    });

    const engine = createFallbackEngine(primary, fallback);
    const result = await engine.isBalanced({ cards: [] });
    expect(result).toBe(true);
  });

  it("falls back on network TypeError", async () => {
    const primary = createStubEngine({
      async isBalanced() {
        throw new TypeError("Failed to fetch");
      },
    });
    const fallback = createStubEngine({
      async isBalanced() {
        return false;
      },
    });

    const engine = createFallbackEngine(primary, fallback);
    const result = await engine.isBalanced({ cards: [] });
    expect(result).toBe(false);
  });

  it("retries primary engine after a transient network error", async () => {
    let callCount = 0;
    const primary = createStubEngine({
      async isBalanced() {
        callCount++;
        if (callCount === 1) {
          throw new TypeError("Failed to fetch");
        }
        return true;
      },
    });
    const fallback = createStubEngine({
      async isBalanced() {
        return false;
      },
    });

    const engine = createFallbackEngine(primary, fallback);

    // First call: primary fails, falls back
    const result1 = await engine.isBalanced({ cards: [] });
    expect(result1).toBe(false);

    // Second call: should retry primary (which now succeeds)
    const result2 = await engine.isBalanced({ cards: [] });
    expect(result2).toBe(true);
  });

  it("does not catch non-network errors", async () => {
    const primary = createStubEngine({
      async isBalanced() {
        throw new Error("DDS not available in V1");
      },
    });
    const fallback = createStubEngine({
      async isBalanced() {
        return false;
      },
    });

    const engine = createFallbackEngine(primary, fallback);
    await expect(engine.isBalanced({ cards: [] })).rejects.toThrow(
      "DDS not available in V1",
    );
  });
});
