import { describe, it, expect } from "vitest";
import { generateCommand } from "../commands/generate";
import { createCliDependencies } from "../engine-factory";
import type { Deal } from "../../engine/types";
import { Seat, Suit, Vulnerability } from "../../engine/types";
import { calculateHcp } from "../../engine/hand-evaluator";

const deps = createCliDependencies();

describe("generate command", () => {
  it("generates a deal with no constraints", async () => {
    const result = await generateCommand.handler({}, deps);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.type).toBe("deal");
    const deal = result.value.data as Deal;
    expect(deal.hands).toBeDefined();
    expect(deal.hands[Seat.North].cards).toHaveLength(13);
    expect(deal.hands[Seat.East].cards).toHaveLength(13);
    expect(deal.hands[Seat.South].cards).toHaveLength(13);
    expect(deal.hands[Seat.West].cards).toHaveLength(13);
    expect(deal.dealer).toBe(Seat.North);
    expect(deal.vulnerability).toBe(Vulnerability.None);
  });

  it("respects --seat with HCP constraints", async () => {
    const result = await generateCommand.handler(
      { seat: "N", "min-hcp": "15", "max-hcp": "17" },
      deps,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    const deal = result.value.data as Deal;
    const hcp = calculateHcp(deal.hands[Seat.North]);
    expect(hcp).toBeGreaterThanOrEqual(15);
    expect(hcp).toBeLessThanOrEqual(17);
  });

  it("respects --balanced constraint", async () => {
    const result = await generateCommand.handler(
      { seat: "S", balanced: true, "min-hcp": "12", "max-hcp": "14" },
      deps,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    const deal = result.value.data as Deal;
    const hand = deal.hands[Seat.South];
    expect(hand.cards).toHaveLength(13);
  });

  it("includes diagnostics when --diagnostics is set", async () => {
    const result = await generateCommand.handler(
      { diagnostics: true },
      deps,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.meta).toBeDefined();
    expect(result.value.meta?.iterations).toBeGreaterThan(0);
    expect(result.value.meta?.relaxationSteps).toBeDefined();
    expect(result.value.meta?.durationMs).toBeDefined();
  });

  it("accepts --dealer and --vulnerability", async () => {
    const result = await generateCommand.handler(
      { dealer: "E", vulnerability: "Both" },
      deps,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    const deal = result.value.data as Deal;
    expect(deal.dealer).toBe(Seat.East);
    expect(deal.vulnerability).toBe(Vulnerability.Both);
  });

  it("respects --min-length constraint", async () => {
    const result = await generateCommand.handler(
      { seat: "N", "min-length": "S=5" },
      deps,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    const deal = result.value.data as Deal;
    const spadeCount = deal.hands[Seat.North].cards.filter(
      (c) => c.suit === Suit.Spades,
    ).length;
    expect(spadeCount).toBeGreaterThanOrEqual(5);
  });

  it("respects --max-length constraint", async () => {
    const result = await generateCommand.handler(
      { seat: "N", "max-length": "H=3" },
      deps,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    const deal = result.value.data as Deal;
    const heartCount = deal.hands[Seat.North].cards.filter(
      (c) => c.suit === Suit.Hearts,
    ).length;
    expect(heartCount).toBeLessThanOrEqual(3);
  });

  it("returns error on invalid seat", async () => {
    const result = await generateCommand.handler({ seat: "X" }, deps);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("INVALID_ARGS");
  });

  it("returns error on invalid --min-hcp", async () => {
    const result = await generateCommand.handler({ seat: "N", "min-hcp": "abc" }, deps);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("INVALID_ARGS");
  });
});
