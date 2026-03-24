import { test, expect, type Page } from "@playwright/test";

/**
 * Bergen Raises E2E Test Suite — Seeds 1-15
 *
 * For each seed, captures:
 *   1. South's hand: suit lengths, HCP, specific cards
 *   2. The auction so far (partner's 1M opening)
 *   3. What the app says the correct bid is
 *   4. All 4 hands (from debug panel)
 *   5. The pipeline explanation
 *
 * Bergen Raises rules (as implemented — "standard" Bergen):
 *   3C  = constructive raise — 4+ trump support, 7-10 HCP
 *   3D  = limit raise       — 4+ trump support, 10-12 HCP
 *   3M  = preemptive raise  — 4+ trump support, 0-6 HCP
 *   4M  = game raise        — 4+ trump support, 13+ HCP
 *   3oM = splinter          — 4+ trump support, 12+ HCP, shortage
 *
 * The app uses standard Bergen: 3C = constructive (7-10), 3D = limit (10-12).
 * Priority: splinter(0) > game(1) > limit(2) > constructive(3) > preemptive(4)
 */

/* ---------- helpers ---------- */

/** Convert formatted bid (e.g. "3\u2663") to data-testid (e.g. "bid-3C") */
function bidToTestId(formatted: string): string {
  if (formatted === "Pass") return "bid-P";
  if (formatted === "X") return "bid-X";
  if (formatted === "XX") return "bid-XX";
  return (
    "bid-" +
    formatted
      .replace("\u2663", "C")
      .replace("\u2666", "D")
      .replace("\u2665", "H")
      .replace("\u2660", "S")
  );
}

/** Parse a seat block from the All Hands debug panel text.
 *  The app uses abbreviated seat names: N, E, S, W
 *  Format:
 *    N (15 HCP)
 *    \u2660 AKJ87
 *    \u2665 Q3
 *    \u2666 K92
 *    \u2663 J54
 */
interface ParsedHand {
  seat: string;
  hcp: number;
  spades: string;
  hearts: string;
  diamonds: string;
  clubs: string;
}

const SEAT_MAP: Record<string, string> = {
  N: "North",
  E: "East",
  S: "South",
  W: "West",
  North: "North",
  East: "East",
  South: "South",
  West: "West",
};

function parseAllHands(text: string): ParsedHand[] {
  const hands: ParsedHand[] = [];
  const lines = text.split("\n").map((l) => l.trim());

  for (let i = 0; i < lines.length; i++) {
    // Match: "N (15 HCP)" or "North (15 HCP)"
    const headerMatch = lines[i].match(
      /^(N|E|S|W|North|East|South|West)\s*\((\d+)\s*HCP\)/,
    );
    if (!headerMatch) continue;

    const seat = SEAT_MAP[headerMatch[1]] ?? headerMatch[1];
    const hcp = parseInt(headerMatch[2], 10);
    const suits = { spades: "", hearts: "", diamonds: "", clubs: "" };

    // Scan next lines for suit symbols
    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
      const line = lines[j];
      // Break if next seat header
      if (/^(N|E|S|W|North|East|South|West)\s*\(/.test(line)) break;

      const spadeMatch = line.match(/\u2660\s*([AKQJT98765432]*)/);
      const heartMatch = line.match(/\u2665\s*([AKQJT98765432]*)/);
      const diamondMatch = line.match(/\u2666\s*([AKQJT98765432]*)/);
      const clubMatch = line.match(/\u2663\s*([AKQJT98765432]*)/);

      if (spadeMatch && spadeMatch[1] !== undefined) suits.spades = spadeMatch[1];
      if (heartMatch && heartMatch[1] !== undefined) suits.hearts = heartMatch[1];
      if (diamondMatch && diamondMatch[1] !== undefined) suits.diamonds = diamondMatch[1];
      if (clubMatch && clubMatch[1] !== undefined) suits.clubs = clubMatch[1];
    }

    hands.push({ seat, hcp, ...suits });
  }

  return hands;
}

/** Expand a closed <details> in the debug drawer via JS (bypasses viewport constraints on mobile). */
async function expandDetailsInDrawer(page: Page, summaryText: string | RegExp) {
  const pattern = summaryText instanceof RegExp ? summaryText.source : summaryText;
  const isRegex = summaryText instanceof RegExp;
  await page.evaluate(({ pattern, isRegex }) => {
    const summaries = document.querySelectorAll('aside[aria-label="Debug drawer"] summary');
    for (const s of summaries) {
      const text = s.textContent?.trim() ?? "";
      const matches = isRegex ? new RegExp(pattern).test(text) : text.includes(pattern);
      if (matches) {
        const details = s.closest("details");
        if (details) details.open = true;
        break;
      }
    }
  }, { pattern, isRegex });
  await page.waitForTimeout(200);
}

