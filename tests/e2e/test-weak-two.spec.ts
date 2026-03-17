import { test, expect, type Page } from "@playwright/test";

/**
 * Weak Two Bids / Ogust Convention — Comprehensive E2E Tests
 *
 * For each seed (1-15), this test:
 *   1. Navigates to the Weak Two practice with a fixed seed + debug mode
 *   2. Waits for the game to load and the bidding phase to begin
 *   3. Opens the debug panel and captures all 4 hands
 *   4. Captures the auction so far (North's opening, East's pass)
 *   5. Reads the correct bid recommendation from the DEV hint panel
 *   6. Validates bids against Weak Two / Ogust rules
 *   7. Submits the correct bid and follows through Ogust path if applicable
 *   8. Logs detailed results and flags any incorrect recommendations
 *
 * Ogust 2NT response system (after partner's Weak Two):
 *   3C = bad hand (5-8 HCP), bad suit (0-1 of A/K/Q)
 *   3D = bad hand (5-8 HCP), good suit (2+ of A/K/Q)
 *   3H = good hand (9-11 HCP), bad suit (0-1 of A/K/Q)
 *   3S = good hand (9-11 HCP), good suit (2+ of A/K/Q)
 *   3NT = solid suit (all 3: A, K, Q)
 */

// ─── Types ──────────────────────────────────────────────────────

interface HandInfo {
  seat: string;
  hcp: number;
  spades: string;
  hearts: string;
  diamonds: string;
  clubs: string;
  spadesLen: number;
  heartsLen: number;
  diamondsLen: number;
  clubsLen: number;
}

interface RoundCapture {
  round: number;
  role: string;
  auctionBefore: string;
  correctBid: string;
  correctBidMeaning: string;
  pipelineText: string;
}

interface SeedResult {
  seed: number;
  hands: HandInfo[];
  rounds: RoundCapture[];
  issues: string[];
}

// ─── Helpers ────────────────────────────────────────────────────

/** Parse a hand block for suit symbols followed by rank characters */
function parseHandFromDebugText(handBlock: string): Partial<HandInfo> {
  const result: Partial<HandInfo> = {};
  const suitPattern = /([♠♥♦♣])\s*([AKQJT2-9]*)/g;
  let m: RegExpExecArray | null;
  while ((m = suitPattern.exec(handBlock)) !== null) {
    const sym = m[1];
    const cards = (m[2] ?? "").trim();
    const len = cards.replace(/\s/g, "").length;
    switch (sym) {
      case "\u2660":
        result.spades = cards;
        result.spadesLen = len;
        break;
      case "\u2665":
        result.hearts = cards;
        result.heartsLen = len;
        break;
      case "\u2666":
        result.diamonds = cards;
        result.diamondsLen = len;
        break;
      case "\u2663":
        result.clubs = cards;
        result.clubsLen = len;
        break;
    }
  }
  return result;
}

/** Count top honors (A, K, Q) in a suit string like "AKJ93" */
function countTopHonors(suitCards: string): number {
  let count = 0;
  if (suitCards.includes("A")) count++;
  if (suitCards.includes("K")) count++;
  if (suitCards.includes("Q")) count++;
  return count;
}

/** Open debug drawer and expand all <details> sections */
async function openDebugDrawer(page: Page): Promise<void> {
  const debugToggle = page.getByTestId("debug-toggle");
  if (await debugToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
    // Check if already open by evaluating the drawer's actual width
    const drawer = page.locator("aside[aria-label='Debug drawer']");
    const isOpen = await drawer
      .evaluate((el) => el.classList.contains("w-[420px]"))
      .catch(() => false);
    if (!isOpen) {
      await debugToggle.click();
      await page.waitForTimeout(600);
    }
  }
  // Expand all <details> elements
  await page.evaluate(() => {
    document.querySelectorAll("details").forEach((d: HTMLDetailsElement) => {
      d.open = true;
    });
  });
  await page.waitForTimeout(400);
}

