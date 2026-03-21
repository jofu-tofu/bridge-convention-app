import { describe, it, expect, vi, beforeEach } from "vitest";
import { startDrill } from "../start-drill";
import { createStubEngine, makeDeal } from "../../test-support/engine-stub";
import { Seat } from "../../engine/types";
import { clearBundleRegistry, registerBundle, createConventionConfigFromBundle } from "../../conventions/core/bundle";
import { ntBundle } from "../../conventions/definitions/nt-bundle";

const ntBundleConventionConfig = createConventionConfigFromBundle(ntBundle);
import { mulberry32 } from "../../core/util/seeded-rng";
import { generateDeal } from "../../engine/deal-generator";

describe("seed determinism", () => {
  beforeEach(() => {
    clearBundleRegistry();
    registerBundle(ntBundle);
  });

  it("same seed produces identical deals through startDrill", async () => {
    const engine = createStubEngine({
      generateDeal: vi.fn().mockResolvedValue(makeDeal()),
    });

    const seed = 42;
    const bundle1 = await startDrill(
      engine, ntBundleConventionConfig, Seat.South,
      mulberry32(seed), seed,
    );
    const bundle2 = await startDrill(
      engine, ntBundleConventionConfig, Seat.South,
      mulberry32(seed), seed,
    );

    // Card-by-card comparison for all 4 hands
    for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
      expect(bundle1.deal.hands[seat].cards).toEqual(bundle2.deal.hands[seat].cards);
    }
  });

  it("seeded startDrill uses TS deal generator (bypasses engine)", async () => {
    const genDeal = vi.fn().mockResolvedValue(makeDeal());
    const engine = createStubEngine({ generateDeal: genDeal });

    const seed = 42;
    await startDrill(
      engine, ntBundleConventionConfig, Seat.South,
      mulberry32(seed), seed,
    );

    // Engine should NOT be called — TS generator handles seeded deals
    expect(genDeal).not.toHaveBeenCalled();
  });

  it("unseeded startDrill still uses the engine", async () => {
    const genDeal = vi.fn().mockResolvedValue(makeDeal());
    const engine = createStubEngine({ generateDeal: genDeal });

    await startDrill(engine, ntBundleConventionConfig, Seat.South);

    expect(genDeal).toHaveBeenCalledTimes(1);
  });

  it("different seeds produce different deals", async () => {
    const engine = createStubEngine({
      generateDeal: vi.fn().mockResolvedValue(makeDeal()),
    });

    const bundle1 = await startDrill(
      engine, ntBundleConventionConfig, Seat.South,
      mulberry32(42), 42,
    );
    const bundle2 = await startDrill(
      engine, ntBundleConventionConfig, Seat.South,
      mulberry32(999), 999,
    );

    // With different seeds the deals should differ
    const cards1 = bundle1.deal.hands[Seat.North].cards.map(
      (c) => `${c.suit}${c.rank}`,
    );
    const cards2 = bundle2.deal.hands[Seat.North].cards.map(
      (c) => `${c.suit}${c.rank}`,
    );
    expect(cards1).not.toEqual(cards2);
  });

  it("successive seeds produce deterministic sequence (simulates devDealCount)", async () => {
    const engine = createStubEngine({
      generateDeal: vi.fn().mockResolvedValue(makeDeal()),
    });

    // First run: seed 100, 101, 102
    const firstRun = [];
    for (let i = 0; i < 3; i++) {
      const s = 100 + i;
      const b = await startDrill(
        engine, ntBundleConventionConfig, Seat.South,
        mulberry32(s), s,
      );
      firstRun.push(b.deal);
    }

    // Second run: same seeds
    const secondRun = [];
    for (let i = 0; i < 3; i++) {
      const s = 100 + i;
      const b = await startDrill(
        engine, ntBundleConventionConfig, Seat.South,
        mulberry32(s), s,
      );
      secondRun.push(b.deal);
    }

    for (let i = 0; i < 3; i++) {
      for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
        expect(firstRun[i]!.hands[seat].cards).toEqual(
          secondRun[i]!.hands[seat].cards,
        );
      }
    }
  });

  it("seed-only (no rng) still produces deterministic deals", async () => {
    const engine = createStubEngine({
      generateDeal: vi.fn().mockResolvedValue(makeDeal()),
    });

    // Pass seed without rng — startDrill should create its own mulberry32(seed)
    const bundle1 = await startDrill(
      engine, ntBundleConventionConfig, Seat.South,
      undefined, 42,
    );
    const bundle2 = await startDrill(
      engine, ntBundleConventionConfig, Seat.South,
      undefined, 42,
    );

    for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
      expect(bundle1.deal.hands[seat].cards).toEqual(bundle2.deal.hands[seat].cards);
    }
  });

  it("seeded deal satisfies convention constraints", async () => {
    const engine = createStubEngine({
      generateDeal: vi.fn().mockResolvedValue(makeDeal()),
    });

    const seed = 42;
    const bundle = await startDrill(
      engine, ntBundleConventionConfig, Seat.South,
      mulberry32(seed), seed,
    );

    // NT bundle requires North: 15-17 HCP balanced, South: 6+ HCP with 4+ major
    const northHcp = bundle.deal.hands[Seat.North].cards.reduce((sum, c) => {
      const v: Record<string, number> = { A: 4, K: 3, Q: 2, J: 1 };
      return sum + (v[c.rank] ?? 0);
    }, 0);
    expect(northHcp).toBeGreaterThanOrEqual(15);
    expect(northHcp).toBeLessThanOrEqual(17);
  });

  it("TS generateDeal with same mulberry32 seed is deterministic", () => {
    const constraints = ntBundleConventionConfig.dealConstraints;

    const deal1 = generateDeal(constraints, mulberry32(42));
    const deal2 = generateDeal(constraints, mulberry32(42));

    for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
      expect(deal1.deal.hands[seat].cards).toEqual(deal2.deal.hands[seat].cards);
    }
  });
});
