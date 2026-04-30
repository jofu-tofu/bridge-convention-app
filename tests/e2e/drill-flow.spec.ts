import { expect, test } from "@playwright/test";
import { expectNoSettingsButtonInGameShell, waitForPhase } from "./helpers";

test.describe("drill flow", () => {
  test("practice settings, saved drill creation, and MRU launch work from /practice", async ({ page }) => {
    await page.goto("/practice");
    await page.evaluate(() => {
      window.localStorage.clear();
    });
    await page.reload();

    await expect(page.getByTestId("practice-settings-mode-decision")).toBeVisible();
    await expect(page.getByTestId("practice-settings-role-auto")).toBeVisible();
    await expect(page.getByTestId("practice-settings-system-sayc")).toBeVisible();
    await expect(page.getByTestId("practice-settings-opponents-silent")).toBeVisible();
    await expect(page.getByTestId("practice-settings-skill-world-class")).toBeVisible();
    await expect(page.getByTestId("practice-settings-annotations")).toBeVisible();

    await page.getByTestId("practice-settings-mode-decision").click();
    await page.getByTestId("practice-settings-role-auto").click();
    await page.getByTestId("practice-settings-system-sayc").click();

    await page.getByTestId("practice-stayman-bundle").click();

    await expect(page).toHaveURL(/\/game$/);
    await waitForPhase(page, "Bidding");
    await expect(page.getByTestId("bid-P")).toBeEnabled({ timeout: 5_000 });
    await expectNoSettingsButtonInGameShell(page);

    await page.goto("/practice/drills/new");

    await page.getByTestId("drill-form-convention-picker-trigger").click();
    await page.getByTestId("drill-form-convention-picker-option-stayman-bundle").click();

    const drillName = "Stayman auto drill";
    await page.getByTestId("drill-form-name").fill(drillName);
    await page.getByTestId("drill-form-save").click();

    await expect(page).toHaveURL(/\/practice\/drills$/);

    await page.goto("/practice");
    const savedDrill = page.locator('[data-testid^="drill-preset-launch-"]').filter({
      hasText: drillName,
    });
    await expect(savedDrill).toBeVisible();

    await savedDrill.click();

    await expect(page).toHaveURL(/\/game$/);
    await waitForPhase(page, "Bidding");
    await expect(page.getByTestId("bid-P")).toBeEnabled({ timeout: 5_000 });
    await expectNoSettingsButtonInGameShell(page);
  });
});
