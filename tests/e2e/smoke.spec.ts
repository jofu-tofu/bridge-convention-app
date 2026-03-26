import { test, expect } from "@playwright/test";

/**
 * Smoke tests covering the primary user flows:
 * home → convention select → game → bid → feedback → navigation
 *
 * Bid button testids use callKey format: bid-P (pass), bid-X (double),
 * bid-XX (redouble), bid-2C, bid-3NT, etc.
 */

const ALL_CONVENTIONS = [
  "nt-bundle",
  "nt-stayman",
  "nt-transfers",
  "bergen-bundle",
  "weak-twos-bundle",
  "dont-bundle",
] as const;

test.describe("home screen", () => {
  test("renders all six convention cards", async ({ page }) => {
    await page.goto("/");
    for (const id of ALL_CONVENTIONS) {
      await expect(page.getByTestId(`practice-${id}`)).toBeAttached();
    }
  });

  test("category filter narrows convention list", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Defensive" }).click();
    await expect(page.getByTestId("practice-dont-bundle")).toBeAttached();
    await expect(
      page.getByTestId("practice-bergen-bundle"),
    ).not.toBeAttached();

    await page.getByRole("button", { name: "All" }).click();
    await expect(page.getByTestId("practice-bergen-bundle")).toBeAttached();
  });

  test("search filters conventions by name", async ({ page }) => {
    await page.goto("/");
    const search = page.getByLabel("Search conventions");
    await search.fill("stayman");

    await expect(page.getByTestId("practice-nt-stayman")).toBeVisible();
    await expect(
      page.getByTestId("practice-bergen-bundle"),
    ).not.toBeAttached();
  });
});

test.describe("convention navigation", () => {
  test("clicking Practice loads game screen with bidding phase", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("practice-bergen-bundle").click();

    const phase = page.getByTestId("game-phase");
    await expect(phase).toHaveText("Bidding", { timeout: 10000 });

    await expect(page.getByTestId("bid-P")).toBeEnabled({ timeout: 10000 });
  });

  test("clicking Learn loads learning screen", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("learn-nt-bundle").click();

    await expect(page.locator("h1")).toHaveText("1NT Responses", {
      timeout: 5000,
    });
    await expect(page.getByRole("tab", { name: "Study" })).toBeVisible();
  });

  test("URL param ?convention loads game directly", async ({ page }) => {
    await page.goto("/?convention=bergen-bundle&seed=1");

    const phase = page.getByTestId("game-phase");
    await expect(phase).toHaveText("Bidding", { timeout: 10000 });
    await expect(page.getByTestId("bid-P")).toBeEnabled({ timeout: 5000 });
  });

  test("URL param ?learn loads learning screen directly", async ({ page }) => {
    await page.goto("/?learn=nt-stayman");

    await expect(page.locator("h1")).toHaveText("Stayman", { timeout: 5000 });
  });
});

test.describe("bidding flow", () => {
  test("bid shows feedback panel", async ({ page }) => {
    await page.goto("/?convention=bergen-bundle&seed=1");

    const phase = page.getByTestId("game-phase");
    await expect(phase).toHaveText("Bidding", { timeout: 10000 });
    await expect(page.getByTestId("bid-P")).toBeEnabled({ timeout: 5000 });

    await page.getByTestId("bid-P").click();

    const feedback = page.locator("[role='alert']");
    await expect(feedback).toBeVisible({ timeout: 5000 });
  });

  test("wrong bid shows feedback with try again or continue", async ({
    page,
  }) => {
    // Bergen seed=1: pass is likely wrong (Bergen expects a raise)
    await page.goto("/?convention=bergen-bundle&seed=1");

    const phase = page.getByTestId("game-phase");
    await expect(phase).toHaveText("Bidding", { timeout: 10000 });
    await expect(page.getByTestId("bid-P")).toBeEnabled({ timeout: 5000 });

    await page.getByTestId("bid-P").click();

    const feedback = page.locator("[role='alert']");
    await expect(feedback).toBeVisible({ timeout: 5000 });

    const tryAgain = page.getByRole("button", { name: /try again/i });
    const continueBtn = page.getByRole("button", { name: /continue/i });
    await expect(tryAgain.or(continueBtn)).toBeVisible({ timeout: 3000 });
  });

  test("try again restores bid buttons", async ({ page }) => {
    await page.goto("/?convention=bergen-bundle&seed=1");

    await expect(page.getByTestId("game-phase")).toHaveText("Bidding", {
      timeout: 10000,
    });
    await expect(page.getByTestId("bid-P")).toBeEnabled({ timeout: 5000 });

    await page.getByTestId("bid-P").click();

    const tryAgain = page.getByRole("button", { name: /try again/i });
    if (await tryAgain.isVisible({ timeout: 3000 })) {
      await tryAgain.click();
      await expect(page.getByTestId("bid-P")).toBeEnabled({ timeout: 5000 });
    }
  });
});

