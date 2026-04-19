import { createHmac } from "node:crypto";
import { expect, type APIRequestContext, type APIResponse, type Page } from "@playwright/test";

const E2E_WEBHOOK_SECRET = "whsec_e2e_test_secret";

export interface DevLoginOptions {
  id?: string;
  email?: string;
  display_name?: string;
  subscription_status?: string;
  subscription_current_period_end?: number;
  stripe_customer_id?: string;
  subscription_price_id?: string;
}

/**
 * Upsert a user via the dev-tools `/api/dev/login` endpoint and capture the
 * session cookie into the page's browser context. Playwright's cookie jar
 * handles the Set-Cookie automatically when using `page.request`.
 */
export async function devLogin(page: Page, opts: DevLoginOptions = {}): Promise<void> {
  const response = await page.request.post("/api/dev/login", {
    data: opts,
    headers: { "content-type": "application/json" },
  });
  if (!response.ok()) {
    throw new Error(`devLogin failed: ${response.status()} ${await response.text()}`);
  }
}

export interface StripeEventLike {
  id: string;
  type: string;
  /** Unix seconds — required, embedded in HMAC. */
  created: number;
  data: { object: Record<string, unknown> };
  [key: string]: unknown;
}

/**
 * Sign and POST a Stripe webhook event. HMAC secret is hard-coded to match
 * `STRIPE_WEBHOOK_SECRET` in `playwright.config.ts`.
 *
 * Pass `page.request` (not the top-level `request` fixture) if subsequent
 * assertions need the browser's session cookie honored — though the webhook
 * POST itself is cookie-free.
 */
export async function fireStripeWebhook(
  ctx: APIRequestContext,
  event: StripeEventLike,
): Promise<APIResponse> {
  if (typeof event.created !== "number" || !Number.isFinite(event.created)) {
    throw new Error("fireStripeWebhook: event.created (unix seconds) is required");
  }
  const payload = JSON.stringify({
    object: "event",
    livemode: false,
    pending_webhooks: 1,
    request: null,
    ...event,
  });
  const signedPayload = `${event.created}.${payload}`;
  const signature = createHmac("sha256", E2E_WEBHOOK_SECRET)
    .update(signedPayload)
    .digest("hex");
  const sigHeader = `t=${event.created},v1=${signature}`;
  return ctx.post("/api/billing/webhook", {
    headers: {
      "stripe-signature": sigHeader,
      "content-type": "application/json",
    },
    data: payload,
  });
}


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

export async function waitForPhase(
  page: Page,
  phase: "Bidding" | "Declarer" | "Defend" | "Playing" | "Review",
  timeout = 10_000,
): Promise<void> {
  await expect(page.getByTestId("game-phase")).toHaveText(phase, { timeout });
}

export async function expectNoSettingsButtonInGameShell(page: Page): Promise<void> {
  await expect(
    page.locator('main[aria-label="Bridge drill"]').getByRole("button", { name: /settings/i }),
  ).toHaveCount(0);
}

export async function startPracticeFromHome(
  page: Page,
  conventionId: string,
  mode: "decision-drill" | "full-auction" = "decision-drill",
): Promise<void> {
  const params = new URLSearchParams();
  if (mode !== "decision-drill") {
    params.set("practiceMode", mode);
  }
  const href = params.size > 0 ? `/practice?${params.toString()}` : "/practice";
  await page.goto(href);
  await page.getByTestId(`practice-${conventionId}`).click();
  await waitForPhase(page, "Bidding");
}
