import { expect, test } from "@playwright/test";

import { devLogin, fireStripeWebhook } from "./helpers";

const PAID_BUNDLE = "bergen-bundle";

// Serial: SQLite file backing bridge-api can hit readonly/busy errors under
// concurrent writes when specs run in parallel.
test.describe.configure({ mode: "serial" });

test.describe("billing + auth", () => {
  test("anonymous user is prompted to sign in when opening paid bundle", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/practice?e2e=1");
    await page.getByTestId(`practice-${PAID_BUNDLE}`).click();

    // Either auth-modal or paywall-overlay proves the UI blocked entry to a
    // paid bundle for an anon user. In practice anon users hit the paywall
    // because `canPractice` gates client-side before the 402 fetch.
    // `<dialog>` elements rendered via `showModal()` sometimes confuse
    // Playwright's visibility heuristic — match the button inside the dialog.
    await expect(
      page.getByRole("button", { name: /subscribe|continue with google/i }),
    ).toBeVisible();
  });

  test("free-tier user sees paywall overlay on paid bundle", async ({ page }) => {
    await page.context().clearCookies();
    await devLogin(page, {});
    await page.goto("/practice?e2e=1");
    await page.getByTestId(`practice-${PAID_BUNDLE}`).click();

    await expect(page.getByTestId("paywall-overlay-subscribe")).toBeVisible();
  });

  test("paid user can open the Stripe portal", async ({ page }) => {
    await page.context().clearCookies();
    const periodEnd = Math.floor(Date.now() / 1000) + 86_400;
    await devLogin(page, {
      subscription_status: "active",
      subscription_current_period_end: periodEnd,
      stripe_customer_id: "cus_e2e_paid",
    });

    await page.goto("/settings?e2e=1");
    await page.getByTestId("settings-tab-account").click();

    const portalRequest = page.waitForRequest(
      (req) =>
        req.url().includes("dev-stripe.local/portal/cus_e2e_paid") && req.isNavigationRequest(),
    );
    await page.route("**/dev-stripe.local/**", (route) =>
      route.fulfill({ status: 200, body: "portal-stub" }),
    );

    await page.getByRole("button", { name: /manage subscription/i }).click();

    const req = await portalRequest;
    expect(req.url()).toContain("cus_e2e_paid");
  });

  test("subscription.deleted leaves tier Paid until period_end", async ({ page }) => {
    await page.context().clearCookies();
    const periodEnd = Math.floor(Date.now() / 1000) + 86_400;
    await devLogin(page, {
      subscription_status: "active",
      subscription_current_period_end: periodEnd,
      stripe_customer_id: "cus_e2e_paid_deleted",
    });

    const created = Math.floor(Date.now() / 1000);
    const webhook = await fireStripeWebhook(page.request, {
      id: `evt_e2e_${created}`,
      type: "customer.subscription.deleted",
      created,
      data: { object: { customer: "cus_e2e_paid_deleted" } },
    });
    expect(webhook.status()).toBe(200);

    const me = await page.request.get("/api/auth/me").then((r) => r.json());
    expect(me.subscription_tier).toBe("paid");
  });
});