test.describe("navigation", () => {
  test("back button returns to home from game", async ({ page }) => {
    await page.goto("/?convention=bergen-bundle&seed=1");

    await expect(page.getByTestId("game-phase")).toHaveText("Bidding", {
      timeout: 10000,
    });

    await page.getByTestId("back-to-menu").click();
    await expect(page.locator("h1")).toHaveText("Bridge Practice", {
      timeout: 10000,
    });
  });

  test("settings screen accessible from nav rail", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).first().click();

    await expect(page.locator("h1")).toContainText("Settings", {
      timeout: 5000,
    });

    await page.getByRole("button", { name: "Home" }).first().click();
    await expect(page.locator("h1")).toHaveText("Bridge Practice", {
      timeout: 5000,
    });
  });
});

test.describe("autoplay and review", () => {
  // Autoplay is broken due to Svelte 5.43.0 reactivity regression (pinned version).
  // The $effect that drives autoplay does not fire reliably.
  test.skip("autoplay reaches review phase", async ({ page }) => {
    await page.goto("/?convention=nt-bundle&seed=42&autoplay=true");

    const phase = page.getByTestId("game-phase");
    await expect(phase).toHaveText("Review", { timeout: 30000 });

    await expect(
      page.getByRole("heading", { name: "Bidding Review" }),
    ).toBeVisible();
    await expect(page.getByTestId("next-deal")).toBeVisible();
  });

  test.skip("next deal advances to new hand", async ({ page }) => {
    await page.goto("/?convention=nt-bundle&seed=1&autoplay=true");

    const phase = page.getByTestId("game-phase");
    await expect(phase).toHaveText("Review", { timeout: 30000 });

    await page.getByTestId("next-deal").click();
    await expect(phase).toHaveText("Bidding", { timeout: 10000 });
  });
});

test.describe("all conventions load via URL", () => {
  for (const id of ALL_CONVENTIONS) {
    test(`?convention=${id} loads and renders game screen`, async ({
      page,
    }) => {
      await page.goto(`/?convention=${id}&seed=10`);

      const phase = page.getByTestId("game-phase");
      await expect(phase).toHaveText("Bidding", { timeout: 15000 });

      // Bid panel should be present
      await expect(page.getByTestId("level-bids")).toBeVisible({
        timeout: 5000,
      });
    });
  }
});

test.describe("deterministic seeding", () => {
  test("same seed produces same hand", async ({ page }) => {
    await page.goto("/?convention=bergen-bundle&seed=99");
    await expect(page.getByTestId("game-phase")).toHaveText("Bidding", {
      timeout: 10000,
    });

    const southHand = page.getByTestId("hand-fan").first();
    await southHand.waitFor({ state: "attached", timeout: 5000 });
    const hand1 = await southHand.textContent();

    await page.goto("/?convention=bergen-bundle&seed=99");
    await expect(page.getByTestId("game-phase")).toHaveText("Bidding", {
      timeout: 10000,
    });
    await southHand.waitFor({ state: "attached", timeout: 5000 });

    const hand2 = await southHand.textContent();
    expect(hand1).toBe(hand2);
  });
});

test.describe("nt-bundle button-disable regression", () => {
  test("nt-bundle seed=42 should enable bid buttons", async ({ page }) => {
    await page.goto("/?convention=nt-bundle&seed=42");

    await expect(page.getByTestId("game-phase")).toHaveText("Bidding", {
      timeout: 10000,
    });

    await expect(page.getByTestId("bid-P")).toBeEnabled({ timeout: 10000 });
  });
});
