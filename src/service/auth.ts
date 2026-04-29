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

/** Wire-shape of a server-persisted drill record. Mirrors `Drill` in `src/stores/drills.svelte.ts`. */
export interface DrillDto {
  id: string;
  name: string;
  moduleIds: string[];
  practiceMode: string;
  practiceRole: string;
  systemSelectionId: string;
  opponentMode: string;
  playProfileId: string;
  vulnerabilityDistribution: { none: number; ours: number; theirs: number; both: number };
  showEducationalAnnotations: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}

export interface DrillCreatePayload {
  /** Optional client-supplied id; server assigns one when omitted. */
  id?: string;
  name: string;
  moduleIds: string[];
  practiceMode: string;
  practiceRole: string;
  systemSelectionId: string;
  opponentMode: string;
  playProfileId: string;
  vulnerabilityDistribution: { none: number; ours: number; theirs: number; both: number };
  showEducationalAnnotations: boolean;
}

export type DrillUpdatePayload = DrillCreatePayload;

export class DrillEntitlementError extends Error {
  readonly kind = "convention_locked" as const;
  constructor(public readonly blockedModuleIds: string[]) {
    super(`Convention locked: ${blockedModuleIds.join(", ")}`);
    this.name = "DrillEntitlementError";
  }
}

export class DrillUnknownModuleError extends Error {
  readonly kind = "unknown_module" as const;
  constructor(public readonly moduleIds: string[]) {
    super(`Unknown module: ${moduleIds.join(", ")}`);
    this.name = "DrillUnknownModuleError";
  }
}

export class DrillNotFoundError extends Error {
  readonly kind = "not_found" as const;
  constructor() {
    super("Drill not found");
    this.name = "DrillNotFoundError";
  }
}

export class DrillUnauthenticatedError extends Error {
  readonly kind = "unauthenticated" as const;
  constructor() {
    super("Not signed in");
    this.name = "DrillUnauthenticatedError";
  }
}

/**
 * Client-side DataPort interface — the boundary between UI/stores and the
 * bridge-api server. Auth, billing, entitlements, progress sync, etc.
 */
export interface DataPort extends DataPortBilling {
  fetchCurrentUser(): Promise<AuthUser | null>;
  getLoginUrl(provider: "google"): string;
  logout(): Promise<void>;
  /** Dev-only: re-authenticate as the dev user without OAuth. Only set on DevDataPort. */
  devLogin?(): Promise<void>;

