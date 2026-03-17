import { test } from "@playwright/test";

test("Expand Other bids details in feedback - seed 1 stayman", async ({ page }) => {
  test.setTimeout(20000);
  await page.goto("/?convention=nt-stayman&seed=1");
  await page.waitForTimeout(2000);
  
  // Bid wrong: 2NT
  await page.getByTestId("bid-2NT").click();
  await page.waitForTimeout(2000);
  
  // Show answer
  await page.locator("[aria-label='Show answer']").click();
  await page.waitForTimeout(1000);
  
  // Now click on each "Other bids" item to expand them
  // They appear as clickable summary/details elements
  // First expand all details
  await page.evaluate(() => {
    document.querySelectorAll("details").forEach(d => d.open = true);
  });
  await page.waitForTimeout(500);
  
  // Get full content of the feedback alert
  const alert = page.locator("[role='alert']");
  const fullText = await alert.innerText();
  console.log("=== FULLY EXPANDED OTHER BIDS ===");
  console.log(fullText);
  
  // Also get HTML to see what's hidden
  const fullHTML = await alert.innerHTML();
  console.log("\n=== HTML OF OTHER BIDS SECTION ===");
  // Extract just the "Other bids" section
  const otherBidsMatch = fullHTML.match(/Other bids[\s\S]*/);
  console.log(otherBidsMatch?.[0]?.substring(0, 3000));
  
  await page.screenshot({ path: "/tmp/bridge-other-bids-expanded.png", fullPage: true });
});

test("Check 'Acceptable' grade feedback detail - DONT Double", async ({ page }) => {
  test.setTimeout(20000);
  await page.goto("/?convention=dont-bundle&seed=1");
  await page.waitForTimeout(2000);
  
  // Bid Double (ACCEPTABLE)
  await page.getByTestId("bid-double").click();
  await page.waitForTimeout(2000);
  
  const alert = page.locator("[role='alert']");
  if (await alert.count() > 0) {
    console.log("=== ACCEPTABLE GRADE FULL TEXT ===");
    console.log(await alert.innerText());
    console.log("\n=== HTML ===");
    console.log((await alert.innerHTML()).substring(0, 2000));
    
    // Is there a show answer button?
    const showBtn = page.locator("[aria-label='Show answer']");
    console.log("\nShow answer available:", await showBtn.count() > 0);
    
    // Is there a next/continue button?
    const nextBtn = page.locator("[aria-label='Continue'], button:has-text('Next'), button:has-text('Continue')");
    console.log("Next/Continue button:", await nextBtn.count() > 0);
  }
  
  await page.screenshot({ path: "/tmp/bridge-acceptable-detail.png", fullPage: true });
});

test("Weak Two: bid 2NT Ogust (which matched pipeline) - check grade", async ({ page }) => {
  test.setTimeout(20000);
  await page.goto("/?seed=3");
  await page.waitForTimeout(1000);
  await page.locator("button[aria-label='Practice Weak Two Bids (Bundle)']").click();
  await page.waitForTimeout(2000);
  
  // Hand: 2♠ 4♥ 5♦ 2♣, 19 HCP. Both 4♥ and 2NT matched pipeline.
  await page.getByTestId("bid-2NT").click();
  await page.waitForTimeout(2000);
  
  const alert = page.locator("[role='alert']");
  if (await alert.count() > 0) {
    const alertText = await alert.innerText();
    console.log("=== WEAK TWO 2NT FEEDBACK ===");
    console.log(alertText);
    
    // Check if 2NT is graded "Acceptable" or "Incorrect"
    if (alertText.includes("Acceptable")) {
      console.log("\n>>> 2NT is ACCEPTABLE");
    } else if (alertText.includes("Incorrect")) {
      console.log("\n>>> 2NT is INCORRECT (but it matched the pipeline!)");
    }
    
    // Show answer
    const showBtn = page.locator("[aria-label='Show answer']");
    if (await showBtn.count() > 0) {
      await showBtn.click();
      await page.waitForTimeout(1000);
      await page.evaluate(() => {
        document.querySelectorAll("details").forEach(d => d.open = true);
      });
      await page.waitForTimeout(500);
      console.log("\n=== EXPANDED ===");
      console.log(await alert.innerText());
    }
  }
  
  await page.screenshot({ path: "/tmp/bridge-weak2-2nt-grade.png", fullPage: true });
});
