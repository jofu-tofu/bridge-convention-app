import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const SCREENSHOT_DIR = "screenshots-edge-cases";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Log the current auction table text */
async function logAuction(page: Page, label: string) {
  console.log(`\n--- AUCTION (${label}) ---`);
  const auctionTable = page.locator("table").first();
  if (await auctionTable.isVisible().catch(() => false)) {
    const text = await auctionTable.innerText();
    console.log(text);
    const html = await auctionTable.evaluate((e: Element) => e.outerHTML);
    console.log(`HTML: ${html.substring(0, 2000)}`);
  } else {
    console.log("(no auction table visible)");
  }
}

/** Log all bid button states */
async function logAllBidButtons(page: Page, label: string) {
  console.log(`\n--- BID BUTTON STATES (${label}) ---`);

  const allBids = page.locator("[data-testid^='bid-']");
  const count = await allBids.count();
  console.log(`Total bid buttons: ${count}`);

  for (let i = 0; i < count; i++) {
    const btn = allBids.nth(i);
    const testId = await btn.getAttribute("data-testid");
    const text = await btn.textContent();
    const disabled = await btn.isDisabled();
    console.log(
      `  ${testId}: text="${text?.trim()}" disabled=${disabled}`,
    );
  }
}

/** Log the special bid buttons specifically */
async function logSpecialBids(page: Page) {
  console.log("\n--- SPECIAL BID STATES ---");
  for (const id of ["bid-pass", "bid-double", "bid-redouble"]) {
    const btn = page.getByTestId(id);
    if (await btn.isVisible().catch(() => false)) {
      const disabled = await btn.isDisabled();
      const text = await btn.textContent();
      console.log(`  ${id}: text="${text?.trim()}" disabled=${disabled}`);
    } else {
      console.log(`  ${id}: NOT VISIBLE`);
    }
  }
}

/** Log visible page text (truncated) */
async function logPageText(page: Page, label: string, maxLen = 3000) {
  const text = await page.locator("body").innerText();
  console.log(`\n--- PAGE TEXT (${label}) ---`);
  console.log(text.substring(0, maxLen));
  if (text.length > maxLen) console.log(`... (truncated, total ${text.length} chars)`);
}

// ── TEST 1: Double / Redouble button behavior ───────────────────────────────

