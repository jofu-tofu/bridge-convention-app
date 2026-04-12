// ── DataPort client ─────────────────────────────────────────────────
// Client-side boundary for all /api/* calls (auth, entitlements, sync).
// Mirrors the contract defined by bridge-api (Axum server).

export interface AuthUser {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  subscription?: SubscriptionTier;
}

export enum SubscriptionTier {
  Free = "free",
  Premium = "premium",
  Expired = "expired",
}

/**
 * Client-side DataPort interface — the boundary between UI/stores and the
 * bridge-api server. Auth today; entitlements, progress sync, etc. later.
 */
export interface DataPort {
  fetchCurrentUser(): Promise<AuthUser | null>;
  getLoginUrl(provider: "google" | "github"): string;
  logout(): Promise<void>;
  /** Dev-only: re-authenticate as the dev user without OAuth. Only set on DevDataPort. */
  devLogin?(): Promise<void>;
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
    return Promise.resolve({
      id: "dev-user",
      display_name: "Dev User",
      email: "dev@localhost",
      avatar_url: null,
      subscription: this.tier,
    });
  }

  getLoginUrl(provider: "google" | "github"): string {
    return this.inner.getLoginUrl(provider);
  }

  async logout(): Promise<void> {
    writeDevLoggedOut(true);
    await this.inner.logout();
  }

  async devLogin(): Promise<void> {
    writeDevLoggedOut(false);
  }
}
