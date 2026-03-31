# Bridge Practice App

Bridge bidding convention practice app (1NT Responses, Bergen Raises bundles). Tauri 2 desktop + WASM browser (VPS via Docker/Caddy). Svelte 5 (runes) + TypeScript strict. Uses meaning-centric pipeline exclusively (old tree/protocol/overlay pipeline removed).

## Commands

| Command                   | Purpose                                                    |
| ------------------------- | ---------------------------------------------------------- |
| `npm run dev`             | Build WASM (if needed) + start dev server (port 1420)      |
| `npm run build`           | Build WASM + production bundle                             |
| `npm run wasm:build`      | Build WASM (release)                                       |
| `npm run wasm:dev`        | Build WASM (debug, faster)                                 |
| `npm run check`           | Svelte type-check                                          |
| `npx tsc --noEmit`        | TypeScript type-check                                      |
| `npm run test`            | Vitest watch mode                                          |
| `npm run test:run`        | Vitest single run                                          |
| `npm run test:coverage`   | Coverage report (90% branches, 90% functions, 85% lines)   |
| `npm run test:e2e`        | Playwright E2E tests                                       |
| `npm run test:all`        | Unit + E2E together                                        |
| `npm run lint`            | ESLint check                                               |
| `npm run lint:fix`        | ESLint auto-fix                                            |
| `npm run lint:dead`       | Report unused files/dead references via Knip                  |
| `npm run lint:full`       | `npm run lint` plus dead-reference check                     |
| `npx tsx src/cli/main.ts verify preflight --bundle=<id>` | Bundle compositional verification |
| `npm run format`          | Prettier format all files                                  |
| `npm run format:check`    | Prettier check (CI)                                        |
| `cargo test --workspace`  | Run all Rust tests (from src-tauri/)                       |
| `cargo build --workspace` | Build all Rust crates (from src-tauri/)                    |

## Dev Tools (dev server only)

**URL params (9 consolidated params):**

