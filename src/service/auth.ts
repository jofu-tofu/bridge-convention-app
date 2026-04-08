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
 * Dev-only DataPort that returns a fake user with a given subscription tier.
 * Gated by import.meta.env.DEV at the call site — never instantiated in production.
 */
export class DevDataPort implements DataPort {
  constructor(private readonly tier: SubscriptionTier) {}

  fetchCurrentUser(): Promise<AuthUser> {
    return Promise.resolve({
      id: "dev-user",
      display_name: "Dev User",
      email: "dev@localhost",
      avatar_url: null,
      subscription: this.tier,
    });
  }

  getLoginUrl(_provider: "google" | "github"): string {
    return "#";
  }

  async logout(): Promise<void> {
    // no-op in dev
  }
}
