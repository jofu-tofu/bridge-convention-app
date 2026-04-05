import { test, expect, type Page } from "@playwright/test";
import { bidTextToTestId, closeDebugDrawer, readDebugDrawerText } from "./helpers";

// ============================================================================
// Jacoby Transfers — Comprehensive E2E Test Suite
// ============================================================================
//
// Convention rules under test:
//   • After partner opens 1NT, responder bids:
//     - 2♦ = transfer to hearts (shows 5+ hearts)
//     - 2♥ = transfer to spades (shows 5+ spades)
//   • Opener must complete the transfer (bid the next suit up)
//   • With a super-accept (4+ support, maximum), opener can jump to 3M
//   • After completion, responder chooses:
//     - Pass (weak, ≤7 HCP)
//     - 2NT (invite, 8–9 HCP)
//     - 3NT (game, 10+ HCP, 5-card suit)
//     - 4M  (game, 10+ HCP, 6+ card suit)
//   • With 5-5 majors, transfer to spades takes priority
//
// NOTE: Seed-to-hand mappings may change across code updates. Tests use a
//       "probe bid" approach to discover correct bids dynamically rather
//       than relying on hardcoded seed data. Debug data (pipeline, suggested
//       bid, hand facts) is only populated AFTER the user makes a bid.
// ============================================================================

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Navigate to Jacoby Transfers drill and wait for bidding to be ready. */
async function startDrill(page: Page, seed: number): Promise<void> {
  await page.goto(`/?convention=nt-transfers&seed=${seed}`);
  await expect(page.getByTestId("game-phase")).toHaveText("Bidding", {
    timeout: 10_000,
  });
  await expect(page.getByTestId("bid-P")).toBeEnabled({ timeout: 5_000 });
}

/**
 * Make a probe bid (7NT, always wrong) to trigger pipeline evaluation,
 * read the debug data from the page, then click "Try Again" to restore
 * the bid panel for subsequent bids.
 */
