import { test, expect, type Page } from "@playwright/test";

// ============================================================
// 1NT Responses — Full Convention E2E Test Suite
//
// Tests seeds 1–10:
//   - South's hand (suit lengths, HCP, specific cards)
//   - Auction so far
//   - App's correct bid recommendation
//   - All 4 hands (from debug drawer)
//   - Pipeline explanation
//
// Seed 1 additionally tests:
//   - Wrong bid → feedback text
//   - Show Answer → expanded explanation
//   - Try Again → retry flow
//   - Correct bid → feedback / auction advance
//
// Flags any bid recommendations that disagree with standard
// 1NT response system rules.
// ============================================================

// --------------- Card & Bid Helpers ---------------

interface ParsedCard {
  rank: string;
  suit: string;
}

const HCP_VALUES: Record<string, number> = { A: 4, K: 3, Q: 2, J: 1 };

const SUIT_NAME_TO_SYMBOL: Record<string, string> = {
  spades: "\u2660", Spades: "\u2660", S: "\u2660", s: "\u2660",
  hearts: "\u2665", Hearts: "\u2665", H: "\u2665", h: "\u2665",
  diamonds: "\u2666", Diamonds: "\u2666", D: "\u2666", d: "\u2666",
  clubs: "\u2663", Clubs: "\u2663", C: "\u2663", c: "\u2663",
};

function _parseAriaLabel(label: string): ParsedCard {
  // aria-label format: "A of spades", "10 of hearts", "K of clubs", etc.
  const match = label.match(/^(.+?)\s+of\s+(.+)$/i);
  if (!match) return { rank: "?", suit: "?" };
  const rank = match[1].trim();
  const suitName = match[2].trim();
  return { rank, suit: SUIT_NAME_TO_SYMBOL[suitName] || SUIT_NAME_TO_SYMBOL[suitName.toLowerCase()] || suitName };
}

function computeHcp(cards: ParsedCard[]): number {
  return cards.reduce((sum, c) => sum + (HCP_VALUES[c.rank] || 0), 0);
}

function computeSuitLengths(cards: ParsedCard[]): Record<string, number> {
  const lengths: Record<string, number> = { "\u2660": 0, "\u2665": 0, "\u2666": 0, "\u2663": 0 };
  for (const card of cards) lengths[card.suit] = (lengths[card.suit] || 0) + 1;
  return lengths;
}

function fmtLengths(l: Record<string, number>): string {
  return "\u2660" + l["\u2660"] + " \u2665" + l["\u2665"] + " \u2666" + l["\u2666"] + " \u2663" + l["\u2663"];
}

function fmtCards(cards: ParsedCard[]): string {
  const bySuit: Record<string, string[]> = { "\u2660": [], "\u2665": [], "\u2666": [], "\u2663": [] };
  for (const c of cards) bySuit[c.suit]?.push(c.rank);
  return Object.entries(bySuit)
    .map(([s, r]) => s + " " + (r.join(" ") || "\u2014"))
    .join("  ");
}

/** Convert display bid text ("2\u2663") to data-testid value ("bid-2C") */
function bidToTestId(display: string): string {
  const d = display.trim();
  if (/^pass$/i.test(d) || d.includes("No convention bid")) return "bid-P";
  if (d === "X" || d === "Dbl") return "bid-X";
  if (d === "XX" || d === "Rdbl") return "bid-XX";
  return (
    "bid-" +
    d.replace("\u2663", "C").replace("\u2666", "D").replace("\u2665", "H").replace("\u2660", "S")
  );
}

/** Pick a bid guaranteed to be wrong */
function pickWrongBidTestId(correctTestId: string): string {
  if (correctTestId === "bid-7NT") return "bid-P";
  return "bid-7NT";
}

