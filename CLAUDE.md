# Bridge Practice App

Bridge bidding convention practice app (1NT Responses, Bergen Raises bundles). Tauri 2 desktop + WASM browser (Vercel). Svelte 5 (runes) + TypeScript strict. Uses meaning-centric pipeline exclusively (old tree/protocol/overlay pipeline removed).

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

- **URL routing:** `?convention=nt-bundle` jumps to game screen with that convention (IDs: `nt-bundle`, `nt-stayman`, `nt-transfers`, `bergen-bundle`, `weak-twos-bundle`, `dont-bundle`). `?learn=stayman` resolves module-first (direct to Stayman module learning). `?learn=nt-bundle` resolves as bundle filter (shows that bundle's modules, auto-selects first).
- **Deterministic seed:** `?seed=42` seeds the PRNG for reproducible deals. Seed advances per deal (42, 43, 44...). Reload resets.
- **Autoplay:** `?autoplay=true` auto-bids correct calls, dismisses feedback, and skips declarer prompts to reach Review phase instantly. Combine with convention: `?convention=nt-bundle&autoplay=true`
- **Target surface:** `?targetSurface=Z` exercises a specific meaning surface at target state
- **Coverage screen:** `?coverage=true&convention=X` opens coverage screen for a specific bundle
- **Profiles screen:** `?profiles=true` opens the base system profiles screen (SAYC/2-1/Acol comparison)
- **CLI coverage:** `npx tsx src/cli/main.ts list --bundle=nt-bundle` runs headless coverage tests. Subcommands: `list` (enumerate atoms), `eval` (per-atom evaluation), `play` (playthrough evaluation), `selftest` (CI mode), `plan` (evaluation plan). Same seed = same deal across `eval`/`eval --bid`.
- **Compositional verification:** `npx tsx src/cli/main.ts verify preflight --bundle=nt-bundle --budget=fast` runs full structural health check (lint + interference + exploration + fuzz). Individual runtime stages: `verify explore`, `verify motif`, `verify fuzz`. Static checks (lint, interference) run as vitest tests and internally as part of preflight.
- **Bid button test IDs:** `data-testid="bid-{callKey}"` on all bid buttons — e.g., `bid-1C`, `bid-7NT`, `bid-P` (pass), `bid-X` (double), `bid-XX` (redouble). Container test IDs: `level-bids` (contract grid), `special-bids` (pass/dbl/rdbl row).

## Code Hygiene

- **Fix all lint errors and warnings you encounter** — even if they weren't caused by your changes. If `npm run lint` or a hook reports errors/warnings in files you touched, fix them before finishing.
- **Lint is scoped to app code, tests, and root JS/TS config files.** `npm run lint` is not a workspace-wide sweep; it excludes generated/tooling directories outside the app surface.
- **Lint enforces architecture, not just style.** ESLint guards key import boundaries (`engine/`, `inference/`, `conventions/`, `strategy/`, `stores/`, `cli/`, `components/`), the UI/backend boundary (components/ cannot import from any backend module -- must use service/), design token usage in game components (`no-hardcoded-style-classes`), and protocol trigger scope (`no-full-scope-trigger`). `npm run lint:dead` uses Knip for dead-file detection, with `static/dds/dds.js` ignored because it is loaded by the DDS worker via `importScripts()`.

## Conventions

- **Pure engine.** `src/engine/` has zero imports from svelte, tauri, DOM APIs, or `session/`.
- **Backend modules import from each other's barrels freely.** `engine/`, `conventions/`, `inference/`, `session/`, `service/` can all import from each other's `index.ts`. Deep imports into subfolders are still blocked for external consumers (conventions barrel enforcement stays). Frontend (`components/`, `stores/`) imports backend types only through `service/`. The service port wire format is the only frontend/backend boundary.
- **Registry pattern.** Use registries for conventions and strategies, not hardcoded switch statements
- **EnginePort abstraction.** UI communicates with engine through `EnginePort` interface; engine never imports UI
- **Svelte 5 runes.** Use `$state`, `$derived`, `$effect` — no legacy `$:` reactive statements
- **Named exports only.** No `export default` — for greppability
- **No `const enum`** — breaks Vite/isolatedModules; use regular `enum`
- **No `any` without comment** — annotate with `// any: <reason>`
- **No mocking own modules** — use dependency injection instead
- **PlayerViewport boundary.** Game phase components never access raw `Deal`. Everything the player sees flows through viewport types: `BiddingViewport` (bidding), `DeclarerPromptViewport` (declarer prompt), `PlayingViewport` (play), `ExplanationViewport` (review). Viewport builders and `EvaluationOracle` live in `src/session/`. Builders filter hands through faceUpSeats. `EvaluationOracle` is the answer key — only grading code touches it.
- **Service is the sole interface for UI and CLI.** All UI components (`components/`, `stores/`) and CLI commands (`cli/`) must import exclusively from `service/` — never directly from `engine/`, `conventions/`, `inference/`, or `session/`. `service/evaluation/` is an internal subfolder containing stateless CLI grading logic. ESLint enforces this for CLI commands; UI enforcement is in progress. When adding new functionality the UI needs, expose it through `ServicePort` or as a re-export from `service/index.ts` — do not add direct imports from backend modules.
- **Strategy contract types live in `conventions/core/strategy-types.ts`.** `BiddingStrategy`, `BidResult`, `BiddingContext`, `PlayStrategy`, `PlayContext`, `PlayResult`, `PosteriorSummary`, `PracticalRecommendation` — NOT in service/ or engine/ — because conventions/ imports them and placing them elsewhere creates circular dependencies.
- **Callers own their types.** Service defines its own viewport/response types (`BiddingViewport`, `ViewportBidFeedback`, `TeachingDetail`, etc.) rather than exposing internal types from backend modules. Engine domain primitives (`Call`, `Card`, `Seat`, `Hand`) are acceptable to re-export since they are universal vocabulary. Convention pipeline internals (`PipelineResult`, `ArbitrationResult`, `MachineDebugSnapshot`, `EvaluatedFacts`) must NOT cross the service boundary — create service-owned viewport types instead.
- **Coverage optimization.** Tree LP computes minimal test sessions; two-phase algorithm (leaf sweep + gap fill) covers all (state, surface) pairs efficiently. Module interference detection uses static prefix-overlap analysis.

## Design Philosophy

See `docs/design-philosophy.md` for the full set of 10 design principles and subsystem design rationale.

## System Parameterization

Multi-system support (SAYC, 2/1, Acol). Modules are system-agnostic — differences flow through `SystemConfig` → system facts → surface clause evaluation. `SystemConfig` and system fact vocabulary live in `conventions/definitions/`.

## Architecture

**Dependency direction (hexagonal boundary):**
```
components/ → stores/ → service/ (thin port) → session/ → {engine, conventions, inference}
cli/commands/ → service/
```
UI layers (`components/`, `stores/`) import ONLY from `service/`. `session/` is the domain layer — it must never import from `service/` (ESLint enforced). `service/` is a thin hexagonal port: `ServicePort`, barrel, `display/`, `util/`, `evaluation/`. Nothing imports from `service/` except `stores/`, `components/`, and `cli/commands/`.

```
src/
  engine/          Pure TS game logic (zero platform deps, includes seeded-rng.ts)
  conventions/     Convention system
    core/            Registry, context factory, bundle registry, runtime, strategy contract types — public API via index.ts barrel
    pipeline/        Meaning pipeline (surfaces → facts → evaluation → arbitration → encoding)
      facts/           Fact evaluation: hand → facts (primitive, bridge-derived, module-derived)
      evaluation/      Meaning evaluation + arbitration: surfaces × facts → ranked result
      observation/     Surface selection (FSM/route/negotiation) + observation log construction
    teaching/        Teaching resolution, projection builder, parse-tree builder, teaching graph
    definitions/     Convention bundles + system config + system fact vocabulary
    adapter/         Convention→strategy bridge (meaning-strategy, protocol-adapter, practical-scorer)
  inference/       Auction inference system (natural inference, posterior engine, belief accumulator)
  session/         Domain logic: game state, controllers, drill lifecycle, viewport builders, grading
    heuristics/    Convention-independent bidding/play heuristics (natural fallback, strategy chain, random/heuristic play)
  service/         Thin hexagonal port: ServicePort, barrel, display/, util/, evaluation/
    evaluation/    Stateless CLI grading logic (atom evaluation, playthrough evaluation) — internal to service
    display/       Call/contract/card formatting, hand summary (moved from core/display/)
    util/          Pure utilities: delay (moved from core/util/)
  cli/             Headless coverage test runner (modular: main.ts + shared.ts + commands/)
  test-support/    Shared test factories (engine stub, deal/session fixtures)
  stores/          Svelte stores (app, game coordinator + bidding/play/dds sub-stores, context DI, dev-params)
  components/      Svelte UI components
    navigation/    NavRail (desktop left rail), NavFlyout (hover menu), BottomTabBar (mobile)
    screens/       Screen-level components (ConventionSelectScreen, LearningScreen, game-screen/GameScreen)
    game/          Game components + co-located .ts companions (DecisionTree.ts, RoundBidList.ts, BidFeedbackPanel.ts)
    shared/        Reusable components (Card, Button, ConventionCallout) + display utilities (tokens, sort-cards, seat-mapping, table-scale, breakpoints, vulnerability-labels, layout-props)
src-tauri/         Cargo workspace with three crates
  crates/
    bridge-engine/   Pure Rust engine logic (types, hand eval, deal gen, auction, scoring, play)
    bridge-tauri/    Tauri app with #[tauri::command] handlers delegating to bridge-engine free functions
    bridge-wasm/     WASM bindings via wasm-bindgen for browser deployment
tests/
  e2e/             Playwright E2E tests
```

**Subsystems:**

| Subsystem | Entry | Summary |
|-----------|-------|---------|
| Engine | `src/engine/types.ts` | Pure TS game logic |
| Conventions | `src/conventions/index.ts` | Convention system (core/ + pipeline/ + teaching/ + definitions/ + adapter/) |
| Pipeline | `src/conventions/pipeline/run-pipeline.ts` | Meaning pipeline (facts/ → evaluation/ → observation/) with cross-cutting types at root |
| Adapter | `src/conventions/adapter/protocol-adapter.ts` | Convention→strategy bridge (meaning-strategy, protocol-adapter, practical-scorer) |
| Teaching | `src/conventions/teaching/teaching-resolution.ts` | Teaching resolution and projection (inside conventions/) |
| Inference | `src/inference/inference-engine.ts` | Auction inference |
| Session | `src/session/session-state.ts` | Domain: game state, controllers, drill lifecycle, viewport builders, heuristics |
| Service | `src/service/index.ts` | Thin hexagonal port + barrel + evaluation facade + display/ + util/ |
| CLI | `src/cli/main.ts` | Headless coverage test runner (modular) |
| Test Support | `src/test-support/engine-stub.ts` | Shared test factories |
| Stores | `src/stores/app.svelte.ts` | Svelte stores + game coordinator |
| Components | — | Svelte UI (screens/game/shared) |
| Tests | `tests/e2e/` | Vitest + Playwright |

**Game phases:** BIDDING → DECLARER_PROMPT (conditional) → PLAYING (optional) → EXPLANATION. User always bids as South. Details in `src/stores/CLAUDE.md`.

**V1 storage:** localStorage for user preferences only — no stats/progress tracking until V2 (SQLite)

## Gotchas

- `npm run dev` builds WASM if `pkg/` missing, then starts Vite with HMR — the dev server stays running and reflects file changes instantly. Do NOT restart the server or browser after editing source files; just save and the page updates automatically
- WASM must build before Vite (`npm run dev` handles this automatically via `wasm:ensure`)
- **No pure-TS EnginePort.** Browser=WASM (`WasmEngine`), desktop=Tauri IPC (`TauriIpcEngine`), no fallback. See `docs/gotchas.md` for details.
- Never build bridge-wasm via `cargo build --workspace`; always use `wasm-pack` to isolate feature resolution and prevent `getrandom/js` from bleeding into native builds
- Read a subsystem's CLAUDE.md before working in that directory
- Full testing playbook is in **TESTING.md**, not here
- Tailwind v4 uses `@tailwindcss/vite` plugin (no PostCSS config) — plugin goes before svelte() in `vite.config.ts`
- `vitest.config.ts` has `resolve.conditions: ["browser"]` so Svelte 5 `mount()` works in jsdom tests — don't use `require()` in tests, use ES imports
- Component tests use `@testing-library/svelte` — components needing context (stores/engine) need wrapper setup in test-helpers.ts
- Svelte `{#each}` blocks require keyed iteration (`{#each items as item (item.id)}`) per ESLint rule `svelte/require-each-key`
- See `docs/gotchas.md` for detailed technical notes (DDS browser, vendor/dds, convention system details, CLI enumeration, deal generation)

**Context tree** (read the relevant one before working in that directory):

- `src/engine/CLAUDE.md` — engine purity, module graph, key patterns
- `src/conventions/CLAUDE.md` — registry pattern, convention bundles
- `src/conventions/core/CLAUDE.md` — runtime, bundle systems, absorbed types from former core/contracts/
- `src/conventions/pipeline/CLAUDE.md` — pipeline module graph, 6-stage pipeline flow, test architecture
- `src/conventions/definitions/CLAUDE.md` — system config, system fact vocabulary
- `src/inference/CLAUDE.md` — inference architecture, posterior engine
- `src/inference/posterior/CLAUDE.md` — posterior subsystem: factor compiler, backend, query port
- `src/session/CLAUDE.md` — domain logic: game state, controllers, drill lifecycle, viewport builders, heuristics
- `src/session/heuristics/CLAUDE.md` — convention-independent bidding/play heuristics
- `src/conventions/adapter/CLAUDE.md` — convention→strategy bridge (meaning-strategy, protocol-adapter, practical-scorer)
- `src/service/CLAUDE.md` — thin hexagonal port, display/, util/, evaluation/
- `src/service/evaluation/CLAUDE.md` — stateless CLI grading logic
- `src/cli/CLAUDE.md` — headless coverage test runner
- `src/conventions/teaching/CLAUDE.md` — convention evaluation for teaching
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
- **Working on inference/posterior** → read `docs/architecture-specs.md` for open questions
  and spec status before implementing
- **Planning a large refactor** → read `docs/design-philosophy.md` + `docs/architecture-specs.md`
  to avoid violating architectural constraints
- **Touching CLI evaluation pipeline** → read `docs/cli-evaluation.md` for the two-phase
  design and known gaps
- **Modifying typography/layout tokens** → read `docs/typography-and-layout.md` for the
  full token system

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

<!-- context-layer: generated=2026-02-20 | last-audited=2026-03-25 | version=19 | dir-commits-at-audit=62 | tree-sig=dirs:20,files:150+ -->
