# Bridge Practice App

Desktop app for drilling bridge bidding conventions (Stayman, Gerber, DONT, Bergen Raises). Tauri 2 + Svelte 5 (runes) + TypeScript strict.

## Commands

| Command                 | Purpose                                                  |
| ----------------------- | -------------------------------------------------------- |
| `npm run dev`           | Start dev server (port 1420)                             |
| `npm run build`         | Build production bundle                                  |
| `npm run check`         | Svelte type-check                                        |
| `npx tsc --noEmit`      | TypeScript type-check                                    |
| `npm run test`          | Vitest watch mode                                        |
| `npm run test:run`      | Vitest single run                                        |
| `npm run test:coverage` | Coverage report (90% branches, 90% functions, 85% lines) |
| `npm run test:e2e`      | Playwright E2E tests                                     |
| `npm run test:all`      | Unit + E2E together                                      |
| `npm run cli`           | Run CLI in dev mode (via tsx)                             |
| `npm run build:cli`     | Compile CLI to dist/                                      |
| `npm run lint`          | ESLint check                                             |
| `npm run lint:fix`      | ESLint auto-fix                                          |
| `npm run format`        | Prettier format all files                                |
| `npm run format:check`  | Prettier check (CI)                                      |
| `npm run dev:web`       | Rust HTTP server (3001) + Vite dev (1420) via concurrently |
| `cargo test --workspace`| Run all Rust tests (from src-tauri/)                      |
| `cargo build --workspace`| Build all Rust crates (from src-tauri/)                  |

## Dev Tools (dev server only)

- **URL routing:** `?convention=stayman` jumps to game screen with that convention (IDs: `stayman`, `gerber`, `dont`, `bergen-raises`)
- **Deterministic seed:** `?seed=42` seeds the PRNG for reproducible deals. Seed advances per deal (42, 43, 44...). Reload resets.
- **Bid button test IDs:** `data-testid="bid-{callKey}"` on all bid buttons — e.g., `bid-1C`, `bid-7NT`, `bid-pass`, `bid-double`, `bid-redouble`

## Conventions

- **Pure engine.** `src/engine/` has zero imports from svelte, tauri, DOM APIs, or `ai/`. Engine imports `shared/types` for cross-boundary types (`BiddingStrategy`, `BidResult`)
- **Shared types layer.** `src/shared/types.ts` contains types used by both `engine/` and `ai/`. Do not add types only used by one module.
- **Registry pattern.** Use registries for conventions and strategies, not hardcoded switch statements
- **EnginePort abstraction.** UI communicates with engine through `EnginePort` interface; engine never imports UI
- **Svelte 5 runes.** Use `$state`, `$derived`, `$effect` — no legacy `$:` reactive statements
- **Named exports only.** No `export default` — for greppability
- **No `const enum`** — breaks Vite/isolatedModules; use regular `enum`
- **No `any` without comment** — annotate with `// any: <reason>`
- **No mocking own modules** — use dependency injection instead

## Architecture

```
src/
  engine/          Pure TS game logic (zero platform deps)
    __tests__/     Unit tests colocated with source
  cli/             CLI interface — consumer of engine, JSON-first output
    commands/      Command handlers (generate, evaluate, stubs for future phases)
    __tests__/     CLI unit tests
  shared/          Cross-boundary types (BidResult, BiddingStrategy, ConditionDetail)
  conventions/     Convention definitions (registry, conditions, evaluator, Stayman, types)
  ai/              AI bidding strategies (convention adapter, pass strategy, drill session)
  lib/             Display utilities, design tokens, pure functions (format, context, sort-cards, table-scale, filter-conventions, drill-helpers, seat-mapping)
  components/      Svelte UI components
    screens/       Screen-level components (ConventionSelectScreen, game-screen/GameScreen)
    game/          Game components (BridgeTable, HandFan, AuctionTable, BidPanel, BiddingReview, TrickArea)
    shared/        Reusable components (Card, Button, ConventionCallout)
  stores/          Svelte stores (app navigation, game drill state)
src-tauri/         Cargo workspace with three crates
  crates/
    bridge-engine/   Pure Rust engine logic (types, hand eval, deal gen, auction, scoring, play)
    bridge-tauri/    Tauri app with #[tauri::command] handlers delegating to BridgeEngine trait
    bridge-server/   Axum HTTP server (port 3001) for browser dev mode
tests/
  e2e/             Playwright E2E tests
```

