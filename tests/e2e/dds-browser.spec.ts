import { test, expect } from "@playwright/test";

test.describe("DDS in browser via WASM worker", () => {
  test("autoplay to EXPLANATION shows tricks table, par absent", async ({
    page,
  }) => {
    // Autoplay bids correct calls and skips to review automatically
    await page.goto("/?convention=stayman&autoplay=true&seed=42");

    // Wait for EXPLANATION phase (autoplay completes bidding)
    const phaseLabel = page.getByTestId("game-phase");
    await expect(phaseLabel).toHaveText("Explanation", { timeout: 30000 });

    // DDS tricks table should render (worker initializes in background)
    const tricksTable = page.getByTestId("tricks-table");
    await expect(tricksTable).toBeVisible({ timeout: 15000 });

    // Par section should be absent (mode=-1, par is null)
    const parSection = page.getByTestId("par-info");
    await expect(parSection).not.toBeVisible();
  });
});
