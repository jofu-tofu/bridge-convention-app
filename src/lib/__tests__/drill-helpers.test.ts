import { describe, it, expect, vi, beforeEach } from "vitest";
import { startDrill } from "../drill-helpers";
import {
  createStubEngine,
  makeDeal,
} from "../../components/__tests__/test-helpers";
import { Seat } from "../../engine/types";
import { clearRegistry, registerConvention } from "../../conventions/registry";
import { staymanConfig } from "../../conventions/stayman";

describe("startDrill", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
  });

  it("calls engine.generateDeal with convention's dealConstraints", async () => {
    const generateDeal = vi.fn().mockResolvedValue(makeDeal());
    const engine = createStubEngine({ generateDeal });
    const gameStore = { startDrill: vi.fn().mockResolvedValue(undefined) };

    await startDrill(engine, staymanConfig, Seat.South, gameStore);

    expect(generateDeal).toHaveBeenCalledWith(staymanConfig.dealConstraints);
  });

  it("calls gameStore.startDrill with generated deal and session", async () => {
    const deal = makeDeal();
    const engine = createStubEngine({
      generateDeal: vi.fn().mockResolvedValue(deal),
    });
    const gameStore = { startDrill: vi.fn().mockResolvedValue(undefined) };

    await startDrill(engine, staymanConfig, Seat.South, gameStore);

    expect(gameStore.startDrill).toHaveBeenCalledTimes(1);
    const [calledDeal, calledSession] = gameStore.startDrill.mock.calls[0]!;
    expect(calledDeal).toBe(deal);
    expect(calledSession).toBeDefined();
    expect(typeof calledSession.getNextBid).toBe("function");
  });

  it("passes initialAuction from convention.defaultAuction when defined", async () => {
    const deal = makeDeal();
    const engine = createStubEngine({
      generateDeal: vi.fn().mockResolvedValue(deal),
    });
    const gameStore = { startDrill: vi.fn().mockResolvedValue(undefined) };

    // Stayman has no defaultAuction, so create a test convention with one
    const mockAuction = { entries: [], isComplete: false };
    const conventionWithDefault = {
      ...staymanConfig,
      defaultAuction: vi.fn().mockReturnValue(mockAuction),
    };

    await startDrill(engine, conventionWithDefault, Seat.South, gameStore);

    expect(conventionWithDefault.defaultAuction).toHaveBeenCalledWith(
      Seat.South,
      deal,
    );
    const [, , calledAuction] = gameStore.startDrill.mock.calls[0]!;
    expect(calledAuction).toBe(mockAuction);
  });

  it("passes undefined initialAuction when convention has no defaultAuction", async () => {
    const engine = createStubEngine({
      generateDeal: vi.fn().mockResolvedValue(makeDeal()),
    });
    const gameStore = { startDrill: vi.fn().mockResolvedValue(undefined) };

    // Create convention without defaultAuction
    const { defaultAuction: _, ...conventionNoDefault } = staymanConfig;
    registerConvention({ ...conventionNoDefault, id: "stayman-no-default" });
    const config = {
      ...conventionNoDefault,
      id: "stayman-no-default",
    } as typeof staymanConfig;

    await startDrill(engine, config, Seat.South, gameStore);

    const [, , calledAuction] = gameStore.startDrill.mock.calls[0]!;
    expect(calledAuction).toBeUndefined();
  });
});
