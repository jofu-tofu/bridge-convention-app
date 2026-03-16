import { test, expect } from "@playwright/test";

const CONVENTIONS = [
  "nt-bundle",
  "nt-stayman",
  "nt-transfers",
  "bergen-bundle",
  "weak-two-bundle",
  "dont-bundle",
] as const;

const CONVENTION_NAMES: Record<string, string> = {
  "nt-bundle": "1NT Responses",
  "nt-stayman": "Stayman",
  "nt-transfers": "Jacoby Transfers",
  "bergen-bundle": "Bergen Raises",
  "weak-two-bundle": "Weak Two Bids",
  "dont-bundle": "DONT",
};

test.describe("Convention details and learn screens", () => {
  test("explore details toggle for each convention", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    for (const id of CONVENTIONS) {
      const name = CONVENTION_NAMES[id];
      console.log(`\n========== DETAILS: ${name} (${id}) ==========`);

      // Scroll convention card into view
      const card = page.getByTestId(`convention-${id}`);
      await expect(card).toBeVisible({ timeout: 5000 });
      await card.scrollIntoViewIfNeeded();

      // Log card text before expanding
      const cardText = await card.innerText();
      console.log(`Card text (before details): ${cardText}`);

      // Click the Details toggle
      const detailsToggle = page.getByTestId(`details-toggle-${id}`);
      const detailsExists = await detailsToggle.isVisible().catch(() => false);

      if (detailsExists) {
        await detailsToggle.click();
        // Wait for expansion animation
        await page.waitForTimeout(500);

        // Re-read card text with details expanded
        const expandedText = await card.innerText();
        console.log(`Card text (details expanded): ${expandedText}`);

        // Screenshot with details expanded
        await page.screenshot({
          path: `/tmp/details-${id}.png`,
          fullPage: true,
        });

        // Collapse details for clean slate
        await detailsToggle.click();
        await page.waitForTimeout(300);
      } else {
        console.log(`  [No Details toggle found for ${name}]`);
        await page.screenshot({
          path: `/tmp/details-${id}-nodetails.png`,
          fullPage: true,
        });
      }
    }
  });

  test("explore learn screen for each convention", async ({ page }) => {
    for (const id of CONVENTIONS) {
      const name = CONVENTION_NAMES[id];
      console.log(`\n========== LEARN SCREEN: ${name} (${id}) ==========`);

      // Navigate to home page fresh each time
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Click the learn button (book icon — first icon button in the card)
      const learnBtn = page.getByTestId(`learn-${id}`);
      await expect(learnBtn).toBeVisible({ timeout: 5000 });
      await learnBtn.click();

      // Wait for learning screen to load
      await page.waitForTimeout(1000);

      // Screenshot the learning screen (Study mode — default)
      await page.screenshot({
        path: `/tmp/learn-${id}-study.png`,
        fullPage: true,
      });

      // Read all visible text in the main content area
      const bodyText = await page.locator("body").innerText();
      console.log(`Learn screen text (Study mode):\n${bodyText}`);

      // Try switching to "Learn" depth mode for full detail
      const learnTab = page.getByRole("tab", { name: "Learn" });
      const learnTabExists = await learnTab.isVisible().catch(() => false);
      if (learnTabExists) {
        await learnTab.click();
        await page.waitForTimeout(500);

        const learnModeText = await page.locator("body").innerText();
        console.log(`\nLearn screen text (Learn mode):\n${learnModeText}`);

        await page.screenshot({
          path: `/tmp/learn-${id}-learnmode.png`,
          fullPage: true,
        });
      }

      // Try switching to "Compact" depth mode
      const compactTab = page.getByRole("tab", { name: "Compact" });
      const compactTabExists = await compactTab.isVisible().catch(() => false);
      if (compactTabExists) {
        await compactTab.click();
        await page.waitForTimeout(500);

        const compactModeText = await page.locator("body").innerText();
        console.log(`\nLearn screen text (Compact mode):\n${compactModeText}`);

        await page.screenshot({
          path: `/tmp/learn-${id}-compact.png`,
          fullPage: true,
        });
      }
    }
  });

  test("click practice button for 1NT Responses and screenshot", async ({
    page,
  }) => {
    console.log(
      "\n========== PRACTICE: 1NT Responses (nt-bundle) =========="
    );

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Click practice button (play icon — second icon button in the card)
    const practiceBtn = page.getByTestId("practice-nt-bundle");
    await expect(practiceBtn).toBeVisible({ timeout: 5000 });
    await practiceBtn.click();

    // Wait for game screen to load
    await page.waitForTimeout(2000);

    // Screenshot the game screen
    await page.screenshot({
      path: `/tmp/practice-nt-bundle.png`,
      fullPage: true,
    });

    // Read all visible text
    const bodyText = await page.locator("body").innerText();
    console.log(`Practice screen text:\n${bodyText}`);
  });
});
