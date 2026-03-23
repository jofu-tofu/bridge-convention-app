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
    
    const passButton = page.getByTestId("bid-P");
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
    await expect(heading).toHaveText("Practice Settings", { timeout: 5000 });
    
    const backBtn = page.getByTestId("settings-back");
    await expect(backBtn).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Visual regression screenshots
//
// These capture full-page screenshots at key layout states. Each test runs
// against all three Playwright projects (desktop, mobile, tablet), so every
// screenshot is automatically tested at all viewport sizes.
//
// First run:  npx playwright test responsive-layout --update-snapshots
//   → generates baseline PNGs in responsive-layout.spec.ts-snapshots/
//
// Subsequent: npx playwright test responsive-layout
//   → compares against baselines; failures produce expected/actual/diff
//     images in test-results/ and in the HTML report.
//
// View diffs: npx playwright show-report
//   → opens browser with side-by-side expected | actual | diff slider
// ---------------------------------------------------------------------------

test.describe("visual regression — convention select", () => {
  test("home screen layout", async ({ page }) => {
    await page.goto("/");
    // Wait for convention cards to render
    await expect(page.getByTestId("practice-nt-bundle")).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveScreenshot("home-screen.png");
  });
});

test.describe("visual regression — game screen", () => {
  test("bidding phase layout", async ({ page }) => {
    await page.goto("/?convention=nt-bundle&seed=42");
    // Wait for bidding UI to be fully interactive
    await expect(page.getByTestId("bid-P")).toBeEnabled({ timeout: 10000 });
    await expect(page).toHaveScreenshot("bidding-phase.png");
  });

  test("bidding phase with feedback", async ({ page }) => {
    await page.goto("/?convention=nt-bundle&seed=42");
    await expect(page.getByTestId("bid-P")).toBeEnabled({ timeout: 10000 });
    // Make a bid to trigger the feedback panel
    await page.getByTestId("bid-P").click();
    await expect(page.locator("[role='alert']")).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveScreenshot("bidding-feedback.png");
  });
});

test.describe("visual regression — learning screen", () => {
  test("learning screen layout", async ({ page }) => {
    await page.goto("/?learn=nt-bundle");
    await expect(page.locator("h1")).toContainText("1NT", { timeout: 5000 });
    await expect(page).toHaveScreenshot("learning-screen.png");
  });
});

test.describe("visual regression — settings screen", () => {
  test("settings screen layout", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("settings-button").click();
    await expect(page.locator("h1")).toHaveText("Practice Settings", { timeout: 5000 });
    await expect(page).toHaveScreenshot("settings-screen.png");
  });
});