/** Extract all 4 hands using page.evaluate() for reliable DOM access */
async function extractAllHands(page: Page): Promise<HandInfo[]> {
  const hands: HandInfo[] = [];

  // Wait briefly for debug drawer content to render
  await page.waitForTimeout(500);

  // Expand all <details> elements in the page
  await page.evaluate(() => {
    document.querySelectorAll("details").forEach((d) => {
      d.open = true;
    });
  });
  await page.waitForTimeout(200);

  // Get the All Hands text via page-level Playwright locator (filter approach)
  // This avoids scoping issues with the drawer
  const detailsEls = page.locator("details").filter({
    has: page.locator("summary", { hasText: "All Hands" }),
  });

  const count = await detailsEls.count();
  if (count === 0) {
    // Fallback: try page.evaluate
    const txt = await page.evaluate(() => {
      const sums = Array.from(document.querySelectorAll("summary"));
      const allHandsSum = sums.find((s) => s.textContent?.trim() === "All Hands");
      if (allHandsSum) {
        const det = allHandsSum.closest("details") as HTMLDetailsElement;
        if (det) { det.open = true; return det.innerText; }
      }
      return "SUMMARIES:" + sums.map((s) => s.textContent?.trim()).join("|");
    });
    console.log(`  [DIAG] detailsEls.count=0, evaluate result: ${txt.substring(0, 200)}`);
    if (txt.startsWith("SUMMARIES:")) return hands;
    return parseHandText(txt);
  }

  const handText = await detailsEls.first().innerText();
  return parseHandText(handText);
}

function parseHandText(handText: string): HandInfo[] {
  const hands: HandInfo[] = [];
  if (!handText) return hands;

  // Debug drawer renders seats as single letters: N, E, S, W
  // Format: "N (10 HCP)\n♠ J5\n♥ KT54\n♦ AT9532\n♣ Q\nE (5 HCP)\n..."
  const seatEntries: { abbrev: string; fullName: string }[] = [
    { abbrev: "N", fullName: "North" },
    { abbrev: "E", fullName: "East" },
    { abbrev: "S", fullName: "South" },
    { abbrev: "W", fullName: "West" },
  ];

  for (let i = 0; i < seatEntries.length; i++) {
    const { abbrev, fullName } = seatEntries[i]!;
    const pattern = new RegExp(`\\b${abbrev}\\s*\\(\\d+\\s*HCP\\)`);
    const match = pattern.exec(handText);
    if (!match) continue;

    const startIdx = match.index;
    // Find end: next seat or end of text
    let endIdx = handText.length;
    for (let j = 0; j < seatEntries.length; j++) {
      if (j === i) continue;
      const np = new RegExp(`\\b${seatEntries[j]!.abbrev}\\s*\\(\\d+\\s*HCP\\)`);
      const nm = np.exec(handText.substring(startIdx + 1));
      if (nm && startIdx + 1 + nm.index < endIdx) {
        endIdx = startIdx + 1 + nm.index;
      }
    }

    const block = handText.substring(startIdx, endIdx);
    const hcpMatch = block.match(/\((\d+)\s*HCP\)/);
    const hcp = hcpMatch ? parseInt(hcpMatch[1]!, 10) : -1;
    const parsedHand = parseHandFromDebugText(block);

    hands.push({
      seat: fullName,
      hcp,
      spades: parsedHand.spades ?? "",
      hearts: parsedHand.hearts ?? "",
      diamonds: parsedHand.diamonds ?? "",
      clubs: parsedHand.clubs ?? "",
      spadesLen: parsedHand.spadesLen ?? 0,
      heartsLen: parsedHand.heartsLen ?? 0,
      diamondsLen: parsedHand.diamondsLen ?? 0,
      clubsLen: parsedHand.clubsLen ?? 0,
    });
  }
  return hands;
}

