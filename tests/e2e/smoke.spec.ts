import { test, expect } from "@playwright/test";
import { expectNoSettingsButtonInGameShell, startPracticeFromHome, waitForPhase } from "./helpers";

test.describe("app smoke", () => {
  test("home search narrows the convention list", async ({ page }) => {
    await page.goto("/practice");

    await expect(page.getByTestId("practice-jacoby-transfers-bundle")).toBeVisible();
    await expect(page.getByTestId("practice-bergen-bundle")).toBeVisible();
    await page.getByLabel("Search conventions").fill("stayman");

    await expect(page.getByTestId("practice-stayman-bundle")).toBeVisible();
    await expect(page.getByTestId("practice-bergen-bundle")).not.toBeAttached();
  });

  test("practice picker starts a decision drill", async ({ page }) => {
    await startPracticeFromHome(page, "bergen-bundle");

    await expect(page.getByTestId("bid-P")).toBeEnabled({ timeout: 5_000 });
  });

  test("game shell does not expose an in-game settings button", async ({ page }) => {
    await page.goto("/practice?convention=bergen-bundle&seed=1");
    await waitForPhase(page, "Bidding");
    await expectNoSettingsButtonInGameShell(page);
  });

  test("convention and learning deep links load their target screens directly", async ({ page }) => {
    await page.goto("/practice?convention=bergen-bundle&seed=3");
    await waitForPhase(page, "Bidding");
    await expect(page.getByTestId("bid-P")).toBeEnabled({ timeout: 5_000 });

    await page.goto("/learn/stayman/");
    await expect(page.getByRole("heading", { level: 1, name: /Stayman/ })).toBeVisible();
  });

  test("wrong bid feedback is blocking and retry restores the bid panel", async ({ page }) => {
    await page.goto("/practice?convention=bergen-bundle&seed=1");
    await waitForPhase(page, "Bidding");

    await page.getByTestId("bid-7NT").click();

    const feedback = page.locator("[role='alert']");
    await expect(feedback).toBeVisible({ timeout: 5_000 });
    await expect(feedback).toContainText("Incorrect", { timeout: 3_000 });

    const tryAgain = feedback.locator("[aria-label='Try again']");
    await expect(tryAgain).toBeVisible({ timeout: 3_000 });
    await tryAgain.click();

    await expect(page.getByTestId("bid-7NT")).toBeEnabled({ timeout: 5_000 });
  });

  test("settings and home navigation remain reachable", async ({ page }) => {
    await page.goto("/practice");
    await page.getByRole("link", { name: "Settings" }).first().click();

    await expect(page.locator("h1")).toHaveText("Settings", { timeout: 5_000 });

    await page.getByRole("link", { name: "Practice" }).first().click();
    await expect(page.locator("h1")).toHaveText("Practice", { timeout: 5_000 });
  });
});
