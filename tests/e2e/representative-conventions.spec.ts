import { test, expect } from "@playwright/test";
import { waitForPhase } from "./helpers";

test.describe("representative convention flows", () => {
  test("Jacoby Transfers reaches review after the two key responder decisions", async ({ page }) => {
    await page.goto("/practice?convention=jacoby-transfers-bundle&seed=42");
    await waitForPhase(page, "Bidding");

    await page.getByTestId("bid-2H").click();
    await expect(page.locator("[role='alert']")).toContainText("Correct!", { timeout: 3_000 });
    await expect(page.getByTestId("bid-4S")).toBeEnabled({ timeout: 5_000 });

    await page.getByTestId("bid-4S").click();
    await waitForPhase(page, "Review", 10_000);

    const biddingReview = page.getByRole("tabpanel", { name: "Bidding review" });
    await expect(page.getByRole("heading", { name: "Bidding Review" })).toBeVisible();
    await expect(biddingReview).toContainText("2♥");
    await expect(biddingReview).toContainText("4♠");
  });

  test("Bergen Raises blocks a wrong pass before accepting the raise", async ({ page }) => {
    await page.goto("/practice?convention=bergen-bundle&seed=1");
    await waitForPhase(page, "Bidding");

    await page.getByTestId("bid-P").click();

    const feedback = page.locator("[role='alert']");
    await expect(feedback).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: /try again/i })).toBeVisible({ timeout: 3_000 });

    await page.getByRole("button", { name: /try again/i }).click();
    await expect(page.getByTestId("bid-2C")).toBeEnabled({ timeout: 5_000 });

    await page.getByTestId("bid-2C").click();
    await expect(feedback).toContainText("Correct!", { timeout: 3_000 });
    await expect(feedback).toContainText("2♣");
  });
});
