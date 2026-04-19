import { test, expect } from "@playwright/test";
import { waitForPhase } from "./helpers";

test.describe("representative convention flows", () => {
  test("Jacoby Transfers seeded full-auction deal opens on the expected 1NT hand", async ({ page }) => {
    await page.goto("/practice?convention=jacoby-transfers-bundle&seed=10&practiceMode=full-auction");
    await waitForPhase(page, "Bidding", 10_000);

    await expect(page.getByRole("heading", { name: "Jacoby Transfers Practice" })).toBeVisible();
    await expect(page.getByTestId("practice-mode-label")).toHaveText("Full Auction");
    await expect(page.getByTestId("bid-1NT")).toBeEnabled();
  });

  test("Bergen Raises blocks a wrong pass before accepting the raise", async ({ page }) => {
    await page.goto("/practice?convention=bergen-bundle&seed=3");
    await waitForPhase(page, "Bidding");

    await page.getByTestId("bid-P").click();

    const feedback = page.locator("[role='alert']");
    await expect(feedback).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("[aria-label='Try again']")).toBeVisible({ timeout: 3_000 });

    await page.locator("[aria-label='Try again']").click();
    await expect(page.getByTestId("bid-3H")).toBeEnabled({ timeout: 5_000 });

    await page.getByTestId("bid-3H").click();
    await expect(feedback).toContainText("Close", { timeout: 3_000 });
    await expect(feedback).toContainText("3♥");
  });
});