**Subsystems:**

- **Engine:** Pure TS game logic — types, hand evaluation, deal generation, auction, scoring, play rules, EnginePort. `bid-suggester.ts` is standalone (not on EnginePort). `tauri-ipc-engine.ts` and `http-engine.ts` provide Rust-backed transports. (entry: `src/engine/types.ts`)
- **Conventions:** Registry of convention configs — each convention = one file using `conditionedRule()` with composable condition factories (`conditions.ts`), evaluated by `condition-evaluator.ts`, registered via `registry.ts`. All 23 rules across 4 conventions use introspectable conditions (entry: `src/conventions/registry.ts`)
- **Shared:** Cross-boundary type definitions used by both engine/ and ai/ (entry: `src/shared/types.ts`)
- **AI:** Bidding strategies + play AI — `conventionToStrategy()` adapter, `passStrategy`, `DrillSession` + `DrillConfig` factory, `randomPlay()` card selection (entry: `src/ai/convention-strategy.ts`)
- **Lib:** Display utilities + pure functions — `formatCall()`, suit symbols, typed Svelte context helpers, design tokens (`tokens.ts`), extracted logic (`sortCards`, `computeTableScale`, `filterConventions`, `startDrill`, `viewSeat`), seedable PRNG (`seeded-rng.ts`) (entry: `src/lib/format.ts`)
- **Components:** Svelte 5 UI organized in `screens/` (ConventionSelectScreen, `game-screen/GameScreen` + sub-components), `game/` (BridgeTable, HandFan, AuctionTable, BidPanel, BidFeedbackPanel, BiddingReview, TrickArea), `shared/` (Card, Button, ConventionCallout). Midnight Table dark theme via CSS custom properties + Tailwind.
- **Stores:** App store (screen navigation, selected convention, dev seed state) + Game store (deal, auction, bid history, phase transitions) via factory DI (entry: `src/stores/app.svelte.ts`)
- **CLI:** Command-line interface wrapping EnginePort — JSON default, text opt-in, phase-gated future commands (entry: `src/cli/runner.ts`)
- **Tests:** Vitest unit + Playwright E2E (entry: `tests/e2e/`)

**Game phases:** BIDDING → DECLARER_PROMPT (conditional) → PLAYING (optional) → EXPLANATION (tracked in `stores/game.svelte.ts`). User always bids as South. When user is dummy (North declares), DECLARER_PROMPT offers "Play as Declarer" (rotates table 180° via `viewSeat()` in `src/lib/seat-mapping.ts`) or "Skip to Review" (goes straight to EXPLANATION). When South declares or E/W declares, auction completes directly to EXPLANATION (no play phase). Play phase only entered via acceptDeclarerSwap. AI plays random legal cards with 500ms delay.

**V1 storage:** localStorage for user preferences only — no stats/progress tracking until V2 (SQLite)

## Phase Tracking

| Phase | Status  | Description                                                               |
| ----- | ------- | ------------------------------------------------------------------------- |
| 0     | Done    | Scaffold, types, testing pipeline, CLAUDE.md                              |
| 1     | Done    | Engine core: types, constants, hand-evaluator, deal-generator, EnginePort, CLI |
| 1.5   | Done    | Auction mechanics, scoring engine, play rules, convention test fixtures    |
| 2     | Done    | Convention registry + Stayman implementation                              |
| 3     | Done    | AI bidding strategies (BiddingStrategy, convention adapter, pass strategy) |
| 4     | Done    | Drill UI with feedback (Tailwind, stores, components, drill session)       |
| 5     | Done    | Card play UI + Tauri desktop shell                                        |
| 6     | In Progress | Rust engine port — three-crate workspace (bridge-engine, bridge-tauri, bridge-server), dual transport (Tauri IPC + HTTP) |
| 7     | Pending | Smart play AI — heuristic → DDS-assisted → convention-aware card play     |

