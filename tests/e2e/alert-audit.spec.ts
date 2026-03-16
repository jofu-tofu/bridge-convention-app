import { test, expect } from "@playwright/test";

test("Visual evidence - Stayman with alert (seed 1)", async ({ page }) => {
  await page.goto("http://localhost:1420/?seed=1");
  await page.waitForTimeout(1000);
  await page.locator("button[aria-label='Practice Stayman']").click();
  await page.waitForTimeout(2000);
  
  // Bid 2C
  await page.locator("[data-testid='bid-2C']").click();
  await page.waitForTimeout(2000);
  
  // Take screenshot of full page and auction close-up
  await page.screenshot({ path: "/tmp/evidence-stayman-2c-alert.png", fullPage: true });
  await page.locator("table").first().screenshot({ path: "/tmp/evidence-stayman-auction-closeup.png" });
  
  // Detailed HTML analysis
  const auctionHTML = await page.locator("table").first().evaluate((e: Element) => e.outerHTML);
  console.log("STAYMAN AUCTION HTML:");
  console.log(auctionHTML);
});

test("Visual evidence - Bergen Pass alert (seed 99)", async ({ page }) => {
  await page.goto("http://localhost:1420/?seed=99");
  await page.waitForTimeout(1000);
  await page.locator("button[aria-label='Practice Bergen Raises (Bundle)']").click();
  await page.waitForTimeout(2000);
  
  // Should be 3♥ preemptive raise
  await page.locator("[data-testid='bid-3H']").click();
  await page.waitForTimeout(2000);
  
  await page.screenshot({ path: "/tmp/evidence-bergen-pass-alert.png", fullPage: true });
  await page.locator("table").first().screenshot({ path: "/tmp/evidence-bergen-auction-closeup.png" });
  
  const auctionHTML = await page.locator("table").first().evaluate((e: Element) => e.outerHTML);
  console.log("BERGEN PASS ALERT HTML:");
  console.log(auctionHTML);
  
  // Check specifically the Pass cell
  const passCells = await page.locator("td:has-text('Pass')").all();
  for (const cell of passCells) {
    const html = await cell.evaluate((e: Element) => e.innerHTML);
    if (html.includes("Alert")) {
      console.log(`\nALERTED PASS: ${html}`);
    }
  }
});

test("Visual evidence - Ogust 2NT alert (seed 15)", async ({ page }) => {
  await page.goto("http://localhost:1420/?seed=15");
  await page.waitForTimeout(1000);
  await page.locator("button[aria-label='Practice Weak Two Bids (Bundle)']").click();
  await page.waitForTimeout(2000);
  
  await page.locator("[data-testid='bid-2NT']").click();
  await page.waitForTimeout(2000);
  
  await page.screenshot({ path: "/tmp/evidence-ogust-2nt-alert.png", fullPage: true });
  await page.locator("table").first().screenshot({ path: "/tmp/evidence-ogust-auction-closeup.png" });
  
  const auctionHTML = await page.locator("table").first().evaluate((e: Element) => e.outerHTML);
  console.log("OGUST 2NT ALERT HTML:");
  console.log(auctionHTML);
});

test("Verify: no alerts on natural 1-level openings", async ({ page }) => {
  // Bergen always starts with 1♥ or 1♠ - check those never have alerts
  await page.goto("http://localhost:1420/?seed=1");
  await page.waitForTimeout(500);
  await page.locator("button[aria-label='Practice Bergen Raises (Bundle)']").click();
  await page.waitForTimeout(2000);
  
  const auctionHTML = await page.locator("table").first().evaluate((e: Element) => e.outerHTML);
  console.log("BERGEN OPENING BID CHECK:");
  console.log(auctionHTML);
  
  // Check that the 1♥ or 1♠ opening does NOT have an alert
  const hasAlertOn1Level = auctionHTML.includes('1♥<span') || auctionHTML.includes('1♠<span');
  console.log(`Alert on 1-level opening: ${hasAlertOn1Level}`);
  
  // Also check East's Pass doesn't have alert
  const firstPassCell = await page.locator("td:has-text('Pass')").first();
  const passHTML = await firstPassCell.evaluate((e: Element) => e.innerHTML);
  console.log(`Pass HTML: ${passHTML}`);
  console.log(`Pass has alert: ${passHTML.includes("Alert")}`);
});

test("DONT response chain - check all alerts", async ({ page }) => {
  // DONT seed 15 had X (single suit) → 2♣ (relay) → S reveals suit
  await page.goto("http://localhost:1420/?seed=15");
  await page.waitForTimeout(500);
  await page.locator("button[aria-label='Practice DONT (Bundle)']").click();
  await page.waitForTimeout(2000);
  
  // Bid X
  await page.locator("[data-testid='bid-double']").click();
  await page.waitForTimeout(2000);
  
  // Now we should be asked for our next bid
  let bodyText = await page.locator("body").innerText();
  console.log("=== DONT AFTER X ===");
  
  // Check if we need to bid again (reveal suit)
  const match = bodyText.match(/DEV: Correct Bid\n(\S+)/);
  console.log("Next correct bid:", match ? match[1] : "none");
  
  if (match && match[1] !== "No") {
    const bidMap: Record<string, string> = {
      "2♣": "bid-2C", "2♦": "bid-2D", "2♥": "bid-2H", "2♠": "bid-2S",
      "Pass": "bid-pass"
    };
    const testid = bidMap[match[1]];
    if (testid) {
      await page.locator(`[data-testid="${testid}"]`).click();
      await page.waitForTimeout(2000);
    }
  }
  
  const auctionHTML = await page.locator("table").first().evaluate((e: Element) => e.outerHTML);
  console.log("\n=== FULL DONT AUCTION ===");
  console.log(auctionHTML);
  
  await page.screenshot({ path: "/tmp/evidence-dont-full-auction.png", fullPage: true });
});