/** Extract the correct bid text from the DEV hint panel */
async function getCorrectBidFromDebugPanel(page: Page): Promise<{
  bidText: string;
  meaningText: string;
}> {
  // The inline DebugPanel (not the drawer) shows "DEV: Correct Bid"
  const debugPanel = page.locator("text=DEV: Correct Bid").first();
  const panelExists = (await debugPanel.count()) > 0;
  if (panelExists) {
    // Get the parent container text
    const container = debugPanel.locator("..");
    const panelText = await container.innerText().catch(() => "");
    if (panelText.includes("No convention bid")) {
      return { bidText: "Pass", meaningText: "No convention bid" };
    }
    const lines = panelText.split("\n").filter((l) => l.trim());
    const bidLine = lines.find((l) => !l.includes("DEV:")) ?? "";
    // Split on em-dash or regular dash
    const dashIdx = bidLine.indexOf("\u2014");
    if (dashIdx >= 0) {
      return {
        bidText: bidLine.substring(0, dashIdx).trim(),
        meaningText: bidLine.substring(dashIdx + 1).trim(),
      };
    }
    const dashIdx2 = bidLine.indexOf("—");
    if (dashIdx2 >= 0) {
      return {
        bidText: bidLine.substring(0, dashIdx2).trim(),
        meaningText: bidLine.substring(dashIdx2 + 1).trim(),
      };
    }
    return { bidText: bidLine.trim(), meaningText: "" };
  }

  // Fallback: try the SuggestedBid section in debug drawer
  const drawer = page.locator("aside[aria-label='Debug drawer']");
  const suggestedBid = drawer
    .locator("details:has(summary:has-text('Suggested Bid'))")
    .first();
  if ((await suggestedBid.count()) > 0) {
    const text = await suggestedBid.innerText().catch(() => "");
    // Parse the suggested bid text
    const callMatch = text.match(
      /call:\s*([^\n]+)/,
    );
    const meaningMatch = text.match(
      /meaning:\s*([^\n]+)/,
    );
    return {
      bidText: callMatch ? callMatch[1]!.trim() : "unknown",
      meaningText: meaningMatch ? meaningMatch[1]!.trim() : "",
    };
  }

  return { bidText: "unknown", meaningText: "" };
}

/** Extract auction text from the AuctionTable in table center */
async function getAuctionText(page: Page): Promise<string> {
  const center = page.getByTestId("table-center");
  if ((await center.count()) > 0) {
    return await center.innerText().catch(() => "");
  }
  return "";
}

/** Extract pipeline text using page.evaluate for reliable access */
async function extractPipelineText(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const summaries = document.querySelectorAll("summary");
    for (const s of summaries) {
      if (s.textContent?.includes("Pipeline")) {
        const details = s.closest("details");
        if (details) {
          details.open = true;
          return details.innerText;
        }
      }
    }
    return "Pipeline section not found";
  });
}

/** Map bid text (with suit symbols) to bid-panel testid key */
function bidTextToTestId(bidText: string): string {
  const cleaned = bidText
    .replace(/♣/g, "C")
    .replace(/♦/g, "D")
    .replace(/♥/g, "H")
    .replace(/♠/g, "S")
    .replace("NT", "NT")
    .replace(/\s+/g, "")
    .trim();
  if (cleaned.toLowerCase() === "pass") return "bid-pass";
  if (cleaned.toLowerCase() === "double" || cleaned === "X")
    return "bid-double";
  if (cleaned.toLowerCase() === "redouble" || cleaned === "XX")
    return "bid-redouble";
  return `bid-${cleaned}`;
}

/** Determine the opened suit from the auction text */
function getOpenedSuit(
  auctionText: string,
): "hearts" | "spades" | "diamonds" | null {
  if (auctionText.includes("2\u2665") || auctionText.includes("2♥"))
    return "hearts";
  if (auctionText.includes("2\u2660") || auctionText.includes("2♠"))
    return "spades";
  if (auctionText.includes("2\u2666") || auctionText.includes("2♦"))
    return "diamonds";
  return null;
}

/** Get suit cards from a HandInfo */
function getSuitCards(
  hand: HandInfo,
  suit: "hearts" | "spades" | "diamonds",
): string {
  switch (suit) {
    case "hearts":
      return hand.hearts;
    case "spades":
      return hand.spades;
    case "diamonds":
      return hand.diamonds;
  }
}

/** Get suit length from a HandInfo */
function getSuitLength(
  hand: HandInfo,
  suit: "hearts" | "spades" | "diamonds",
): number {
  switch (suit) {
    case "hearts":
      return hand.heartsLen;
    case "spades":
      return hand.spadesLen;
    case "diamonds":
      return hand.diamondsLen;
  }
}

// ─── Validation Logic ───────────────────────────────────────────

