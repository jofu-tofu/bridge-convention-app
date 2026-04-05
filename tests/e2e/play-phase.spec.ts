import { test, expect } from "@playwright/test";

test("autoplay completes bidding and reaches review", async ({ page }) => {
  // Use autoplay to complete bidding automatically with deterministic seed
  await page.goto("/?convention=nt-bundle&seed=42&autoplay=true");

  // Should reach Review phase (autoplay bids correctly and skips to review)
  const phaseLabel = page.getByTestId("game-phase");
  await expect(phaseLabel).toHaveText("Review", { timeout: 30000 });

  // Review side panel should show bidding review
  const biddingReview = page.getByRole("heading", { name: "Bidding Review" });
  await expect(biddingReview).toBeVisible();

  const nextDeal = page.getByTestId("next-deal");
  await expect(nextDeal).toBeVisible();
});
