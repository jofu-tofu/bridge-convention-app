import { describe, it, expect, vi, beforeEach } from "vitest";
import { startDrill } from "../start-drill";
import { createStubEngine, makeDeal } from "../../test-support/engine-stub";
import { Seat } from "../../engine/types";
import type { DealConstraints } from "../../engine/types";
import { clearRegistry, registerConvention } from "../../conventions/core/registry";
import { clearBundleRegistry, registerBundle } from "../../conventions/core/bundle";
import { ntBundle } from "../../conventions/definitions/nt-bundle";
import { ntBundleConventionConfig } from "../../conventions/definitions/nt-bundle/convention-config";
import { mulberry32 } from "../../core/util/seeded-rng";
import { generateDeal } from "../../engine/deal-generator";

describe("seed determinism - pipeline", () => {
  beforeEach(() => {
    clearRegistry();
    clearBundleRegistry();
    registerConvention(ntBundleConventionConfig);
    registerBundle(ntBundle);
  });

  it("seed is passed through to engine.generateDeal", async () => {
    const genDeal = vi.fn().mockResolvedValue(makeDeal());
    const engine = createStubEngine({ generateDeal: genDeal });

    const seed = 42;
    const rng = mulberry32(seed);
    await startDrill(engine, ntBundleConventionConfig, Seat.South, rng, seed);

    const constraints = genDeal.mock.calls[0]![0] as DealConstraints;
    expect(constraints.seed).toBe(42);
    expect(typeof constraints.rng).toBe("function");
  });

  it("TS generateDeal with same seed produces identical deals", () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    
    const constraints: DealConstraints = {
      seats: [
        { seat: Seat.North, minHcp: 15, maxHcp: 17, balanced: true },
      ],
    };
    
    const deal1 = generateDeal(constraints, rng1);
    const deal2 = generateDeal(constraints, rng2);
    
    expect(deal1.deal.hands[Seat.North].cards).toEqual(deal2.deal.hands[Seat.North].cards);
    expect(deal1.deal.hands[Seat.South].cards).toEqual(deal2.deal.hands[Seat.South].cards);
    expect(deal1.deal.hands[Seat.East].cards).toEqual(deal2.deal.hands[Seat.East].cards);
    expect(deal1.deal.hands[Seat.West].cards).toEqual(deal2.deal.hands[Seat.West].cards);
  });
});