/** Validate R1: North's weak two opening (6+ suit, 5-11 HCP) */
function validateR1Opening(
  northHand: HandInfo,
  openedSuit: "hearts" | "spades" | "diamonds",
): string[] {
  const issues: string[] = [];
  const hcp = northHand.hcp;

  if (hcp < 5 || hcp > 11) {
    issues.push(
      `R1 ISSUE: North has ${hcp} HCP, outside weak two range 5-11`,
    );
  }

  const suitLen = getSuitLength(northHand, openedSuit);
  if (suitLen < 6) {
    issues.push(
      `R1 ISSUE: North opened 2${openedSuit[0]!.toUpperCase()} but only has ${suitLen} ${openedSuit}`,
    );
  }

  return issues;
}

/**
 * Validate R2: South's response
 *   16+ HCP + 3+ fit => game raise (4M or 5D)
 *   16+ HCP + <3 fit => Ogust 2NT
 *   14-15 HCP + 3+ fit => invite raise (3 of suit)
 *   otherwise => pass
 */
function validateR2Response(
  southHand: HandInfo,
  openedSuit: "hearts" | "spades" | "diamonds",
  correctBid: string,
): string[] {
  const issues: string[] = [];
  const hcp = southHand.hcp;
  const fitLen = getSuitLength(southHand, openedSuit);
  const hasFit = fitLen >= 3;

  const bid = correctBid
    .replace(/♣/g, "C")
    .replace(/♦/g, "D")
    .replace(/♥/g, "H")
    .replace(/♠/g, "S")
    .replace(/\s+/g, "");

  const isGameRaise = bid === "4H" || bid === "4S" || bid === "5D";
  const isOgust = bid === "2NT";
  const isInviteRaise = bid === "3H" || bid === "3S" || bid === "3D";
  const isPass = bid.toLowerCase() === "pass";

  if (hcp >= 16 && hasFit) {
    if (!isGameRaise) {
      issues.push(
        `R2 ISSUE: South has ${hcp} HCP and ${fitLen} ${openedSuit} (fit). ` +
          `Expected game raise but got "${correctBid}"`,
      );
    }
  } else if (hcp >= 16 && !hasFit) {
    if (!isOgust) {
      issues.push(
        `R2 ISSUE: South has ${hcp} HCP and ${fitLen} ${openedSuit} (no fit). ` +
          `Expected Ogust 2NT but got "${correctBid}"`,
      );
    }
  } else if (hcp >= 14 && hcp <= 15 && hasFit) {
    if (!isInviteRaise) {
      issues.push(
        `R2 ISSUE: South has ${hcp} HCP and ${fitLen} ${openedSuit}. ` +
          `Expected invite raise (3-level) but got "${correctBid}"`,
      );
    }
  } else {
    if (!isPass) {
      issues.push(
        `R2 ISSUE: South has ${hcp} HCP and ${fitLen} ${openedSuit}. ` +
          `Expected pass (fallback) but got "${correctBid}"`,
      );
    }
  }

  return issues;
}

/**
 * Validate R3: North's Ogust response
 *   3C = minimum (5-8 HCP), bad suit (0-1 top honors)
 *   3D = minimum (5-8 HCP), good suit (2+ top honors)
 *   3H = maximum (9-11 HCP), bad suit (0-1 top honors)
 *   3S = maximum (9-11 HCP), good suit (2+ top honors)
 *   3NT = solid suit (AKQ, all 3 top honors)
 */
function validateR3Ogust(
  northHand: HandInfo,
  openedSuit: "hearts" | "spades" | "diamonds",
  correctBid: string,
): string[] {
  const issues: string[] = [];
  const hcp = northHand.hcp;
  const suitCards = getSuitCards(northHand, openedSuit);
  const topHonors = countTopHonors(suitCards);
  const isMinimum = hcp >= 5 && hcp <= 8;
  const isMaximum = hcp >= 9 && hcp <= 11;
  const isBadSuit = topHonors <= 1;
  const isGoodSuit = topHonors >= 2;
  const isSolid = topHonors === 3;

  const bid = correctBid
    .replace(/♣/g, "C")
    .replace(/♦/g, "D")
    .replace(/♥/g, "H")
    .replace(/♠/g, "S")
    .replace(/\s+/g, "");

  let expectedBid: string;
  let expectedLabel: string;
  if (isSolid) {
    expectedBid = "3NT";
    expectedLabel = "solid (AKQ)";
  } else if (isMinimum && isBadSuit) {
    expectedBid = "3C";
    expectedLabel = "min/bad";
  } else if (isMinimum && isGoodSuit) {
    expectedBid = "3D";
    expectedLabel = "min/good";
  } else if (isMaximum && isBadSuit) {
    expectedBid = "3H";
    expectedLabel = "max/bad";
  } else if (isMaximum && isGoodSuit) {
    expectedBid = "3S";
    expectedLabel = "max/good";
  } else {
    expectedBid = "?";
    expectedLabel = `unknown (HCP=${hcp}, topHonors=${topHonors})`;
  }

  if (bid !== expectedBid) {
    issues.push(
      `R3 OGUST ISSUE: North has ${hcp} HCP, ${topHonors} top honors in ${openedSuit} (${suitCards}). ` +
        `Expected ${expectedBid} (${expectedLabel}) but app says "${correctBid}"`,
    );
  }

  return issues;
}