/** Close the debug drawer (needed on mobile viewports where it covers bid buttons) */
async function closeDebugDrawer(page: Page): Promise<void> {
  try {
    await page.locator('button[aria-label="Close debug panel"]').click({ timeout: 1000 });
    await page.waitForTimeout(300);
  } catch {
    // Already closed or not interactable — ignore
  }
}

/** Read innerText of a <details> section in the debug drawer. */
async function readDrawerSection(
  page: Page,
  summaryText: string | RegExp,
): Promise<string> {
  const drawer = page.locator('aside[aria-label="Debug drawer"]');
  const summary = drawer.locator("summary").filter({ hasText: summaryText }).first();
  const isVisible = await summary.isVisible().catch(() => false);
  if (!isVisible) return "(section not visible)";
  const details = summary.locator("xpath=..");
  return (await details.innerText().catch(() => "(read error)")) || "";
}

/** Format a parsed hand for display */
function fmtHand(h: ParsedHand): string {
  return `\u2660 ${h.spades || "\u2014"} \u2665 ${h.hearts || "\u2014"} \u2666 ${h.diamonds || "\u2014"} \u2663 ${h.clubs || "\u2014"}`;
}

/* ---------- test suite ---------- */

test.describe("Bergen Raises Convention - Seeds 1 to 5", () => {
  test.setTimeout(45_000);

  for (let seed = 1; seed <= 15; seed++) {
    test(`Seed ${seed}: capture and verify Bergen raise`, async ({ page }) => {
      // -- 1. Navigate with debug panel open --
      await page.goto(
        `/?convention=bergen-bundle&seed=${seed}&debug=true`,
      );

      const phaseLabel = page.getByTestId("game-phase");
      await expect(phaseLabel).toHaveText("Bidding", { timeout: 12_000 });
      await expect(page.getByTestId("bid-P")).toBeEnabled({
        timeout: 5_000,
      });

      // -- 2. Determine opening bid (1H or 1S) --
      // After 1H-Pass, bid-1S is still legal (enabled).
      // After 1S-Pass, bid-1S is not legal (disabled).
      const is1SEnabled = await page.getByTestId("bid-1S").isEnabled();
      const openingSuit = is1SEnabled ? "\u2665" : "\u2660";
      const openingSuitCode = is1SEnabled ? "H" : "S";
      const otherMajorSuit = openingSuit === "\u2665" ? "\u2660" : "\u2665";
      const opening = `1${openingSuit}`;

      // -- 3. Expand debug drawer sections --
      await expandDetailsInDrawer(page, "All Hands");
      await expandDetailsInDrawer(page, "Hand Facts");
      await expandDetailsInDrawer(page, /^Pipeline/);
      // "Suggested Bid" is open by default

      // -- 4. Read all debug sections --
      const suggestedBidText = await readDrawerSection(page, "Suggested Bid");
      const handFactsText = await readDrawerSection(page, "Hand Facts");
      const pipelineText = await readDrawerSection(page, /^Pipeline/);
      const allHandsText = await readDrawerSection(page, "All Hands");

      // -- 5. Extract correct bid from Suggested Bid section --
      // Format: "Suggested Bid\n3\u2663\nConstructive raise (3C)\nrule\n..."
      // or: "Suggested Bid\nNo convention bid (pass)"
      const suggestedLines = suggestedBidText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      let correctBid = "Pass";
      let bidMeaning = "";

      for (let i = 0; i < suggestedLines.length; i++) {
        const line = suggestedLines[i];
        if (
          /^[1-7][\u2663\u2666\u2665\u2660]$/.test(line) ||
          /^[1-7]NT$/.test(line)
        ) {
          correctBid = line;
          if (i + 1 < suggestedLines.length) {
            bidMeaning = suggestedLines[i + 1];
          }
          break;
        }
      }
      if (
        correctBid === "Pass" &&
        suggestedBidText.includes("No convention bid")
      ) {
        bidMeaning = "No convention bid (pass)";
      }

      // -- 6. Extract hand facts --
      const hcpMatch = handFactsText.match(/hand\.hcp\s+(\d+)/);
      const southHcp = hcpMatch ? parseInt(hcpMatch[1], 10) : -1;

      const sLenS = handFactsText.match(/hand\.suitLength\.spades\s+(\d+)/);
      const sLenH = handFactsText.match(/hand\.suitLength\.hearts\s+(\d+)/);
      const sLenD = handFactsText.match(/hand\.suitLength\.diamonds\s+(\d+)/);
      const sLenC = handFactsText.match(/hand\.suitLength\.clubs\s+(\d+)/);

      const suitLengths = [
        sLenS ? parseInt(sLenS[1], 10) : -1,
        sLenH ? parseInt(sLenH[1], 10) : -1,
        sLenD ? parseInt(sLenD[1], 10) : -1,
        sLenC ? parseInt(sLenC[1], 10) : -1,
      ];

      const trumpSupport =
        openingSuitCode === "H" ? suitLengths[1] : suitLengths[0];

      const shortageMatch = handFactsText.match(
        /bridge\.hasShortage\s+(true|false)/,
      );
      const hasShortage = shortageMatch
        ? shortageMatch[1] === "true"
        : false;

      // Hand shape summary from Suggested Bid
      let handSummary = "";
      for (const line of suggestedLines) {
        if (/\d+\u2660.*\d+\u2665.*\d+\u2666.*\d+\u2663/.test(line)) {
          handSummary = line;
          break;
        }
      }

      // -- 7. Parse All Hands (all 4 players) --
      const allHands = parseAllHands(allHandsText);
      const south = allHands.find((h) => h.seat === "South");

      // South's specific cards
      const southCards = south
        ? fmtHand(south)
        : `(no card data; shape from facts: S=${suitLengths[0]} H=${suitLengths[1]} D=${suitLengths[2]} C=${suitLengths[3]})`;

      // -- 8. Classify the recommended bid --
      let bidType: string;
      if (correctBid === "3\u2663") bidType = "constructive";
      else if (correctBid === "3\u2666") bidType = "limit";
      else if (correctBid === `3${openingSuit}`) bidType = "preemptive";
      else if (correctBid === `4${openingSuit}`) bidType = "game";
      else if (correctBid === `3${otherMajorSuit}`) bidType = "splinter";
      else if (correctBid === "Pass") bidType = "pass";
      else bidType = `other(${correctBid})`;

      const hcpBand: Record<string, string> = {
        constructive: "7-10",
        limit: "10-12",
        preemptive: "0-6",
        game: "13+",
        splinter: "12+ w/ shortage",
        pass: "n/a (no Bergen bid)",
      };

      // -- 9. Log full details --
      console.log("");
      console.log("=".repeat(76));
      console.log(`  SEED ${seed}`);
      console.log("=".repeat(76));
      console.log(`  Auction:          North opens ${opening}, East passes`);
      console.log(`  South HCP:        ${southHcp}`);
      console.log(`  South Hand:       ${southCards}`);
      if (handSummary) {
        console.log(`  Hand shape:       ${handSummary}`);
      }
      console.log(
        `  Suit lengths:     S=${suitLengths[0]} H=${suitLengths[1]} D=${suitLengths[2]} C=${suitLengths[3]}`,
      );
      console.log(
        `  Trump support:    ${trumpSupport} card(s) in ${openingSuit}`,
      );
      console.log(
        `  Has shortage:     ${hasShortage} (min suit len = ${Math.min(...suitLengths)})`,
      );
      console.log(`  Correct bid:      ${correctBid}`);
      console.log(`  Bid meaning:      ${bidMeaning || "(none)"}`);
      console.log(
        `  Bergen type:      ${bidType} (expected HCP: ${hcpBand[bidType] ?? "n/a"})`,
      );

      // All 4 hands
      console.log("-".repeat(76));
      console.log("  ALL 4 HANDS:");
      if (allHands.length === 4) {
        for (const h of allHands) {
          console.log(`    ${h.seat.padEnd(6)} (${String(h.hcp).padStart(2)} HCP): ${fmtHand(h)}`);
        }
      } else if (allHands.length > 0) {
        for (const h of allHands) {
          console.log(`    ${h.seat.padEnd(6)} (${String(h.hcp).padStart(2)} HCP): ${fmtHand(h)}`);
        }
        console.log(`    (only ${allHands.length} hands parsed)`);
      } else {
        console.log("    (could not parse All Hands section)");
        for (const line of allHandsText.split("\n").slice(0, 25)) {
          if (line.trim()) console.log(`      ${line.trim()}`);
        }
      }

      // Suggested bid details
      console.log("-".repeat(76));
      console.log("  SUGGESTED BID (debug drawer):");
      for (const line of suggestedBidText.split("\n")) {
        if (line.trim()) console.log(`    ${line.trim()}`);
      }

      // Pipeline
      console.log("-".repeat(76));
      console.log("  PIPELINE:");
      for (const line of pipelineText.split("\n")) {
        if (line.trim()) console.log(`    ${line.trim()}`);
      }

      // Hand facts
      console.log("-".repeat(76));
      console.log("  HAND FACTS:");
      for (const line of handFactsText.split("\n")) {
        if (line.trim()) console.log(`    ${line.trim()}`);
      }

      // -- 10. Verify Bergen rules --
      const issues: string[] = [];

      if (bidType !== "pass" && !bidType.startsWith("other")) {
        // Support check
        if (trumpSupport >= 0 && trumpSupport < 4) {
          issues.push(
            `Trump support = ${trumpSupport}, expected >= 4 for Bergen ${bidType}`,
          );
        }

        // HCP range checks (accounting for priority overlap)
        switch (bidType) {
          case "constructive":
            if (southHcp < 7 || southHcp > 10)
              issues.push(
                `Constructive raise HCP = ${southHcp}, expected 7-10`,
              );
            if (southHcp === 10)
              issues.push(
                `HCP = 10: limit (3D, priority 2) should outrank constructive (3C, priority 3)`,
              );
            break;

          case "limit":
            if (southHcp < 10 || southHcp > 12)
              issues.push(
                `Limit raise HCP = ${southHcp}, expected 10-12`,
              );
            if (southHcp >= 12 && hasShortage)
              issues.push(
                `HCP = ${southHcp} with shortage: splinter should outrank limit (priority 0 vs 2)`,
              );
            break;

          case "preemptive":
            if (southHcp > 6)
              issues.push(
                `Preemptive raise HCP = ${southHcp}, expected <= 6`,
              );
            break;

          case "game":
            if (southHcp < 13)
              issues.push(
                `Game raise HCP = ${southHcp}, expected >= 13`,
              );
            if (hasShortage && southHcp >= 12)
              issues.push(
                `HCP = ${southHcp} with shortage: splinter should outrank game (priority 0 vs 1)`,
              );
            break;

          case "splinter":
            if (southHcp < 12)
              issues.push(
                `Splinter HCP = ${southHcp}, expected >= 12`,
              );
            if (!hasShortage)
              issues.push(`Splinter without shortage in any suit`);
            break;
        }
      } else if (bidType === "pass") {
        // Verify pass is correct — typically because trump support < 4
        if (trumpSupport >= 4) {
          issues.push(
            `No Bergen bid recommended but trump support = ${trumpSupport} (should have a Bergen response)`,
          );
        }
      }

      // Log verdict
      if (issues.length > 0) {
        console.log("-".repeat(76));
        console.log("  !! ISSUES:");
        for (const iss of issues) console.log(`    * ${iss}`);
      } else {
        console.log("-".repeat(76));
        console.log(`  PASS: Bergen rules verified - seed ${seed} OK`);
      }

      // -- 11. Close debug drawer before bid interaction (mobile viewports) --
      await closeDebugDrawer(page);

      // -- 12. Make the correct bid & verify feedback --
      const testId = bidToTestId(correctBid);
      const bidButton = page.getByTestId(testId);
      await expect(bidButton).toBeVisible({ timeout: 3_000 });
      await bidButton.click();

      await page.waitForTimeout(800);

      const correctMarker = page.getByTestId("bid-correct");
      const incorrectMarker = page.getByTestId("bid-incorrect");

      const wasCorrect = await correctMarker
        .first()
        .isVisible()
        .catch(() => false);
      const wasIncorrect = await incorrectMarker
        .first()
        .isVisible()
        .catch(() => false);

      if (wasCorrect) {
        console.log(`  PASS: Bid submitted -> marked CORRECT`);
      } else if (wasIncorrect) {
        console.log(`  FAIL: Bid submitted -> marked INCORRECT (unexpected!)`);
        const alert = page.locator("[role='alert']");
        if (await alert.isVisible().catch(() => false)) {
          const alertText =
            (await alert.innerText().catch(() => "")) || "";
          console.log(`  Feedback: ${alertText.substring(0, 300)}`);
        }
      } else {
        const currentPhase =
          (await page.getByTestId("game-phase").textContent()) ?? "";
        console.log(
          `  INFO: No bid marker visible - phase is now "${currentPhase}"`,
        );
      }

      console.log("=".repeat(76));
      console.log("");

      // -- 13. Soft assertion: no Bergen rule violations --
      expect
        .soft(
          issues.length,
          `Bergen rule violations for seed ${seed}: ${issues.join("; ")}`,
        )
        .toBe(0);
    });
  }
});
