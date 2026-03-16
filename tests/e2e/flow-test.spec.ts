import { test, expect } from "@playwright/test";

test("CRITICAL: compare nt-bundle vs nt-stayman transfer response", async ({ page }) => {
  // Test 1: nt-bundle with seed=42 - bid 2♥ manually
  await page.goto("http://localhost:1420/?seed=42");
  await page.waitForLoadState("networkidle");
  await page.locator('[data-testid="practice-nt-bundle"]').click();
  await page.waitForTimeout(1000);
  
  // Bid 2♥ (transfer)
  await page.locator('[data-testid="bid-2H"]').click();
  await page.waitForTimeout(2000);
  
  const auction1 = await page.locator('[data-testid="table-center"]').textContent();
  console.log("=== NT-BUNDLE: Auction after 2♥ ===");
  console.log(auction1);
  
  // Go back
  await page.locator('[data-testid="back-to-menu"]').click();
  await page.waitForTimeout(500);
  
  // Test 2: nt-stayman with seed=42 - bid 2♥ manually
  await page.goto("http://localhost:1420/?seed=42");
  await page.waitForLoadState("networkidle");
  await page.locator('[data-testid="practice-nt-stayman"]').click();
  await page.waitForTimeout(1000);
  
  // Bid 2♥ (transfer)
  await page.locator('[data-testid="bid-2H"]').click();
  await page.waitForTimeout(2000);
  
  const auction2 = await page.locator('[data-testid="table-center"]').textContent();
  console.log("=== NT-STAYMAN: Auction after 2♥ ===");
  console.log(auction2);
  
  // Compare
  console.log("\n=== COMPARISON ===");
  console.log("nt-bundle N response:", auction1?.match(/2♥!Pass(.+?)Pass/)?.[1]?.trim());
  console.log("nt-stayman N response:", auction2?.match(/2♥!Pass(.+?)Pass/)?.[1]?.trim());
});

test("verify review phase shows correct/incorrect markers", async ({ page }) => {
  // Use autoplay with nt-bundle
  await page.goto("http://localhost:1420/?convention=nt-bundle&seed=42&autoplay=true");
  
  // Wait for Review phase
  const phaseLabel = page.locator('[data-testid="game-phase"]');
  await expect(phaseLabel).toHaveText("Review", { timeout: 30000 });
  
  const bodyText = await page.textContent("body") || "";
  
  // Extract the bidding review section
  const reviewMatch = bodyText.match(/Bidding Review([\s\S]*?)(?:Conventions in this deal|Debug Console)/);
  console.log("=== BIDDING REVIEW ===");
  console.log(reviewMatch?.[1]?.trim().substring(0, 1000));
  
  // Check auction table
  const auction = await page.locator('[data-testid="table-center"]').textContent();
  console.log("\n=== FINAL AUCTION ===");
  console.log(auction);
  
  // Extract contract
  const contractMatch = bodyText.match(/Contract\s*(.+?)(?:Bidding Review|$)/s);
  console.log("\n=== CONTRACT ===");
  console.log(contractMatch?.[1]?.trim().substring(0, 100));
  
  // Extract scoring
  const scoreMatch = bodyText.match(/Score\s*(.+?)(?:Next|Back|$)/s);
  console.log("\n=== SCORE ===");
  console.log(scoreMatch?.[1]?.trim().substring(0, 200));
});

test("next deal increments and generates new hand", async ({ page }) => {
  await page.goto("http://localhost:1420/?convention=nt-bundle&seed=42&autoplay=true");
  const phaseLabel = page.locator('[data-testid="game-phase"]');
  await expect(phaseLabel).toHaveText("Review", { timeout: 30000 });
  
  // Record deal 1 info
  const bodyText1 = await page.textContent("body") || "";
  const cards1 = await page.$$eval('[data-testid="card"]', els => els.map(e => e.textContent));
  const dealNum1 = bodyText1.match(/Deal #(\d+)/)?.[1];
  console.log("Deal #:", dealNum1, "Cards:", cards1.join(", "));
  
  // Click Next Deal
  await page.locator('[data-testid="next-deal"]').click();
  await page.waitForTimeout(3000);
  
  // Check deal 2
  const phase2 = await page.locator('[data-testid="game-phase"]').textContent();
  const bodyText2 = await page.textContent("body") || "";
  const cards2 = await page.$$eval('[data-testid="card"]', els => els.map(e => e.textContent));
  const dealNum2 = bodyText2.match(/Deal #(\d+)/)?.[1];
  console.log("Deal #:", dealNum2, "Phase:", phase2, "Cards:", cards2.join(", "));
  
  // Verify the hand is different
  const sameHand = JSON.stringify(cards1) === JSON.stringify(cards2);
  console.log("Same hand?:", sameHand);
});