test.describe("TEST 1: Double/Redouble button behavior", () => {
  test("DONT seed=40 — check Double/Redouble states after opponent opens", async ({ page }) => {
    // Step 1: Navigate to home with seed=40
    await page.goto("/?seed=40");
    await page.waitForLoadState("networkidle");
    console.log("\n=== TEST 1: Navigate to home page, seed=40 ===");
    console.log(`URL: ${page.url()}`);

    // Step 2: Click DONT practice button
    const dontBtn = page.getByTestId("practice-dont-bundle");
    await expect(dontBtn).toBeVisible({ timeout: 5000 });
    await dontBtn.click();
    console.log("Clicked practice-dont-bundle");

    // Step 3: Wait for game to load
    await page.waitForTimeout(1000);
    const phaseLabel = page.getByTestId("game-phase");
    await expect(phaseLabel).toBeVisible({ timeout: 5000 });
    const phase = await phaseLabel.textContent();
    console.log(`Game phase: "${phase}"`);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/test1-step1-game-loaded.png`,
      fullPage: true,
    });

    // Step 4: Log the full auction (opponents may have already bid)
    await logAuction(page, "initial state");

    // Step 5: Log all button states
    await logAllBidButtons(page, "initial state");
    await logSpecialBids(page);

    // Step 6: Check Double/Redouble specifically
    const doubleBtn = page.getByTestId("bid-double");
    const redoubleBtn = page.getByTestId("bid-redouble");
    const passBtn = page.getByTestId("bid-pass");

    const doubleDisabled = await doubleBtn.isDisabled();
    const redoubleDisabled = await redoubleBtn.isDisabled();
    const passDisabled = await passBtn.isDisabled();

    console.log("\n=== DOUBLE/REDOUBLE ANALYSIS ===");
    console.log(`Double button disabled: ${doubleDisabled}`);
    console.log(`Redouble button disabled: ${redoubleDisabled}`);
    console.log(`Pass button disabled: ${passDisabled}`);

    // In DONT, opponents open 1NT. South should be able to double (showing a single suit).
    // Redouble should be disabled (no one has doubled yet).
    // Pass should be enabled (always legal).
    expect(passDisabled).toBe(false); // Pass always legal
    console.log(
      `Redouble should be disabled (no double to redouble): ${redoubleDisabled}`,
    );
    expect(redoubleDisabled).toBe(true); // Can't redouble if no double happened

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/test1-step2-button-states.png`,
      fullPage: true,
    });

    // Step 7: If Double is enabled, click it and observe
    if (!doubleDisabled) {
      console.log("\n=== CLICKING DOUBLE ===");
      await doubleBtn.click();
      await page.waitForTimeout(1500);

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/test1-step3-after-double.png`,
        fullPage: true,
      });

      const phaseAfter = await phaseLabel.textContent();
      console.log(`Phase after Double: "${phaseAfter}"`);

      await logAuction(page, "after Double clicked");

      // Check for feedback panel (did we bid correctly or incorrectly?)
      const feedbackPanel = page.locator("[role='alert']");
      if (await feedbackPanel.isVisible().catch(() => false)) {
        const feedbackText = await feedbackPanel.innerText();
        console.log(`Feedback panel: "${feedbackText}"`);
      } else {
        console.log("No feedback panel visible — bid may have been accepted");
      }

      await logAllBidButtons(page, "after Double");
      await logSpecialBids(page);
    } else {
      console.log("Double is DISABLED — opponent may not have bid, or it's not South's turn");

      // Log seat labels to understand who has bid
      for (const seat of ["north", "south", "east", "west"]) {
        const seatLabel = page.getByTestId(`seat-label-${seat}`);
        if (await seatLabel.isVisible().catch(() => false)) {
          const text = await seatLabel.textContent();
          console.log(`Seat ${seat}: "${text}"`);
        }
      }
    }

    await logPageText(page, "final state");
  });
});

// ── TEST 2: Pass out a hand ─────────────────────────────────────────────────

test.describe("TEST 2: Try to pass out a hand", () => {
  test("Stayman seed=42 — bid Pass and observe result", async ({ page }) => {
    // Step 1: Navigate and start Stayman drill
    await page.goto("/?seed=42");
    await page.waitForLoadState("networkidle");
    console.log("\n=== TEST 2: Pass out a hand, seed=42 ===");

    const staymanBtn = page.getByTestId("practice-nt-stayman");
    await expect(staymanBtn).toBeVisible({ timeout: 5000 });
    await staymanBtn.click();
    console.log("Clicked practice-nt-stayman");

    // Step 2: Wait for game to load
    await page.waitForTimeout(1000);
    const phaseLabel = page.getByTestId("game-phase");
    await expect(phaseLabel).toBeVisible({ timeout: 5000 });
    const phaseBefore = await phaseLabel.textContent();
    console.log(`Phase before Pass: "${phaseBefore}"`);

    await logAuction(page, "before Pass");
    await logSpecialBids(page);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/test2-step1-before-pass.png`,
      fullPage: true,
    });

    // Step 3: Click Pass
    const passBtn = page.getByTestId("bid-pass");
    await expect(passBtn).toBeEnabled({ timeout: 5000 });
    await passBtn.click();
    console.log("Clicked Pass");

    // Step 4: Wait and observe
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/test2-step2-after-pass.png`,
      fullPage: true,
    });

    const phaseAfter = await phaseLabel.textContent();
    console.log(`Phase after Pass: "${phaseAfter}"`);

    // Check for feedback panel
    const feedbackPanel = page.locator("[role='alert']");
    if (await feedbackPanel.isVisible().catch(() => false)) {
      const feedbackText = await feedbackPanel.innerText();
      console.log(`\nFeedback panel visible: YES`);
      console.log(`Feedback text: "${feedbackText}"`);

      // Look for Continue or Try Again buttons
      const continueBtn = page.getByRole("button", { name: /continue/i });
      const retryBtn = page.getByRole("button", { name: /try again/i });
      console.log(
        `Continue button visible: ${await continueBtn.isVisible().catch(() => false)}`,
      );
      console.log(
        `Try Again button visible: ${await retryBtn.isVisible().catch(() => false)}`,
      );
    } else {
      console.log("No feedback panel — auction may have continued");
      await logAuction(page, "after Pass - no feedback");
    }

    await logPageText(page, "after Pass");
  });
});

// ── TEST 3: Navigation — back button ────────────────────────────────────────

test.describe("TEST 3: Back button navigation", () => {
  test("Stayman seed=42 — back to menu and re-enter", async ({ page }) => {
    // Step 1: Start a game
    await page.goto("/?seed=42");
    await page.waitForLoadState("networkidle");
    console.log("\n=== TEST 3: Back button navigation, seed=42 ===");

    const staymanBtn = page.getByTestId("practice-nt-stayman");
    await expect(staymanBtn).toBeVisible({ timeout: 5000 });
    await staymanBtn.click();

    const phaseLabel = page.getByTestId("game-phase");
    await expect(phaseLabel).toHaveText("Bidding", { timeout: 5000 });
    console.log("Game loaded — Bidding phase");

    // Capture initial auction state for comparison
    const auctionBefore = await page.locator("table").first().innerText().catch(() => "");
    console.log(`Initial auction text: "${auctionBefore}"`);

    // Capture initial hand for comparison
    const handFan = page.getByTestId("hand-fan");
    const handBefore = await handFan.innerText().catch(() => "");
    console.log(`Initial hand: "${handBefore}"`);

    // Step 2: Click back-to-menu
    const backBtn = page.getByTestId("back-to-menu");
    await expect(backBtn).toBeVisible({ timeout: 3000 });
    await backBtn.click();
    console.log("Clicked back-to-menu");

    await page.waitForTimeout(1000);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/test3-step1-back-at-menu.png`,
      fullPage: true,
    });

    // Step 3: Verify we're at home screen
    const heading = page.locator("h1");
    const headingText = await heading.textContent();
    console.log(`Heading after back: "${headingText}"`);
    console.log(`URL after back: ${page.url()}`);

    const isAtHome = headingText?.includes("Bridge Practice") ?? false;
    console.log(`At home screen: ${isAtHome}`);
    expect(isAtHome).toBe(true);

    // Step 4: Click Stayman again (still seed=42 from URL)
    const staymanBtn2 = page.getByTestId("practice-nt-stayman");
    await expect(staymanBtn2).toBeVisible({ timeout: 5000 });
    await staymanBtn2.click();
    console.log("Re-clicked practice-nt-stayman");

    await page.waitForTimeout(1000);
    await expect(phaseLabel).toHaveText("Bidding", { timeout: 5000 });

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/test3-step2-re-entered-game.png`,
      fullPage: true,
    });

    // Step 5: Compare auction — is it the same deal?
    const auctionAfter = await page.locator("table").first().innerText().catch(() => "");
    console.log(`Auction after re-entry: "${auctionAfter}"`);
    console.log(
      `Same auction? ${auctionBefore === auctionAfter ? "YES — same text" : "NO — different text"}`,
    );

    // Log cards for comparison
    const handAfter = await handFan.innerText().catch(() => "");
    console.log(`Hand after re-entry: "${handAfter}"`);
    console.log(
      `Same hand? ${handBefore === handAfter ? "YES — same hand" : "NO — different hand"}`,
    );

    await logPageText(page, "after re-entry");
  });
});

// ── TEST 4: Browser back/forward ────────────────────────────────────────────

test.describe("TEST 4: Browser back/forward", () => {
  test("Stayman seed=42 — browser back then forward", async ({ page }) => {
    // Step 1: Navigate to home
    await page.goto("/?seed=42");
    await page.waitForLoadState("networkidle");
    console.log("\n=== TEST 4: Browser back/forward, seed=42 ===");
    console.log(`Initial URL: ${page.url()}`);

    // Step 2: Click into Stayman game
    const staymanBtn = page.getByTestId("practice-nt-stayman");
    await expect(staymanBtn).toBeVisible({ timeout: 5000 });
    await staymanBtn.click();

    const phaseLabel = page.getByTestId("game-phase");
    await expect(phaseLabel).toBeVisible({ timeout: 5000 });
    const phase = await phaseLabel.textContent();
    console.log(`In game — phase: "${phase}"`);
    console.log(`URL in game: ${page.url()}`);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/test4-step1-in-game.png`,
      fullPage: true,
    });

    // Step 3: Browser back
    console.log("\n--- Pressing browser BACK ---");
    await page.goBack();
    await page.waitForTimeout(1500);

    console.log(`URL after back: ${page.url()}`);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/test4-step2-after-back.png`,
      fullPage: true,
    });

    // What do we see? The app uses in-memory state, no history API
    const bodyTextAfterBack = await page.locator("body").innerText();
    const stillInGame = bodyTextAfterBack.includes("Bidding") || bodyTextAfterBack.includes("Review");
    const atHome = bodyTextAfterBack.includes("Bridge Practice");
    const blankPage = bodyTextAfterBack.trim().length < 20;

    console.log(`Still in game: ${stillInGame}`);
    console.log(`At home screen: ${atHome}`);
    console.log(`Blank/empty page: ${blankPage}`);
    console.log(
      `Body text (first 500): "${bodyTextAfterBack.substring(0, 500)}"`,
    );

    // Step 4: Browser forward
    console.log("\n--- Pressing browser FORWARD ---");
    await page.goForward();
    await page.waitForTimeout(1500);

    console.log(`URL after forward: ${page.url()}`);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/test4-step3-after-forward.png`,
      fullPage: true,
    });

    const bodyTextAfterFwd = await page.locator("body").innerText();
    const inGameAfterFwd = bodyTextAfterFwd.includes("Bidding") || bodyTextAfterFwd.includes("Review");
    const atHomeAfterFwd = bodyTextAfterFwd.includes("Bridge Practice");

    console.log(`In game after forward: ${inGameAfterFwd}`);
    console.log(`At home after forward: ${atHomeAfterFwd}`);
    console.log(
      `Body text (first 500): "${bodyTextAfterFwd.substring(0, 500)}"`,
    );
  });
});

