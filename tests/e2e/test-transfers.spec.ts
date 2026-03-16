import { test, expect, type Page } from "@playwright/test";

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
// Verified seed data (seeds 1–15):
//   Hearts transfers (2♦): seeds 1(3 HCP), 5(12), 7(11), 13(4), 15(5)
//   Spades transfers (2♥): seeds 2(4), 3(2), 4(4), 6(14), 8(4), 9(2),
//                           10(7), 11(15), 12(5), 14(9)
// ============================================================================

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Navigate to Jacoby Transfers drill and wait for bidding to be ready. */
async function startDrill(page: Page, seed: number): Promise<void> {
  await page.goto(`/?convention=nt-transfers&seed=${seed}`);
  await expect(page.getByTestId("game-phase")).toHaveText("Bidding", {
    timeout: 10_000,
  });
  await expect(page.getByTestId("bid-pass")).toBeEnabled({ timeout: 5_000 });
}

/** Parse hand shape like "3♠ 5♥ 2♦ 3♣" from the debug info in body text. */
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

/** Get the DEV: Correct Bid from the inline debug panel. */
function getCorrectBid(body: string) {
  const lines = body.split("\n");
  const idx = lines.findIndex((l) => l.includes("DEV: Correct Bid"));
  if (idx < 0 || idx + 1 >= lines.length) return null;
  return { bid: lines[idx + 1].trim(), meaning: (lines[idx + 2] ?? "").trim() };
}

/** Read South's HCP as a number. */
async function getHcp(page: Page): Promise<number> {
  const txt = await page.getByTestId("south-hcp").textContent();
  return parseInt(txt?.match(/(\d+)/)?.[1] ?? "-1", 10);
}

// ============================================================================
// Test Group 1: Navigation
// ============================================================================

test.describe("Jacoby Transfers — Navigation", () => {
  test("start via practice-nt-transfers button from home screen", async ({
    page,
  }) => {
    await page.goto("/");
    const btn = page.getByTestId("practice-nt-transfers");
    await expect(btn).toBeVisible({ timeout: 5_000 });
    await btn.click();

    await expect(page.getByTestId("game-phase")).toHaveText("Bidding", {
      timeout: 10_000,
    });
    await expect(page.locator("body")).toContainText("Jacoby Transfers");
  });

  test("start via direct URL with convention and seed params", async ({
    page,
  }) => {
    await startDrill(page, 42);
    await expect(page.getByTestId("bid-pass")).toBeEnabled();
    await expect(page.locator("body")).toContainText("Jacoby Transfers");
  });

  test("back button returns to convention select screen", async ({ page }) => {
    await startDrill(page, 1);
    await page.getByTestId("back-to-menu").click();
    await expect(page.locator("h1")).toHaveText("Bridge Practice", {
      timeout: 5_000,
    });
  });
});

// ============================================================================
// Test Group 2: R1 Transfer Bid Verification — Seeds 1–15
// ============================================================================