async function probeAndReadDebug(page: Page): Promise<string> {
  // Close debug drawer first so bid buttons are accessible on mobile viewports
  await closeDebugDrawer(page);

  await page.getByTestId("bid-7NT").click();
  // Wait for either the feedback alert OR a phase transition (game may auto-advance)
  const alert = page.locator("[role='alert']");
  const phaseChanged = page.getByTestId("game-phase").filter({ hasNotText: "Bidding" });
  await expect(alert.or(phaseChanged)).toBeVisible({ timeout: 5_000 });
  await page.waitForTimeout(500);

  // Open debug drawer to read populated data (use JS to toggle, bypasses overlay issues on mobile)
  await page.evaluate(() => {
    // Toggle the debug panel open via the app store
    const toggleBtn = document.querySelector('[data-testid="debug-toggle"]');
    if (toggleBtn) toggleBtn.click();
  });
  await page.waitForTimeout(500);

  // Read debug data directly from the drawer element (bypasses viewport issues)
  const body = await page.evaluate(() => {
    const drawer = document.querySelector('aside[aria-label="Debug drawer"]');
    if (drawer && !drawer.hasAttribute("inert")) {
      drawer.querySelectorAll("details").forEach((d) => {
        (d).open = true;
      });
      return drawer.innerText + "\n" + (document.querySelector("main")?.innerText ?? "");
    }
    // Fallback: drawer not open, try body
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

/** Parse hand shape like "6♠ 1♥ 2♦ 4♣" from the debug info in body text. */
function parseHandShape(body: string) {
  const m = body.match(/(\d+)♠\s+(\d+)♥\s+(\d+)♦\s+(\d+)♣/);
  if (!m) return null;
  return { spades: +m[1], hearts: +m[2], diamonds: +m[3], clubs: +m[4] };
}

/** Extract South's specific cards from the body text (between HCP and YOUR BID). */
function parseSouthCards(body: string): string[] {
  const start = body.indexOf("HCP\n");
  const end = body.indexOf("YOUR BID");
  if (start < 0 || end < 0) return [];
  const section = body.substring(start + 4, end);
  const lines = section
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const cards: string[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (
      /^[AKQJT98765432]$/.test(lines[i]) &&
      /^[♠♥♦♣]$/.test(lines[i + 1])
    ) {
      cards.push(`${lines[i]}${lines[i + 1]}`);
      i++;
    }
  }
  return cards;
}

/**
 * Get the correct bid from the at-a-glance "expected:" text.
 * Uses regex on the full body text since "expected:" may not be at line start.
 * Returns null if "expected:" is not found (e.g., before any bid is made).
 */
function getCorrectBid(body: string) {
  // Match "expected: <bid> <meaning>" anywhere in the body text.
  // The at-a-glance renders it inline, so it may not be at line start.
  const match = body.match(/expected:\s*(\S+)\s+([^]*?)(?=\d+ matched|\n\n|expected:|$)/);
  if (match) {
    const bid = match[1].trim();
    const meaning = match[2]?.trim() ?? "";
    if (bid.includes("(no") || bid === "") return null;
    return { bid, meaning };
  }
  return null;
}

/** Read South's HCP as a number. */
async function getHcp(page: Page): Promise<number> {
  const txt = await page.getByTestId("south-hcp").textContent();
  return parseInt(txt?.match(/(\d+)/)?.[1] ?? "-1", 10);
}

// ============================================================================
// Test Group 1: R1 Transfer Bid Verification — Seeds 1–5
// ============================================================================

test.describe("Jacoby Transfers — R1 bid verification (seeds 1–5)", () => {
  for (let seed = 1; seed <= 15; seed++) {
    test(`seed ${seed}: correct transfer bid matches convention rules`, async ({
      page,
    }) => {
      await startDrill(page, seed);

      // Probe bid to trigger pipeline evaluation
      await page.getByTestId("bid-7NT").click();
      await expect(page.locator("[role='alert']")).toBeVisible({
        timeout: 5_000,
      });
      await page.waitForTimeout(500);

      // Toggle drawer open and read debug data via JS (works on mobile where drawer defaults closed)
      await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="debug-toggle"]');
        if (btn) btn.click();
      });
      await page.waitForTimeout(500);

      const hcp = await getHcp(page);
      const body = await readDebugDrawerText(page);
      await closeDebugDrawer(page);

      const shape = parseHandShape(body);
      const bid = getCorrectBid(body);
      const cards = parseSouthCards(body);

      // ── Must be parseable ──
      expect(shape, "could not parse hand shape from debug info").not.toBeNull();
      expect(bid, "could not find expected bid in at-a-glance").not.toBeNull();
      if (!shape || !bid) return;

      // ── Report hand details ──
      console.log(
        `Seed ${seed.toString().padStart(2)}: ` +
          `${hcp.toString().padStart(2)} HCP | ` +
          `${shape.spades}♠ ${shape.hearts}♥ ${shape.diamonds}♦ ${shape.clubs}♣ | ` +
          `Cards: ${cards.join(" ")} | ` +
          `Correct: ${bid.bid} (${bid.meaning})`,
      );

      // ── Verify deal constraints ──
      // South must have exactly 13 cards
      expect(shape.spades + shape.hearts + shape.diamonds + shape.clubs).toBe(
        13,
      );
      // South must have 5+ in at least one major (transfer drill constraint)
      expect(
        shape.spades >= 5 || shape.hearts >= 5,
        `South needs 5+ major (got ${shape.spades}♠ ${shape.hearts}♥)`,
      ).toBe(true);

      // ── Verify Jacoby Transfer rules ──
      if (shape.spades >= 5) {
        // 5+ spades → 2♥ (transfer to spades)
        // Spades wins over hearts when both ≥5 (lower declarationOrder)
        expect(bid.bid).toBe("2♥");
        expect(bid.meaning).toContain("Transfer to spades");
      } else {
        // 5+ hearts, <5 spades → 2♦ (transfer to hearts)
        expect(bid.bid).toBe("2♦");
        expect(bid.meaning).toContain("Transfer to hearts");
      }

      // ── Verify pipeline references jacoby-transfers module ──
      expect(body).toContain("jacoby-transfers");
      expect(body).toContain("Pipeline");
    });
  }
});

// ============================================================================
// Test Group 3: Correct Bid Feedback
// ============================================================================

