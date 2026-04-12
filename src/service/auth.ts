// ── DataPort client ─────────────────────────────────────────────────
// Client-side boundary for all /api/* calls (auth, billing, entitlements, sync).
// Mirrors the contract defined by bridge-api (Axum server).

import {
  AuthRequiredError,
  SubscriptionRequiredError,
  type BillingPlan,
  type DataPortBilling,
} from "./billing";

export interface AuthUser {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  subscription_tier: SubscriptionTier;
  subscription_current_period_end: number | null;
}

export enum SubscriptionTier {
  Free = "free",
  Paid = "paid",
  Expired = "expired",
}

/**
 * Client-side DataPort interface — the boundary between UI/stores and the
 * bridge-api server. Auth, billing, entitlements, progress sync, etc.
 */
export interface DataPort extends DataPortBilling {
  fetchCurrentUser(): Promise<AuthUser | null>;
  getLoginUrl(provider: "google" | "github"): string;
  logout(): Promise<void>;
  /** Dev-only: re-authenticate as the dev user without OAuth. Only set on DevDataPort. */
  devLogin?(): Promise<void>;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

/** Production DataPort — real HTTP calls to bridge-api. */
export class DataPortClient implements DataPort {
  /** Fetch the currently logged-in user, or null if not authenticated. */
  async fetchCurrentUser(): Promise<AuthUser | null> {
    try {
      const resp = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (!resp.ok) return null;
      return (await resp.json()) as AuthUser;
    } catch {
      return null;
    }
  }

  /** Get the login URL for the given OAuth provider. */
  getLoginUrl(provider: "google" | "github"): string {
    return `/api/auth/login/${provider}`;
  }

  /** Log out the current user. */
  async logout(): Promise<void> {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
  }

  async startCheckout(plan: BillingPlan): Promise<{ url: string }> {
    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ plan }),
    });
    return parseJsonResponse<{ url: string }>(response);
  }

  async openBillingPortal(): Promise<{ url: string }> {
    const response = await fetch("/api/billing/portal", {
      method: "POST",
      credentials: "same-origin",
    });
    return parseJsonResponse<{ url: string }>(response);
  }

  async fetchConventionDefinition(bundleId: string): Promise<unknown> {
    const response = await fetch(`/api/conventions/${encodeURIComponent(bundleId)}/definition`, {
      credentials: "same-origin",
    });

    if (response.status === 401) {
      throw new AuthRequiredError();
    }
    if (response.status === 402) {
      throw new SubscriptionRequiredError();
    }

    return parseJsonResponse<unknown>(response);
  }
}

/**
 * Dev-only DataPort that bypasses OAuth and delegates everything else to the
 * real DataPortClient. Only the authentication entry point is faked — all
 * business logic (entitlements, progress, sync) flows through the real server
 * when bridge-api is running, so dev behavior matches production.
 *
 * Two-layer gating ensures this never runs in production:
 *   TS side:   import.meta.env.DEV — Vite strips DevDataPort from the prod bundle entirely.
 *   Rust side: #[cfg(feature = "dev-tools")] — the /api/dev/login-as endpoint won't be
 *              compiled into the production binary, so the route doesn't exist to probe.
 */
const DEV_LOGGED_OUT_KEY = "bridge-app:dev-logged-out";

function readDevLoggedOut(): boolean {
  try {
    return typeof sessionStorage !== "undefined" && sessionStorage.getItem(DEV_LOGGED_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDevLoggedOut(value: boolean): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    if (value) sessionStorage.setItem(DEV_LOGGED_OUT_KEY, "1");
    else sessionStorage.removeItem(DEV_LOGGED_OUT_KEY);
  } catch {
    // sessionStorage unavailable (private mode, SSR) — fall back to in-memory only
  }
}

export class DevDataPort implements DataPort {
  private readonly inner = new DataPortClient();

  constructor(private readonly tier: SubscriptionTier) {}

  fetchCurrentUser(): Promise<AuthUser | null> {
    if (readDevLoggedOut()) return Promise.resolve(null);
    const now = new Date().toISOString();
    return Promise.resolve({
      id: "dev-user",
      display_name: "Dev User",
      email: "dev@localhost",
      avatar_url: null,
      created_at: now,
      updated_at: now,
      subscription_tier: this.tier,
      subscription_current_period_end: null,
    });
  }

  getLoginUrl(provider: "google" | "github"): string {
    return this.inner.getLoginUrl(provider);
  }

  async logout(): Promise<void> {
    writeDevLoggedOut(true);
    await this.inner.logout();
  }

  devLogin(): Promise<void> {
    writeDevLoggedOut(false);
    return Promise.resolve();
  }

  startCheckout(_plan: BillingPlan): Promise<{ url: string }> {
    // eslint-disable-next-line no-console -- explicit dev-only billing stub for local UI wiring
    console.warn("[DevDataPort] billing disabled in dev");
    return Promise.resolve({ url: "" });
  }

  openBillingPortal(): Promise<{ url: string }> {
    // eslint-disable-next-line no-console -- explicit dev-only billing stub for local UI wiring
    console.warn("[DevDataPort] billing disabled in dev");
    return Promise.resolve({ url: "" });
  }

  fetchConventionDefinition(bundleId: string): Promise<unknown> {
    return this.inner.fetchConventionDefinition(bundleId);
  }
}
