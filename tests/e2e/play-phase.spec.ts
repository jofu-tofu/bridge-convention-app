import { test, expect } from "@playwright/test";

test("play phase loads after bidding completes", async ({ page }) => {
  await page.goto("/");

  // Select a convention from the menu
  const conventionCard = page.locator("[data-testid='convention-card']").first();
  await expect(conventionCard).toBeVisible({ timeout: 5000 });
  await conventionCard.click();

  // Should navigate to game screen
  const table = page.locator("[data-testid='bridge-table']");
  await expect(table).toBeVisible({ timeout: 5000 });

  // Wait for bidding to complete and play phase or explanation to appear
  // The auction may complete quickly (all passes → passout → explanation)
  // or lead to a contract → play phase with trick area
  const trickArea = page.locator("[data-testid='trick-area']");
  const explanationHeading = page.getByRole("heading", { name: "Bidding Review" });

  // One of these should appear — either we're in play phase or explanation
  await expect(trickArea.or(explanationHeading)).toBeVisible({ timeout: 15000 });
});

test("skip to review button transitions to explanation", async ({ page }) => {
  await page.goto("/");

  const conventionCard = page.locator("[data-testid='convention-card']").first();
  await expect(conventionCard).toBeVisible({ timeout: 5000 });
  await conventionCard.click();

  const table = page.locator("[data-testid='bridge-table']");
  await expect(table).toBeVisible({ timeout: 5000 });

  // If we reach play phase, click Skip to Review
  const skipButton = page.getByRole("button", { name: "Skip to Review" });
  const explanationHeading = page.getByRole("heading", { name: "Bidding Review" });

  // Wait for either skip button (play phase) or explanation (passout)
  const skipVisible = await skipButton.isVisible().catch(() => false);

  if (skipVisible) {
    await skipButton.click();
  }

  // Should reach explanation screen
  await expect(explanationHeading).toBeVisible({ timeout: 15000 });
});
