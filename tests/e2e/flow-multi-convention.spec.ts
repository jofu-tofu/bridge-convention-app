import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { closeDebugDrawer, readDebugDrawerText } from "./helpers";

/**
 * Multi-convention flow tests across different seeds.
 *
 * Each test:
 *  1. Navigates with a deterministic seed
 *  2. Clicks the practice button for the convention
 *  3. Waits for bidding phase, takes a screenshot
 *  4. Logs: full page text, auction sequence, South cards, HCP, expected bid
 *  5. Runs convention-specific assertions
 */

// ---------------------------------------------------------------------------
// Shared helper to extract game-state data from the page
// ---------------------------------------------------------------------------
interface GameData {
  fullText: string;
  auctionText: string;
  auctionHTML: string;
  southCards: string[];
  southHCP: string;
  correctBidBlock: string | null;
  enabledBids: string[];
  disabledBids: string[];
  alertMarkers: string[];
  dealerIndicator: string;
  vulnerabilityIndicator: string;
}

async function extractGameData(
  page: Page,
): Promise<GameData> {
  // Auction
  const auctionText =
    (await page.locator('[data-testid="table-center"]').textContent()) ?? "";
  const auctionHTML =
    (await page.locator('[data-testid="table-center"]').innerHTML()) ?? "";

  // South cards
  const southCards = await page.$$eval('[data-testid="card"]', (els) =>
    els.map((e) => (e.textContent ?? "").trim()),
  );

  // HCP
  const southHCP =
    (await page.locator('[data-testid="south-hcp"]').textContent()) ?? "";

  // Bid buttons: enabled vs disabled (read before probe bid)
  const enabledBids = await page.$$eval(
    '[data-testid^="bid-"]:not([disabled])',
    (els) =>
      els
        .map((e) => e.getAttribute("data-testid") ?? "")
        .filter((t) => t.startsWith("bid-")),
  );
  const disabledBids = await page.$$eval(
    '[data-testid^="bid-"][disabled]',
    (els) =>
      els
        .map((e) => e.getAttribute("data-testid") ?? "")
        .filter((t) => t.startsWith("bid-")),
  );

  // Alert markers (! in auction)
  const alertMarkers = await page.$$eval(
    '[data-testid="table-center"] sup',
    (els) => els.map((e) => (e.textContent ?? "").trim()),
  );

  // Dealer indicator — look for "Dealer:" or check seat labels
  const dealerIndicator = await page.evaluate(() => {
    const body = document.body.innerText;
    const m = body.match(/Dealer[:\s]+([NESW]\w*)/i);
    if (m) return m[1];
    // Fallback: collect seat labels
    const seats = document.querySelectorAll('[data-testid^="seat-label-"]');
    const labels: string[] = [];
    seats.forEach((s) => labels.push((s.textContent ?? "").trim()));
    return labels.join(", ") || "not found";
  });

  // Vulnerability indicator
  const vulnerabilityIndicator = await page.evaluate(() => {
    const body = document.body.innerText;
    const m = body.match(/Vul(?:nerable)?[:\s]+([^\n]+)/i);
    return m ? m[1].trim() : "not displayed";
  });

  // --- Probe bid to populate debug data (null pre-bid on mobile/tablet) ---
  await closeDebugDrawer(page);
  await expect(page.getByTestId("bid-P")).toBeEnabled({ timeout: 5_000 });

  await page.getByTestId("bid-7NT").click();
  const alert = page.locator("[role='alert']");
  const phaseChanged = page.getByTestId("game-phase").filter({ hasNotText: "Bidding" });
  await expect(alert.or(phaseChanged)).toBeVisible({ timeout: 5_000 });
  await page.waitForTimeout(500);

  // Open debug drawer via JS (bypasses overlay issues on mobile)
  await page.evaluate(() => {
    const toggleBtn = document.querySelector('[data-testid="debug-toggle"]');
    if (toggleBtn) toggleBtn.click();
  });
  await page.waitForTimeout(500);

  // Read full text via page.evaluate with inert check
  const fullText = await readDebugDrawerText(page);

  // Extract correctBidBlock from the populated text
  const correctBidBlock = (() => {
    // Try "expected:" from at-a-glance
    const m = fullText.match(/expected:\s*(.+?)(?=\n|$)/);
    if (m) return m[0].trim();
    // Try "Suggested Bid" section
    const sg = fullText.match(/Suggested Bid[\s\S]*?(?=\n\n|Pipeline|Hand Facts|$)/);
    return sg ? sg[0].trim() : null;
  })();

  // Close drawer and retry to restore bid panel
  await closeDebugDrawer(page);
  const retryBtn = page.getByRole("button", { name: /try again/i });
  if (await retryBtn.isVisible().catch(() => false)) {
    await retryBtn.click();
    await expect(page.getByTestId("bid-P")).toBeEnabled({ timeout: 5_000 });
  }

  return {
    fullText,
    auctionText,
    auctionHTML,
    southCards,
    southHCP,
    correctBidBlock,
    enabledBids,
    disabledBids,
    alertMarkers,
    dealerIndicator,
    vulnerabilityIndicator,
  };
}

