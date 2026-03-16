import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect every visible text on the page body (trimmed, non-empty lines). */
async function captureAllText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.innerText);
}

/** Read the auction table rows as an array of cell texts. */
async function readAuctionTable(page: Page) {
  const table = page.locator("table", { has: page.locator("caption") });
  if (!(await table.count())) return { headers: [] as string[], rows: [] as string[][] };

  const headers = await table.locator("thead th").allInnerTexts();
  const bodyRows = table.locator("tbody tr");
  const rowCount = await bodyRows.count();
  const rows: string[][] = [];
  for (let i = 0; i < rowCount; i++) {
    const cells = await bodyRows.nth(i).locator("td").allInnerTexts();
    rows.push(cells);
  }
  return { headers, rows };
}

/** Collect South's face-up cards (text content of data-testid="card" inside the south hand). */
async function readSouthHand(page: Page) {
  // South is the last hand-fan in the bridge table
  const cards = page.locator("[data-testid='hand-fan']").last().locator("[data-testid='card']");
  const count = await cards.count();
  const cardTexts: string[] = [];
  for (let i = 0; i < count; i++) {
    const ariaLabel = await cards.nth(i).getAttribute("aria-label");
    cardTexts.push(ariaLabel ?? (await cards.nth(i).innerText()));
  }
  return cardTexts;
}

/** Get all enabled (non-disabled) bid buttons from the bid panel. */
async function getEnabledBids(page: Page) {
  const allBids = page.locator("[data-testid^='bid-']");
  const count = await allBids.count();
  const enabled: { testId: string; text: string }[] = [];
  for (let i = 0; i < count; i++) {
    const btn = allBids.nth(i);
    const isDisabled = await btn.isDisabled();
    if (!isDisabled) {
      const testId = (await btn.getAttribute("data-testid")) ?? "";
      const text = (await btn.innerText()).trim();
      enabled.push({ testId, text });
    }
  }
  return enabled;
}