  listDrills(): Promise<DrillDto[]>;
  createDrill(payload: DrillCreatePayload): Promise<DrillDto>;
  updateDrill(id: string, payload: DrillUpdatePayload): Promise<DrillDto>;
  deleteDrill(id: string): Promise<void>;
  markDrillLaunched(id: string): Promise<DrillDto>;
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
  getLoginUrl(provider: "google"): string {
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

  async listDrills(): Promise<DrillDto[]> {
    const response = await fetch("/api/drills", { credentials: "same-origin" });
    await throwTypedDrillError(response);
    const body = (await response.json()) as { drills: DrillDto[] };
    return body.drills;
  }

  async createDrill(payload: DrillCreatePayload): Promise<DrillDto> {
    const response = await fetch("/api/drills", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await throwTypedDrillError(response);
    const body = (await response.json()) as { drill: DrillDto };
    return body.drill;
  }

  async updateDrill(id: string, payload: DrillUpdatePayload): Promise<DrillDto> {
    const response = await fetch(`/api/drills/${encodeURIComponent(id)}`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await throwTypedDrillError(response);
    const body = (await response.json()) as { drill: DrillDto };
    return body.drill;
  }

  async deleteDrill(id: string): Promise<void> {
    const response = await fetch(`/api/drills/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    await throwTypedDrillError(response);
  }

  async markDrillLaunched(id: string): Promise<DrillDto> {
    const response = await fetch(`/api/drills/${encodeURIComponent(id)}/launched`, {
      method: "POST",
      credentials: "same-origin",
    });
    await throwTypedDrillError(response);
    const body = (await response.json()) as { drill: DrillDto };
    return body.drill;
  }
}

interface ServerErrorBody {
  error?: string;
  blocked_module_ids?: string[];
  module_ids?: string[];
}

async function throwTypedDrillError(response: Response): Promise<void> {
  if (response.ok || response.status === 204) return;
  let body: ServerErrorBody = {};
  try {
    body = (await response.clone().json()) as ServerErrorBody;
  } catch {
    /* fall through to generic error */
  }
  if (response.status === 401) throw new DrillUnauthenticatedError();
  if (response.status === 404) throw new DrillNotFoundError();
  if (response.status === 403 && body.error === "convention_locked") {
    throw new DrillEntitlementError(body.blocked_module_ids ?? []);
  }
  if (response.status === 400 && body.error === "unknown_module") {
    throw new DrillUnknownModuleError(body.module_ids ?? []);
  }
  throw new Error(`Drill request failed (${response.status})`);
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

const DEV_DRILLS_KEY = "bridge-app:dev-drills";

function readDevDrills(): DrillDto[] {
  try {
    const raw = localStorage.getItem(DEV_DRILLS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { drills?: unknown };
    if (!parsed || !Array.isArray(parsed.drills)) return [];
    return parsed.drills as DrillDto[];
  } catch {
    return [];
  }
}

function writeDevDrills(drills: DrillDto[]): void {
  try {
    localStorage.setItem(DEV_DRILLS_KEY, JSON.stringify({ drills }));
  } catch {
    // ignore quota / unavailable storage
  }
}

function generateDevDrillId(): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `drill:${suffix}`;
}

/**
 * **DevDataPort fakes client state only.** Auth, billing, and drill storage
 * are all faked in-browser so local dev runs without bridge-api. Drills
 * persist to `localStorage` under `bridge-app:dev-drills`, isolated from the
 * anonymous-mode key (`bridge-app:drills`) so logout doesn't merge data
 * across modes.
 *
 * Tests that need real server behavior (entitlements, webhook effects,
 * session cookies, server-persisted drills) must call `POST /api/dev/login`
 * on bridge-api (built with the `dev-tools` cargo feature). See
 * `tests/e2e/helpers.ts:devLogin`. The `?e2e=1` query param routes the
 * client through `DataPortClient` instead of `DevDataPort` for those flows.
 */
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

  getLoginUrl(provider: "google"): string {
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

  listDrills(): Promise<DrillDto[]> {
    return Promise.resolve(readDevDrills());
  }

  createDrill(payload: DrillCreatePayload): Promise<DrillDto> {
    const now = new Date().toISOString();
    const drill: DrillDto = {
      id: payload.id ?? generateDevDrillId(),
      name: payload.name,
      moduleIds: payload.moduleIds,
      practiceMode: payload.practiceMode,
      practiceRole: payload.practiceRole,
      systemSelectionId: payload.systemSelectionId,
      opponentMode: payload.opponentMode,
      playProfileId: payload.playProfileId,
      vulnerabilityDistribution: payload.vulnerabilityDistribution,
      showEducationalAnnotations: payload.showEducationalAnnotations,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: null,
    };
    writeDevDrills([...readDevDrills(), drill]);
    return Promise.resolve(drill);
  }

  updateDrill(id: string, payload: DrillUpdatePayload): Promise<DrillDto> {
    const drills = readDevDrills();
    const existing = drills.find((d) => d.id === id);
    if (!existing) return Promise.reject(new DrillNotFoundError());
    const updated: DrillDto = {
      ...existing,
      name: payload.name,
      moduleIds: payload.moduleIds,
      practiceMode: payload.practiceMode,
      practiceRole: payload.practiceRole,
      systemSelectionId: payload.systemSelectionId,
      opponentMode: payload.opponentMode,
      playProfileId: payload.playProfileId,
      vulnerabilityDistribution: payload.vulnerabilityDistribution,
      showEducationalAnnotations: payload.showEducationalAnnotations,
      updatedAt: new Date().toISOString(),
    };
    writeDevDrills(drills.map((d) => (d.id === id ? updated : d)));
    return Promise.resolve(updated);
  }

  deleteDrill(id: string): Promise<void> {
    const drills = readDevDrills();
    if (!drills.some((d) => d.id === id)) return Promise.reject(new DrillNotFoundError());
    writeDevDrills(drills.filter((d) => d.id !== id));
    return Promise.resolve();
  }

  markDrillLaunched(id: string): Promise<DrillDto> {
    const drills = readDevDrills();
    const existing = drills.find((d) => d.id === id);
    if (!existing) return Promise.reject(new DrillNotFoundError());
    const updated: DrillDto = { ...existing, lastUsedAt: new Date().toISOString() };
    writeDevDrills(drills.map((d) => (d.id === id ? updated : d)));
    return Promise.resolve(updated);
  }
}
