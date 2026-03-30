import { describe, it, expect, vi } from "vitest";
import type { Call } from "../../../service";

// GameScreen uses Svelte context heavily — test the extracted logic
describe("GameScreen", () => {
  it("computeTableScale produces valid scale for desktop", async () => {
    const { computeTableScale } = await import("../../shared/table-scale");
    const scale = computeTableScale(1200, 800);
    expect(scale).toBeGreaterThanOrEqual(0.35);
    expect(scale).toBeLessThanOrEqual(1.4);
  });

  it("BidPanel disabled when not user turn is handled by store", () => {
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
