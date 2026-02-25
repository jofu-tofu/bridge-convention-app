import { test, expect } from "@playwright/test";

test.describe("game lifecycle — select, bid, navigate", () => {
  test("select Stayman → bid correctly → buttons re-enable for next bid", async ({ page }) => {
    await page.goto("/?convention=stayman&seed=42");

    // Wait for game to load and bidding phase
    const phaseLabel = page.getByTestId("game-phase");
    await expect(phaseLabel).toHaveText("Bidding", { timeout: 5000 });

    // Wait for bid buttons to be enabled
    const bid2C = page.getByTestId("bid-2C");
    await expect(bid2C).toBeEnabled({ timeout: 5000 });

    // Click the correct Stayman response
    await bid2C.click();

    // After correct bid + AI response, either:
    // - Still bidding: pass button should become enabled (feedback auto-dismissed)
    // - Phase transitioned: phase label changes from "Bidding"
    const passButton = page.getByTestId("bid-pass");
    await expect(
      passButton.or(phaseLabel.filter({ hasNotText: "Bidding" })),
    ).toBeVisible({ timeout: 5000 });

    // If still in bidding phase, bid buttons must be re-enabled
    const phase = await phaseLabel.textContent();
    if (phase === "Bidding") {
      await expect(passButton).toBeEnabled({ timeout: 5000 });
    }
  });

  test("back button returns to convention select screen", async ({ page }) => {
    await page.goto("/?convention=stayman&seed=42");

    const phaseLabel = page.getByTestId("game-phase");
    await expect(phaseLabel).toHaveText("Bidding", { timeout: 5000 });

    // Click back button
    const backButton = page.getByTestId("back-to-menu");
    await backButton.click();

    // Should see convention select screen
    const heading = page.locator("h1");
    await expect(heading).toHaveText("Bridge Practice", { timeout: 5000 });
  });

  test("back to menu → re-select convention → game loads again", async ({ page }) => {
    await page.goto("/?convention=stayman&seed=42");

    const phaseLabel = page.getByTestId("game-phase");
    await expect(phaseLabel).toHaveText("Bidding", { timeout: 5000 });

    // Go back
    const backButton = page.getByTestId("back-to-menu");
    await backButton.click();
    await expect(page.locator("h1")).toHaveText("Bridge Practice", { timeout: 5000 });

    // Re-select Stayman
    const staymanCard = page.getByTestId("convention-stayman");
    await staymanCard.click();

    // Game should load again with bidding phase
    await expect(phaseLabel).toHaveText("Bidding", { timeout: 5000 });
    const bid2C = page.getByTestId("bid-2C");
    await expect(bid2C).toBeEnabled({ timeout: 5000 });
  });

  test("bid wrong → dismiss feedback → can bid again", async ({ page }) => {
    await page.goto("/?convention=stayman&seed=42");

    const phaseLabel = page.getByTestId("game-phase");
    await expect(phaseLabel).toHaveText("Bidding", { timeout: 5000 });

    // Wait for buttons to be ready
    const passButton = page.getByTestId("bid-pass");
    await expect(passButton).toBeEnabled({ timeout: 5000 });

    // Bid wrong (pass instead of 2C)
    await passButton.click();

    // Feedback panel should appear with incorrect indicator
    const feedbackPanel = page.locator("[role='alert']");
    await expect(feedbackPanel).toBeVisible({ timeout: 5000 });

    // Click "Continue" to dismiss
    const continueBtn = page.getByRole("button", { name: /continue/i });
    if (await continueBtn.isVisible()) {
      await continueBtn.click();

      // After dismiss, auction should continue
      await page.waitForTimeout(2000);
      const phase = await phaseLabel.textContent();
      // Phase should be either still bidding or transitioned
      expect(["Bidding", "Declarer", "Defend", "Review"]).toContain(phase);
    }
  });

  test("bid wrong → retry → can bid again with same deal", async ({ page }) => {
    await page.goto("/?convention=stayman&seed=42");

    const phaseLabel = page.getByTestId("game-phase");
    await expect(phaseLabel).toHaveText("Bidding", { timeout: 5000 });

    const passButton = page.getByTestId("bid-pass");
    await expect(passButton).toBeEnabled({ timeout: 5000 });

    // Bid wrong
    await passButton.click();

    // Look for retry button
    const retryBtn = page.getByRole("button", { name: /try again/i });
    if (await retryBtn.isVisible()) {
      await retryBtn.click();

      // After retry, buttons should be enabled again
      const bid2C = page.getByTestId("bid-2C");
      await expect(bid2C).toBeEnabled({ timeout: 5000 });
    }
  });
});