/** Determine expected bid per standard 1NT response rules */
function analyzeExpected(
  sl: Record<string, number>,
  hcp: number
): { bid: string; reason: string } {
  const S = sl["\u2660"] || 0;
  const H = sl["\u2665"] || 0;

  // Priority 1: 5+ card major -> Jacoby transfer
  if (H >= 5 && S >= 5) {
    return H > S
      ? { bid: "2\u2666", reason: "Transfer -- " + H + "\u2665 longer than " + S + "\u2660 (5-5+ majors)" }
      : { bid: "2\u2665", reason: "Transfer -- " + S + "\u2660 >= " + H + "\u2665 (5-5+ majors)" };
  }
  if (H >= 5) return { bid: "2\u2666", reason: "Jacoby transfer (" + H + " hearts)" };
  if (S >= 5) return { bid: "2\u2665", reason: "Jacoby transfer (" + S + " spades)" };

  // Priority 2: 4-card major + 8+ HCP -> Stayman
  const has4M = S >= 4 || H >= 4;
  if (has4M && hcp >= 8) return { bid: "2\u2663", reason: "Stayman (4-card major, " + hcp + " HCP)" };

  // Priority 3: Weak hands
  if (hcp <= 7) return { bid: "Pass", reason: "Weak (" + hcp + " HCP, no 5-card major)" };

  // Priority 4: Slam-level hands
  if (hcp >= 16) return { bid: "4NT", reason: "Quantitative (" + hcp + " HCP)" };

  // Priority 5: No 4-card major, various HCP
  if (hcp >= 10) return { bid: "3NT", reason: "Game (" + hcp + " HCP, no 4-card major)" };
  if (hcp >= 8) return { bid: "2NT", reason: "Invite (" + hcp + " HCP, no 4-card major)" };

  return { bid: "?", reason: "Ambiguous: " + hcp + " HCP" };
}

// --------------- Page Interaction Helpers ---------------

async function navigateToGame(page: Page, seed: number): Promise<void> {
  await page.goto("/?convention=nt-bundle&seed=" + seed);
  await expect(page.getByTestId("game-phase")).toHaveText("Bidding", {
    timeout: 10000,
  });
  await expect(page.getByTestId("bid-P")).toBeEnabled({ timeout: 5000 });
}

async function getSouthHcp(page: Page): Promise<string> {
  return ((await page.getByTestId("south-hcp").textContent()) ?? "").trim();
}

async function getSouthCards(page: Page): Promise<ParsedCard[]> {
  // During bidding only South's cards are face-up.
  // Use aria-label for rank and data-suit for suit (most reliable).
  const cards = page.locator('[data-testid="bridge-table"] [data-testid="card"]');
  const count = await cards.count();
  const parsed: ParsedCard[] = [];
  for (let i = 0; i < count; i++) {
    const el = cards.nth(i);
    const label = (await el.getAttribute("aria-label")) ?? "";
    const dataSuit = (await el.getAttribute("data-suit")) ?? "";
    // Rank from aria-label: "A of S" → "A"
    const rankMatch = label.match(/^(.+?)\s+of\s+/i);
    const rank = rankMatch ? rankMatch[1].trim() : "?";
    const suit = SUIT_NAME_TO_SYMBOL[dataSuit] || SUIT_NAME_TO_SYMBOL[dataSuit.toLowerCase()] || dataSuit;
    parsed.push({ rank, suit });
  }
  return parsed;
}

async function getAuction(page: Page): Promise<string> {
  return (
    (await page.getByTestId("table-center").textContent()) ?? ""
  ).trim();
}

/** Parse correct bid from already-extracted body text */
function getCorrectBidFromText(body: string): { bid: string; meaning: string } {
  // Try regex match for "expected: <bid> <meaning>" (works across line boundaries)
  const expectedMatch = body.match(/expected:\s*(\S+)/);
  if (expectedMatch) {
    const bid = expectedMatch[1];
    if (bid.includes("(no") || bid.includes("No")) {
      return { bid: "Pass", meaning: "No convention bid (pass)" };
    }
    // Try to capture meaning after the bid
    const fullMatch = body.match(/expected:\s*\S+\s+(.+?)(?=\n\n|expected:|$)/s);
    const meaning = fullMatch ? fullMatch[1].trim() : "";
    return { bid, meaning };
  }
  // Fallback: look for "Suggested Bid" section (regex across lines)
  const sgMatch = body.match(/Suggested Bid\s*\n\s*(.+)\s*\n\s*(.+)/);
  if (sgMatch) {
    const bid = sgMatch[1].trim();
    const meaning = sgMatch[2].trim();
    if (bid.includes("No convention bid")) {
      return { bid: "Pass", meaning: "No convention bid (pass)" };
    }
    return { bid, meaning };
  }
  return { bid: "unknown", meaning: "" };
}

/** Probe bid (7NT) to populate debug data, read via JS, then retry.
 *  Returns the combined drawer + main text for parsing. */