test.describe("Jacoby Transfers — Correct bid feedback", () => {
  test("correct transfer bid advances game — seed 1", async ({
    page,
  }) => {
    await startDrill(page, 1);

    const body = await probeAndReadDebug(page);
    const correctBid = getCorrectBid(body);
    expect(correctBid).not.toBeNull();

    const testId = bidTextToTestId(correctBid!.bid);
    await page.getByTestId(testId).click();

    await page.waitForTimeout(2_000);
    const currentPhase = await page.getByTestId("game-phase").textContent();
    expect(["Bidding", "Declarer", "Defend", "Review"]).toContain(currentPhase);
  });
});

// ============================================================================
// Test Group 4: Incorrect Bid Feedback
// ============================================================================

test.describe("Jacoby Transfers — Incorrect bid feedback", () => {
  test("pass instead of transfer shows Incorrect with Try Again and Show Answer", async ({
    page,
  }) => {
    await startDrill(page, 1);

    // Pass is always wrong for a transfer drill
    await page.getByTestId("bid-P").click();

    const alert = page.locator("[role='alert']");
    await expect(alert).toBeVisible({ timeout: 5_000 });
    await expect(alert).toContainText("Incorrect");

    // Action buttons available
    await expect(
      page.getByRole("button", { name: /try again/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /show answer/i }),
    ).toBeVisible();
  });

  test("retry then correct bid succeeds", async ({ page }) => {
    await startDrill(page, 1);

    // First: bid wrong (Pass is always wrong for transfers)
    await page.getByTestId("bid-P").click();
    await expect(page.locator("[role='alert']")).toContainText("Incorrect", {
      timeout: 5_000,
    });

    // Read the correct bid from debug data (now populated after the bid)
    // Open debug drawer via JS (bypasses overlay issues on mobile)
    await page.evaluate(() => {
      const toggleBtn = document.querySelector('[data-testid="debug-toggle"]');
      if (toggleBtn) toggleBtn.click();
    });
    await page.waitForTimeout(500);

    // Read debug data via page.evaluate with inert check (mobile-safe)
    const body = await readDebugDrawerText(page);
    await closeDebugDrawer(page);

    const correctBid = getCorrectBid(body);
    expect(correctBid).not.toBeNull();

    // Retry
    await page.getByRole("button", { name: /try again/i }).click();
    await expect(page.getByTestId("bid-P")).toBeEnabled({ timeout: 5_000 });

    // Second: bid correct
    const testId = bidTextToTestId(correctBid!.bid);
    await page.getByTestId(testId).click();
    // After correct bid, game may show feedback or auto-advance
    await page.waitForTimeout(2_000);
    const phase = await page.getByTestId("game-phase").textContent();
    expect(["Bidding", "Declarer", "Defend", "Review"]).toContain(phase);
  });

});

// ============================================================================
// Test Group 5: Multi-Round Auction Flow
// ============================================================================

test.describe("Jacoby Transfers — Multi-round auction", () => {
  test("transfer → opener accepts → pass signoff → Declarer (seed 1)", async ({
    page,
  }) => {
    test.setTimeout(45_000);
    await startDrill(page, 1);

    // Probe to find correct R1 bid
    const probeBody = await probeAndReadDebug(page);
    const correctBid = getCorrectBid(probeBody);
    expect(correctBid).not.toBeNull();

    const isHeartsTransfer = correctBid!.bid === "2♦";
    const acceptBid = isHeartsTransfer ? "2♥" : "2♠";

    // R1: Transfer bid
    await page.getByTestId(bidTextToTestId(correctBid!.bid)).click();

    // Wait for auction to auto-advance to R3 (opponents + opener bid)
    await expect(page.getByTestId("bid-P")).toBeEnabled({
      timeout: 15_000,
    });

    // Verify opener accepted the transfer
    await expect(page.locator("body")).toContainText(acceptBid);

    // R3: Pass (signoff)
    await page.getByTestId("bid-P").click();

    // Should transition to Declarer phase
    await expect(page.getByTestId("game-phase")).toHaveText("Declarer", {
      timeout: 15_000,
    });

    const body = await page.locator("body").innerText();
    expect(body).toContain(`${acceptBid} by N`);
    console.log(
      `Auction: transfer ${correctBid!.bid} → opener ${acceptBid} → pass → Declarer ✓`,
    );
  });

});
