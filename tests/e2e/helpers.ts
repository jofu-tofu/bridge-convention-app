import { expect, type Page } from "@playwright/test";

export function bidTextToTestId(bidText: string): string {
  const normalized = bidText.trim();

  if (/^pass$/i.test(normalized) || /no convention bid/i.test(normalized)) {
    return "bid-P";
  }

  if (/^(x|dbl|double)$/i.test(normalized)) {
    return "bid-X";
  }

  if (/^(xx|rdbl|redouble)$/i.test(normalized)) {
    return "bid-XX";
  }

  return `bid-${normalized
    .replace(/♣/g, "C")
    .replace(/♦/g, "D")
    .replace(/♥/g, "H")
    .replace(/♠/g, "S")
    .replace(/\s+/g, "")}`;
}

export async function closeDebugDrawer(page: Page): Promise<void> {
  try {
    await page.locator('button[aria-label="Close debug panel"]').click({ timeout: 1000 });
    await page.waitForTimeout(300);
  } catch {
    // Already closed or not interactable.
  }
}

export async function readDebugDrawerText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const drawer = document.querySelector('aside[aria-label="Debug drawer"]');
    if (drawer && !drawer.hasAttribute("inert")) {
      drawer.querySelectorAll("details").forEach((d) => {
        if (d instanceof HTMLDetailsElement) {
          d.open = true;
        }
      });
      return drawer.innerText + "\n" + (document.querySelector("main")?.innerText ?? "");
    }
    return document.body.innerText;
  });
}

export async function waitForPhase(
  page: Page,
  phase: "Bidding" | "Declarer" | "Defend" | "Playing" | "Review",
  timeout = 10_000,
): Promise<void> {
  await expect(page.getByTestId("game-phase")).toHaveText(phase, { timeout });
}

export async function startPracticeFromHome(
  page: Page,
  conventionId: string,
  mode: "decision-drill" | "full-auction" = "decision-drill",
): Promise<void> {
  await page.goto("/");
  await page.getByTestId(`practice-${conventionId}`).click();
  await page.getByTestId(`mode-${mode}`).click({ timeout: 5_000 });
  await waitForPhase(page, "Bidding");
}
