# Routes

SvelteKit file-based routing. `adapter-static` with `fallback: 'index.html'`.

## Layout groups

- `(app)/` — client-only (`ssr=false`). Loads WASM, renders `AppReady` + `AppShell`. All interactive game routes live here.
- `(app)/billing/{success,cancel}` — Stripe return routes. They stay client-only so they can refresh auth state and redirect back to `/practice` without a separate server render path.
- `(content)/` — prerendered (`prerender = true` in `+layout.ts`). SEO pages: `/` (landing), `/guides/[slug]`, `/learn/[moduleId]`. All content routes — including `/` — wrap in `AppShell`. The landing page renders `LoggedInLanding` when authed, marketing hero otherwise, both inside the shell chrome.

## Custom drills

- `/practice/drill` — saved custom drills index.
- `/practice/drill/new` — create form.
- `/practice/drill/[id]/edit` — edit form.

All three are reachable without an entitlement (entitlement gating is per-action at launch time via `canPractice(...)`, matching `ConventionSelectScreen`). Launch wiring is deferred; Phase 1 is create + save + edit + delete only.

## Learn Reference Surface

- `/learn/[moduleId]` is the convention reference surface. Keep it reference-first and scan-friendly; step-by-step tutorial content belongs in guided practice / in-app learning flows, not on this prerendered page.
- **Authoring-field-driven, no per-module hardcoding.** Every field the page renders must come from authored module/bundle data or be derived (e.g. from `definingMeaningId`, surfaces, or `systemFactLadder`). Do not branch on module id, hardcode per-convention prose, or override derived values in the page component. The learn page now has one render path: every module ships a populated `reference` block, and `ModuleLearningViewport.reference` is non-optional. If a convention needs to say something new, add a required authored field on the module data model — do not special-case the renderer. See `docs/guides/convention-authoring.md` for the authoring-eligible field list and the "derive, don't author" rules.
- **Scalability check before adding a field.** Anything system-specific (HCP, total points, losing-trick count, suit-quality thresholds, etc.) must resolve through `SystemConfig` / fact-catalog-driven axes, not hardcoded prose. Before adding a new authored field, ask: will every convention in every system need to answer this? If yes, it belongs on the module data model as **required** — authors write explicit applicability states rather than leaving it null, so every reference page is complete by construction.

## Auth store

`authStore` is created once in the root `src/routes/+layout.svelte` inside `if (browser)` and exposed via Svelte context (`AUTH_STORE_KEY` in `src/stores/context.ts`). The root layout also creates the shared `DataPort` once and exposes it via context for billing UI. Do NOT re-create either in `(app)` or `(content)` layouts — consume via the existing context helpers.

- Prerender-safe: creation is guarded by `browser`, so SSG does not call `/api/auth/me`.
- `(content)` pages that need auth MUST use `getAuthStoreOptional()` guarded by `browser` — context is absent during prerender.

## Auth-aware routing on prerendered routes

`+page.ts` `load` cannot read session (runs at build time). For routes that need to redirect based on auth, do it client-side in `onMount` / `$effect` using `goto(..., { replaceState: true })`. Brief post-paint flash is expected and acceptable. See `(content)/+page.svelte` for the pattern.

## Context Maintenance

After modifying files in this directory, keep this file in sync with observable routing behavior. Remove entries that fail the falsifiability test.