## Testing Scope

**Run only the tests affected by your changes — not the full suite.** Vitest supports file-pattern filtering:

| Changed files in… | Test command | When to use full suite |
|---|---|---|
| `src/components/` | `npx vitest run src/components/` | Never for UI-only (CSS, props, layout) |
| `src/stores/` | `npx vitest run src/stores/` | If store interface changed |
| `src/engine/` | `npx vitest run src/engine/` | If types/exports changed |
| `src/lib/` | `npx vitest run src/lib/` | If shared utility signatures changed |
| CSS-only / layout tweaks | `npm run check` (type-check only) | Never |
| Cross-cutting (types, exports) | `npm run test:run` (full suite) | Always for type/interface changes |

**Rule:** If you only changed `.svelte` files, CSS values, or added optional props — run targeted tests or just type-check. Full suite (`npm run test:run`) only when changing shared types, store interfaces, or engine logic.

## Gotchas

- `npm run dev` uses Vite with HMR — the dev server stays running and reflects file changes instantly. Do NOT restart the server or browser after editing source files; just save and the page updates automatically
- Read a subsystem's CLAUDE.md before working in that directory
- Full testing playbook is in **TESTING.md**, not here
- `src-tauri/` is boilerplate scaffold until Phase 5 — don't add custom Rust commands yet
- No vendored bridge libraries — clean-room implementation only
- DONT uses Standard DONT (original Marty Bergen) variant. Bergen Raises uses Standard Bergen (3C=constructive 7-9, 3D=limit 10-12, 3M=preemptive 0-6)
- Only duplicate bridge scoring implemented (rubber bridge out of scope for V1)
- Deal generator uses flat rejection sampling (no relaxation) with configurable `maxAttempts`, `minLengthAny` OR constraints, and `customCheck` escape hatch
- Tailwind v4 uses `@tailwindcss/vite` plugin (no PostCSS config) — plugin goes before svelte() in `vite.config.ts`
- `vitest.config.ts` has `resolve.conditions: ["browser"]` so Svelte 5 `mount()` works in jsdom tests — don't use `require()` in tests, use ES imports
- Component tests use `@testing-library/svelte` — components needing context (stores/engine) need wrapper setup in test-helpers.ts
- Svelte `{#each}` blocks require keyed iteration (`{#each items as item (item.id)}`) per ESLint rule `svelte/require-each-key`

**Reference docs** (detailed architecture, not auto-loaded):

- `docs/architecture-reference.md` — convention constraints, AI heuristics, screen flow, phase details
- `docs/bridge-rules-sources.md` — authoritative bridge rules sources, ambiguity resolution
- `docs/conventions/` — per-convention reference docs (gerber.md, bergen-raises.md, dont.md) with sources, rules, edge cases

**Context tree** (read the relevant one before working in that directory):

- `src/engine/CLAUDE.md` — engine purity, module graph, key patterns
- `src/conventions/CLAUDE.md` — registry pattern, convention rules reference, how to add conventions
- `src/cli/CLAUDE.md` — JSON-first output, PhaseGate, how to add commands
- `src/ai/CLAUDE.md` — strategy pattern, dependency rules, how to add strategies
- `src/components/CLAUDE.md` — component conventions, screen flow, Svelte 5 patterns
- `src/stores/CLAUDE.md` — factory DI pattern, game store methods, race condition handling
- `tests/CLAUDE.md` — E2E config, test running

---

## Context Maintenance

**After modifying files in this project:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Add** an entry only if an agent would fail without knowing it, it is not obvious from
the code, and applies project-wide (not just one directory).

**Remove** any entry that fails the falsifiability test: if removing it would not change
how an agent acts, remove it. If a convention here conflicts with the codebase, the
codebase wins — update this file, do not work around it. Prune aggressively.

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

<!-- context-layer: generated=2026-02-20 | last-audited=2026-02-22 | version=6 | dir-commits-at-audit=21 | tree-sig=dirs:9,files:120+ -->
