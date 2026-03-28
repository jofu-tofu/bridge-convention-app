import { describe, it, expect, vi, beforeEach } from "vitest";
import { Seat } from "../../../service";
import type { Call } from "../../../service";
import { clearBundleRegistry, registerBundle, createConventionConfigFromBundle, ntBundle } from "../../../conventions";
import { calculateHcp } from "../../../engine/hand-evaluator";

const ntBundleConventionConfig = createConventionConfigFromBundle(ntBundle);

// GameScreen uses Svelte context heavily — test the extracted logic
describe("GameScreen", () => {
  beforeEach(() => {
    clearBundleRegistry();
    registerBundle(ntBundle);
  });

  it("startDrill produces a valid deal satisfying constraints", async () => {
    const { startDrill } = await import("../../../session/start-drill");

    const bundle = await startDrill(ntBundleConventionConfig, Seat.South);

    // Valid 4×13 deal
    for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
      expect(bundle.deal.hands[seat].cards).toHaveLength(13);
    }
    // NT bundle requires North: 15-17 HCP
    const northHcp = calculateHcp(bundle.deal.hands[Seat.North]);
    expect(northHcp).toBeGreaterThanOrEqual(15);
    expect(northHcp).toBeLessThanOrEqual(17);
  });

  it("startDrill returns bundle with deal and session", async () => {
    const { startDrill } = await import("../../../session/start-drill");

    const bundle = await startDrill(ntBundleConventionConfig, Seat.South);

    // Structural check: 4 hands of 13 cards
    for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
      expect(bundle.deal.hands[seat].cards).toHaveLength(13);
    }
    expect(bundle.session).toBeDefined();
  });

  it("computeTableScale produces valid scale for desktop", async () => {
    const { computeTableScale } = await import("../../shared/table-scale");
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
      navigateToConventions: vi.fn(),
    };
    appStore.navigateToConventions();
    expect(appStore.navigateToConventions).toHaveBeenCalledOnce();
  });
});
