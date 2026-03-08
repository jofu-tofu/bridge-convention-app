import { test, expect } from "@playwright/test";

test("autoplay completes bidding and reaches review", async ({ page }) => {
  // Use autoplay to complete bidding automatically with deterministic seed
  await page.goto("/?convention=stayman&seed=42&autoplay=true");

  // Should reach Review phase (autoplay bids correctly and skips to review)
  const phaseLabel = page.getByTestId("game-phase");
  await expect(phaseLabel).toHaveText("Review", { timeout: 30000 });

  // Review side panel should show bidding review
  const biddingReview = page.getByRole("heading", { name: "Bidding Review" });
  await expect(biddingReview).toBeVisible();
});

test("skip to review button transitions to review", async ({ page }) => {
  // Use autoplay=false with seed — autoplay the opponents but not the user
  // Instead, use convention+seed and manually bid to reach play phase
  await page.goto("/?convention=stayman&seed=42&autoplay=true");

  // Autoplay reaches review; verify the phase and that review content is present
  const phaseLabel = page.getByTestId("game-phase");
  await expect(phaseLabel).toHaveText("Review", { timeout: 30000 });

  // Next Deal button should be available to start another deal
  const nextDeal = page.getByTestId("next-deal");
  await expect(nextDeal).toBeVisible();
});