// ─── Auction parsing helpers ────────────────────────────────────

/** Extract North's Ogust response from auction text */
function extractOgustResponse(auctionText: string): string | null {
  const normalized = auctionText
    .replace(/♣/g, "C")
    .replace(/♦/g, "D")
    .replace(/♥/g, "H")
    .replace(/♠/g, "S");

  const bidPattern = /\b(Pass|[1-7](?:C|D|H|S|NT)|X|XX)\b/gi;
  const bids: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = bidPattern.exec(normalized)) !== null) {
    bids.push(m[1]!);
  }

  // Sequence: 2X, Pass, 2NT, Pass, {ogust response}
  for (let i = 0; i < bids.length - 4; i++) {
    if (
      bids[i]!.match(/^2[HSD]$/i) &&
      bids[i + 1]!.toLowerCase() === "pass" &&
      bids[i + 2]!.toUpperCase() === "2NT" &&
      bids[i + 3]!.toLowerCase() === "pass"
    ) {
      const response = bids[i + 4];
      if (response) {
        return response
          .replace(/C$/i, "♣")
          .replace(/D$/i, "♦")
          .replace(/H$/i, "♥")
          .replace(/S$/i, "♠");
      }
    }
  }
  return null;
}

/** Extract South's R2 bid from the body text */
function extractSouthR2Bid(bodyText: string): string | null {
  const normalized = bodyText
    .replace(/♣/g, "C")
    .replace(/♦/g, "D")
    .replace(/♥/g, "H")
    .replace(/♠/g, "S");

  const bidPattern = /\b(Pass|[1-7](?:C|D|H|S|NT)|X|XX)\b/gi;
  const bids: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = bidPattern.exec(normalized)) !== null) {
    bids.push(m[1]!);
  }

  // N: 2X (idx 0), E: Pass (idx 1), S: ?? (idx 2)
  for (let i = 0; i < bids.length - 2; i++) {
    if (
      bids[i]!.match(/^2[HSD]$/i) &&
      bids[i + 1]!.toLowerCase() === "pass"
    ) {
      const southBid = bids[i + 2]!;
      return southBid
        .replace(/C$/i, "♣")
        .replace(/D$/i, "♦")
        .replace(/H$/i, "♥")
        .replace(/S$/i, "♠");
    }
  }
  return null;
}

// ─── Main Test: Interactive bidding ─────────────────────────────

