/**
 * DONT Convention E2E Tests
 *
 * Tests the DONT (Disturbing Opponent's No Trump) convention practice mode.
 * Verifies correct bid recommendations for seeds 1-15 against the DONT rules:
 *
 *   - 2♥  = both majors (H5+S4+ or S5+H4+)
 *   - 2♦  = diamonds + a major (D5+ and H4+/S4+)
 *   - 2♣  = clubs + a higher suit (C5+ and D4+/H4+/S4+)
 *   - 2♠  = natural long spades (S6+)
 *   - X   = single-suited, not spades (one suit 6+, no other 4+, longest ≠ ♠)
 *   - Pass = nothing qualifies
 *
 * Priority: 2♥ > 2♦ > 2♣ > 2♠ > X > Pass
 *
 * Each test captures: South's hand, HCP, suit lengths, all 4 hands,
 * the correct bid, the rule/explanation, and verifies against DONT logic.
 */
import { test, expect } from "@playwright/test";

// ── Per-seed expected data ────────────────────────────────────────────────────
// Gathered from deterministic runs with seeds 1-15 and independently verified
// against the DONT convention rules implemented in the codebase.
interface SeedData {
  seed: number;
  hcp: number;
  /** suit lengths [♠, ♥, ♦, ♣] */
  shape: [number, number, number, number];
  expectedBid: string;
  expectedRule: string;
  /** Brief explanation of why this bid is correct */
  reason: string;
  southCards: string;
  allHands: {
    north: { hcp: number; cards: string };
    east:  { hcp: number; cards: string };
    south: { hcp: number; cards: string };
    west:  { hcp: number; cards: string };
  };
}

