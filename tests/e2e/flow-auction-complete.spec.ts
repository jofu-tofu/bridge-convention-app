import { test, expect, type Page } from "@playwright/test";

/**
 * Helper: log the current auction sequence from the table center.
 */
async function logAuction(page: Page, label: string): Promise<string> {
  const auction = await page.locator('[data-testid="table-center"]').textContent();
  console.log(`=== AUCTION [${label}] ===`);
  console.log(auction?.trim());
  return auction?.trim() ?? "";
}

/**
 * Helper: log all enabled bid buttons.
 */
async function logEnabledButtons(page: Page, label: string): Promise<string[]> {
  const buttons = await page.$$eval(
    'button[data-testid^="bid-"]',
    (els) =>
      els
        .filter((e) => !(e as HTMLButtonElement).disabled)
        .map((e) => e.getAttribute("data-testid") ?? ""),
  );
  console.log(`=== ENABLED BUTTONS [${label}] ===`);
  console.log(JSON.stringify(buttons));
  return buttons;
}

/**
 * Helper: log full body text (truncated).
 */
async function logBodyText(page: Page, label: string, maxLen = 4000): Promise<string> {
  const bodyText = (await page.textContent("body")) ?? "";
  console.log(`=== BODY TEXT [${label}] ===`);
  console.log(bodyText.substring(0, maxLen));
  return bodyText;
}

/**
 * Helper: log the current game phase.
 */
async function logPhase(page: Page, label: string): Promise<string> {
  const phaseEl = page.getByTestId("game-phase");
  const phase = (await phaseEl.textContent()) ?? "";
  console.log(`=== PHASE [${label}] === ${phase}`);
  return phase;
}