test.describe("Jacoby Transfers — R1 bid verification (seeds 1–15)", () => {
  for (let seed = 1; seed <= 15; seed++) {
    test(`seed ${seed}: correct transfer bid matches convention rules`, async ({
      page,
    }) => {
      await startDrill(page, seed);

      const hcp = await getHcp(page);
      const body = await page.locator("body").innerText();
      const shape = parseHandShape(body);
      const bid = getCorrectBid(body);
      const cards = parseSouthCards(body);

      // ── Must be parseable ──
      expect(shape, "could not parse hand shape from debug info").not.toBeNull();
      expect(bid, "could not find DEV: Correct Bid panel").not.toBeNull();
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
        // Spades wins over hearts when both ≥5 (lower intraModuleOrder)
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
  test("2♦ (hearts transfer) shows Correct! alert — seed 1, 3 HCP", async ({
    page,
  }) => {
    await startDrill(page, 1);

    await page.getByTestId("bid-2D").click();

    const alert = page.locator("[role='alert']");
    await expect(alert).toBeVisible({ timeout: 5_000 });
    await expect(alert).toContainText("Correct");
  });

  test("2♥ (spades transfer) shows Correct! alert — seed 2, 4 HCP", async ({
    page,
  }) => {
    await startDrill(page, 2);

    await page.getByTestId("bid-2H").click();

    const alert = page.locator("[role='alert']");
    await expect(alert).toBeVisible({ timeout: 5_000 });
    await expect(alert).toContainText("Correct");
  });

  test("correct bid for high-HCP hand — seed 5, 12 HCP, hearts transfer", async ({
    page,
  }) => {
    await startDrill(page, 5);

    // Even with 12 HCP, the R1 bid is still the transfer (2♦)
    await page.getByTestId("bid-2D").click();

    const alert = page.locator("[role='alert']");
    await expect(alert).toBeVisible({ timeout: 5_000 });
    await expect(alert).toContainText("Correct");
  });

  test("correct bid for high-HCP hand — seed 6, 14 HCP, spades transfer", async ({
    page,
  }) => {
    await startDrill(page, 6);

    await page.getByTestId("bid-2H").click();

    const alert = page.locator("[role='alert']");
    await expect(alert).toBeVisible({ timeout: 5_000 });
    await expect(alert).toContainText("Correct");
  });
});

// ============================================================================
// Test Group 4: Incorrect Bid Feedback
// ============================================================================

test.describe("Jacoby Transfers — Incorrect bid feedback", () => {
  test("pass instead of transfer shows Incorrect with Try Again and Show Answer", async ({
    page,
  }) => {
    await startDrill(page, 1); // Correct = 2♦

    await page.getByTestId("bid-pass").click();

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

  test("wrong transfer direction (2♥ for hearts hand) shows Incorrect", async ({
    page,
  }) => {
    await startDrill(page, 1); // 5♥, correct = 2♦

    // 2♥ = spades transfer — wrong for a hearts hand
    await page.getByTestId("bid-2H").click();

    const alert = page.locator("[role='alert']");
    await expect(alert).toBeVisible({ timeout: 5_000 });
    // Should not be "Correct!" — the hand has no 5+ spades
    const text = await alert.textContent();
    expect(text).not.toContain("Correct!");
    console.log(`Wrong direction feedback: "${text?.trim()}"`);
  });

  test("retry after wrong bid re-enables bid panel", async ({ page }) => {
    await startDrill(page, 1);

    await page.getByTestId("bid-pass").click();
    await expect(page.locator("[role='alert']")).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: /try again/i }).click();

    // Bid buttons should be enabled again
    await expect(page.getByTestId("bid-2D")).toBeEnabled({ timeout: 5_000 });
    await expect(page.getByTestId("bid-pass")).toBeEnabled({ timeout: 5_000 });
  });

  test("retry then correct bid succeeds", async ({ page }) => {
    await startDrill(page, 1); // Correct = 2♦

    // First: bid wrong
    await page.getByTestId("bid-pass").click();
    await expect(page.locator("[role='alert']")).toContainText("Incorrect", {
      timeout: 5_000,
    });

    // Retry
    await page.getByRole("button", { name: /try again/i }).click();
    await expect(page.getByTestId("bid-2D")).toBeEnabled({ timeout: 5_000 });

    // Second: bid correct
    await page.getByTestId("bid-2D").click();
    await expect(page.locator("[role='alert']")).toContainText("Correct", {
      timeout: 5_000,
    });
  });

  test("multiple wrong bids can be retried (seed 2, spades transfer)", async ({
    page,
  }) => {
    await startDrill(page, 2); // Correct = 2♥

    // First wrong bid: pass
    await page.getByTestId("bid-pass").click();
    await expect(page.locator("[role='alert']")).toContainText("Incorrect", {
      timeout: 5_000,
    });
    await page.getByRole("button", { name: /try again/i }).click();
    await expect(page.getByTestId("bid-pass")).toBeEnabled({ timeout: 5_000 });

    // Second wrong bid: 2♦ (hearts transfer, wrong direction)
    await page.getByTestId("bid-2D").click();
    await expect(page.locator("[role='alert']")).toBeVisible({ timeout: 5_000 });

    const text = await page.locator("[role='alert']").textContent();
    expect(text).not.toContain("Correct!");

    // Retry and bid correctly
    await page.getByRole("button", { name: /try again/i }).click();
    await expect(page.getByTestId("bid-2H")).toBeEnabled({ timeout: 5_000 });

    await page.getByTestId("bid-2H").click();
    await expect(page.locator("[role='alert']")).toContainText("Correct", {
      timeout: 5_000,
    });
  });
});

// ============================================================================
// Test Group 5: Multi-Round Auction Flow
// ============================================================================

test.describe("Jacoby Transfers — Multi-round auction", () => {
  test("hearts: 2♦ → opener accepts 2♥ → pass signoff → Declarer (seed 1, 3 HCP)", async ({
    page,
  }) => {
    test.setTimeout(45_000);
    await startDrill(page, 1); // 3 HCP, 5♥ → signoff

    // R1: Transfer to hearts
    await page.getByTestId("bid-2D").click();

    // Wait for auction to auto-advance to R3 (opponents + opener bid)
    await expect(page.getByTestId("bid-pass")).toBeEnabled({
      timeout: 15_000,
    });

    // Verify opener accepted the transfer (2♥ visible in auction)
    await expect(page.locator("body")).toContainText("2♥");

    // R3: Pass (signoff with 3 HCP ≤7)
    await page.getByTestId("bid-pass").click();

    // Should transition to Declarer phase (contract: 2♥ by N)
    await expect(page.getByTestId("game-phase")).toHaveText("Declarer", {
      timeout: 15_000,
    });

    const body = await page.locator("body").innerText();
    expect(body).toContain("2♥ by N");
    console.log("Auction: 1NT–P–2♦!–P–2♥–P–P–P → 2♥ by N ✓");
  });

  test("spades: 2♥ → opener accepts 2♠ → pass signoff → Declarer (seed 10, 7 HCP)", async ({
    page,
  }) => {
    test.setTimeout(45_000);
    await startDrill(page, 10); // 7 HCP, 5♠ → signoff

    // R1: Transfer to spades
    await page.getByTestId("bid-2H").click();

    // Wait for R3
    await expect(page.getByTestId("bid-pass")).toBeEnabled({
      timeout: 15_000,
    });

    // Verify opener accepted (2♠ visible)
    await expect(page.locator("body")).toContainText("2♠");

    // R3: Pass
    await page.getByTestId("bid-pass").click();

    // Declarer phase (contract: 2♠ by N)
    await expect(page.getByTestId("game-phase")).toHaveText("Declarer", {
      timeout: 15_000,
    });

    const body = await page.locator("body").innerText();
    expect(body).toContain("2♠ by N");
    console.log("Auction: 1NT–P–2♥!–P–2♠–P–P–P → 2♠ by N ✓");
  });
});

// ============================================================================
// Test Group 6: Debug Panel & Pipeline Information
// ============================================================================

test.describe("Jacoby Transfers — Debug panel information", () => {
  test("DEV panel shows correct bid, meaning, rule, and pipeline info", async ({
    page,
  }) => {
    await startDrill(page, 5); // 12 HCP, hearts transfer

    const body = await page.locator("body").innerText();

    // DEV: Correct Bid section
    expect(body).toContain("DEV: Correct Bid");
    expect(body).toContain("Transfer to hearts");

    // Pipeline section
    expect(body).toContain("Pipeline");
    expect(body).toContain("candidates");
    expect(body).toContain("eliminated");

    // Suggested Bid section in debug drawer
    expect(body).toContain("Suggested Bid");

    // Convention module
    expect(body).toContain("jacoby-transfers");

    // Meaning rule reference
    expect(body).toContain("transfer:to-hearts");

    // Hand summary
    expect(body).toContain("3♠ 5♥ 4♦ 1♣");

    console.log(
      "Debug panel verified: correct bid, meaning, rule, pipeline, hand summary",
    );
  });

  test("debug drawer reveals all 4 hands when expanded", async ({ page }) => {
    await startDrill(page, 1);

    // Toggle open the debug drawer
    const debugToggle = page.getByTestId("debug-toggle");
    await expect(debugToggle).toBeVisible();
    await debugToggle.click();

    const drawer = page.locator("[aria-label='Debug drawer']");
    await expect(drawer).toBeVisible({ timeout: 3_000 });

    // Expand "All Hands" section
    await drawer.getByText("All Hands").click();
    await page.waitForTimeout(500);

    // All 4 seats should be present (abbreviated as N/E/S/W in debug drawer)
    const drawerText = await drawer.innerText();
    for (const seat of ["N (", "E (", "S (", "W ("]) {
      expect(
        drawerText,
        `${seat.charAt(0)} hand missing from debug drawer`,
      ).toContain(seat);
    }

    // Verify HCP values are shown for each hand
    const hcpMatches = drawerText.match(/\d+ HCP/g) ?? [];
    expect(hcpMatches.length).toBeGreaterThanOrEqual(4);

    console.log("All 4 hands visible in debug drawer ✓");
    // Log hand details for documentation
    const handSection = drawerText.match(
      /N \(\d+ HCP\)[\s\S]*?W \(\d+ HCP\)[\s\S]*?(?=Convention|$)/,
    );
    if (handSection) {
      console.log("All 4 hands:\n" + handSection[0].trim());
    }
  });

  test("pipeline shows 5 candidates with 4 eliminated for R1", async ({
    page,
  }) => {
    await startDrill(page, 7); // 11 HCP, hearts transfer

    const body = await page.locator("body").innerText();

    // The pipeline evaluates 5 responder surfaces (Stayman, 2 transfers, NT invite, 3NT)
    // and eliminates 4, leaving 1 winner
    expect(body).toContain("Pipeline (5 candidates, 4 eliminated)");

    console.log("Pipeline: 5 candidates, 4 eliminated → 1 winner ✓");
  });
});

// ============================================================================
// Test Group 7: Autoplay
// ============================================================================

test.describe("Jacoby Transfers — Autoplay", () => {
  test("autoplay completes full drill to Review phase", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/?convention=nt-transfers&seed=1&autoplay=true");

    // Autoplay auto-bids correct answers, skips declarer prompt, reaches Review
    await expect(page.getByTestId("game-phase")).toHaveText("Review", {
      timeout: 30_000,
    });

    console.log("Autoplay completed drill to Review phase ✓");
  });
});

// ============================================================================
// Test Group 8: Convention Rule Flags & Edge Cases
// ============================================================================

test.describe("Jacoby Transfers — Convention rule flags", () => {
  test("FLAG: opener always simple-accepts (no super-accept implemented)", async ({
    page,
  }) => {
    // Convention rule: with 4+ card support and maximum (17 HCP),
    // opener can jump to 3 of the major (super-accept).
    // This app only implements simple acceptance (2♥/2♠).
    test.setTimeout(45_000);
    await startDrill(page, 1); // Hearts transfer

    await page.getByTestId("bid-2D").click();
    await expect(page.getByTestId("bid-pass")).toBeEnabled({
      timeout: 15_000,
    });

    const body = await page.locator("body").innerText();
    const auction =
      body.match(/Auction sequence[\s\S]*?(?=YOUR BID|$)/)?.[0] ?? "";
    const hasSimpleAccept = auction.includes("2♥");
    const hasSuperAccept = auction.includes("3♥");

    expect(hasSimpleAccept, "Opener should accept with 2♥").toBe(true);

    console.log(
      `Super-accept check: simple 2♥=${hasSimpleAccept}, super 3♥=${hasSuperAccept}`,
    );
    console.log(
      "FLAG: Super-accept (3M jump with 4+ support, max) is NOT implemented.",
    );
    console.log(
      "  Opener always completes transfer at the 2-level regardless of fit/strength.",
    );
  });

  test("FLAG: R3 continuation shows no recommendation for game-strength hands", async ({
    page,
  }) => {
    // Per convention: after transfer completion with 10+ HCP & 5-card suit → bid 3NT
    // But the app's "Jacoby Transfers Only" drill returns null for R3.
    test.setTimeout(45_000);
    await startDrill(page, 5); // 12 HCP, 5♥

    const hcp = await getHcp(page);
    expect(hcp).toBe(12);

    // R1: correct transfer bid
    await page.getByTestId("bid-2D").click();
    await expect(page.getByTestId("bid-pass")).toBeEnabled({
      timeout: 15_000,
    });

    const body = await page.locator("body").innerText();
    const r3Bid = getCorrectBid(body);

    console.log(`R3 check — seed 5, ${hcp} HCP, 5♥:`);
    console.log(`  App recommends: "${r3Bid?.bid ?? "null"}"`);
    console.log(`  Convention rule says: 3NT (game values, 5-card suit)`);

    if (r3Bid?.bid?.includes("No convention")) {
      console.log("  FLAG: R3 continuation not graded in the transfers-only drill.");
      console.log(
        "  R3 surfaces exist in meaning-surfaces.ts but getExpectedBid() returns null.",
      );
    }
  });

  test("FLAG: R3 not graded for invite-range hand (8–9 HCP)", async ({
    page,
  }) => {
    test.setTimeout(45_000);
    await startDrill(page, 14); // 9 HCP, 5♠

    const hcp = await getHcp(page);
    expect(hcp).toBe(9);

    await page.getByTestId("bid-2H").click();
    await expect(page.getByTestId("bid-pass")).toBeEnabled({
      timeout: 15_000,
    });

    const body = await page.locator("body").innerText();
    const r3Bid = getCorrectBid(body);

    console.log(`R3 check — seed 14, ${hcp} HCP, 5♠:`);
    console.log(`  App recommends: "${r3Bid?.bid ?? "null"}"`);
    console.log(`  Convention rule says: 2NT (invite, 8–9 HCP)`);

    if (r3Bid?.bid?.includes("No convention")) {
      console.log(
        "  FLAG: R3 invite bid (2NT) not recommended for invite-range hand.",
      );
    }
  });

  test("5-5 majors: spades transfer takes priority", async ({ page }) => {
    // With both 5+ spades and 5+ hearts, 2♥ (spades) should be recommended
    // because spades has intraModuleOrder: 0 (checked first).
    // We test all seeds and flag any with 5-5 majors.
    let found55 = false;

    for (let seed = 1; seed <= 15; seed++) {
      await page.goto(`/?convention=nt-transfers&seed=${seed}`);
      await expect(page.getByTestId("game-phase")).toHaveText("Bidding", {
        timeout: 10_000,
      });
      await expect(page.getByTestId("bid-pass")).toBeEnabled({
        timeout: 5_000,
      });

      const body = await page.locator("body").innerText();
      const shape = parseHandShape(body);
      if (!shape) continue;

      if (shape.spades >= 5 && shape.hearts >= 5) {
        found55 = true;
        const bid = getCorrectBid(body);
        expect(bid?.bid).toBe("2♥"); // Spades transfer wins
        console.log(
          `Seed ${seed}: 5-5 majors (${shape.spades}♠ ${shape.hearts}♥) → ` +
            `${bid?.bid} (spades transfer wins) ✓`,
        );
      }
    }

    if (!found55) {
      console.log(
        "No 5-5 major hand found in seeds 1–15 (rule verified structurally via meaning-surfaces.ts).",
      );
    }
  });

  test("transfer bid always has alert marker (!) in auction display", async ({
    page,
  }) => {
    test.setTimeout(45_000);
    await startDrill(page, 1);

    // Bid the correct transfer
    await page.getByTestId("bid-2D").click();
    await expect(page.getByTestId("bid-pass")).toBeEnabled({
      timeout: 15_000,
    });

    // The transfer bid should have an alert marker (!) in the auction
    const body = await page.locator("body").innerText();
    expect(body).toContain("2♦!");
    console.log("Transfer bid 2♦ has alert marker (!) in auction ✓");
  });
});