const SEEDS: SeedData[] = [
  {
    seed: 1, hcp: 13, shape: [6, 2, 3, 2],
    expectedBid: "2♠", expectedRule: "dont:natural-spades-2s",
    reason: "S=6 ≥ 6 → natural spades",
    southCards: "AQ7543/AJ/QT5/43",
    allHands: {
      north: { hcp: 7,  cards: "♠ KJT ♥ Q932 ♦ J964 ♣ 62" },
      east:  { hcp: 15, cards: "♠ 2 ♥ K764 ♦ AK82 ♣ KQT9" },
      south: { hcp: 13, cards: "♠ AQ7543 ♥ AJ ♦ QT5 ♣ 43" },
      west:  { hcp: 5,  cards: "♠ 986 ♥ T85 ♦ 73 ♣ AJ875" },
    },
  },
  {
    seed: 2, hcp: 9, shape: [3, 3, 5, 2],
    expectedBid: "Pass", expectedRule: "dont:overcaller-pass",
    reason: "D=5 but no 4+ major → no qualifying pattern",
    southCards: "QT8/K95/KJT72/52",
    allHands: {
      north: { hcp: 5,  cards: "♠ 97652 ♥ J4 ♦ A986 ♣ 74" },
      east:  { hcp: 16, cards: "♠ AKJ4 ♥ AT876 ♦ 5 ♣ A86" },
      south: { hcp: 9,  cards: "♠ QT8 ♥ K95 ♦ KJT72 ♣ 52" },
      west:  { hcp: 10, cards: "♠ 3 ♥ Q32 ♦ Q43 ♣ KQJT93" },
    },
  },
  {
    seed: 3, hcp: 8, shape: [3, 4, 5, 1],
    expectedBid: "2♦", expectedRule: "dont:diamonds-major-2d",
    reason: "D=5 ≥ 5 and H=4 ≥ 4 → diamonds + a major",
    southCards: "K42/Q875/K9653/7",
    allHands: {
      north: { hcp: 11, cards: "♠ J7 ♥ A9642 ♦ AQ87 ♣ 82" },
      east:  { hcp: 17, cards: "♠ AQT83 ♥ J ♦ 2 ♣ AKQJT9" },
      south: { hcp: 8,  cards: "♠ K42 ♥ Q875 ♦ K9653 ♣ 7" },
      west:  { hcp: 4,  cards: "♠ 965 ♥ KT3 ♦ JT4 ♣ 6543" },
    },
  },
  {
    seed: 4, hcp: 8, shape: [1, 3, 4, 5],
    expectedBid: "2♣", expectedRule: "dont:clubs-higher-2c",
    reason: "C=5 ≥ 5 and D=4 ≥ 4 → clubs + a higher suit",
    southCards: "4/Q84/J872/AJT76",
    allHands: {
      north: { hcp: 11, cards: "♠ A9873 ♥ KJ62 ♦ 9 ♣ K43" },
      east:  { hcp: 17, cards: "♠ KQJ52 ♥ 9 ♦ AKQ54 ♣ Q9" },
      south: { hcp: 8,  cards: "♠ 4 ♥ Q84 ♦ J872 ♣ AJT76" },
      west:  { hcp: 4,  cards: "♠ T6 ♥ AT753 ♦ T63 ♣ 852" },
    },
  },
  {
    seed: 5, hcp: 8, shape: [2, 5, 4, 2],
    expectedBid: "Pass", expectedRule: "dont:overcaller-pass",
    reason: "H=5 but S=2 < 4; no 5+ C or D pairing; no 6+ suit → pass",
    southCards: "94/JT876/T985/AK",
    allHands: {
      north: { hcp: 4,  cards: "♠ T863 ♥ 53 ♦ QJ73 ♣ J73" },
      east:  { hcp: 17, cards: "♠ AK2 ♥ AK42 ♦ K6 ♣ T852" },
      south: { hcp: 8,  cards: "♠ 94 ♥ JT876 ♦ T985 ♣ AK" },
      west:  { hcp: 11, cards: "♠ QJ75 ♥ Q9 ♦ A42 ♣ Q964" },
    },
  },
  {
    seed: 6, hcp: 13, shape: [3, 3, 2, 5],
    expectedBid: "Pass", expectedRule: "dont:overcaller-pass",
    reason: "C=5 but no 4+ higher suit (S=3,H=3,D=2) → pass",
    southCards: "K95/Q63/Q8/AQ983",
    allHands: {
      north: { hcp: 9,  cards: "♠ J73 ♥ AJ8742 ♦ 742 ♣ K" },
      east:  { hcp: 16, cards: "♠ A8 ♥ K95 ♦ AKJ653 ♣ J4" },
      south: { hcp: 13, cards: "♠ K95 ♥ Q63 ♦ Q8 ♣ AQ983" },
      west:  { hcp: 2,  cards: "♠ QT642 ♥ T ♦ T9 ♣ T7652" },
    },
  },
  {
    seed: 7, hcp: 8, shape: [5, 1, 1, 6],
    expectedBid: "2♣", expectedRule: "dont:clubs-higher-2c",
    reason: "C=6 ≥ 5 and S=5 ≥ 4 → clubs + a higher suit",
    southCards: "AK943/2/3/J97643",
    allHands: {
      north: { hcp: 9,  cards: "♠ T8 ♥ Q9765 ♦ AK972 ♣ 2" },
      east:  { hcp: 16, cards: "♠ Q6 ♥ AKJ ♦ QJT65 ♣ KT8" },
      south: { hcp: 8,  cards: "♠ AK943 ♥ 2 ♦ 3 ♣ J97643" },
      west:  { hcp: 7,  cards: "♠ J752 ♥ T843 ♦ 84 ♣ AQ5" },
    },
  },
  {
    seed: 8, hcp: 12, shape: [3, 5, 0, 5],
    expectedBid: "2♣", expectedRule: "dont:clubs-higher-2c",
    reason: "C=5 ≥ 5 and H=5 ≥ 4 → clubs + a higher suit",
    southCards: "Q82/AK643//QJ976",
    allHands: {
      north: { hcp: 9,  cards: "♠ 963 ♥ QT92 ♦ AQJ9 ♣ 83" },
      east:  { hcp: 15, cards: "♠ AKJ7 ♥ 8 ♦ KT8743 ♣ A4" },
      south: { hcp: 12, cards: "♠ Q82 ♥ AK643 ♦ ♣ QJ976" },
      west:  { hcp: 4,  cards: "♠ T54 ♥ J75 ♦ 652 ♣ KT52" },
    },
  },
  {
    seed: 9, hcp: 13, shape: [2, 6, 2, 3],
    expectedBid: "X", expectedRule: "dont:single-suited-double",
    reason: "H=6 ≥ 6, no other suit 4+, longest not ♠ → single-suited double",
    southCards: "A7/AQT743/T9/K62",
    allHands: {
      north: { hcp: 5,  cards: "♠ 942 ♥ K ♦ Q7632 ♣ 8753" },
      east:  { hcp: 16, cards: "♠ KQ ♥ J98652 ♦ A ♣ AQ94" },
      south: { hcp: 13, cards: "♠ A7 ♥ AQT743 ♦ T9 ♣ K62" },
      west:  { hcp: 6,  cards: "♠ JT8653 ♥ ♦ KJ854 ♣ JT" },
    },
  },
  {
    seed: 10, hcp: 9, shape: [4, 2, 6, 1],
    expectedBid: "2♦", expectedRule: "dont:diamonds-major-2d",
    reason: "D=6 ≥ 5 and S=4 ≥ 4 → diamonds + a major",
    southCards: "QJ43/A2/QT9762/7",
    allHands: {
      north: { hcp: 1,  cards: "♠ 7652 ♥ 865 ♦ 83 ♣ J953" },
      east:  { hcp: 15, cards: "♠ AT ♥ JT93 ♦ AK4 ♣ K862" },
      south: { hcp: 9,  cards: "♠ QJ43 ♥ A2 ♦ QT9762 ♣ 7" },
      west:  { hcp: 15, cards: "♠ K98 ♥ KQ74 ♦ J5 ♣ AQT4" },
    },
  },
  {
    seed: 11, hcp: 12, shape: [2, 3, 3, 5],
    expectedBid: "Pass", expectedRule: "dont:overcaller-pass",
    reason: "C=5 but no 4+ higher suit → pass",
    southCards: "A8/Q64/Q65/KJ987",
    allHands: {
      north: { hcp: 2,  cards: "♠ T9754 ♥ 732 ♦ T87 ♣ Q6" },
      east:  { hcp: 16, cards: "♠ K3 ♥ A95 ♦ AJ932 ♣ AT4" },
      south: { hcp: 12, cards: "♠ A8 ♥ Q64 ♦ Q65 ♣ KJ987" },
      west:  { hcp: 10, cards: "♠ QJ62 ♥ KJT8 ♦ K4 ♣ 532" },
    },
  },
  {
    seed: 12, hcp: 8, shape: [2, 4, 1, 6],
    expectedBid: "2♣", expectedRule: "dont:clubs-higher-2c",
    reason: "C=6 ≥ 5 and H=4 ≥ 4 → clubs + a higher suit",
    southCards: "J2/Q542/4/AJT742",
    allHands: {
      north: { hcp: 7,  cards: "♠ T43 ♥ 3 ♦ AQJ982 ♣ 953" },
      east:  { hcp: 15, cards: "♠ K985 ♥ KJ6 ♦ K76 ♣ KQ8" },
      south: { hcp: 8,  cards: "♠ J2 ♥ Q542 ♦ 4 ♣ AJT742" },
      west:  { hcp: 10, cards: "♠ AQ76 ♥ AT987 ♦ T53 ♣ 6" },
    },
  },
  {
    seed: 13, hcp: 10, shape: [5, 2, 3, 3],
    expectedBid: "Pass", expectedRule: "dont:overcaller-pass",
    reason: "S=5 but no 2H(needs H4+), no 2S(needs S6+), no 2C/2D pattern → pass",
    southCards: "K9643/J4/753/AQ6",
    allHands: {
      north: { hcp: 9,  cards: "♠ AJ ♥ K8 ♦ JT864 ♣ T732" },
      east:  { hcp: 15, cards: "♠ Q52 ♥ AQT972 ♦ A ♣ K84" },
      south: { hcp: 10, cards: "♠ K9643 ♥ J4 ♦ 753 ♣ AQ6" },
      west:  { hcp: 6,  cards: "♠ T87 ♥ 653 ♦ KQ92 ♣ J95" },
    },
  },
  {
    seed: 14, hcp: 8, shape: [3, 2, 5, 3],
    expectedBid: "Pass", expectedRule: "dont:overcaller-pass",
    reason: "D=5 but H=2,S=3 → no 4+ major → diamonds+major fails → pass",
    southCards: "743/A4/QJ532/J87",
    allHands: {
      north: { hcp: 10, cards: "♠ T ♥ KJ98752 ♦ K4 ♣ K93" },
      east:  { hcp: 16, cards: "♠ AKQJ95 ♥ Q6 ♦ 876 ♣ A4" },
      south: { hcp: 8,  cards: "♠ 743 ♥ A4 ♦ QJ532 ♣ J87" },
      west:  { hcp: 6,  cards: "♠ 862 ♥ T3 ♦ AT9 ♣ QT652" },
    },
  },
  {
    seed: 15, hcp: 9, shape: [2, 8, 2, 1],
    expectedBid: "X", expectedRule: "dont:single-suited-double",
    reason: "H=8 ≥ 6, no other suit 4+, longest not ♠ → single-suited double",
    southCards: "K7/KQJT9876/T5/3",
    allHands: {
      north: { hcp: 12, cards: "♠ JT932 ♥ A42 ♦ A ♣ KT98" },
      east:  { hcp: 15, cards: "♠ AQ6 ♥ 5 ♦ KJ8432 ♣ AJ5" },
      south: { hcp: 9,  cards: "♠ K7 ♥ KQJT9876 ♦ T5 ♣ 3" },
      west:  { hcp: 4,  cards: "♠ 854 ♥ 3 ♦ Q976 ♣ Q7642" },
    },
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Map a bid button testid suffix to the displayed bid symbol */
function bidToTestId(bid: string): string {
  const map: Record<string, string> = {
    "Pass": "bid-pass",
    "X": "bid-double",
    "XX": "bid-redouble",
    "2♣": "bid-2C",
    "2♦": "bid-2D",
    "2♥": "bid-2H",
    "2♠": "bid-2S",
  };
  return map[bid] ?? `bid-${bid}`;
}

/**
 * Independently verify the expected DONT bid for a given shape.
 * Returns the bid a correct DONT implementation should recommend.
 */
function verifyDontBid(shape: [number, number, number, number]): string {
  const [s, h, d, c] = shape;

  // Priority 1: 2♥ = both majors
  if ((h >= 5 && s >= 4) || (s >= 5 && h >= 4)) return "2♥";

  // Priority 2: 2♦ = diamonds + a major
  if (d >= 5 && (h >= 4 || s >= 4)) return "2♦";

  // Priority 3: 2♣ = clubs + a higher suit
  if (c >= 5 && (d >= 4 || h >= 4 || s >= 4)) return "2♣";

  // Priority 4: 2♠ = natural long spades
  if (s >= 6) return "2♠";

  // Priority 5: X = single-suited (not spades)
  const lengths = [
    { suit: "S", len: s },
    { suit: "H", len: h },
    { suit: "D", len: d },
    { suit: "C", len: c },
  ];
  const longest = lengths.reduce((a, b) => (b.len > a.len ? b : a));
  const otherHas4Plus = lengths.some(
    (l) => l.suit !== longest.suit && l.len >= 4,
  );
  if (longest.len >= 6 && longest.suit !== "S" && !otherHas4Plus) return "X";

  // Fallback: Pass
  return "Pass";
}

// ── Test helpers ──────────────────────────────────────────────────────────────

/**
 * Navigate to DONT practice and wait for bidding phase.
 * Returns an object with useful page accessors.
 */
async function setupDontPractice(
  page: import("@playwright/test").Page,
  seed: number,
) {
  await page.goto(`/?convention=dont-bundle&seed=${seed}`);
  const phaseLabel = page.getByTestId("game-phase");
  await expect(phaseLabel).toHaveText("Bidding", { timeout: 10000 });
  await expect(page.getByTestId("bid-pass")).toBeEnabled({ timeout: 5000 });
  return { phaseLabel };
}

/**
 * Open the debug panel and extract structured bid/hand info.
 * Debug sections use native <details>/<summary> elements.
 * "Suggested Bid" starts open by default; all others start closed.
 */
async function getDebugInfo(page: import("@playwright/test").Page) {
  // Open debug drawer if not already open
  const debugToggle = page.getByTestId("debug-toggle");
  await debugToggle.click();
  await page.waitForTimeout(300);

  // Force-open the "All Hands" <details> section via JS
  await page.evaluate(() => {
    const summaries = document.querySelectorAll("summary");
    for (const s of summaries) {
      if (s.textContent?.trim().startsWith("All Hands")) {
        (s.parentElement as HTMLDetailsElement).open = true;
      }
    }
  });
  await page.waitForTimeout(200);

  return page.evaluate(() => {
    const body = document.body.innerText;

    // Extract suggested bid info ("Suggested Bid" <details> is open by default)
    const sugMatch = body.match(
      /Suggested Bid\n(\S+)\n([^\n]*)\nrule\n(\S+)\nexplanation\n(\S+)\nhand\n([^\n]*)\nconvention\n(\S+)\ncandidates\n(\d+)/,
    );
    const suggestedBid = sugMatch
      ? {
          bid: sugMatch[1],
          meaning: sugMatch[2],
          rule: sugMatch[3],
          hand: sugMatch[5],
          candidates: parseInt(sugMatch[7]),
        }
      : null;

    // Extract all hands text (now the <details> is open)
    const handsMatch = body.match(
      /All Hands\n([\s\S]*?)(?=Convention Machine|Hand Facts)/,
    );
    const allHandsText = handsMatch ? handsMatch[1].trim() : "";

    // Extract HCP from the south-hcp element
    const hcpEl = document.querySelector('[data-testid="south-hcp"]');
    const hcpText = hcpEl?.textContent ?? "";

    return { suggestedBid, allHandsText, hcpText };
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("DONT Convention — Correctness verification (seeds 1-15)", () => {
  for (const sd of SEEDS) {
    test(`seed ${sd.seed}: shape ${sd.shape.join("-")} → ${sd.expectedBid} (${sd.expectedRule})`, async ({
      page,
    }) => {
      // ── 1. Independently verify the expected bid against DONT rules ──────
      const computedBid = verifyDontBid(sd.shape);
      expect(
        computedBid,
        `Independent DONT rule verification failed for seed ${sd.seed}: ` +
          `shape [${sd.shape}] should yield ${sd.expectedBid} but computed ${computedBid}`,
      ).toBe(sd.expectedBid);

      // ── 2. Load the game ─────────────────────────────────────────────────
      await setupDontPractice(page, sd.seed);

      // ── 3. Verify HCP display ────────────────────────────────────────────
      const hcpEl = page.getByTestId("south-hcp");
      await expect(hcpEl).toHaveText(`${sd.hcp} HCP`);

      // ── 4. Verify the auction starts with East opening 1NT ───────────────
      const tableCenter = page.getByTestId("table-center");
      const auctionText = await tableCenter.textContent();
      expect(auctionText).toContain("1NT");

      // ── 5. Open debug panel and verify app's recommendation ──────────────
      const debug = await getDebugInfo(page);

      expect(debug.suggestedBid).not.toBeNull();
      expect(
        debug.suggestedBid!.bid,
        `App recommends ${debug.suggestedBid!.bid} but expected ${sd.expectedBid} for seed ${sd.seed}`,
      ).toBe(sd.expectedBid);
      expect(debug.suggestedBid!.rule).toBe(sd.expectedRule);

      // ── 6. Verify the hand shape shown in debug matches expected ─────────
      const handShape = debug.suggestedBid!.hand;
      expect(handShape).toContain(`${sd.shape[0]}♠`);
      expect(handShape).toContain(`${sd.shape[1]}♥`);
      expect(handShape).toContain(`${sd.shape[2]}♦`);
      expect(handShape).toContain(`${sd.shape[3]}♣`);
      expect(handShape).toContain(`${sd.hcp} HCP`);

      // ── 7. Verify pipeline has 6 candidates (the 6 R1 DONT bids) ────────
      expect(debug.suggestedBid!.candidates).toBe(6);

      // ── 8. Verify all 4 hands are shown ──────────────────────────────────
      if (debug.allHandsText) {
        expect(debug.allHandsText).toContain(`S (${sd.hcp} HCP)`);
        expect(debug.allHandsText).toContain(`E (`);
      }

      // ── 9. Submit the correct bid and verify positive feedback ───────────
      const bidTestId = bidToTestId(sd.expectedBid);
      await page.getByTestId(bidTestId).click();

      const feedbackPanel = page.locator("[role='alert']");
      await expect(feedbackPanel).toBeVisible({ timeout: 5000 });

      const feedbackText = await feedbackPanel.textContent();
      expect(feedbackText).toContain("Correct");
    });
  }
});

test.describe("DONT Convention — Wrong bid gives feedback with retry", () => {
  // Use seed 1 (expected: 2♠) and bid Pass to trigger incorrect feedback
  test("seed 1: bidding Pass instead of 2♠ shows incorrect feedback", async ({
    page,
  }) => {
    await setupDontPractice(page, 1);

    // Bid wrong: Pass instead of 2♠
    await page.getByTestId("bid-pass").click();

    // Feedback panel should appear with "Incorrect"
    const feedbackPanel = page.locator("[role='alert']");
    await expect(feedbackPanel).toBeVisible({ timeout: 5000 });
    const feedbackText = await feedbackPanel.textContent();
    expect(feedbackText).toContain("Incorrect");

    // Retry button should be available
    const retryBtn = page.getByRole("button", { name: /try again/i });
    await expect(retryBtn).toBeVisible();
    await retryBtn.click();

    // After retry, bid buttons should be enabled again
    await expect(page.getByTestId("bid-pass")).toBeEnabled({ timeout: 5000 });

    // Now bid correctly: 2♠
    await page.getByTestId("bid-2S").click();

    const successFeedback = page.locator("[role='alert']");
    await expect(successFeedback).toBeVisible({ timeout: 5000 });
    const successText = await successFeedback.textContent();
    expect(successText).toContain("Correct");
  });

  // Use seed 9 (expected: X double) and bid 2♣ to trigger incorrect feedback
  test("seed 9: bidding 2♣ instead of X shows incorrect feedback", async ({
    page,
  }) => {
    await setupDontPractice(page, 9);

    // Bid wrong: 2♣ instead of X
    await page.getByTestId("bid-2C").click();

    const feedbackPanel = page.locator("[role='alert']");
    await expect(feedbackPanel).toBeVisible({ timeout: 5000 });
    const feedbackText = await feedbackPanel.textContent();
    expect(feedbackText).toContain("Incorrect");
  });
});

test.describe("DONT Convention — Convention-specific edge cases", () => {
  // Seed 5: 5♥ 4♦ but NOT enough for any DONT bid
  // H=5 needs S≥4 for 2♥ (bothMajors), but S=2
  // D=4 < 5 so no 2♦ (diamondsAndMajor)
  // C=2 < 5 so no 2♣ (clubsAndHigher)
  // No suit 6+ so no 2♠ or X
  test("seed 5: 5♥ 4♦ shape correctly passes (no qualifying DONT pattern)", async ({
    page,
  }) => {
    await setupDontPractice(page, 5);

    const debug = await getDebugInfo(page);
    expect(debug.suggestedBid!.bid).toBe("Pass");
    expect(debug.suggestedBid!.rule).toBe("dont:overcaller-pass");

    // Verify pass is correct
    await page.getByTestId("bid-pass").click();
    const feedback = page.locator("[role='alert']");
    await expect(feedback).toBeVisible({ timeout: 5000 });
    const text = await feedback.textContent();
    expect(text).toContain("Correct");
  });

  // Seed 6: 5♣ but no 4+ higher suit — clubs need a higher partner
  test("seed 6: 5♣ with no 4+ higher suit correctly passes", async ({
    page,
  }) => {
    await setupDontPractice(page, 6);

    const debug = await getDebugInfo(page);
    expect(debug.suggestedBid!.bid).toBe("Pass");

    await page.getByTestId("bid-pass").click();
    const feedback = page.locator("[role='alert']");
    await expect(feedback).toBeVisible({ timeout: 5000 });
    const text = await feedback.textContent();
    expect(text).toContain("Correct");
  });

  // Seed 7: 6♣ 5♠ — clubs+higher beats natural spades and single-suited
  // C=6≥5 and S=5≥4 → 2♣ (clubs+higher, spec=3) beats 2♠ (spec=2)
  test("seed 7: 6♣ 5♠ bids 2♣ (two-suited outranks single-suited)", async ({
    page,
  }) => {
    await setupDontPractice(page, 7);

    const debug = await getDebugInfo(page);
    expect(debug.suggestedBid!.bid).toBe("2♣");
    expect(debug.suggestedBid!.rule).toBe("dont:clubs-higher-2c");
  });

  // Seed 15: 8♥ — extreme single-suited hand
  test("seed 15: 8♥ single-suited doubles (extreme shape)", async ({
    page,
  }) => {
    await setupDontPractice(page, 15);

    const debug = await getDebugInfo(page);
    expect(debug.suggestedBid!.bid).toBe("X");
    expect(debug.suggestedBid!.rule).toBe("dont:single-suited-double");

    // The hand shape should show 8 hearts
    expect(debug.suggestedBid!.hand).toContain("8♥");
  });
});

test.describe("DONT Convention — Navigation and lifecycle", () => {
  test("can navigate to DONT via practice button", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Find and click the DONT practice button
    const practiceBtn = page.getByTestId("practice-dont-bundle");
    await expect(practiceBtn).toBeVisible();
    await practiceBtn.click();

    // Should enter bidding phase
    const phaseLabel = page.getByTestId("game-phase");
    await expect(phaseLabel).toHaveText("Bidding", { timeout: 10000 });
  });

  test("back button returns to convention select", async ({ page }) => {
    await page.goto("/?convention=dont-bundle&seed=1");
    const phaseLabel = page.getByTestId("game-phase");
    await expect(phaseLabel).toHaveText("Bidding", { timeout: 10000 });

    await page.getByTestId("back-to-menu").click();
    const heading = page.locator("h1");
    await expect(heading).toHaveText("Bridge Practice", { timeout: 5000 });
  });

  test("DONT deals have East as 1NT opener (15-17 HCP)", async ({ page }) => {
    // Verify across 3 seeds that East always has 15-17 HCP
    for (const seed of [1, 5, 10]) {
      await page.goto(`/?convention=dont-bundle&seed=${seed}`);
      await expect(page.getByTestId("game-phase")).toHaveText("Bidding", {
        timeout: 10000,
      });
      await expect(page.getByTestId("bid-pass")).toBeEnabled({ timeout: 5000 });

      const debug = await getDebugInfo(page);
      if (debug.allHandsText) {
        const eastMatch = debug.allHandsText.match(/E \((\d+) HCP\)/);
        if (eastMatch) {
          const eastHcp = parseInt(eastMatch[1]);
          expect(
            eastHcp,
            `Seed ${seed}: East HCP ${eastHcp} should be 15-17 for 1NT opener`,
          ).toBeGreaterThanOrEqual(15);
          expect(eastHcp).toBeLessThanOrEqual(17);
        }
      }
    }
  });

  test("DONT deals have South with 8-15 HCP", async ({ page }) => {
    for (const sd of SEEDS) {
      expect(
        sd.hcp,
        `Seed ${sd.seed}: South HCP ${sd.hcp} should be 8-15`,
      ).toBeGreaterThanOrEqual(8);
      expect(sd.hcp).toBeLessThanOrEqual(15);
    }
  });
});

test.describe("DONT Convention — Independent rule verification", () => {
  // Pure logic tests (no browser needed) verifying our verifyDontBid function
  // against known hand patterns
  test("verifyDontBid covers all DONT bid types", () => {
    // 2♥: both majors
    expect(verifyDontBid([4, 5, 2, 2])).toBe("2♥");
    expect(verifyDontBid([5, 5, 2, 1])).toBe("2♥");
    expect(verifyDontBid([5, 4, 3, 1])).toBe("2♥");

    // 2♦: diamonds + major
    expect(verifyDontBid([4, 2, 5, 2])).toBe("2♦");
    expect(verifyDontBid([3, 4, 5, 1])).toBe("2♦");
    expect(verifyDontBid([2, 4, 6, 1])).toBe("2♦");

    // 2♣: clubs + higher
    expect(verifyDontBid([1, 3, 4, 5])).toBe("2♣");
    expect(verifyDontBid([4, 1, 2, 6])).toBe("2♣");
    expect(verifyDontBid([2, 4, 1, 6])).toBe("2♣");

    // 2♠: natural (S6+, no two-suited pattern wins)
    expect(verifyDontBid([6, 2, 3, 2])).toBe("2♠");
    expect(verifyDontBid([7, 2, 2, 2])).toBe("2♠");

    // X: single suited (not spades)
    expect(verifyDontBid([2, 6, 2, 3])).toBe("X");
    expect(verifyDontBid([1, 2, 7, 3])).toBe("X");
    expect(verifyDontBid([2, 1, 3, 7])).toBe("X");
    expect(verifyDontBid([2, 8, 2, 1])).toBe("X");

    // Pass: no qualifying pattern
    expect(verifyDontBid([3, 3, 5, 2])).toBe("Pass");
    expect(verifyDontBid([3, 3, 2, 5])).toBe("Pass");
    expect(verifyDontBid([4, 4, 3, 2])).toBe("Pass");
    expect(verifyDontBid([5, 2, 3, 3])).toBe("Pass");
  });

  test("priority: two-suited (spec=3) beats single-suited (spec=2)", () => {
    // 6♣ 5♠ → 2♣ (clubs+higher spec=3) NOT 2♠ (natural spec=2)
    expect(verifyDontBid([5, 1, 1, 6])).toBe("2♣");

    // 6♠ 4♥ → 2♥ (bothMajors spec=3) NOT 2♠ (natural spec=2)
    expect(verifyDontBid([6, 4, 2, 1])).toBe("2♥");

    // 6♦ 4♠ → 2♦ (diamonds+major spec=3) NOT X (single-suited spec=2)
    expect(verifyDontBid([4, 1, 6, 2])).toBe("2♦");
  });

  test("priority order: 2♥ > 2♦ > 2♣ when multiple patterns match", () => {
    // S4 H5 D5 C1 → both 2♥ (bothMajors) and 2♦ (diamonds+major) match
    // → 2♥ wins (higher priority)
    expect(verifyDontBid([4, 5, 5, 1])).toBe("2♥");

    // S1 H4 D5 C5 → both 2♦ and 2♣ match → 2♦ wins
    expect(verifyDontBid([1, 4, 5, 5])).toBe("2♦");
  });
});