test.describe("Weak Two / Ogust — Interactive Bidding (Seeds 1-15)", () => {
  for (let seed = 1; seed <= 15; seed++) {
    test(`Seed ${seed}: capture hand data and validate bidding`, async ({
      page,
    }) => {
      test.setTimeout(60_000);

      const result: SeedResult = {
        seed,
        hands: [],
        rounds: [],
        issues: [],
      };

      // Navigate to game with seed + debug
      await page.goto(
        `/?convention=weak-two-bundle&seed=${seed}&debug=true`,
      );

      const phaseLabel = page.getByTestId("game-phase");
      await expect(phaseLabel).toHaveText("Bidding", { timeout: 15_000 });

      // Wait for bid buttons to be ready
      const passBtn = page.getByTestId("bid-pass");
      await expect(passBtn).toBeEnabled({ timeout: 10_000 });

      // Open debug drawer and expand all details
      await openDebugDrawer(page);
      const hands = await extractAllHands(page);
      result.hands = hands;

      const northHand = hands.find((h) => h.seat === "North");
      const southHand = hands.find((h) => h.seat === "South");

      // ─── Log all 4 hands ───────────────────────────────────
      console.log(`\n${"=".repeat(80)}`);
      console.log(`SEED ${seed} — Weak Two Bids / Ogust`);
      console.log(`${"=".repeat(80)}`);
      if (hands.length === 0) {
        console.log("  [WARN] No hands extracted from debug drawer");
      }
      for (const h of hands) {
        console.log(
          `  ${h.seat} (${h.hcp} HCP): ` +
            `♠ ${h.spades || "-"}  ` +
            `♥ ${h.hearts || "-"}  ` +
            `♦ ${h.diamonds || "-"}  ` +
            `♣ ${h.clubs || "-"}  ` +
            `[${h.spadesLen}-${h.heartsLen}-${h.diamondsLen}-${h.clubsLen}]`,
        );
      }

      // ─── R1: North's opening (AI bid) ──────────────────────
      const auctionR1 = await getAuctionText(page);
      const openedSuit = getOpenedSuit(auctionR1);
      console.log(`\n  R1 Auction: ${auctionR1.replace(/\n/g, " | ")}`);
      console.log(`  Opened suit: ${openedSuit ?? "unknown"}`);

      if (northHand && openedSuit) {
        const r1Issues = validateR1Opening(northHand, openedSuit);
        result.issues.push(...r1Issues);
        // Log North's opening details
        const suitLen = getSuitLength(northHand, openedSuit);
        const suitCards = getSuitCards(northHand, openedSuit);
        const topH = countTopHonors(suitCards);
        console.log(
          `  North opener: ${northHand.hcp} HCP, ${suitLen} ${openedSuit} (${suitCards}), ${topH} top honors`,
        );
      }

      // ─── R2: South's response ──────────────────────────────
      const r2Bid = await getCorrectBidFromDebugPanel(page);
      const r2Pipeline = await extractPipelineText(page);

      console.log(
        `\n  R2 Correct bid: ${r2Bid.bidText} — ${r2Bid.meaningText}`,
      );
      console.log(
        `  R2 Pipeline: ${r2Pipeline.substring(0, 400)}`,
      );

      result.rounds.push({
        round: 2,
        role: "responder (South)",
        auctionBefore: auctionR1.replace(/\n/g, " | "),
        correctBid: r2Bid.bidText,
        correctBidMeaning: r2Bid.meaningText,
        pipelineText: r2Pipeline,
      });

      // Validate R2
      if (southHand && openedSuit) {
        const fitLen = getSuitLength(southHand, openedSuit);
        console.log(
          `  South responder: ${southHand.hcp} HCP, ${fitLen} ${openedSuit} fit`,
        );
        const r2Issues = validateR2Response(
          southHand,
          openedSuit,
          r2Bid.bidText,
        );
        result.issues.push(...r2Issues);
      }

      // ─── Submit R2 bid ─────────────────────────────────────
      const r2TestId = bidTextToTestId(r2Bid.bidText);
      console.log(`  Clicking: ${r2TestId}`);
      const r2Button = page.getByTestId(r2TestId);
      await expect(r2Button).toBeVisible({ timeout: 5000 });
      await r2Button.click();

      // Wait for feedback/next turn
      await page.waitForTimeout(2000);

      // Handle feedback
      const feedback = page.locator("[role='alert']");
      const gotFeedback = await feedback
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      if (gotFeedback) {
        const feedbackText = await feedback.innerText();
        console.log(
          `  R2 Feedback: ${feedbackText.substring(0, 100)}`,
        );
      }

      // ─── Check Ogust path (R3) ────────────────────────────
      const isOgustPath =
        r2Bid.bidText === "2NT" || r2Bid.bidText.includes("2NT");

      if (isOgustPath) {
        console.log("\n  --- Ogust path: waiting for R3 ---");

        // Wait for AI bids (East passes, North responds)
        await page.waitForTimeout(3000);

        const currentPhase = await phaseLabel.textContent();

        if (currentPhase === "Bidding") {
          // Re-expand debug details
          await page.evaluate(() => {
            document
              .querySelectorAll("details")
              .forEach((d: HTMLDetailsElement) => {
                d.open = true;
              });
          });
          await page.waitForTimeout(500);

          const auctionR3 = await getAuctionText(page);
          console.log(
            `  R3 Auction: ${auctionR3.replace(/\n/g, " | ")}`,
          );

          // Extract North's Ogust response
          const ogustResponse = extractOgustResponse(auctionR3);
          if (ogustResponse) {
            console.log(`  North Ogust response: ${ogustResponse}`);
          }

          // Validate Ogust response
          if (ogustResponse && northHand && openedSuit) {
            const suitCards = getSuitCards(northHand, openedSuit);
            const topH = countTopHonors(suitCards);
            const isMin = northHand.hcp >= 5 && northHand.hcp <= 8;
            const isMax = northHand.hcp >= 9 && northHand.hcp <= 11;
            console.log(
              `  Ogust eval: North ${northHand.hcp} HCP (${isMin ? "MIN" : isMax ? "MAX" : "??"}), ` +
                `${topH} top honors in ${openedSuit} (${suitCards}) → ` +
                `${topH <= 1 ? "BAD" : topH === 3 ? "SOLID" : "GOOD"} suit`,
            );
            const r3Issues = validateR3Ogust(
              northHand,
              openedSuit,
              ogustResponse,
            );
            result.issues.push(...r3Issues);
          }

          // Capture what's expected next
          const r3Bid = await getCorrectBidFromDebugPanel(page);
          const r3Pipeline = await extractPipelineText(page);
          console.log(
            `  R3 Next bid: ${r3Bid.bidText} — ${r3Bid.meaningText}`,
          );

          result.rounds.push({
            round: 3,
            role: "after Ogust response",
            auctionBefore: auctionR3.replace(/\n/g, " | "),
            correctBid: r3Bid.bidText,
            correctBidMeaning: r3Bid.meaningText,
            pipelineText: r3Pipeline,
          });
        } else {
          console.log(`  Phase transitioned to: ${currentPhase}`);
        }
      }

      // ─── Summary ───────────────────────────────────────────
      console.log(`\n  --- Seed ${seed} Summary ---`);
      if (result.issues.length === 0) {
        console.log("  PASS: All bids correct per Weak Two / Ogust rules");
      } else {
        for (const issue of result.issues) {
          console.log(`  FLAG: ${issue}`);
        }
      }

      // Screenshot
      await page.screenshot({
        path: `/tmp/weak-two-seed${seed}.png`,
        fullPage: true,
      });

      expect.soft(result.issues, `Seed ${seed} validation issues`).toEqual([]);
    });
  }
});