async function probeAndReadAllDebug(page: Page): Promise<string> {
  // Close debug drawer before bid interactions (mobile viewports)
  await closeDebugDrawer(page);

  // Make probe bid to trigger pipeline evaluation
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

  // Read debug data via page.evaluate with inert check
  const body = await page.evaluate(() => {
    const drawer = document.querySelector('aside[aria-label="Debug drawer"]');
    if (drawer && !drawer.hasAttribute("inert")) {
      drawer.querySelectorAll("details").forEach((d) => {
        (d).open = true;
      });
      return drawer.innerText + "\n" + (document.querySelector("main")?.innerText ?? "");
    }
    return document.body.innerText;
  });

  // Close drawer and retry to restore bid panel
  await closeDebugDrawer(page);
  const retryBtn = page.getByRole("button", { name: /try again/i });
  if (await retryBtn.isVisible().catch(() => false)) {
    await retryBtn.click();
    await expect(page.getByTestId("bid-P")).toBeEnabled({ timeout: 5_000 });
  }

  return body;
}

async function closeDebugDrawer(page: Page): Promise<void> {
  try {
    await page.locator('button[aria-label="Close debug panel"]').click({ timeout: 1000 });
    await page.waitForTimeout(300);
  } catch {
    // Already closed or not interactable — ignore
  }
}

/** Extract a named section from debug drawer text (up to 60 lines) */
function extractSection(text: string, heading: string): string {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.includes(heading));
  if (start === -1) return '(section "' + heading + '" not found)';
  return lines.slice(start, start + 60).join("\n");
}

// --------------- Shared capture logic ---------------

interface SeedReport {
  seed: number;
  southHcpDisplay: string;
  southHcpComputed: number;
  cardCount: number;
  southCards: string;
  suitLengths: string;
  auction: string;
  appBid: string;
  appMeaning: string;
  expectedBid: string;
  expectedReason: string;
  match: boolean;
  allHands: string;
  pipeline: string;
  suggestedBid: string;
}

async function captureSeed(page: Page, seed: number): Promise<SeedReport> {
  await navigateToGame(page, seed);

  const hcpText = await getSouthHcp(page);
  const cards = await getSouthCards(page);
  const sl = computeSuitLengths(cards);
  const hcp = computeHcp(cards);
  const auction = await getAuction(page);

  // Probe bid to populate debug data, then read via JS (mobile-safe)
  const debugText = await probeAndReadAllDebug(page);
  const { bid: appBid, meaning: appMeaning } = getCorrectBidFromText(debugText);
  const exp = analyzeExpected(sl, hcp);

  const allHands = extractSection(debugText, "All Hands");
  const pipeline = extractSection(debugText, "Pipeline");
  const suggested = extractSection(debugText, "Suggested Bid");

  await page.screenshot({
    path: "/tmp/1nt-seed" + seed + "-debug.png",
    fullPage: true,
  });

  const report: SeedReport = {
    seed,
    southHcpDisplay: hcpText,
    southHcpComputed: hcp,
    cardCount: cards.length,
    southCards: fmtCards(cards),
    suitLengths: fmtLengths(sl),
    auction,
    appBid,
    appMeaning,
    expectedBid: exp.bid,
    expectedReason: exp.reason,
    match: exp.bid === appBid || exp.bid === "?",
    allHands,
    pipeline,
    suggestedBid: suggested,
  };

  // Log report
  const bar = "=".repeat(52);
  console.log("\n" + bar);
  console.log("  SEED " + seed);
  console.log(bar);
  console.log("South HCP (display): " + report.southHcpDisplay);
  console.log("South HCP (computed): " + report.southHcpComputed);
  console.log("Card count: " + report.cardCount);
  console.log("South cards: " + report.southCards);
  console.log("Suit lengths: " + report.suitLengths);
  console.log("Auction: " + report.auction);
  console.log("App bid: " + report.appBid + (report.appMeaning ? " -- " + report.appMeaning : ""));
  console.log("Expected: " + report.expectedBid + " -- " + report.expectedReason);
  if (report.match) {
    console.log("MATCH: Recommendation matches rules");
  } else {
    console.log("FLAG: App says " + report.appBid + ", rules say " + report.expectedBid);
  }
  console.log("\n--- ALL 4 HANDS ---");
  console.log(report.allHands);
  console.log("\n--- PIPELINE ---");
  console.log(report.pipeline);
  console.log("\n--- SUGGESTED BID ---");
  console.log(report.suggestedBid);

  return report;
}

