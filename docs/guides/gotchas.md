# Gotchas & Historical Context

Detailed technical notes, historical context, and non-obvious decisions. Read when you encounter something surprising or need to understand "why."

## Engine & WASM

### WASM Required for Browser
All game logic runs in Rust via WASM (`WasmService`). If WASM init fails, the app shows an error screen — there is no fallback. TS `engine/` contains types, constants, hand evaluation, `isVulnerable()`, and DDS browser support — no auction, deal generation, or scoring logic.

### DDS Browser Implementation
DDS table analysis works via Emscripten-compiled C++ DDS in a Web Worker (`dds-client.ts`). The deal is extracted from the Rust service as a PBN string (`getDealPBN`), then sent to the worker for solving. `initDDS()` fires at app startup (fire-and-forget); `isDDSAvailable()` gates calls. Par is always null (mode=-1). DDS WASM artifacts (`static/dds/`) are committed; rebuild with `npm run dds:build` (requires Emscripten).

### vendor/dds
`vendor/dds/` is the vendored upstream DDS C++ source snapshot used only when rebuilding the browser DDS bundle. The Emscripten-specific edits needed by this repo are already baked into the vendored source; there is no separate patch-apply step in the normal build. App-level bridge logic in `src/` and `crates/` remains clean-room.

### DDS Asset Lifecycle
Keep the DDS layers mentally separate:

1. `vendor/dds/`
   Third-party source code snapshot. Maintenance-only. The app never serves this directory.
2. `scripts/build-dds-wasm.sh`
   Manual rebuild entry point. Compiles `vendor/dds/` with Emscripten.
3. `static/dds/`
   Browser runtime artifacts (`dds.js`, `dds.wasm`, `BUILD_HASH`). These are what the worker actually fetches at runtime.

Normal app startup and deploy use `static/dds/`. `vendor/dds/` matters only when you intentionally rebuild those runtime artifacts.

## DDS Architecture (Post-Migration)

- DDS runs via Emscripten C++ Web Worker in browser only
- `getDealPBN(handle)` extracts deal as PBN string from Rust service for DDS worker

## Convention System

### Convention System (Now in Rust)
Convention logic has been migrated to Rust (`bridge-conventions` crate). TS `src/conventions/` directory is deleted. All convention types, fact DSL, pipeline, teaching, and adapter logic live in Rust. UI components access convention data only through `service/index.ts` which proxies to WASM.

### All Conventions Use Meaning Pipeline
No tree/protocol/overlay pipeline remains. Convention logic lives in `ConventionBundle` with `meaningSurfaces`, `conversationMachine`, `factExtensions`, `explanationCatalog`. Deal constraints are DERIVED from surface preconditions at runtime (`fact_dsl::inversion::derive_deal_constraints`) — never hand-authored. All teaching content is auto-derived from module structure.

### "Pass — no convention applies" appears in drills
Either the user's target module has no surface matching the generated deal (rejection-sampling budget exhausted — check `tracing::warn` logs from `start_drill`) OR surfaces are missing hand-clause preconditions the inverter can reason about (non-`hand.*` / `bridge.isBalanced` facts are silently ignored during inversion). See `docs/architecture/teaching-architecture.md` § Deal Generation → Known Limitations for the specific failure modes (notably the `balanced` union-drop bug affecting NT-family bundles).

### Convention-Specific Details
- Bergen Raises uses Standard Bergen (3C=constructive 7-10, 3D=limit 10-12, 3M=preemptive 0-6, splinter with shortage 12+)
- Only duplicate bridge scoring implemented (rubber bridge out of scope for V1)

## CLI

### CLI Rule Enumeration
All CLI commands (`list`, `plan`, `selftest`, `describe`, `bundles`) use rule enumeration via `ServicePort`. Atom ID format: `moduleId/meaningId`. Selftest uses strategy-driven forward auction construction instead of FSM path targeting.

## Deal Generation

### Rejection Sampling
Deal generator uses flat rejection sampling (no relaxation) with configurable `maxAttempts`, `minLengthAny` OR constraints, and `customCheck` escape hatch. `minLengthAny` is OR (any suit meets minimum), not AND.

## Architecture Reference

### Screen Flow
```
ConventionSelect → GameScreen (Bidding) → GameScreen (Playing) → ExplanationScreen
                                                                     ↓
                                                              "Back to Menu" → ConventionSelect
                                                              "Next Deal" → GameScreen (Bidding)
```

### V1 → V2 Migration Path
- **Storage:** V2 replaces localStorage with SQLite via bridge-api for stats/progress tracking

## Learning Screen Vision

The learning screen should render meaning surfaces as multiple synchronized views — not one static flowchart — so a generic renderer can teach *any* convention without custom screens.

**Four planned views:**
1. **Guided Flow** — user inputs auction context + hand features; UI walks the next discriminating question
2. **Explorable Map** — meaning surfaces grouped by conversation machine state
3. **Cheat Sheet** — "lookup under time pressure" keyed by auction trigger → call → meaning
4. **Practice / Quiz Mode** — retrieval practice with spacing

**Learning science principles applied:** Cognitive load theory (progressive disclosure, segmenting), worked examples → faded practice (expertise reversal effect), retrieval practice (Roediger & Karpicke), spaced practice (Cepeda).

**Current status:** LearningScreen shell exists with sidebar + about card. Surface→display adapter, guided flow, quiz mode, and skill-adaptive presentation are not yet started. The research strongly supports one source of truth (meaning surfaces + fact catalog) → multiple rendered views.

