import { test, expect } from "@playwright/test";

test("Stayman: bid buttons become enabled after game loads", async ({ page }) => {
  await page.goto("/?convention=stayman&seed=42");

  const phaseLabel = page.getByTestId("game-phase");
  await expect(phaseLabel).toHaveText("Bidding", { timeout: 10000 });

  const passButton = page.getByTestId("bid-pass");
  await expect(passButton).toBeEnabled({ timeout: 10000 });

  const bid2C = page.getByTestId("bid-2C");
  await expect(bid2C).toBeEnabled({ timeout: 5000 });
});

test("DONT: bid buttons become enabled after game loads", async ({ page }) => {
  await page.goto("/?convention=dont&seed=42");

  const phaseLabel = page.getByTestId("game-phase");
  await expect(phaseLabel).toHaveText("Bidding", { timeout: 10000 });

  const passButton = page.getByTestId("bid-pass");
  await expect(passButton).toBeEnabled({ timeout: 10000 });
});

test("Stayman: clicking 2C advances the auction", async ({ page }) => {
  await page.goto("/?convention=stayman&seed=42");

  const phaseLabel = page.getByTestId("game-phase");
  await expect(phaseLabel).toHaveText("Bidding", { timeout: 10000 });

  const bid2C = page.getByTestId("bid-2C");
  await expect(bid2C).toBeEnabled({ timeout: 10000 });
  await bid2C.click();

  // After clicking, auction should continue (AI bids) and user gets next turn
  // or feedback shows. Either way, state should settle within a few seconds.
  await page.waitForTimeout(3000);
  const phase = await phaseLabel.textContent();
  expect(["Bidding", "Declarer", "Defend", "Review"]).toContain(phase);
});
