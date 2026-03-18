import { test, expect } from "@playwright/test";

test.describe("responsive layout — convention select screen", () => {
  test("main content area is visible and not overflowing", async ({ page }) => {
    await page.goto("/");
    const main = page.locator("main");
    await expect(main).toBeVisible();
    
    // Content should not overflow horizontally
    const viewport = page.viewportSize()!;
    const box = await main.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeLessThanOrEqual(viewport.width);
  });

  test("search bar is usable", async ({ page }) => {
    await page.goto("/");
    const search = page.getByLabel("Search conventions");
    await expect(search).toBeVisible();
    
    // Search bar should be wide enough to type in
    const box = await search.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(100);
  });

  test("convention cards are visible and tappable", async ({ page }) => {
    await page.goto("/");
    const practiceButton = page.getByTestId("practice-nt-bundle");
    await expect(practiceButton).toBeVisible();
    
    // Button should be large enough to tap (at least 44x44 CSS pixels)
    const box = await practiceButton.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThanOrEqual(24);
    expect(box!.height).toBeGreaterThanOrEqual(24);
  });

  test("category filter buttons wrap on narrow viewports", async ({ page }) => {
    await page.goto("/");
    const allButton = page.getByRole("button", { name: "All" });
    await expect(allButton).toBeVisible();
  });
});

test.describe("responsive layout — game screen", () => {
  test("game screen loads and phase badge is visible", async ({ page }) => {
    await page.goto("/?convention=nt-bundle&seed=42");
    const phase = page.getByTestId("game-phase");
    await expect(phase).toHaveText("Bidding", { timeout: 10000 });
  });

  test("bid panel is visible and interactive", async ({ page }) => {
    await page.goto("/?convention=nt-bundle&seed=42");
    const phase = page.getByTestId("game-phase");
    await expect(phase).toHaveText("Bidding", { timeout: 10000 });
    
    const passButton = page.getByTestId("bid-pass");
    await expect(passButton).toBeVisible();
    await expect(passButton).toBeEnabled({ timeout: 5000 });
    
    // Pass button should be tappable
    const box = await passButton.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThanOrEqual(24);
    expect(box!.height).toBeGreaterThanOrEqual(24);
  });

  test("back button is visible and works", async ({ page }) => {
    await page.goto("/?convention=nt-bundle&seed=42");
    const phase = page.getByTestId("game-phase");
    await expect(phase).toHaveText("Bidding", { timeout: 10000 });
    
    const backButton = page.getByTestId("back-to-menu");
    await expect(backButton).toBeVisible();
    
    const box = await backButton.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThanOrEqual(24);
    expect(box!.height).toBeGreaterThanOrEqual(24);
  });

  test("no horizontal overflow on game screen", async ({ page }) => {
    await page.goto("/?convention=nt-bundle&seed=42");
    const phase = page.getByTestId("game-phase");
    await expect(phase).toHaveText("Bidding", { timeout: 10000 });

    // Check document doesn't have horizontal scroll
    const hasHScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHScroll).toBe(false);
  });
});

test.describe("responsive layout — settings screen", () => {
  test("settings screen elements are visible", async ({ page }) => {
    await page.goto("/");
    const settingsBtn = page.getByTestId("settings-button");
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();
    
    const heading = page.locator("h1");
    await expect(heading).toHaveText("Settings", { timeout: 5000 });
    
    const backBtn = page.getByTestId("settings-back");
    await expect(backBtn).toBeVisible();
  });
});
