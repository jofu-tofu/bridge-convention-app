import { test, expect } from "@playwright/test";
import { waitForPhase } from "./helpers";

const DECISION_CONTEXT = "Partner opened 1NT. RHO passed. Your turn to respond.";

test.describe("session modes", () => {
  test("convention deep links default to decision drill context", async ({ page }) => {
    await page.goto("/practice?convention=nt-transfers&seed=42");
    await waitForPhase(page, "Bidding");

    await expect(page.getByTestId("practice-mode-label")).toHaveCount(0);
    await expect(page.getByText(DECISION_CONTEXT)).toBeVisible();
  });

  test("practice picker can start full auction mode", async ({ page }) => {
    await page.goto("/practice");
    await page.getByTestId("practice-nt-transfers").click();
    await page.getByTestId("mode-full-auction").click({ timeout: 5_000 });

    await waitForPhase(page, "Bidding");
    await expect(page.getByTestId("practice-mode-label")).toHaveText("Full Auction");
    await expect(page.getByText(DECISION_CONTEXT)).toHaveCount(0);
  });

  test("autoplay reaches review and next deal restarts bidding", async ({ page }) => {
    await page.goto("/practice?convention=nt-bundle&seed=42&dev=autoplay");
    await waitForPhase(page, "Review", 30_000);

    await expect(page.getByRole("heading", { name: "Bidding Review" })).toBeVisible();

    // Capture the current deal counter text before clicking Next Deal
    const dealInfo = page.getByText(/Deal #\d+/);
    const initialText = await dealInfo.textContent();

    await page.getByTestId("next-deal").click();

    // With autoplay, the next deal's bidding may complete instantly.
    // Verify the deal advanced by checking the deal counter changed,
    // then confirm we're in a valid game phase (Bidding or Review).
    await expect(dealInfo).not.toHaveText(initialText!, { timeout: 15_000 });
    const phaseText = await page.getByTestId("game-phase").textContent();
    expect(["Bidding", "Review"]).toContain(phaseText);
  });

  test("review analysis tab renders after autoplay", async ({ page }) => {
    await page.goto("/practice?convention=nt-bundle&seed=42&dev=autoplay");
    await waitForPhase(page, "Review", 30_000);

    const analysisTab = page.getByRole("tab", { name: "Analysis" });
    await expect(analysisTab).toBeVisible();
    await analysisTab.click();

    await expect(
      page.getByText(/DDS analysis not available\.|Makeable Contracts/i),
    ).toBeVisible();
  });
});