/** Identify dealer from the auction table (first actual bid column). */
function inferDealerFromAuction(
  headers: string[],
  rows: string[][],
): string | null {
  if (!rows.length) return null;
  const firstRow = rows[0];
  for (let c = 0; c < firstRow.length; c++) {
    if (firstRow[c] && firstRow[c] !== "\u2014" && firstRow[c].trim() !== "") {
      return headers[c] ?? null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Shared "capture everything" routine
// ---------------------------------------------------------------------------
interface ScenarioCapture {
  bodyText: string;
  pageTitle: string;
  phaseBadge: string;
  dealNumber: string;
  heading: string;
  sidePanelHeading: string;
  southHcp: string;
  southCards: string[];
  auctionHeaders: string[];
  auctionRows: string[][];
  inferredDealer: string | null;
  enabledBids: { testId: string; text: string }[];
  seatLabels: string[];
  alertAnnotations: string[];
}

async function captureScenario(page: Page): Promise<ScenarioCapture> {
  const bodyText = await captureAllText(page);

  const phaseBadge = await page.getByTestId("game-phase").innerText();
  const heading = await page.locator("h1").first().innerText();

  // Deal number is a span near the header
  const dealNumber =
    (await page.locator("header span").allInnerTexts()).find((t) =>
      t.startsWith("Deal"),
    ) ?? "";

  // Side panel heading (h2)
  const sidePanelHeading = await page
    .locator("aside[aria-label='Bidding controls'] h2")
    .innerText()
    .catch(() => "");

  const southHcp = await page
    .getByTestId("south-hcp")
    .innerText()
    .catch(() => "");

  const southCards = await readSouthHand(page);

  const { headers: auctionHeaders, rows: auctionRows } =
    await readAuctionTable(page);
  const inferredDealer = inferDealerFromAuction(auctionHeaders, auctionRows);

  const enabledBids = await getEnabledBids(page);

  // Seat labels
  const seatLabels: string[] = [];
  for (const s of ["N", "E", "S", "W"]) {
    const text = await page
      .getByTestId(`seat-label-${s}`)
      .innerText()
      .catch(() => "");
    seatLabels.push(text);
  }

  // Alert annotations (! markers with aria-labels)
  const alerts = page.locator("td[aria-label]");
  const alertCount = await alerts.count();
  const alertAnnotations: string[] = [];
  for (let i = 0; i < alertCount; i++) {
    const label = await alerts.nth(i).getAttribute("aria-label");
    if (label) alertAnnotations.push(label);
  }

  return {
    bodyText,
    pageTitle: await page.title(),
    phaseBadge,
    dealNumber,
    heading,
    sidePanelHeading,
    southHcp,
    southCards,
    auctionHeaders,
    auctionRows,
    inferredDealer,
    enabledBids,
    seatLabels,
    alertAnnotations,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("DONT and Bergen Raises flow", () => {
  test("DONT — seed 100: navigate, capture bidding state, bid, return", async ({
    page,
  }) => {
    // ---- Step 1: Go to home page with seed --------------------------------
    await page.goto("/?seed=100");
    await expect(page.locator("h1")).toHaveText("Bridge Practice", {
      timeout: 8000,
    });

    // ---- Step 2: Click the practice (play) button for DONT ----------------
    const dontCard = page.getByTestId("convention-dont-bundle");
    await expect(dontCard).toBeVisible({ timeout: 5000 });
    const dontPlayBtn = page.getByTestId("practice-dont-bundle");
    await expect(dontPlayBtn).toBeVisible();
    await dontPlayBtn.click();

    // ---- Step 3: Wait for bidding phase -----------------------------------
    const phaseLabel = page.getByTestId("game-phase");
    await expect(phaseLabel).toHaveText("Bidding", { timeout: 8000 });

    // Wait for the bid panel to be present (bids loaded)
    await expect(page.getByTestId("bid-pass")).toBeVisible({ timeout: 5000 });
    // Give a moment for AI bids to resolve
    await page.waitForTimeout(1500);

    // ---- Step 3b: Take initial screenshot ---------------------------------
    await page.screenshot({
      path: "/tmp/dont-seed100-initial.png",
      fullPage: true,
    });

    // ---- Step 4: Capture ALL bidding screen state -------------------------
    const dontState = await captureScenario(page);

    console.log("=== DONT (seed=100) — FULL STATE ===");
    console.log("Page title:", dontState.pageTitle);
    console.log("Heading:", dontState.heading);
    console.log("Phase badge:", dontState.phaseBadge);
    console.log("Deal number:", dontState.dealNumber);
    console.log("Side panel heading:", dontState.sidePanelHeading);
    console.log("South HCP:", dontState.southHcp);
    console.log("Seat labels:", dontState.seatLabels);
    console.log("South cards:", dontState.southCards);
    console.log(
      "Auction headers:",
      JSON.stringify(dontState.auctionHeaders),
    );
    console.log(
      "Auction rows:",
      JSON.stringify(dontState.auctionRows),
    );
    console.log("Inferred dealer:", dontState.inferredDealer);
    console.log(
      "Enabled bids:",
      dontState.enabledBids.map((b) => b.text).join(", "),
    );
    console.log(
      "Enabled bid testIds:",
      dontState.enabledBids.map((b) => b.testId).join(", "),
    );
    console.log("Alert annotations:", dontState.alertAnnotations);
    console.log("--- Full body text (start) ---");
    console.log(dontState.bodyText);
    console.log("--- Full body text (end) ---");

    // Basic assertions
    expect(dontState.phaseBadge).toBe("Bidding");
    expect(dontState.heading).toContain("DONT");
    expect(dontState.seatLabels).toEqual(["N", "E", "S", "W"]);
    expect(dontState.southCards.length).toBeGreaterThan(0);

    // ---- Step 5: Make a bid -----------------------------------------------
    let bidMade = "";

    if (dontState.sidePanelHeading.includes("Your bid")) {
      // It's our turn — pick the first enabled contract bid, or pass
      const contractBid = dontState.enabledBids.find(
        (b) =>
          b.testId !== "bid-pass" &&
          b.testId !== "bid-double" &&
          b.testId !== "bid-redouble",
      );
      const bidToClick = contractBid ?? dontState.enabledBids.find((b) => b.testId === "bid-pass");
      if (bidToClick) {
        console.log(`Making bid: ${bidToClick.text} (${bidToClick.testId})`);
        await page.getByTestId(bidToClick.testId).click();
        bidMade = bidToClick.text;
      }
    } else {
      console.log(
        "Not our turn yet — waiting for user turn or bidding to advance...",
      );
      // Wait until it's our turn or a phase change
      try {
        await expect(
          page.locator("aside[aria-label='Bidding controls'] h2"),
        ).toHaveText("Your bid", { timeout: 10000 });
        // Re-capture enabled bids now that it's our turn
        const freshBids = await getEnabledBids(page);
        const contractBid = freshBids.find(
          (b) =>
            b.testId !== "bid-pass" &&
            b.testId !== "bid-double" &&
            b.testId !== "bid-redouble",
        );
        const bidToClick = contractBid ?? freshBids.find((b) => b.testId === "bid-pass");
        if (bidToClick) {
          console.log(
            `Making bid (after wait): ${bidToClick.text} (${bidToClick.testId})`,
          );
          await page.getByTestId(bidToClick.testId).click();
          bidMade = bidToClick.text;
        }
      } catch {
        console.log("Timed out waiting for our turn — phase may have advanced");
      }
    }

    // ---- Step 5b: Take post-bid screenshot --------------------------------
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: "/tmp/dont-seed100-after-bid.png",
      fullPage: true,
    });

    // Capture post-bid state
    const postBidText = await captureAllText(page);
    console.log("=== DONT post-bid body text ===");
    console.log(postBidText);

    // Check for feedback panel
    const feedbackPanel = page.locator("[role='alert']");
    if (await feedbackPanel.isVisible()) {
      const feedbackText = await feedbackPanel.innerText();
      console.log("Feedback panel text:", feedbackText);
    } else {
      console.log("No feedback panel visible after bid");
    }

    // ---- Step 6: Navigate back to home ------------------------------------
    const backButton = page.getByTestId("back-to-menu");
    await backButton.click();
    await expect(page.locator("h1")).toHaveText("Bridge Practice", {
      timeout: 5000,
    });
    console.log("Successfully returned to home screen");
  });

  test("Bergen Raises — seed 200: navigate, capture bidding state, bid, return", async ({
    page,
  }) => {
    // ---- Step 7: Go to home page with seed 200 ----------------------------
    await page.goto("/?seed=200");
    await expect(page.locator("h1")).toHaveText("Bridge Practice", {
      timeout: 8000,
    });

    // ---- Step 8: Click the practice button for Bergen Raises --------------
    const bergenCard = page.getByTestId("convention-bergen-bundle");
    await expect(bergenCard).toBeVisible({ timeout: 5000 });
    const bergenPlayBtn = page.getByTestId("practice-bergen-bundle");
    await expect(bergenPlayBtn).toBeVisible();
    await bergenPlayBtn.click();

    // ---- Step 9: Wait for bidding phase -----------------------------------
    const phaseLabel = page.getByTestId("game-phase");
    await expect(phaseLabel).toHaveText("Bidding", { timeout: 8000 });

    await expect(page.getByTestId("bid-pass")).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1500);

    // ---- Step 9b: Take initial screenshot ---------------------------------
    await page.screenshot({
      path: "/tmp/bergen-seed200-initial.png",
      fullPage: true,
    });

    // ---- Step 10: Capture ALL bidding screen state ------------------------
    const bergenState = await captureScenario(page);

    console.log("=== BERGEN RAISES (seed=200) — FULL STATE ===");
    console.log("Page title:", bergenState.pageTitle);
    console.log("Heading:", bergenState.heading);
    console.log("Phase badge:", bergenState.phaseBadge);
    console.log("Deal number:", bergenState.dealNumber);
    console.log("Side panel heading:", bergenState.sidePanelHeading);
    console.log("South HCP:", bergenState.southHcp);
    console.log("Seat labels:", bergenState.seatLabels);
    console.log("South cards:", bergenState.southCards);
    console.log(
      "Auction headers:",
      JSON.stringify(bergenState.auctionHeaders),
    );
    console.log(
      "Auction rows:",
      JSON.stringify(bergenState.auctionRows),
    );
    console.log("Inferred dealer:", bergenState.inferredDealer);
    console.log(
      "Enabled bids:",
      bergenState.enabledBids.map((b) => b.text).join(", "),
    );
    console.log(
      "Enabled bid testIds:",
      bergenState.enabledBids.map((b) => b.testId).join(", "),
    );
    console.log("Alert annotations:", bergenState.alertAnnotations);
    console.log("--- Full body text (start) ---");
    console.log(bergenState.bodyText);
    console.log("--- Full body text (end) ---");

    // Basic assertions
    expect(bergenState.phaseBadge).toBe("Bidding");
    expect(bergenState.heading).toContain("Bergen Raises");
    expect(bergenState.seatLabels).toEqual(["N", "E", "S", "W"]);
    expect(bergenState.southCards.length).toBeGreaterThan(0);

    // ---- Make a bid -------------------------------------------------------
    let bidMade = "";
    if (bergenState.sidePanelHeading.includes("Your bid")) {
      const contractBid = bergenState.enabledBids.find(
        (b) =>
          b.testId !== "bid-pass" &&
          b.testId !== "bid-double" &&
          b.testId !== "bid-redouble",
      );
      const bidToClick = contractBid ?? bergenState.enabledBids.find((b) => b.testId === "bid-pass");
      if (bidToClick) {
        console.log(`Making bid: ${bidToClick.text} (${bidToClick.testId})`);
        await page.getByTestId(bidToClick.testId).click();
        bidMade = bidToClick.text;
      }
    } else {
      console.log("Not our turn yet — waiting...");
      try {
        await expect(
          page.locator("aside[aria-label='Bidding controls'] h2"),
        ).toHaveText("Your bid", { timeout: 10000 });
        const freshBids = await getEnabledBids(page);
        const contractBid = freshBids.find(
          (b) =>
            b.testId !== "bid-pass" &&
            b.testId !== "bid-double" &&
            b.testId !== "bid-redouble",
        );
        const bidToClick = contractBid ?? freshBids.find((b) => b.testId === "bid-pass");
        if (bidToClick) {
          console.log(
            `Making bid (after wait): ${bidToClick.text} (${bidToClick.testId})`,
          );
          await page.getByTestId(bidToClick.testId).click();
          bidMade = bidToClick.text;
        }
      } catch {
        console.log("Timed out waiting for our turn");
      }
    }

    // ---- Post-bid screenshot ----------------------------------------------
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: "/tmp/bergen-seed200-after-bid.png",
      fullPage: true,
    });

    const postBidText = await captureAllText(page);
    console.log("=== BERGEN RAISES post-bid body text ===");
    console.log(postBidText);

    const feedbackPanel = page.locator("[role='alert']");
    if (await feedbackPanel.isVisible()) {
      const feedbackText = await feedbackPanel.innerText();
      console.log("Feedback panel text:", feedbackText);
    } else {
      console.log("No feedback panel visible after bid");
    }

    // ---- Navigate back to home --------------------------------------------
    const backButton = page.getByTestId("back-to-menu");
    await backButton.click();
    await expect(page.locator("h1")).toHaveText("Bridge Practice", {
      timeout: 5000,
    });
    console.log("Successfully returned to home screen");
  });
});