// ─── Autoplay Test: Full auction validation ─────────────────────

test.describe("Weak Two / Ogust — Autoplay Validation (Seeds 1-15)", () => {
  for (let seed = 1; seed <= 15; seed++) {
    test(`Seed ${seed}: autoplay full auction and validate`, async ({
      page,
    }) => {
      test.setTimeout(45_000);

      await page.goto(
        `/?convention=weak-two-bundle&seed=${seed}&autoplay=true&debug=true`,
      );

      const phaseLabel = page.getByTestId("game-phase");
      await expect(phaseLabel).toHaveText(/Review|Declarer|Defend/, {
        timeout: 30_000,
      });

      // Open debug drawer and expand
      await openDebugDrawer(page);
      const hands = await extractAllHands(page);
      const northHand = hands.find((h) => h.seat === "North");
      const southHand = hands.find((h) => h.seat === "South");

      console.log(`\n${"=".repeat(80)}`);
      console.log(`AUTOPLAY SEED ${seed} — Full Auction Validation`);
      console.log(`${"=".repeat(80)}`);
      for (const h of hands) {
        console.log(
          `  ${h.seat} (${h.hcp} HCP): ` +
            `♠ ${h.spades || "-"}  ♥ ${h.hearts || "-"}  ` +
            `♦ ${h.diamonds || "-"}  ♣ ${h.clubs || "-"}  ` +
            `[${h.spadesLen}-${h.heartsLen}-${h.diamondsLen}-${h.clubsLen}]`,
        );
      }

      // Get bid log
      const drawer = page.locator("aside[aria-label='Debug drawer']");
      await page.evaluate(() => {
        document
          .querySelectorAll("details")
          .forEach((d: HTMLDetailsElement) => {
            d.open = true;
          });
      });
      await page.waitForTimeout(300);

      const bidLogSection = drawer
        .locator("details:has(summary:has-text('Bid Log'))")
        .first();
      const bidLogText = await bidLogSection
        .innerText()
        .catch(() => "Bid log not found");
      console.log(`\n  Bid Log:\n${bidLogText}`);

      // Get the auction from body text
      const bodyText = await page.locator("body").innerText();
      const openedSuit = getOpenedSuit(bodyText);
      console.log(`  Opened suit: ${openedSuit ?? "unknown"}`);

      const issues: string[] = [];

      // Validate R1
      if (northHand && openedSuit) {
        if (northHand.hcp < 5 || northHand.hcp > 11) {
          issues.push(
            `R1: North HCP ${northHand.hcp} outside 5-11 range`,
          );
        }
        const suitLen = getSuitLength(northHand, openedSuit);
        if (suitLen < 6) {
          issues.push(
            `R1: North opened ${openedSuit} with only ${suitLen} cards`,
          );
        }
        const suitCards = getSuitCards(northHand, openedSuit);
        const topH = countTopHonors(suitCards);
        console.log(
          `  North: ${northHand.hcp} HCP, ${suitLen} ${openedSuit} (${suitCards}), ${topH} top honors`,
        );
      }

      // Validate R2
      if (southHand && openedSuit) {
        const hcp = southHand.hcp;
        const fitLen = getSuitLength(southHand, openedSuit);
        const hasFit = fitLen >= 3;
        console.log(
          `  South: ${hcp} HCP, ${fitLen} ${openedSuit} fit`,
        );

        const southBid = extractSouthR2Bid(bodyText);
        console.log(`  South R2 bid: ${southBid}`);

        if (southBid) {
          const normalBid = southBid
            .replace(/♣/g, "C")
            .replace(/♦/g, "D")
            .replace(/♥/g, "H")
            .replace(/♠/g, "S")
            .replace(/\s+/g, "");
          const isGameRaise =
            normalBid === "4H" || normalBid === "4S" || normalBid === "5D";
          const isOgust = normalBid === "2NT";
          const isInvite =
            normalBid === "3H" || normalBid === "3S" || normalBid === "3D";

          if (hcp >= 16 && hasFit && !isGameRaise) {
            issues.push(
              `R2: South ${hcp} HCP, ${fitLen} ${openedSuit}. Expected game raise, got ${southBid}`,
            );
          } else if (hcp >= 16 && !hasFit && !isOgust) {
            issues.push(
              `R2: South ${hcp} HCP, ${fitLen} ${openedSuit}. Expected 2NT, got ${southBid}`,
            );
          } else if (hcp >= 14 && hcp <= 15 && hasFit && !isInvite) {
            issues.push(
              `R2: South ${hcp} HCP, ${fitLen} ${openedSuit}. Expected invite, got ${southBid}`,
            );
          }

          // Validate R3 Ogust if applicable
          if (normalBid === "2NT") {
            const ogustResponse = extractOgustResponse(bodyText);
            if (ogustResponse && northHand) {
              const suitCards = getSuitCards(northHand, openedSuit);
              const topH = countTopHonors(suitCards);
              const isMin =
                northHand.hcp >= 5 && northHand.hcp <= 8;
              const isMax =
                northHand.hcp >= 9 && northHand.hcp <= 11;
              console.log(
                `  North Ogust: ${northHand.hcp} HCP (${isMin ? "MIN" : isMax ? "MAX" : "??"}), ` +
                  `${topH} top honors → ${ogustResponse}`,
              );
              const r3Issues = validateR3Ogust(
                northHand,
                openedSuit,
                ogustResponse,
              );
              issues.push(...r3Issues);
            }
          }
        }
      }

      // Report
      console.log(`\n  --- Autoplay Seed ${seed} Validation ---`);
      if (issues.length === 0) {
        console.log("  PASS: All bids correct per Weak Two / Ogust rules");
      } else {
        for (const issue of issues) {
          console.log(`  FLAG: ${issue}`);
        }
      }

      await page.screenshot({
        path: `/tmp/weak-two-autoplay-seed${seed}.png`,
        fullPage: true,
      });

      expect.soft(issues, `Autoplay seed ${seed} issues`).toEqual([]);
    });
  }
});