function logGameData(label: string, data: GameData) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  ${label}`);
  console.log(`${"=".repeat(70)}`);
  console.log(`Auction text   : ${data.auctionText}`);
  console.log(`Dealer         : ${data.dealerIndicator}`);
  console.log(`Vulnerability  : ${data.vulnerabilityIndicator}`);
  console.log(
    `South cards (${data.southCards.length}): ${data.southCards.join(", ")}`,
  );
  console.log(`South HCP      : ${data.southHCP}`);
  console.log(`Correct bid    : ${data.correctBidBlock ?? "NOT FOUND"}`);
  console.log(`Enabled bids   : ${data.enabledBids.join(", ")}`);
  console.log(`Disabled bids  : ${data.disabledBids.join(", ")}`);
  console.log(
    `Alert markers  : ${data.alertMarkers.length > 0 ? data.alertMarkers.join(", ") : "none"}`,
  );
  console.log(`Auction HTML   : ${data.auctionHTML.substring(0, 500)}`);
  console.log(`${"=".repeat(70)}\n`);
}

// ---------------------------------------------------------------------------
// TEST 1 — Jacoby Transfers, seed=10
// ---------------------------------------------------------------------------
test.describe("Multi-convention flow tests", () => {
  test("TEST 1: Jacoby Transfers with seed=10", async ({ page }) => {
    await page.goto("/?seed=10");
    await page.getByTestId("practice-nt-transfers").click();

    // Wait for bidding phase
    const phaseLabel = page.getByTestId("game-phase");
    await expect(phaseLabel).toHaveText("Bidding", { timeout: 10000 });

    // Allow rendering to settle
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: "/tmp/flow-test1-jacoby-transfers-seed10.png",
      fullPage: true,
    });

    const data = await extractGameData(page);
    logGameData("TEST 1: Jacoby Transfers — seed=10", data);

    // ----- Convention-specific checks -----

    // Jacoby Transfers: Partner (North) should have opened 1NT
    // The auction should contain 1NT from the opener
    expect(data.auctionText).toContain("1NT");

    // South's hand should have 13 cards
    expect(data.southCards.length).toBe(13);

    // HCP should be displayed
    expect(data.southHCP).toMatch(/\d+\s*HCP/);

    // expected bid should be present (dev mode is on during tests)
    expect(data.correctBidBlock).not.toBeNull();

    // For Jacoby Transfers the correct bid should typically be 2D, 2H, or
    // another transfer bid.  At minimum check that some recommendation exists.
    console.log(
      `Transfer check: correct bid block = "${data.correctBidBlock}"`,
    );

    // At least some bid buttons should be enabled
    expect(data.enabledBids.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // TEST 2 — Bergen Raises, seed=20
  // ---------------------------------------------------------------------------
  test("TEST 2: Bergen Raises with seed=20", async ({ page }) => {
    await page.goto("/?seed=20");
    await page.getByTestId("practice-bergen-bundle").click();

    const phaseLabel = page.getByTestId("game-phase");
    await expect(phaseLabel).toHaveText("Bidding", { timeout: 10000 });

    await page.waitForTimeout(1000);
    await page.screenshot({
      path: "/tmp/flow-test2-bergen-raises-seed20.png",
      fullPage: true,
    });

    const data = await extractGameData(page);
    logGameData("TEST 2: Bergen Raises — seed=20", data);

    // ----- Convention-specific checks -----

    // Bergen Raises: Partner opens 1♥ or 1♠
    const has1H =
      /1\s*[♥♥]/.test(data.auctionText) ||
      data.auctionText.includes("1♥");
    const has1S =
      /1\s*[♠♠]/.test(data.auctionText) ||
      data.auctionText.includes("1♠");
    expect(has1H || has1S).toBeTruthy();

    console.log(`Bergen opener check — 1♥: ${has1H}, 1♠: ${has1S}`);

    // 13 cards
    expect(data.southCards.length).toBe(13);
    expect(data.southHCP).toMatch(/\d+\s*HCP/);
    expect(data.correctBidBlock).not.toBeNull();
    expect(data.enabledBids.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // TEST 3 — Weak Two Bids, seed=30
  // ---------------------------------------------------------------------------
  test("TEST 3: Weak Two Bids with seed=30", async ({ page }) => {
    await page.goto("/?seed=30");
    await page.getByTestId("practice-weak-twos-bundle").click();

    const phaseLabel = page.getByTestId("game-phase");
    await expect(phaseLabel).toHaveText("Bidding", { timeout: 10000 });

    await page.waitForTimeout(1000);
    await page.screenshot({
      path: "/tmp/flow-test3-weak-two-seed30.png",
      fullPage: true,
    });

    const data = await extractGameData(page);
    logGameData("TEST 3: Weak Two Bids — seed=30", data);

    // ----- Convention-specific checks -----

    // Weak Two: South may be opening or responding to partner's weak two.
    // The starting position depends on the scenario dealt.
    expect(data.southCards.length).toBe(13);
    expect(data.southHCP).toMatch(/\d+\s*HCP/);
    expect(data.correctBidBlock).not.toBeNull();
    expect(data.enabledBids.length).toBeGreaterThan(0);

    console.log(
      `Weak Two starting position — auction so far: "${data.auctionText}"`,
    );
  });

  // ---------------------------------------------------------------------------
  // TEST 4 — DONT, seed=40
  // ---------------------------------------------------------------------------
  test("TEST 4: DONT with seed=40", async ({ page }) => {
    await page.goto("/?seed=40");
    await page.getByTestId("practice-dont-bundle").click();

    const phaseLabel = page.getByTestId("game-phase");
    await expect(phaseLabel).toHaveText("Bidding", { timeout: 10000 });

    await page.waitForTimeout(1000);
    await page.screenshot({
      path: "/tmp/flow-test4-dont-seed40.png",
      fullPage: true,
    });

    const data = await extractGameData(page);
    logGameData("TEST 4: DONT — seed=40", data);

    // ----- Convention-specific checks -----

    // DONT: An opponent opens 1NT and South uses DONT to interfere.
    expect(data.auctionText).toContain("1NT");

    expect(data.southCards.length).toBe(13);
    expect(data.southHCP).toMatch(/\d+\s*HCP/);
    expect(data.correctBidBlock).not.toBeNull();
    expect(data.enabledBids.length).toBeGreaterThan(0);

    console.log(
      `DONT check — opponent 1NT present: ${data.auctionText.includes("1NT")}`,
    );
  });

  // ---------------------------------------------------------------------------
  // TEST 5 — 1NT Bundle, seed=50
  // ---------------------------------------------------------------------------
  test("TEST 5: 1NT Bundle with seed=50", async ({ page }) => {
    await page.goto("/?seed=50");
    await page.getByTestId("practice-nt-bundle").click();

    const phaseLabel = page.getByTestId("game-phase");
    await expect(phaseLabel).toHaveText("Bidding", { timeout: 10000 });

    await page.waitForTimeout(1000);
    await page.screenshot({
      path: "/tmp/flow-test5-nt-bundle-seed50.png",
      fullPage: true,
    });

    const data = await extractGameData(page);
    logGameData("TEST 5: 1NT Bundle — seed=50", data);

    // ----- Convention-specific checks -----

    // 1NT Bundle: Partner opens 1NT, South responds.
    expect(data.auctionText).toContain("1NT");

    expect(data.southCards.length).toBe(13);
    expect(data.southHCP).toMatch(/\d+\s*HCP/);
    expect(data.correctBidBlock).not.toBeNull();
    expect(data.enabledBids.length).toBeGreaterThan(0);
  });
});
