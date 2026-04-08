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
export class DevDataPort implements DataPort {
  private readonly inner = new DataPortClient();

  constructor(private readonly tier: SubscriptionTier) {}

  fetchCurrentUser(): Promise<AuthUser> {
    // TODO: When bridge-api runs locally, call POST /api/dev/login-as
    // (Rust: #[cfg(feature = "dev-tools")] only) to get a real session,
    // then delegate to this.inner for all subsequent calls.
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
    await this.inner.logout();
  }
}
