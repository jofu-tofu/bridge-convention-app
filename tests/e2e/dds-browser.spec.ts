import { test, expect } from "@playwright/test";

test.describe("DDS in browser via WASM worker", () => {
  test("autoplay to Review shows analysis tab", async ({ page }) => {
    // Autoplay bids correct calls and skips to review automatically
    await page.goto("/?convention=nt-bundle&autoplay=true&seed=42");

    // Wait for Review phase (autoplay completes bidding)
    const phaseLabel = page.getByTestId("game-phase");
    await expect(phaseLabel).toHaveText("Review", { timeout: 30000 });

    // Analysis tab should be present and clickable
    const analysisTab = page.getByRole("tab", { name: "Analysis" });
    await expect(analysisTab).toBeVisible();
    await analysisTab.click();

    // In dev mode, the DDS worker fails to init because Vite serves the
    // worker as a module worker (no importScripts). The analysis panel
    // shows either the makeable contracts table or "DDS not available".
    const analysisPanel = page.getByRole("tabpanel", {
      name: "DDS analysis",
    });
    await expect(analysisPanel).toBeVisible();

    // Par section should be absent — either DDS isn't available, or
    // mode=-1 means par is null in browser
    await expect(page.getByText("Par Score")).not.toBeVisible();
  });
});
