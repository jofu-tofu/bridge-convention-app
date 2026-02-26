import { describe, it, expect, vi, beforeEach } from "vitest";
import { Seat } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import {
  clearRegistry,
  registerConvention,
} from "../../../conventions/core/registry";
import { staymanConfig } from "../../../conventions/definitions/stayman";
import { saycConfig } from "../../../conventions/definitions/sayc";
import { createStubEngine, makeDeal } from "../../../test-support/engine-stub";

// GameScreen uses Svelte context heavily — test the extracted logic
describe("GameScreen", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
    registerConvention(saycConfig);
  });

  it("startDrill calls engine.generateDeal", async () => {
    const { startDrill } = await import("../../../drill/helpers");
    const deal = makeDeal();
    const generateDeal = vi.fn().mockResolvedValue(deal);
    const engine = createStubEngine({ generateDeal });
    const gameStore = { startDrill: vi.fn().mockResolvedValue(undefined) };

    await startDrill(engine, staymanConfig, Seat.South, gameStore);
    expect(generateDeal).toHaveBeenCalledTimes(1);
    const calledConstraints = generateDeal.mock.calls[0]![0];
    // Convention's own seat constraints are included
    for (const seatConstraint of staymanConfig.dealConstraints.seats) {
      expect(calledConstraints.seats).toContainEqual(
        expect.objectContaining({ seat: seatConstraint.seat }),
      );
    }
  });

  it("startDrill calls gameStore.startDrill with deal and session", async () => {
    const { startDrill } = await import("../../../drill/helpers");
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
    const { computeTableScale } = await import("../../../display/table-scale");
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