// ── TEST 5: Settings button ─────────────────────────────────────────────────

test.describe("TEST 5: Settings button", () => {
  test("home screen — click settings and explore", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    console.log("\n=== TEST 5: Settings button ===");
    console.log(`URL: ${page.url()}`);

    // Step 1: Find and click settings
    const settingsBtn = page.getByTestId("settings-button");
    await expect(settingsBtn).toBeVisible({ timeout: 5000 });
    const settingsText = await settingsBtn.textContent();
    console.log(`Settings button text: "${settingsText}"`);

    await settingsBtn.click();
    console.log("Clicked settings-button");

    await page.waitForTimeout(1000);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/test5-settings-screen.png`,
      fullPage: true,
    });

    // Step 2: Log everything visible
    console.log(`URL on settings: ${page.url()}`);
    await logPageText(page, "settings screen");

    // Step 3: Check for known settings elements
    const settingsBack = page.getByTestId("settings-back");
    console.log(
      `\nSettings back button visible: ${await settingsBack.isVisible().catch(() => false)}`,
    );

    const opponentMode = page.getByTestId("opponent-mode-select");
    console.log(
      `Opponent mode select visible: ${await opponentMode.isVisible().catch(() => false)}`,
    );
    if (await opponentMode.isVisible().catch(() => false)) {
      const currentValue = await opponentMode.inputValue().catch(() => "N/A");
      console.log(`Opponent mode current value: "${currentValue}"`);

      // List all options
      const options = await opponentMode.locator("option").allTextContents();
      console.log(`Opponent mode options: ${JSON.stringify(options)}`);
    }

    // Step 4: Check for any other settings elements
    const allButtons = page.locator("button");
    const btnCount = await allButtons.count();
    console.log(`\nTotal buttons on settings page: ${btnCount}`);
    for (let i = 0; i < btnCount; i++) {
      const btn = allButtons.nth(i);
      const text = await btn.textContent();
      const testId = await btn.getAttribute("data-testid");
      console.log(`  Button ${i}: text="${text?.trim()}" testid="${testId}"`);
    }

    // Look for headings, labels, etc.
    const headings = await page.locator("h1, h2, h3").allTextContents();
    console.log(`\nHeadings: ${JSON.stringify(headings)}`);

    const labels = await page.locator("label").allTextContents();
    console.log(`Labels: ${JSON.stringify(labels)}`);

    // Step 5: Navigate back from settings
    if (await settingsBack.isVisible().catch(() => false)) {
      await settingsBack.click();
      await page.waitForTimeout(500);

      const heading = await page.locator("h1").textContent();
      console.log(`\nAfter settings back — heading: "${heading}"`);
      console.log(`URL: ${page.url()}`);
    }
  });
});

// ── TEST 6: Learn screen ────────────────────────────────────────────────────

test.describe("TEST 6: Learn screen", () => {
  test("home screen — click learn Stayman and explore", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    console.log("\n=== TEST 6: Learn screen ===");
    console.log(`URL: ${page.url()}`);

    // Step 1: Find and click learn button for Stayman
    const learnBtn = page.getByTestId("learn-nt-stayman");
    await expect(learnBtn).toBeVisible({ timeout: 5000 });
    const learnText = await learnBtn.textContent();
    console.log(`Learn button text: "${learnText}"`);

    await learnBtn.click();
    console.log("Clicked learn-nt-stayman");

    await page.waitForTimeout(1000);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/test6-learn-screen.png`,
      fullPage: true,
    });

    // Step 2: Log everything visible
    console.log(`URL on learn screen: ${page.url()}`);
    await logPageText(page, "learn screen");

    // Step 3: Check for structural elements
    const headings = await page.locator("h1, h2, h3").allTextContents();
    console.log(`\nHeadings: ${JSON.stringify(headings)}`);

    // Check for sidebar with convention list
    const sidebarLinks = page.locator("nav a, nav button, aside a, aside button");
    const sidebarCount = await sidebarLinks.count();
    console.log(`Sidebar navigation items: ${sidebarCount}`);
    for (let i = 0; i < Math.min(sidebarCount, 20); i++) {
      const text = await sidebarLinks.nth(i).textContent();
      console.log(`  Sidebar item ${i}: "${text?.trim()}"`);
    }

    // Check for Practice button on the learn screen
    const practiceBtn = page.getByRole("button", { name: /practice/i });
    console.log(
      `\nPractice button visible: ${await practiceBtn.first().isVisible().catch(() => false)}`,
    );

    // Step 4: Check for back navigation
    const backButton = page.locator(
      "button:has-text('Back'), button:has-text('back'), [data-testid*='back'], button[aria-label*='back' i], button[aria-label*='Back']",
    );
    const backCount = await backButton.count();
    console.log(`\nBack buttons found: ${backCount}`);
    for (let i = 0; i < backCount; i++) {
      const text = await backButton.nth(i).textContent();
      const testId = await backButton.nth(i).getAttribute("data-testid");
      const ariaLabel = await backButton.nth(i).getAttribute("aria-label");
      console.log(
        `  Back ${i}: text="${text?.trim()}" testid="${testId}" aria-label="${ariaLabel}"`,
      );
    }

    // Step 5: Log all buttons on the page
    const allButtons = page.locator("button");
    const btnCount = await allButtons.count();
    console.log(`\nTotal buttons: ${btnCount}`);
    for (let i = 0; i < Math.min(btnCount, 30); i++) {
      const btn = allButtons.nth(i);
      const text = await btn.textContent();
      const testId = await btn.getAttribute("data-testid");
      console.log(`  Button ${i}: text="${text?.trim()}" testid="${testId}"`);
    }

    // Step 6: Navigate back
    if (backCount > 0) {
      await backButton.first().click();
      await page.waitForTimeout(500);

      const heading = await page.locator("h1").textContent().catch(() => "N/A");
      console.log(`\nAfter learn back — heading: "${heading}"`);
      console.log(`URL: ${page.url()}`);
    }
  });
});