## Multi-Trigger Conventions (FSM Phase Pattern)

When a convention module responds to multiple opponent openings with different cue bid encodings, use **separate FSM phases per trigger** — not one shared phase. Each r1 phase contains only the surfaces with the correct encoding for that trigger.

**Example:** Michaels uses 4 separate r1 phases (`r1-after-1c`, `r1-after-1d`, `r1-after-1h`, `r1-after-1s`) because the cue bid is 2C over 1C but 2D over 1D. DONT avoids this because all its overcalls occur after a single trigger (1NT).

## Game-Forcing Surface Discipline

Game-forcing behavior (e.g., Strong 2C after 2D waiting) is enforced by **omitting pass/signoff surfaces** from the relevant FSM phases. There is no runtime FSM guard. Authors must not add pass surfaces to game-forcing phases. If a pass IS legal (e.g., after 2NT rebid with 0-2 HCP), include it explicitly — the absence of pass is what creates the forcing effect.

## Total Points & System Facts

### System configs store suit TP only
`TotalPointEquivalent` now carries suit/trump total points only. NT evaluation and NT-facing profile display use HCP directly. Runtime system-fact relational evaluators read only `.trump` when `fitAgreed` is present.

### System facts auto-detect HCP vs trump TP via `fitAgreed`
System facts (`system.responder.inviteValues`, etc.) use `fitAgreed` from the negotiation kernel to detect trump context — not `bindings.suit`. `bindings.suit` means "parameterized suit" (not "agreed suit"). Using it for system facts would mis-detect non-support modules (e.g., a future "New Suit Response" module parameterized with `$suit` is not a fit agreement). Both standard (HCP-only) and relational (fitAgreed-aware) evaluators exist for these facts — the standard evaluator runs as baseline, and the relational evaluator overrides when relational context is provided.

## Routing / Layout Groups

SEO content pages (`/guides`, `/guides/[slug]`, `/learn/[moduleId]`) live under `src/routes/(content)/` and are prerendered to static HTML with a minimal "BridgeLab" header and no WASM boot. WASM app screens (the game, settings, coverage, workshop) live under `src/routes/(app)/` with `ssr=false` and full app chrome (NavRail / BottomTabBar). Moving a route between these groups is a user-visible chrome change — the navigation across groups is a full document load, not a SvelteKit client-side transition. Treat `(content)` as the home for anything that needs to be crawlable or linkable from outside the app.

## Billing

### Stripe Webhook Requires Raw Request Body
`/api/billing/webhook` verifies Stripe signatures against the raw request bytes.
The handler uses Axum's `Bytes` extractor on purpose. Do not add JSON body parsing
or global body middleware in front of this route. If future middleware needs to
inspect request bodies, exclude `/api/billing/webhook` or signature verification
will fail.

### Subscription Tier Uses An Access Window, Not Just Status
`past_due` and `canceled` still count as paid access until
`subscription_current_period_end`. This is intentional in
`crates/bridge-api/src/billing/entitlements.rs::tier_for()`:

- `past_due`: Stripe is retrying payment; downgrading immediately would create avoidable churn.
- `canceled`: the user already paid for the current period and keeps access until it ends.

Only `now >= current_period_end` flips the user to `Expired`. Do not simplify this
to a status-only check without product sign-off.

### Free Bundle Allowlist Is Mirrored In Rust And TypeScript
The free practice bundle ID lives in two places and they must stay synchronized:

- Rust: `FREE_BUNDLE_IDS` in `crates/bridge-api/src/billing/entitlements.rs`
- TypeScript: `FREE_PRACTICE_BUNDLE` in `src/stores/entitlements.ts`

Both files point at the other with comments. If the free bundle ever changes,
update both in the same patch.

## Screen Layout Primitives

`src/components/shared/AppScreen.svelte` (for `(app)` routes) and
`src/components/shared/ContentScreen.svelte` (for `(content)` routes) are the
standard outer wrappers for every screen. Tokens they consume live in
`src/app.css` under `--screen-*`.

- Do not fold `AppScreen` and `ContentScreen` into a single component. Their
  overflow chains differ: AppScreen owns its inner scroll container; ContentScreen
  scrolls at the `AppShell` main area. A variant prop branching between the two
  is harder to reason about than the two small files.
- Do not remove `ContentScreen`'s rail offset (`margin-inline-start` at
  `min-width: 1024px`). Prerendered pages slide under the desktop rail without it.
- `GameScreen` and `LearningScreen` are intentionally exempt — they run custom
  split-pane/table-scale layouts that don't fit the AppScreen overflow chain.

## Blackwood combined counts only flow through the convention adapter

The `CombinedAceCount` / `CombinedKingCount` extended clauses read partner's
disclosed ace/king count from `RelationalFactContext.public_commitments`. Only
`bridge-service::convention_adapter::derive_blackwood_commitments` populates
that field by walking the full observation log for
`blackwood:response-*-aces` / `blackwood:king-response-*` carriers.

`pipeline/evaluation/meaning_evaluator.rs` also constructs a
`RelationalFactContext` (per-surface bindings projection) but does NOT see the
observation log at that layer, so it leaves `public_commitments: None`.
Consequence: Blackwood signoff / ask-kings surfaces whose gating depends on
the combined partnership count evaluate correctly only on the adapter-driven
path. If in the future the meaning-evaluator path needs to gate on the same
clauses, thread the observation log through to that site and reuse
`derive_blackwood_commitments`.
