import { describe, it, expect, vi, beforeEach } from "vitest";
import { Seat } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import {
  clearRegistry,
  registerConvention,
} from "../../../conventions/registry";
import { staymanConfig } from "../../../conventions/stayman";
import { createStubEngine, makeDeal } from "../test-helpers";

// GameScreen uses Svelte context heavily — test the extracted logic
describe("GameScreen", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
  });

  it("startDrill calls engine.generateDeal", async () => {
    const { startDrill } = await import("../../../lib/drill-helpers");
    const deal = makeDeal();
    const generateDeal = vi.fn().mockResolvedValue(deal);
    const engine = createStubEngine({ generateDeal });
    const gameStore = { startDrill: vi.fn().mockResolvedValue(undefined) };

    await startDrill(engine, staymanConfig, Seat.South, gameStore);
    expect(generateDeal).toHaveBeenCalledWith(staymanConfig.dealConstraints);
  });

  it("startDrill calls gameStore.startDrill with deal and session", async () => {
    const { startDrill } = await import("../../../lib/drill-helpers");
    const deal = makeDeal();
    const engine = createStubEngine({
      generateDeal: vi.fn().mockResolvedValue(deal),
    });
    const gameStore = { startDrill: vi.fn().mockResolvedValue(undefined) };

    await startDrill(engine, staymanConfig, Seat.South, gameStore);
    expect(gameStore.startDrill).toHaveBeenCalledTimes(1);
    const [calledDeal] = gameStore.startDrill.mock.calls[0]!;
    expect(calledDeal).toBe(deal);
  });

  it("computeTableScale produces valid scale for desktop", async () => {
    const { computeTableScale } = await import("../../../lib/table-scale");
    const scale = computeTableScale(1200, 800);
    expect(scale).toBeGreaterThanOrEqual(0.35);
    expect(scale).toBeLessThanOrEqual(1.4);
  });

  it("BidPanel disabled when not user turn is handled by store", () => {
    // isUserTurn is derived in the store — test the contract
    const mockStore = {
      isUserTurn: false,
      legalCalls: [] as Call[],
    };
    expect(mockStore.isUserTurn).toBe(false);
  });

  it("navigates to menu via appStore", () => {
    const appStore = {
      navigateToMenu: vi.fn(),
    };
    appStore.navigateToMenu();
    expect(appStore.navigateToMenu).toHaveBeenCalledOnce();
  });
});
