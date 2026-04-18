# Product Direction

Stable product decisions and rationale. Reference this for "why" questions about deployment, monetization, and architecture.

## Deployment

Operational release and rollback steps live in `docs/guides/deployment.md`.

- **Hosting:** Self-hosted VPS (Netcup). Migrated off Vercel (March 2026).
- **Reverse proxy:** Caddy (port 80 inside container — Cloudflare terminates TLS)
- **CDN/DNS:** Cloudflare (proxied A record, Full SSL mode)
- **CI/CD:** GitHub Actions — tag-triggered release builds Docker image, pushes to GHCR, deploys to VPS via SSH
- **Container registry:** `ghcr.io/jofu-tofu/bridge-convention-app` (public)
- **VPS deploy dir:** `/opt/bridge-app/docker-compose.yml`

**Why VPS over Vercel:** Full control over serving, no vendor lock-in for static + WASM assets, simpler CORS/auth for future DataPort API.

**Pipeline:** `v*` tag → `release.yml` → multi-stage Docker build (Rust/WASM → Vite → Caddy) → GHCR push → SSH deploy. CI (`deploy.yml`) runs tests/lint/build on every push/PR.

## Monetization Model

### Free Tier
- All learning pages (all conventions, read-only flow trees)
- Full practice for one bundle (Stayman) with fixed defaults:
  - Responder role only
  - Decision drill mode only
  - SAYC system only

### Paid Tier
- Practice for all bundles
- Full configuration: practice modes, role selection, system selection, base module config

### Rationale
- Learning pages are marketing/conversion tools — showing quality drives upgrades
- The interactive practice + feedback loop is the real product
- Bridge conventions are public knowledge; the authored teaching content, evaluation pipeline, and interactive experience are the defensible IP
- Configuration depth (modes, roles, systems) is premium — free users get a curated, opinionated experience

### Pricing
Bridge Lab is now sold as a subscription at **$5.99/month**. Practice access for
paid bundles, role/system selection, and future progress features all sit behind
the recurring plan rather than a one-time unlock.

The rationale is operational, not cosmetic: recurring revenue fits ongoing
content authoring better than one-time sales, Stripe handles payment retries and
dunning automatically, and the Customer Portal reduces support load for cancel /
payment-method changes.

`/billing/pricing` is the canonical pre-Stripe conversion surface: benefits,
price, and the subscribe CTA all live there. `PaywallOverlay` is the
"you-hit-a-locked-bundle" nudge and navigates to `/billing/pricing` rather than
invoking checkout directly, so users always see price and pitch before the
Stripe hop. The display string `MONTHLY_PRICE_DISPLAY` in
`src/routes/(app)/billing/pricing/+page.svelte` is the single on-page source of
truth for "$5.99 / month"; the billed amount is configured via
`STRIPE_PRICE_ID_MONTHLY` on the bridge-api server. If the monthly price
changes, update both sites in the same patch.

## SEO Strategy

Hybrid architecture: static content ring around the WASM interactive core. Learn pages (`/learn/<moduleId>/`) are pre-rendered as static HTML at build time — crawlable by search engines and AI crawlers without JS execution. Practice and game screens remain client-side WASM (no SEO needed for interactive features). The static pages serve as the primary discovery and conversion surface, linking users into the SPA for hands-on practice.

**Pipeline:** `bridge-static` (Rust binary) extracts viewport JSON from `bridge-session` into `.generated/learn-data.json` → SvelteKit content routes under `src/routes/(content)/learn/**` read that JSON during prerender → the final static HTML ships in the production image. Guide pages (`/guides/*`) are prerendered from their own route sources during the same build.

## What Users Value (Test User Feedback)

- The learning page and flow trees
- Iterative feedback — knowing exactly *why* a bid was wrong
- The teaching quality, not the computationally heavy DDS/play phase
- The app's value is pedagogical (like a textbook), not computational (like a service)

## Content Protection

- Convention definitions are **data**, not code — loaded into a generic WASM runtime
- Free definitions baked into static build; paid definitions fetched from server after auth
- One WASM binary for everyone (the runtime engine). No per-tier WASM builds.
- Server validates entitlements before sending paid definition data
- WASM binary protects runtime logic (opaque binary vs readable minified JS)

## Two-Port Architecture

```
┌─────────────┐     ┌──────────────┐
│ ServicePort │     │   DataPort   │
│  (compute)  │     │ (user data)  │
├─────────────┤     ├──────────────┤
│ WASM binary │     │ Server API   │
│ Client-side │     │ Remote       │
│ Stateless   │     │ Auth/entitle │
│ No network  │     │ Progress     │
│ after load  │     │ Sync         │
└─────────────┘     └──────────────┘
```

- **ServicePort** — WASM in browser, handles all game logic. Stateless per-request. No network needed after initial load.
- **DataPort** — remote server API. Auth, entitlements, progress, sync. Implemented as `bridge-api`.
- They don't mix. WASM never touches DB. Server never runs convention logic.

## DataPort Implementation

```
Browser ──fetch──► Caddy ──/api/*──► Axum (bridge-api :3001) ──► SQLite
                    │
                    └── static files (WASM app)
```

**Stack:** Axum (Rust), SQLite via sqlx, server-side sessions (not JWT).

**Why server-side sessions over JWT:** Simpler, revocable (delete row = logged out), no refresh-token rotation. Single indexed SQLite query per auth check is fine at this scale. JWT would add complexity with no benefit for a single-server app.

**Auth is optional:** App works without login (free tier). No auth gate blocks the UI — components check auth state and adapt. This preserves the existing anonymous UX.

**OAuth providers:** Google + GitHub. Server-side authorization code flow — Axum holds client secrets, exchanges code, issues session cookie. Browser never sees OAuth client secret.

**Auto-merge by email:** When a new OAuth provider returns an email matching an existing user, the identity is linked to that user. Null/missing emails are never used for matching.

**Cookie-based CSRF:** OAuth `state` parameter stored in short-lived httpOnly cookie (10-min TTL), verified on callback.

**Crate:** `crates/bridge-api/` — standalone binary, independent of game crates (no bridge-engine/conventions/session/service deps). See `infra/Dockerfile.api` for container build.

**Frontend:** `src/service/auth.ts` (AuthClient) → `src/stores/auth.svelte.ts` (auth store via DI) → components. Same service boundary pattern as ServicePort.

## App Startup Flow

1. App loads → WASM initializes with free bundle definitions baked in (works immediately, no login)
2. User logs in → `DataPort.getEntitlements()` returns entitled bundle IDs
3. `DataPort.getBundleDefs(entitlements)` → server returns paid convention definition JSON
4. `ServicePort.loadBundleDefs(paidDefs)` → feeds definitions into running WASM runtime
5. Paid conventions available for practice

## Decision History: Why Rust/WASM

**Alternatives considered and rejected:**

- **Server-side TS:** User prioritizes stack quality and architecture over speed-to-market
- **Minified JS:** Convention definitions readable in browser, insufficient IP protection

**Why Rust/WASM was chosen:**

- IP protection (opaque binary vs readable JS)
- Client-side compute (no server cost per user)
- Forced architecture improvement during port
- Learning opportunity (user is learning Rust — phases are designed as achievable milestones)

See `docs/architecture/migration/index.md` for the full migration spec.
