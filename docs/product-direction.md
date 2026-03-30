# Product Direction

Stable product decisions and rationale. Reference this for "why" questions about deployment, monetization, and architecture.

## Deployment

- **Hosting:** Self-hosted VPS (DigitalOcean, US East). Moving off Vercel.
- **Reverse proxy:** Caddy with auto-HTTPS
- **CDN/DNS:** Cloudflare (domain TBD)
- **CI/CD:** GitHub Actions + rsync deploy

**Why VPS over Vercel:** Full control over serving, no vendor lock-in for static + WASM assets, simpler CORS/auth for future DataPort API.

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
- One-time purchase initially (~$15-25)
- Subscription when content volume justifies it (15+ bundles, progress tracking, spaced repetition)

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
- **DataPort** — remote server API. Auth, entitlements, progress, sync. Future addition.
- They don't mix. WASM never touches DB. Server never runs convention logic.

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
- Tauri alignment (same Rust crate for desktop native + browser WASM)
- Forced architecture improvement during port
- Learning opportunity (user is learning Rust — phases are designed as achievable milestones)

See `docs/migration/index.md` for the full migration spec.
