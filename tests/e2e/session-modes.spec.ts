import { test, expect } from "@playwright/test";
import { waitForPhase } from "./helpers";

const DECISION_CONTEXT = "Partner opened 1NT. RHO passed. Your turn to respond.";

test.describe("session modes", () => {
  test("convention deep links default to decision drill context", async ({ page }) => {
    await page.goto("/?convention=nt-transfers&seed=42");
    await waitForPhase(page, "Bidding");

    await expect(page.getByTestId("practice-mode-label")).toHaveCount(0);
    await expect(page.getByText(DECISION_CONTEXT)).toBeVisible();
  });

  test("practice picker can start full auction mode", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("practice-nt-transfers").click();
    await page.getByTestId("mode-full-auction").click({ timeout: 5_000 });

    await waitForPhase(page, "Bidding");
    await expect(page.getByTestId("practice-mode-label")).toHaveText("Full Auction");
    await expect(page.getByText(DECISION_CONTEXT)).toHaveCount(0);
  });

  test("continuation drill deep links preserve the continuation mode label", async ({ page }) => {
    await page.goto("/?convention=nt-transfers&seed=42&practiceMode=continuation-drill");
    await waitForPhase(page, "Bidding");

    await expect(page.getByTestId("practice-mode-label")).toHaveText("Continuation");
    await expect(page.getByText(DECISION_CONTEXT)).toHaveCount(0);
  });

  test("autoplay reaches review and next deal restarts bidding", async ({ page }) => {
    await page.goto("/?convention=nt-bundle&seed=42&autoplay=true");
    await waitForPhase(page, "Review", 30_000);

    await expect(page.getByRole("heading", { name: "Bidding Review" })).toBeVisible();
    await page.getByTestId("next-deal").click();

    await waitForPhase(page, "Bidding", 10_000);
  });

  test("review analysis tab renders after autoplay", async ({ page }) => {
    await page.goto("/?convention=nt-bundle&seed=42&autoplay=true");
    await waitForPhase(page, "Review", 30_000);

    const analysisTab = page.getByRole("tab", { name: "Analysis" });
    await expect(analysisTab).toBeVisible();
    await analysisTab.click();

    await expect(
      page.getByText(/DDS analysis not available\.|Makeable Contracts/i),
    ).toBeVisible();
  });
});