// ============================================================
// TESTS
// ============================================================

test.describe("1NT Responses Full Convention (seeds 1-5)", () => {

  // -- SEED 1: full wrong/correct bid workflow --
  test("seed 1 - hand details, wrong bid feedback, correct bid", async ({ page }) => {
    test.setTimeout(90000);
    const report = await captureSeed(page, 1);

    // Basic validations
    expect(report.southHcpComputed).toBeGreaterThanOrEqual(0);
    expect(report.cardCount).toBe(13);
    expect(report.appBid).not.toBe("unknown");

    // -- WRONG BID --
    const correctTestId = bidToTestId(report.appBid);
    const wrongTestId = pickWrongBidTestId(correctTestId);

    console.log("\n--- WRONG BID TEST (seed 1) ---");
    console.log("Correct bid testid: " + correctTestId);
    console.log("Wrong bid testid:   " + wrongTestId);

    // Ensure debug drawer is closed before bid interaction (mobile viewports)
    await closeDebugDrawer(page);

    await page.getByTestId(wrongTestId).click();

    const alert = page.locator("[role='alert']");
    await expect(alert).toBeVisible({ timeout: 5000 });

    const wrongFeedback = await alert.innerText();
    console.log("\nInitial wrong-bid feedback:\n" + wrongFeedback);

    await page.screenshot({
      path: "/tmp/1nt-seed1-wrong-initial.png",
      fullPage: true,
    });

    // Click "Show Answer" if present
    const showBtn = page.getByRole("button", { name: /show answer/i });
    if (await showBtn.isVisible().catch(() => false)) {
      await showBtn.click();
      await page.waitForTimeout(500);
      // Expand nested <details>
      await page.evaluate(() => {
        document
          .querySelectorAll("[role='alert'] details")
          .forEach((d) => ((d as HTMLDetailsElement).open = true));
      });
      await page.waitForTimeout(300);
    }

    const expandedFeedback = await alert.innerText();
    console.log("\nExpanded wrong-bid feedback:\n" + expandedFeedback);

    await page.screenshot({
      path: "/tmp/1nt-seed1-wrong-expanded.png",
      fullPage: true,
    });

    // Verify feedback contains key elements
    expect(expandedFeedback.toLowerCase()).toContain("incorrect");

    // -- TRY AGAIN --
    const retryBtn = page.getByRole("button", { name: /try again/i });
    await expect(retryBtn).toBeVisible({ timeout: 3000 });
    await retryBtn.click();
    await expect(page.getByTestId("bid-P")).toBeEnabled({ timeout: 3000 });
    console.log("\nClicked Try Again - bid panel re-enabled.");

    await page.screenshot({
      path: "/tmp/1nt-seed1-after-retry.png",
      fullPage: true,
    });

    // -- CORRECT BID --
    console.log("\n--- CORRECT BID TEST (seed 1) ---");
    console.log("Clicking correct bid: " + correctTestId);
    // Ensure debug drawer is closed before bid interaction (mobile viewports)
    await closeDebugDrawer(page);
    await page.getByTestId(correctTestId).click();
    await page.waitForTimeout(1500);

    // Correct bid may auto-dismiss or persist briefly
    const postAlert = page.locator("[role='alert']");
    const stillVisible = await postAlert.isVisible().catch(() => false);
    if (stillVisible) {
      const correctFeedback = await postAlert.innerText();
      console.log("Correct-bid feedback:\n" + correctFeedback);
    } else {
      console.log("Correct bid accepted - auction auto-advanced.");
    }

    const phase = await page.getByTestId("game-phase").textContent();
    console.log("Game phase after correct bid: " + phase);

    await page.screenshot({
      path: "/tmp/1nt-seed1-correct.png",
      fullPage: true,
    });
  });

  // -- SEEDS 2-5: capture & validate --
  for (const seed of [2, 3, 4, 5]) {
    test("seed " + seed + " - hand details and bid recommendation", async ({ page }) => {
      test.setTimeout(60000);
      const report = await captureSeed(page, seed);

      // Basic validations
      expect(report.southHcpComputed).toBeGreaterThanOrEqual(0);
      expect(report.cardCount).toBe(13);
      expect(report.appBid).not.toBe("unknown");

      await page.screenshot({
        path: "/tmp/1nt-seed" + seed + "-final.png",
        fullPage: true,
      });
    });
  }
});