test.describe("Stayman full auction — seed 42", () => {
  test("complete auction: correct bids 2H then Pass", async ({ page }) => {
    // Step 1: Navigate to the app with seed=42
    await page.goto("http://localhost:1420/?seed=42");
    await page.waitForLoadState("networkidle");

    // Step 2: Click practice button for Stayman
    await page.locator('[data-testid="practice-nt-stayman"]').click();

    // Wait for bidding phase to load
    const phaseLabel = page.getByTestId("game-phase");
    await expect(phaseLabel).toHaveText("Bidding", { timeout: 5000 });

    // Wait for bid buttons to be enabled (user's turn)
    const bid2H = page.getByTestId("bid-2H");
    await expect(bid2H).toBeEnabled({ timeout: 5000 });

    // Log initial state
    await logPhase(page, "initial");
    await logAuction(page, "initial");
    await logEnabledButtons(page, "initial");
    await logBodyText(page, "initial");

    // Step 4: Bid 2H (Stayman response)
    console.log("\n>>> CLICKING bid-2H <<<\n");
    await bid2H.click();

    // Wait for the auction to progress (AI bids W:Pass, N:3D, E:Pass)
    await page.waitForTimeout(1500);

    // Step 6: Screenshot + log after first bid
    await page.screenshot({
      path: "/tmp/ss-auction-after-2H.png",
      fullPage: true,
    });

    await logPhase(page, "after 2H");
    const auctionAfter2H = await logAuction(page, "after 2H");
    const _enabledAfter2H = await logEnabledButtons(page, "after 2H");
    const _bodyAfter2H = await logBodyText(page, "after 2H");

    // Verify the auction progressed: should contain the 2H bid
    expect(auctionAfter2H).toContain("2");

    // Check if it's user's turn again for the second bid
    const feedbackPanel = page.locator("[role='alert']");
    const hasFeedback = await feedbackPanel.isVisible().catch(() => false);
    console.log("Feedback visible after 2H:", hasFeedback);

    // Step 7: Bid Pass (correct second bid)
    // The DEV info says "No convention bid (pass)" for the second bid
    const passButton = page.getByTestId("bid-pass");

    // If pass is not yet enabled, wait for it
    const phase2 = await logPhase(page, "before pass");
    if (phase2 === "Bidding") {
      await expect(passButton).toBeEnabled({ timeout: 5000 });
      console.log("\n>>> CLICKING bid-pass <<<\n");
      await passButton.click();

      await page.waitForTimeout(1500);

      // Step 9: Screenshot + log after Pass
      await page.screenshot({
        path: "/tmp/ss-auction-after-pass.png",
        fullPage: true,
      });

      await logPhase(page, "after pass");
      await logAuction(page, "after pass");
      await logEnabledButtons(page, "after pass");
      await logBodyText(page, "after pass");
    }

    // Step 10: Continue bidding if needed
    let round = 0;
    const MAX_ROUNDS = 5;
    while (round < MAX_ROUNDS) {
      round++;
      const currentPhase = await logPhase(page, `loop-${round}`);

      if (currentPhase !== "Bidding") {
        console.log(`Phase changed to "${currentPhase}" -- auction is over.`);
        break;
      }

      // Check for feedback (in case our bid was wrong)
      const fbVisible = await feedbackPanel.isVisible().catch(() => false);
      if (fbVisible) {
        const fbText = await feedbackPanel.textContent();
        console.log(`Feedback present in loop-${round}: ${fbText}`);

        // Try clicking "Try again" if available
        const tryAgain = page.getByRole("button", { name: /try again/i });
        if (await tryAgain.isVisible().catch(() => false)) {
          console.log("Clicking Try Again...");
          await tryAgain.click();
          await page.waitForTimeout(500);
          continue;
        }

        // Try clicking "Continue" if available
        const continueBtn = page.getByRole("button", { name: /continue/i });
        if (await continueBtn.isVisible().catch(() => false)) {
          console.log("Clicking Continue...");
          await continueBtn.click();
          await page.waitForTimeout(500);
          continue;
        }
        break;
      }

      // Check if any bid buttons are enabled
      const enabled = await logEnabledButtons(page, `loop-${round}`);
      if (enabled.length === 0) {
        console.log("No enabled buttons -- waiting for AI...");
        await page.waitForTimeout(1000);
        continue;
      }

      // If pass is available, bid pass (safe default)
      if (enabled.includes("bid-pass")) {
        console.log(`Loop-${round}: Bidding pass`);
        await page.getByTestId("bid-pass").click();
        await page.waitForTimeout(1500);
        await logAuction(page, `loop-${round}-after-pass`);
      } else {
        console.log(`Loop-${round}: No pass available, stopping.`);
        break;
      }
    }

    // Final state
    const finalPhase = await logPhase(page, "final");
    await logAuction(page, "final");
    await page.screenshot({
      path: "/tmp/ss-auction-final.png",
      fullPage: true,
    });
    await logBodyText(page, "final");

    // Assert the auction completed -- phase should have moved past Bidding
    console.log(`\n=== FINAL PHASE: "${finalPhase}" ===`);
    expect(["Declarer", "Defend", "Playing", "Review"]).toContain(finalPhase);
  });

  test("wrong bid 2C -> feedback -> retry -> correct bid 2H", async ({ page }) => {
    // Navigate and start Stayman practice
    await page.goto("http://localhost:1420/?seed=42");
    await page.waitForLoadState("networkidle");
    await page.locator('[data-testid="practice-nt-stayman"]').click();

    const phaseLabel = page.getByTestId("game-phase");
    await expect(phaseLabel).toHaveText("Bidding", { timeout: 5000 });

    // Wait for buttons to be ready
    const bid2C = page.getByTestId("bid-2C");
    await expect(bid2C).toBeEnabled({ timeout: 5000 });

    await logPhase(page, "initial-wrong");
    await logAuction(page, "initial-wrong");
    await logEnabledButtons(page, "initial-wrong");

    // Make a wrong bid: 2C
    console.log("\n>>> CLICKING bid-2C (WRONG BID) <<<\n");
    await bid2C.click();
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: "/tmp/ss-wrong-bid-2C.png",
      fullPage: true,
    });

    // Observe feedback
    const feedbackPanel = page.locator("[role='alert']");
    await expect(feedbackPanel).toBeVisible({ timeout: 5000 });

    const feedbackText = await feedbackPanel.textContent();
    console.log("=== FEEDBACK AFTER WRONG BID 2C ===");
    console.log(feedbackText);

    await logAuction(page, "after-wrong-2C");
    await logEnabledButtons(page, "after-wrong-2C");
    await logBodyText(page, "after-wrong-2C");

    // All bid buttons should be disabled during feedback
    const enabledDuringFeedback = await page.$$eval(
      'button[data-testid^="bid-"]',
      (els) =>
        els
          .filter((e) => !(e as HTMLButtonElement).disabled)
          .map((e) => e.getAttribute("data-testid") ?? ""),
    );
    console.log("Enabled buttons during feedback:", JSON.stringify(enabledDuringFeedback));
    expect(enabledDuringFeedback.length).toBe(0);

    // Try bidding 2C again (should not work -- buttons disabled)
    console.log("\n>>> ATTEMPTING bid-2C AGAIN (should be disabled) <<<\n");
    const bid2CDisabled = await bid2C.isDisabled();
    console.log("bid-2C is disabled:", bid2CDisabled);
    expect(bid2CDisabled).toBe(true);

    // Click "Try Again" to dismiss feedback
    const tryAgainBtn = page.getByRole("button", { name: /try again/i });
    await expect(tryAgainBtn).toBeVisible({ timeout: 3000 });
    console.log("\n>>> CLICKING Try Again <<<\n");
    await tryAgainBtn.click();
    await page.waitForTimeout(500);

    // Feedback should be dismissed, buttons should be enabled again
    await expect(feedbackPanel).not.toBeVisible({ timeout: 3000 });

    await logAuction(page, "after-retry");
    const enabledAfterRetry = await logEnabledButtons(page, "after-retry");
    expect(enabledAfterRetry.length).toBeGreaterThan(0);

    await page.screenshot({
      path: "/tmp/ss-after-retry.png",
      fullPage: true,
    });

    // Now bid correctly: 2H
    const bid2H = page.getByTestId("bid-2H");
    await expect(bid2H).toBeEnabled({ timeout: 5000 });
    console.log("\n>>> CLICKING bid-2H (CORRECT BID) <<<\n");
    await bid2H.click();
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: "/tmp/ss-correct-bid-2H.png",
      fullPage: true,
    });

    // Feedback should show "Correct!" briefly or auction should progress
    await logPhase(page, "after-correct-2H");
    await logAuction(page, "after-correct-2H");
    await logEnabledButtons(page, "after-correct-2H");
    await logBodyText(page, "after-correct-2H");

    // The auction should have progressed (AI bids follow)
    const auctionText = await page
      .locator('[data-testid="table-center"]')
      .textContent();
    console.log("Auction after correct bid:", auctionText);

    // Verify we are still in a valid state
    const phase = await phaseLabel.textContent();
    console.log(`Phase after correct bid: "${phase}"`);
    expect(phase).toBeTruthy();
  });
});
