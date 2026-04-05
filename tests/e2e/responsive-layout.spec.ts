import { test, expect } from "@playwright/test";
import { waitForPhase } from "./helpers";

test.describe("responsive layout", () => {
  test("home screen stays visible without horizontal overflow", async ({ page }) => {
    await page.goto("/");

    const main = page.locator("main");
    await expect(main).toBeVisible();
    await expect(page.getByTestId("practice-nt-bundle")).toBeVisible();

    const hasHorizontalScroll = await page.evaluate(() => (
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    ));
    expect(hasHorizontalScroll).toBe(false);
  });

  test("game screen shows the phase badge and a usable bid panel", async ({ page }) => {
    await page.goto("/?convention=nt-bundle&seed=42");
    await waitForPhase(page, "Bidding");

    const passButton = page.getByTestId("bid-P");
    await expect(passButton).toBeVisible();
    await expect(passButton).toBeEnabled({ timeout: 5_000 });

    const buttonBox = await passButton.boundingBox();
    expect(buttonBox).toBeTruthy();
    expect(buttonBox!.width).toBeGreaterThanOrEqual(24);
    expect(buttonBox!.height).toBeGreaterThanOrEqual(24);
  });

  test("settings screen remains reachable from the responsive shell", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).first().click();

    await expect(page.locator("h1")).toHaveText("Practice Settings", { timeout: 5_000 });
  });
});
