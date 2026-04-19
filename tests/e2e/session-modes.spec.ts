import { test, expect } from "@playwright/test";
import { startPracticeFromHome, waitForPhase } from "./helpers";

const DECISION_CONTEXT = "Partner and RHO passed. Your turn to bid.";

test.describe("session modes", () => {
  test("convention deep links default to decision drill context", async ({ page }) => {
    await page.goto("/practice?convention=jacoby-transfers-bundle&seed=42");
    await waitForPhase(page, "Bidding");

    await expect(page.getByTestId("practice-mode-label")).toHaveCount(0);
    await expect(page.getByText(DECISION_CONTEXT)).toBeVisible();
  });

  test("practice starts in full auction mode when requested from the URL", async ({ page }) => {
    await startPracticeFromHome(page, "jacoby-transfers-bundle", "full-auction");
    await waitForPhase(page, "Bidding");
    await expect(page.getByTestId("practice-mode-label")).toHaveText("Full Auction");
    await expect(page.getByText(DECISION_CONTEXT)).toHaveCount(0);
  });
});
