import { test, expect } from "@playwright/test";
import { startPracticeFromHome, waitForPhase } from "./helpers";

test.describe("app smoke", () => {
  test("home search narrows the convention list", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("practice-nt-transfers")).toBeVisible();
    await expect(page.getByTestId("practice-bergen-bundle")).toBeVisible();
    await page.getByLabel("Search conventions").fill("stayman");

    await expect(page.getByTestId("practice-nt-stayman")).toBeVisible();
    await expect(page.getByTestId("practice-bergen-bundle")).not.toBeAttached();
  });

  test("practice picker starts a decision drill", async ({ page }) => {
    await startPracticeFromHome(page, "bergen-bundle");

    await expect(page.getByTestId("bid-P")).toBeEnabled({ timeout: 5_000 });
  });

  test("convention and learning deep links load their target screens directly", async ({ page }) => {
    await page.goto("/?convention=bergen-bundle&seed=1");
    await waitForPhase(page, "Bidding");
    await expect(page.getByTestId("bid-P")).toBeEnabled({ timeout: 5_000 });

    await page.goto("/?learn=nt-stayman");
    await expect(page.getByRole("main", { name: "Convention learning" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Stayman/ })).toBeVisible();
  });

  test("wrong bid feedback is blocking and retry restores the bid panel", async ({ page }) => {
    await page.goto("/?convention=bergen-bundle&seed=1");
    await waitForPhase(page, "Bidding");

    await page.getByTestId("bid-P").click();

    const feedback = page.locator("[role='alert']");
    await expect(feedback).toBeVisible({ timeout: 5_000 });

    const tryAgain = page.getByRole("button", { name: /try again/i });
    await expect(tryAgain).toBeVisible({ timeout: 3_000 });
    await tryAgain.click();

    await expect(page.getByTestId("bid-P")).toBeEnabled({ timeout: 5_000 });
  });

  test("settings and home navigation remain reachable", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).first().click();

    await expect(page.locator("h1")).toHaveText("Practice Settings", { timeout: 5_000 });

    await page.getByRole("button", { name: "Home" }).first().click();
    await expect(page.locator("h1")).toHaveText("Bridge Practice", { timeout: 5_000 });
  });
});
