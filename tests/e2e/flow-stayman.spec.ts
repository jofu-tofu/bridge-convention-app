import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const SCREENSHOT_DIR = "screenshots-e2e";

/** Helper: dump all visible text + DOM structure of key areas */
async function dumpPageState(page: Page, label: string) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  PAGE STATE: ${label}`);
  console.log(`${"=".repeat(70)}`);

  // Full page visible text
  const bodyText = await page.locator("body").innerText();
  console.log(`\n--- FULL PAGE TEXT ---\n${bodyText}`);

  // URL
  console.log(`\n--- URL: ${page.url()} ---`);

  // Title
  const title = await page.title();
  console.log(`--- PAGE TITLE: ${title} ---`);
}

/** Helper: dump the bidding area in detail */
async function dumpBiddingArea(page: Page) {
  console.log(`\n--- BIDDING AREA DETAIL ---`);

  // Game phase
  const phaseEl = page.getByTestId("game-phase");
  if (await phaseEl.isVisible()) {
    const phase = await phaseEl.textContent();
    console.log(`Game Phase: "${phase}"`);
  }

  // Bridge table
  const bridgeTable = page.getByTestId("bridge-table");
  if (await bridgeTable.isVisible()) {
    const tableText = await bridgeTable.innerText();
    console.log(`\nBridge Table text:\n${tableText}`);
    const tableHTML = await bridgeTable.innerHTML();
    console.log(`\nBridge Table HTML (truncated):\n${tableHTML.substring(0, 3000)}`);
  }

  // Seat labels
  for (const seat of ["north", "south", "east", "west"]) {
    const seatLabel = page.getByTestId(`seat-label-${seat}`);
    if (await seatLabel.isVisible().catch(() => false)) {
      const text = await seatLabel.textContent();
      console.log(`Seat ${seat}: "${text}"`);
    }
  }

  // South HCP
  const hcp = page.getByTestId("south-hcp");
  if (await hcp.isVisible().catch(() => false)) {
    const hcpText = await hcp.textContent();
    console.log(`South HCP: "${hcpText}"`);
  }

  // Hand fan (cards)
  const handFan = page.getByTestId("hand-fan");
  if (await handFan.isVisible().catch(() => false)) {
    const handText = await handFan.innerText();
    console.log(`\nHand Fan text: "${handText}"`);
    const handHTML = await handFan.innerHTML();
    console.log(`Hand Fan HTML (truncated):\n${handHTML.substring(0, 2000)}`);
  }

  // All cards
  const cards = page.getByTestId("card");
  const cardCount = await cards.count();
  console.log(`\nTotal cards visible: ${cardCount}`);
  for (let i = 0; i < cardCount; i++) {
    const cardText = await cards.nth(i).textContent();
    const cardClasses = await cards.nth(i).getAttribute("class");
    console.log(`  Card ${i}: text="${cardText}" class="${cardClasses}"`);
  }

  // Auction table
  const auctionTable = page.locator("[class*='auction'], [data-testid*='auction']");
  if (await auctionTable.first().isVisible().catch(() => false)) {
    const auctionText = await auctionTable.first().innerText();
    console.log(`\nAuction Table text:\n${auctionText}`);
  }

  // Vulnerability display
  const vulEl = page.locator("[class*='vul'], [class*='vulnerab']");
  if (await vulEl.first().isVisible().catch(() => false)) {
    const vulText = await vulEl.first().textContent();
    console.log(`Vulnerability: "${vulText}"`);
  }

  // Dealer indicator
  const dealerEl = page.locator("[class*='dealer']");
  if (await dealerEl.first().isVisible().catch(() => false)) {
    const dealerText = await dealerEl.first().textContent();
    console.log(`Dealer: "${dealerText}"`);
  }
}

/** Helper: dump bid panel buttons */
async function dumpBidPanel(page: Page) {
  console.log(`\n--- BID PANEL DETAIL ---`);

  // Level bids section
  const levelBids = page.getByTestId("level-bids");
  if (await levelBids.isVisible().catch(() => false)) {
    const text = await levelBids.innerText();
    console.log(`Level bids text:\n${text}`);
  }

  // Special bids section
  const specialBids = page.getByTestId("special-bids");
  if (await specialBids.isVisible().catch(() => false)) {
    const text = await specialBids.innerText();
    console.log(`Special bids text:\n${text}`);
  }

  // All bid buttons
  const allBidButtons = page.locator("[data-testid^='bid-']");
  const bidCount = await allBidButtons.count();
  console.log(`\nTotal bid buttons: ${bidCount}`);
  for (let i = 0; i < bidCount; i++) {
    const btn = allBidButtons.nth(i);
    const testId = await btn.getAttribute("data-testid");
    const text = await btn.textContent();
    const disabled = await btn.isDisabled();
    const ariaLabel = await btn.getAttribute("aria-label");
    console.log(
      `  Button ${i}: testid="${testId}" text="${text}" disabled=${disabled} aria-label="${ariaLabel}"`,
    );
  }
}

test.describe("Stayman convention flow — comprehensive exploration", () => {
  test("Step 1: Home page → click Stayman play button → observe bidding screen", async ({
    page,
  }) => {
    // STEP 1: Go to home page with seed=42
    console.log("\n STEP 1: Navigate to home page with seed=42");
    await page.goto("/?seed=42");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-home-page.png`,
      fullPage: true,
    });

    await dumpPageState(page, "Home Page (seed=42)");

    // STEP 2: Find and describe all convention cards
    console.log("\n STEP 2: Listing all convention cards");
    const allConventionCards = page.locator("[data-testid^='convention-']");
    const cardCount = await allConventionCards.count();
    console.log(`Total convention cards: ${cardCount}`);

    for (let i = 0; i < cardCount; i++) {
      const card = allConventionCards.nth(i);
      const testId = await card.getAttribute("data-testid");
      const text = await card.innerText();
      console.log(`\n  Convention card ${i}: testid="${testId}"`);
      console.log(`  Text: "${text.replace(/\n/g, " | ")}"`);
    }

    // STEP 3: Find Stayman card specifically
    console.log("\n STEP 3: Finding Stayman card");

    const staymanCard = page.getByTestId("convention-nt-stayman");
    if (await staymanCard.isVisible().catch(() => false)) {
      const staymanText = await staymanCard.innerText();
      console.log(`Stayman card text: "${staymanText.replace(/\n/g, " | ")}"`);
      const staymanHTML = await staymanCard.innerHTML();
      console.log(`Stayman card HTML:\n${staymanHTML.substring(0, 2000)}`);
    } else {
      console.log("convention-nt-stayman not found, trying other selectors...");
      const allTestIds = await page.evaluate(() => {
        const elements = document.querySelectorAll("[data-testid]");
        return Array.from(elements).map((el) => ({
          testId: el.getAttribute("data-testid"),
          tag: el.tagName,
          text: (el as HTMLElement).innerText?.substring(0, 100),
        }));
      });
      console.log("All data-testid elements:", JSON.stringify(allTestIds, null, 2));
    }

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02-stayman-card-located.png`,
      fullPage: true,
    });

    // STEP 4: Click the Stayman play button
    console.log("\n STEP 4: Clicking Stayman play button");

    const practiceBtn = page.getByTestId("practice-nt-stayman");
    if (await practiceBtn.isVisible().catch(() => false)) {
      console.log("Found practice-nt-stayman button, clicking...");
      await practiceBtn.click();
    } else {
      console.log("practice-nt-stayman not found. Trying fallback...");
      const staymanHeading = page.locator("text=Stayman").first();
      if (await staymanHeading.isVisible()) {
        const parentCard = staymanHeading.locator("xpath=ancestor::*[contains(@data-testid, 'convention')]");
        const buttons = parentCard.locator("button");
        const btnCount = await buttons.count();
        console.log(`Found ${btnCount} buttons in Stayman card area`);
        for (let i = 0; i < btnCount; i++) {
          const btn = buttons.nth(i);
          const text = await btn.textContent();
          const testId = await btn.getAttribute("data-testid");
          console.log(`  Button ${i}: text="${text}" testid="${testId}"`);
        }
        if (btnCount > 0) {
          await buttons.first().click();
          console.log("Clicked first button in Stayman card");
        }
      }
    }

    // Wait for navigation / game to load
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/03-after-stayman-click.png`,
      fullPage: true,
    });

    await dumpPageState(page, "After clicking Stayman play button");

    // STEP 5: Analyze the bidding screen
    console.log("\n STEP 5: Analyzing the bidding screen");

    const phaseLabel = page.getByTestId("game-phase");
    const phaseVisible = await phaseLabel.isVisible().catch(() => false);
    if (phaseVisible) {
      await expect(phaseLabel).toHaveText("Bidding", { timeout: 10000 });
      console.log("Game phase is Bidding");
    } else {
      console.log("game-phase element not visible");
    }

    await dumpBiddingArea(page);
    await dumpBidPanel(page);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/04-bidding-screen-detail.png`,
      fullPage: true,
    });

    // STEP 6: Capture complete DOM snapshot
    console.log("\n STEP 6: Full DOM snapshot of game area");
    const mainContent = await page.evaluate(() => {
      const main = document.querySelector("main") || document.body;
      return main.innerHTML;
    });
    console.log(`\nMain content HTML (first 5000 chars):\n${mainContent.substring(0, 5000)}`);

    // Check for any turn indicator
    console.log("\n--- TURN INDICATORS ---");
    const turnIndicators = await page.evaluate(() => {
      const results: string[] = [];
      const allElements = document.querySelectorAll("*");
      allElements.forEach((el) => {
        const classes = el.className?.toString() || "";
        const text = (el as HTMLElement).innerText?.trim() || "";
        if (
          (classes.includes("turn") ||
            classes.includes("current") ||
            classes.includes("active") ||
            classes.includes("highlight")) &&
          text.length < 200
        ) {
          results.push(
            `tag=${el.tagName} class="${classes.substring(0, 100)}" text="${text.substring(0, 100)}"`,
          );
        }
      });
      return results.slice(0, 30);
    });
    turnIndicators.forEach((t) => console.log(`  ${t}`));

    // STEP 7: Make a bid and observe
    console.log("\n STEP 7: Attempting to make a bid");

    const passBtn = page.getByTestId("bid-pass");
    const passBtnVisible = await passBtn.isVisible().catch(() => false);

    if (passBtnVisible) {
      const enabledBids = page.locator("[data-testid^='bid-']:not([disabled])");
      const enabledCount = await enabledBids.count();
      console.log(`\nEnabled bid buttons: ${enabledCount}`);
      for (let i = 0; i < enabledCount; i++) {
        const btn = enabledBids.nth(i);
        const testId = await btn.getAttribute("data-testid");
        const text = await btn.textContent();
        console.log(`  Enabled: testid="${testId}" text="${text}"`);
      }

      // Try to bid 2C (Stayman response to 1NT)
      const stayman2C = page.getByTestId("bid-2C");
      const stayman2CVisible = await stayman2C.isVisible().catch(() => false);
      const stayman2CEnabled = stayman2CVisible ? await stayman2C.isEnabled().catch(() => false) : false;

      if (stayman2CEnabled) {
        console.log("\n2C button is available and enabled - this is the Stayman bid!");
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/05-before-2C-bid.png`,
          fullPage: true,
        });

        await stayman2C.click();
        console.log("Clicked 2C (Stayman)");

        await page.waitForTimeout(2000);
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/06-after-2C-bid.png`,
          fullPage: true,
        });

        await dumpPageState(page, "After bidding 2C (Stayman)");
        await dumpBiddingArea(page);
        await dumpBidPanel(page);
      } else {
        console.log("\n2C not available. Trying Pass to see feedback...");
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/05-before-pass-bid.png`,
          fullPage: true,
        });

        await passBtn.click();
        console.log("Clicked Pass");

        await page.waitForTimeout(2000);
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/06-after-pass-bid.png`,
          fullPage: true,
        });

        await dumpPageState(page, "After bidding Pass");

        const feedbackPanel = page.locator("[role='alert']");
        if (await feedbackPanel.isVisible().catch(() => false)) {
          const feedbackText = await feedbackPanel.innerText();
          console.log(`\nFeedback panel text: "${feedbackText}"`);
          const feedbackHTML = await feedbackPanel.innerHTML();
          console.log(`Feedback panel HTML:\n${feedbackHTML.substring(0, 3000)}`);

          await page.screenshot({
            path: `${SCREENSHOT_DIR}/07-feedback-panel.png`,
            fullPage: true,
          });

          const retryBtn = page.getByRole("button", { name: /try again/i });
          const continueBtn = page.getByRole("button", { name: /continue/i });

          if (await retryBtn.isVisible().catch(() => false)) {
            console.log("Retry button found - clicking it");
            await retryBtn.click();
            await page.waitForTimeout(1000);

            await page.screenshot({
              path: `${SCREENSHOT_DIR}/08-after-retry.png`,
              fullPage: true,
            });

            await dumpBiddingArea(page);
            await dumpBidPanel(page);

            const bid2C = page.getByTestId("bid-2C");
            if (await bid2C.isEnabled().catch(() => false)) {
              console.log("Now bidding 2C (Stayman)");
              await bid2C.click();
              await page.waitForTimeout(2000);

              await page.screenshot({
                path: `${SCREENSHOT_DIR}/09-after-correct-2C-bid.png`,
                fullPage: true,
              });

              await dumpPageState(page, "After correct 2C bid");
              await dumpBiddingArea(page);
              await dumpBidPanel(page);
            }
          } else if (await continueBtn.isVisible().catch(() => false)) {
            console.log("Continue button found - clicking it");
            await continueBtn.click();
            await page.waitForTimeout(1000);
            await page.screenshot({
              path: `${SCREENSHOT_DIR}/08-after-continue.png`,
              fullPage: true,
            });
            await dumpBiddingArea(page);
            await dumpBidPanel(page);
          }
        }
      }
    } else {
      console.log("No bid-pass button visible.");
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/05-no-bid-buttons.png`,
        fullPage: true,
      });
    }

    // STEP 8: Final state snapshot
    console.log("\n STEP 8: Final state snapshot");
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/10-final-state.png`,
      fullPage: true,
    });
    await dumpPageState(page, "Final state");
    await dumpBiddingArea(page);
  });

  test("Step 2: Direct URL navigation to Stayman with seed=42", async ({ page }) => {
    console.log("\n Direct navigation to Stayman via URL param");
    await page.goto("/?convention=nt-stayman&seed=42");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/20-direct-stayman-load.png`,
      fullPage: true,
    });

    await dumpPageState(page, "Direct Stayman load (convention=nt-stayman&seed=42)");

    const phaseLabel = page.getByTestId("game-phase");
    await expect(phaseLabel).toHaveText("Bidding", { timeout: 10000 });

    await dumpBiddingArea(page);
    await dumpBidPanel(page);

    // Dump the complete main HTML for analysis
    console.log("\n--- COMPLETE MAIN ELEMENT HTML ---");
    const mainHTML = await page.evaluate(() => {
      const main = document.querySelector("main");
      return main ? main.outerHTML : document.body.innerHTML;
    });
    console.log(mainHTML.substring(0, 8000));

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/21-stayman-bidding-ready.png`,
      fullPage: true,
    });

    // Identify the auction history
    console.log("\n--- AUCTION HISTORY ---");
    const auctionCells = await page.evaluate(() => {
      const results: string[] = [];
      const cells = document.querySelectorAll("td, [role='cell'], [role='gridcell']");
      cells.forEach((cell) => {
        const text = (cell as HTMLElement).innerText?.trim();
        if (text) results.push(text);
      });
      return results;
    });
    console.log(`Auction cells: ${JSON.stringify(auctionCells)}`);

    // Check whose turn it is
    console.log("\n--- WHOSE TURN ---");
    const turnInfo = await page.evaluate(() => {
      const results: string[] = [];
      const selectors = [
        "[class*='current']",
        "[class*='active']",
        "[class*='turn']",
        "[class*='highlight']",
        "[aria-current]",
        ".font-bold",
        "[class*='glow']",
        "[class*='pulse']",
      ];
      selectors.forEach((sel) => {
        const els = document.querySelectorAll(sel);
        els.forEach((el) => {
          const text = (el as HTMLElement).innerText?.trim().substring(0, 200);
          const classes = el.className?.toString().substring(0, 200);
          if (text) {
            results.push(`[${sel}] text="${text}" class="${classes}"`);
          }
        });
      });
      return results;
    });
    turnInfo.forEach((t) => console.log(`  ${t}`));

    // Vulnerability and dealer
    console.log("\n--- VULNERABILITY / DEALER ---");
    const vulDealerInfo = await page.evaluate(() => {
      const body = document.body.innerText;
      const lines = body.split("\n").filter((l) => l.trim());
      return lines.filter(
        (l) =>
          /vul|dealer|north|south|east|west|none|both|n-s|e-w|ns|ew/i.test(l) &&
          l.length < 100,
      );
    });
    vulDealerInfo.forEach((l) => console.log(`  ${l}`));

    // Make a bid
    console.log("\n--- MAKING A BID ---");
    const enabledBids = page.locator("[data-testid^='bid-']:not([disabled])");
    const enabledCount = await enabledBids.count();
    console.log(`Enabled bids: ${enabledCount}`);

    const enabledBidList: string[] = [];
    for (let i = 0; i < enabledCount; i++) {
      const btn = enabledBids.nth(i);
      const testId = await btn.getAttribute("data-testid");
      const text = await btn.textContent();
      enabledBidList.push(`${testId}: "${text}"`);
    }
    console.log(`Enabled bid list: ${JSON.stringify(enabledBidList)}`);

    const bid2C = page.getByTestId("bid-2C");
    if (await bid2C.isVisible().catch(() => false)) {
      const isEnabled = await bid2C.isEnabled();
      console.log(`2C button visible: true, enabled: ${isEnabled}`);

      if (isEnabled) {
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/22-before-bid-2C.png`,
          fullPage: true,
        });

        await bid2C.click();
        console.log("Clicked 2C");
        await page.waitForTimeout(3000);

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/23-after-bid-2C.png`,
          fullPage: true,
        });

        await dumpPageState(page, "After 2C bid");
        await dumpBiddingArea(page);
        await dumpBidPanel(page);

        const feedbackPanel = page.locator("[role='alert']");
        if (await feedbackPanel.isVisible().catch(() => false)) {
          const feedbackText = await feedbackPanel.innerText();
          console.log(`\nFeedback: "${feedbackText}"`);
          const feedbackHTML = await feedbackPanel.innerHTML();
          console.log(`Feedback HTML:\n${feedbackHTML.substring(0, 3000)}`);

          await page.screenshot({
            path: `${SCREENSHOT_DIR}/24-bid-2C-feedback.png`,
            fullPage: true,
          });
        }

        const nextPhase = await phaseLabel.textContent();
        console.log(`Phase after bid: "${nextPhase}"`);

        if (nextPhase === "Bidding") {
          const newEnabledBids = page.locator("[data-testid^='bid-']:not([disabled])");
          const newCount = await newEnabledBids.count();
          console.log(`\nNew enabled bids after 2C: ${newCount}`);
          for (let i = 0; i < newCount; i++) {
            const btn = newEnabledBids.nth(i);
            const testId = await btn.getAttribute("data-testid");
            const text = await btn.textContent();
            console.log(`  ${testId}: "${text}"`);
          }

          if (newCount > 0) {
            const firstEnabled = newEnabledBids.first();
            const firstTestId = await firstEnabled.getAttribute("data-testid");
            console.log(`\nClicking next available bid: ${firstTestId}`);
            await firstEnabled.click();
            await page.waitForTimeout(3000);

            await page.screenshot({
              path: `${SCREENSHOT_DIR}/25-after-second-bid.png`,
              fullPage: true,
            });

            await dumpPageState(page, "After second bid");
            await dumpBiddingArea(page);
          }
        }
      }
    } else {
      console.log("2C button not visible");
      const passBtn = page.getByTestId("bid-pass");
      if (await passBtn.isEnabled().catch(() => false)) {
        await passBtn.click();
        console.log("Clicked Pass instead");
        await page.waitForTimeout(2000);

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/22-after-pass.png`,
          fullPage: true,
        });
        await dumpPageState(page, "After Pass bid");
      }
    }

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/29-final-stayman-state.png`,
      fullPage: true,
    });
  });
});