| Param | Values | Effect |
|-------|--------|--------|
| `?convention=<id>` | `nt-bundle`, `nt-stayman`, `nt-transfers`, `bergen-bundle`, `weak-twos-bundle`, `dont-bundle` | Select convention → game screen. `?learn=stayman` resolves module-first (direct to Stayman module learning). `?learn=nt-bundle` resolves as bundle filter (shows that bundle's modules, auto-selects first). |
| `?learn=<id>` | module or bundle ID | Learning screen — module-first resolution, falls back to bundle filter |
| `?seed=<n>` | number | Deterministic PRNG seed. Advances per deal (42, 43, 44...). Reload resets. |
| `?screen=<name>` | `settings`, `coverage`, `profiles` | Direct screen navigation. `?screen=coverage&convention=X` for bundle-specific coverage. |
| `?phase=<name>` | `review`, `playing`, `declarer` | Skip to game phase instantly (auto-completes bidding, no animation). Requires `?convention=`. |
| `?dev=<flags>` | comma-separated: `debug`, `expanded`, `autoplay`, `autoDismiss` | DEV-only flags. `debug` opens debug panel. `expanded` opens panel + expands all sections. `autoplay` animates through phases. `autoDismiss` auto-retries wrong bids. |
| `?practiceMode=<mode>` | `decision-drill`, `full-auction`, `continuation-drill` | Select practice mode (default: `decision-drill`) |
| `?practiceRole=<role>` | `opener`, `responder`, `both` | Practice as opener, responder, or random per deal (default: `responder`) |
| `?targetState=<id>`, `?targetSurface=<id>` | FSM state / meaning surface | Coverage targeting (used by coverage tests) |

Backward compat aliases: `?coverage=true` → `?screen=coverage`, `?profiles=true` → `?screen=profiles`, `?debug=true` → `?dev=debug`, `?autoplay=true` → `?dev=autoplay`.

**Example URLs:**
```
?convention=nt-bundle&seed=42                          # Deterministic game
?convention=nt-bundle&seed=42&phase=review             # Instant review screen
?convention=nt-bundle&dev=debug,expanded,autoDismiss   # Max debug, friction-free probing
?screen=coverage&convention=nt-bundle                  # Coverage screen
?screen=settings                                       # Settings screen
```
- **CLI coverage:** `npx tsx src/cli/main.ts list --bundle=nt-bundle` runs headless coverage tests. Subcommands: `list` (enumerate atoms), `eval` (per-atom evaluation), `play` (playthrough evaluation), `selftest` (CI mode), `plan` (evaluation plan). Same seed = same deal across `eval`/`eval --bid`.
- **Compositional verification:** `npx tsx src/cli/main.ts verify preflight --bundle=nt-bundle --budget=fast` runs full structural health check (lint + interference + exploration + fuzz). Individual runtime stages: `verify explore`, `verify motif`, `verify fuzz`. Static checks (lint, interference) run as vitest tests and internally as part of preflight.
- **Bid button test IDs:** `data-testid="bid-{callKey}"` on all bid buttons — e.g., `bid-1C`, `bid-7NT`, `bid-P` (pass), `bid-X` (double), `bid-XX` (redouble). Container test IDs: `level-bids` (contract grid), `special-bids` (pass/dbl/rdbl row).

## Code Hygiene

- **Fix all lint errors and warnings you encounter** — even if they weren't caused by your changes. If `npm run lint` or a hook reports errors/warnings in files you touched, fix them before finishing.
- **Lint is scoped to app code, tests, and root JS/TS config files.** `npm run lint` is not a workspace-wide sweep; it excludes generated/tooling directories outside the app surface.
- **Lint enforces architecture, not just style.** ESLint guards key import boundaries (`engine/`, `stores/`, `cli/`, `components/`), the UI/backend boundary (components/ cannot import from any backend module -- must use service/), design token usage in game components (`no-hardcoded-style-classes`), and protocol trigger scope (`no-full-scope-trigger`). `npm run lint:dead` uses Knip for dead-file detection, with `static/dds/dds.js` ignored because it is loaded by the DDS worker via `importScripts()`.

## Conventions

- **Pure engine.** `src/engine/` has zero imports from svelte, tauri, DOM APIs.
- **Service is the sole interface for UI and CLI.** All UI components (`components/`, `stores/`) and CLI commands (`cli/`) must import exclusively from `service/` — never directly from `engine/`. Backend logic (conventions, inference, session) lives entirely in Rust. When adding new functionality the UI needs, expose it through `ServicePort` in Rust, then add the WASM binding and TS proxy method.
- **Svelte 5 runes.** Use `$state`, `$derived`, `$effect` — no legacy `$:` reactive statements
- **Named exports only.** No `export default` — for greppability
- **No `const enum`** — breaks Vite/isolatedModules; use regular `enum`
- **No `any` without comment** — annotate with `// any: <reason>`
- **No mocking own modules** — use dependency injection instead
- **PlayerViewport boundary.** Game phase components never access raw `Deal`. Everything the player sees flows through viewport types: `BiddingViewport` (bidding), `DeclarerPromptViewport` (declarer prompt), `PlayingViewport` (play), `ExplanationViewport` (review). Viewport builders live in Rust (`bridge-service`).
- **Callers own their types.** Service defines its own viewport/response types. Engine domain primitives (`Call`, `Card`, `Seat`, `Hand`) are acceptable to re-export since they are universal vocabulary.
- **Coverage optimization.** Tree LP computes minimal test sessions; two-phase algorithm (leaf sweep + gap fill) covers all (state, surface) pairs efficiently. Module interference detection uses static prefix-overlap analysis.

## Design Philosophy

See `docs/design-philosophy.md` for the full set of 10 design principles and subsystem design rationale.

## System Parameterization

Multi-system support (SAYC, 2/1, Acol). Modules are system-agnostic — differences flow through `SystemConfig` → system facts → surface clause evaluation. `SystemConfig` and system fact vocabulary live in Rust (`bridge-conventions`).

**Base modules:** Each base system has 4 always-active modules: `["natural-bids", "stayman", "jacoby-transfers", "blackwood"]`. These are merged into every `specFromBundle()` call (strategy layer) but NOT into `resolveBundle()` (deal generation/teaching). Base modules affect bidding strategy only — inert modules (e.g., Stayman during Bergen practice) never activate because their FSM triggers never fire.

## Architecture

**Dependency direction (hexagonal boundary):**
```
components/ → stores/ → service/ (WASM proxy) → [Rust: bridge-service → bridge-session → {bridge-engine, bridge-conventions}]
cli/commands/ → service/
```
UI layers (`components/`, `stores/`) import ONLY from `service/`. `service/` is a thin WASM proxy: `ServicePort` interface, `WasmService` impl, barrel, `display/`, `util/`, `session-types.ts`, `dds-bridge.ts`. Nothing imports from `service/` except `stores/`, `components/`, and `cli/commands/`.

```
src/
  engine/          Pure TS engine types + DDS browser support (types, auction, scoring, play, dds-client, dds-worker)
  service/         WASM proxy: ServicePort, WasmService, barrel, session-types, dds-bridge, display/, util/
    display/       Call/contract/card formatting, hand summary, convention card builder
    util/          Pure utilities: delay
  cli/             Headless coverage test runner (modular: main.ts + shared.ts + commands/)
  test-support/    Shared test factories (engine stub, deal/session fixtures)
  stores/          Svelte stores (app, game coordinator + bidding/play/dds sub-stores, context DI, dev-params)
  components/      Svelte UI components
    navigation/    NavRail (desktop left rail), NavFlyout (hover menu), BottomTabBar (mobile)
    screens/       Screen-level components (ConventionSelectScreen, LearningScreen, game-screen/GameScreen)
    game/          Game components + co-located .ts companions (DecisionTree.ts, RoundBidList.ts, BidFeedbackPanel.ts)
    shared/        Reusable components (Card, Button, ConventionCallout) + display utilities (tokens, sort-cards, seat-mapping, table-scale, breakpoints, vulnerability-labels, layout-props)
src-tauri/         Cargo workspace with six crates
  crates/
    bridge-engine/       Pure Rust game logic (types, hand eval, deal gen, auction, scoring, play)
    bridge-conventions/  Convention types, fact DSL, pipeline, teaching, adapter
    bridge-session/      Session state, controllers, heuristics, inference
    bridge-service/      ServicePort impl, viewport builders
    bridge-tauri/        Tauri app with #[tauri::command] handlers wrapping ServicePortImpl
    bridge-wasm/         WASM bindings via wasm-bindgen for browser deployment (full ServicePort)
tests/
  e2e/             Playwright E2E tests
```

**Subsystems:**

| Subsystem | Entry | Summary |
|-----------|-------|---------|
| Engine (TS) | `src/engine/types.ts` | TS engine types + DDS browser support |
| Engine (Rust) | `src-tauri/crates/bridge-engine/` | Pure Rust game logic |
| Conventions (Rust) | `src-tauri/crates/bridge-conventions/` | Convention types, fact DSL, pipeline, teaching, adapter |
| Session (Rust) | `src-tauri/crates/bridge-session/` | Session state, controllers, heuristics, inference |
| Service (Rust) | `src-tauri/crates/bridge-service/` | ServicePort impl, viewport builders |
| Service (TS) | `src/service/index.ts` | WASM proxy + barrel + session-types + display/ + util/ + dds-bridge |
| CLI | `src/cli/main.ts` | Headless coverage test runner (modular) |
| Test Support | `src/test-support/engine-stub.ts` | Shared test factories |
| Stores | `src/stores/app.svelte.ts` | Svelte stores + game coordinator |
| Components | — | Svelte UI (screens/game/shared) |
| Tests | `tests/e2e/` | Vitest + Playwright |

**Game phases:** BIDDING → DECLARER_PROMPT (conditional) → PLAYING (optional) → EXPLANATION. User always bids as South. `playPreference` (from practice mode) controls BIDDING exit: `skip` → EXPLANATION, `always` → PLAYING, `prompt` → DECLARER_PROMPT.

**V1 storage:** localStorage for user preferences only — no stats/progress tracking until V2 (SQLite)

## Completed: Rust/WASM Migration

Backend modules (conventions/, inference/, session/, service/) have been migrated from TypeScript to Rust/WASM. All 5 phases are complete. TS `service/` is now a thin WASM proxy (~100 LOC). Convention logic, inference, session management, and viewport building all run in Rust.
See `docs/migration/index.md` for the phase tracker and architectural decisions. See `docs/product-direction.md` for the product decisions that drove this migration.

## Gotchas

- `npm run dev` builds WASM if `pkg/` missing, then starts Vite with HMR — the dev server stays running and reflects file changes instantly. Do NOT restart the server or browser after editing source files; just save and the page updates automatically
- WASM must build before Vite (`npm run dev` handles this automatically via `wasm:ensure`)
- **WASM required for browser.** All game logic runs in Rust via WASM. If WASM init fails, the app shows an error screen — no fallback. See `docs/gotchas.md` for details.
- Never build bridge-wasm via `cargo build --workspace`; always use `wasm-pack` to isolate feature resolution and prevent `getrandom/js` from bleeding into native builds
- Read a subsystem's CLAUDE.md before working in that directory
- Full testing playbook is in **TESTING.md**, not here
- Tailwind v4 uses `@tailwindcss/vite` plugin (no PostCSS config) — plugin goes before svelte() in `vite.config.ts`
- `vitest.config.ts` has `resolve.conditions: ["browser"]` so Svelte 5 `mount()` works in jsdom tests — don't use `require()` in tests, use ES imports
- Component tests use `@testing-library/svelte` — components needing context (stores/engine) need wrapper setup in test-helpers.ts
- Svelte `{#each}` blocks require keyed iteration (`{#each items as item (item.id)}`) per ESLint rule `svelte/require-each-key`
- See `docs/gotchas.md` for detailed technical notes (DDS browser, vendor/dds, convention system details, CLI enumeration, deal generation)

**Context tree** (read the relevant one before working in that directory):

- `src/engine/CLAUDE.md` — engine types, DDS browser support, module graph
- `src/service/CLAUDE.md` — WASM proxy, display/, util/, session-types
- `src-tauri/CLAUDE.md` — Rust workspace: 6 crates, serde contract, commands
- `src/cli/CLAUDE.md` — headless coverage test runner
- `src/components/CLAUDE.md` — component conventions, screen flow, Svelte 5 patterns
- `src/stores/CLAUDE.md` — factory DI pattern, game store methods, race condition handling
- `src/test-support/CLAUDE.md` — shared test factories, dependency rules
- `tests/CLAUDE.md` — E2E config, test running

## Reference Knowledge (docs/)

The `docs/` folder contains decision history, design philosophy, architecture specs,
and detailed guides extracted from CLAUDE.md files. Agents do not need this context
for routine work. **Read from docs/ when:**

- **Making a design decision** with multiple viable approaches → read `docs/design-philosophy.md`
  to check if a prior principle already resolves it
- **Wondering "why is it done this way?"** about a non-obvious pattern → read `docs/gotchas.md`
  or the relevant subsystem doc
- **Adding a new convention bundle** → read `docs/convention-authoring.md` for the full
  checklist, templates, and common pitfalls
- **Working on inference/posterior (Rust)** → read `docs/architecture-specs.md` for open questions
  and spec status before implementing
- **Planning a large refactor** → read `docs/design-philosophy.md` + `docs/architecture-specs.md`
  to avoid violating architectural constraints
- **Touching CLI evaluation pipeline** → read `docs/cli-evaluation.md` for the two-phase
  design and known gaps
- **Modifying typography/layout tokens** → read `docs/typography-and-layout.md` for the
  full token system
- **Product direction and deployment** → read `docs/product-direction.md` for monetization model,
  deployment architecture, two-port model, content protection strategy, and decision history
- **Rust/WASM migration** → read `docs/migration/index.md` for phase tracker, architectural
  decisions, and per-phase specs. Migration is complete; docs retained as architectural reference.

**Update docs/ when:**

- A design decision is made that future agents should know about → add to
  `docs/design-philosophy.md` or `docs/gotchas.md`
- A spec status changes (open question resolved, phase completed) → update
  `docs/architecture-specs.md` or `docs/roadmap.md`
- A non-obvious gotcha is discovered during implementation → add to `docs/gotchas.md`

---

## Context Maintenance

**Directory-level CLAUDE.md updates are mandatory.** When a session adds, removes, or renames files in a directory that has a `CLAUDE.md`, update that `CLAUDE.md` before committing. This includes:
- Adding new files to the architecture table
- Removing entries for deleted files
- Updating descriptions when module responsibilities change
- Bumping the `last-audited` date and `version` in the context-layer comment

Do not defer CLAUDE.md updates to a follow-up task. The update is part of the change.

**After modifying files in this project:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Add** an entry only if an agent would fail without knowing it, it is not obvious from
the code, and applies project-wide (not just one directory).

**Remove** any entry that fails the falsifiability test: if removing it would not change
how an agent acts, remove it. If a convention here conflicts with the codebase, the
codebase wins — update this file, do not work around it. Prune aggressively.

**docs/ knowledge base:** When a session makes a design decision, resolves an open question,
or discovers a non-obvious gotcha, update the relevant file in `docs/`. See § Reference
Knowledge above for when to read vs. update.

**Track follow-up work:** After modifying files, evaluate whether changes create incomplete
work, shift a phase status, or break an assumption tracked elsewhere. If so, create a task
or update the Phase Tracking table before ending the session. Do not leave implicit TODOs.

**Staleness anchor:** This file assumes `src/engine/types.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

**Trigger Audit or Generate:**

- Rename/move files or dirs → Audit
- > 20% of files changed → Generate
- 30+ days without touching this file → Audit
- Agent mistake caused by this file → fix immediately, then Audit

<!-- context-layer: generated=2026-02-20 | last-audited=2026-03-29 | version=20 | dir-commits-at-audit=67 | tree-sig=dirs:15,files:100+ -->
