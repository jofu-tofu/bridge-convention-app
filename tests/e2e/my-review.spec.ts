import { test } from "@playwright/test";

test.setTimeout(90000);

test("Weak Two - verify seeds 6, 9, 10, 14 opener hearts", async ({ page }) => {
  // These were missing from the validation test
  for (const seed of [6, 9, 10, 14]) {
    await page.goto(`http://localhost:1420?seed=${seed}`);
    await page.waitForTimeout(300);
    await page.locator('[data-testid="practice-weak-two-bundle"]').click();
    await page.waitForTimeout(1500);
    
    const bodyText = await page.textContent("body");
    const northMatch = bodyText?.match(/N \((\d+) HCP\)\s*♠\s*(\S+?)♥\s*(\S+?)♦\s*(\S+?)♣\s*(\S+?)E/s);
    if (northMatch) {
      const [_, nhcp, _nspades, nhearts, _ndiamonds, _nclubs] = northMatch;
      console.log(`Seed ${seed}: N=${nhcp}HCP ♥=${nhearts.trim()} (${nhearts.trim().length} hearts)`);
    }
  }
});

test("1NT seed 9 - pass with 6 HCP edge case", async ({ page }) => {
  // S has 6 HCP, 4♠3♥3♦3♣ - should pass 1NT
  await page.goto("http://localhost:1420?seed=9");
  await page.waitForTimeout(300);
  await page.locator('[data-testid="practice-nt-bundle"]').click();
  await page.waitForTimeout(1500);
  
  const bodyText = await page.textContent("body");
  const devBid = bodyText?.match(/DEV: Correct Bid (.+?) Debug/)?.[1];
  console.log("1NT Seed 9 (6 HCP, 4333):", devBid);
  
  // Bid pass and check
  await page.locator('[data-testid="bid-pass"]').click();
  await page.waitForTimeout(1500);
  
  const bodyText2 = await page.textContent("body");
  const teaching = bodyText2?.match(/Teaching(.+?)(?:Public Beliefs|$)/s)?.[1];
  console.log("Feedback:", teaching?.substring(0, 200));
});

test("Stayman opener with both majors - verify 2H first", async ({ page }) => {
  // Seed 4: N has ♠QJ87 ♥AQ64 (both 4-card majors)
  // After Stayman 2♣, opener should bid 2♥ first (standard)
  await page.goto("http://localhost:1420?seed=4");
  await page.waitForTimeout(300);
  await page.locator('[data-testid="practice-nt-stayman"]').click();
  await page.waitForTimeout(1500);
  
  // Bid 2♣
  await page.locator('[data-testid="bid-2C"]').click();
  await page.waitForTimeout(2000);
  
  const bodyText = await page.textContent("body");
  const auction = bodyText?.match(/Auction sequence(.+?)(?:E\s+S|Your bid)/s)?.[1];
  console.log("Seed 4 - Opener with both majors:");
  console.log("Auction:", auction?.replace(/\s+/g, ' ')?.substring(0, 150));
  console.log("Expected: Opener bids 2♥ (hearts first with both)");
  
  const has2H = auction?.includes("2♥");
  console.log("Opener bid 2♥?", has2H ? "YES ✓" : "NO ❌");
});

test("Jacoby Transfer - test seeds 1-5", async ({ page }) => {
  // Check if transfer module works standalone
  for (const seed of [1, 2, 3, 4, 5]) {
    await page.goto(`http://localhost:1420?seed=${seed}`);
    await page.waitForTimeout(300);
    await page.locator('[data-testid="practice-nt-transfers"]').click();
    await page.waitForTimeout(1500);
    
    const bodyText = await page.textContent("body");
    const devBid = bodyText?.match(/DEV: Correct Bid (.+?) Debug/)?.[1];
    const allHands = bodyText?.match(/All Hands(.+?)Convention Machine/s)?.[1];
    const hcp = bodyText?.match(/hand\.hcp(\d+)/)?.[1];
    const sLen = bodyText?.match(/hand\.suitLength\.spades(\d+)/)?.[1];
    const hLen = bodyText?.match(/hand\.suitLength\.hearts(\d+)/)?.[1];
    
    console.log(`\nTransfer Seed ${seed}: ${sLen}♠${hLen}♥ ${hcp}HCP → ${devBid}`);
    console.log(`  Hands: ${allHands?.substring(0, 150)}`);
    
    // Make the bid and check if transfer is completed by opener
    if (devBid && !devBid.includes("No convention") && !devBid.includes("pass")) {
      const bidMatch = devBid.match(/^(\S+)/)?.[1];
      const bidMap: {[key:string]: string} = {
        "2♦": "bid-2D", "2♥": "bid-2H", "2♠": "bid-2S"
      };
      const testId = bidMatch ? bidMap[bidMatch] : null;
      if (testId) {
        await page.locator(`[data-testid="${testId}"]`).click();
        await page.waitForTimeout(1500);
        
        const bodyText2 = await page.textContent("body");
        const devBid2 = bodyText2?.match(/DEV: Correct Bid (.+?) Debug/)?.[1];
        const auction2 = bodyText2?.match(/Auction sequence(.+?)(?:E\s+S|Your bid)/s)?.[1];
        console.log(`  After transfer: ${devBid2}`);
        console.log(`  Auction: ${auction2?.replace(/\s+/g, ' ')?.substring(0, 120)}`);
      }
    }
  }
});

test("Bergen seeds 50-60 - check for 1S openings", async ({ page }) => {
  // Check more seeds to see if Bergen ever generates 1♠ openings
  for (const seed of [50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 100, 150, 200, 250]) {
    await page.goto(`http://localhost:1420?seed=${seed}`);
    await page.waitForTimeout(200);
    await page.locator('[data-testid="practice-bergen-bundle"]').click();
    await page.waitForTimeout(800);
    
    const bodyText = await page.textContent("body");
    const auction = bodyText?.match(/Auction sequence(.+?)(?:E\s+S|Your bid)/s)?.[1];
    const opening = auction?.match(/(1[♥♠])/)?.[1] || "??";
    console.log(`Bergen Seed ${seed}: Opening=${opening}`);
  }
});
