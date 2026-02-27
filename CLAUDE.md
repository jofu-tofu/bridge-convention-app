# Bridge Practice App

Desktop app for drilling bridge bidding conventions (Stayman, Gerber, DONT, Bergen Raises). Tauri 2 + Svelte 5 (runes) + TypeScript strict.

## Commands

| Command                   | Purpose                                                    |
| ------------------------- | ---------------------------------------------------------- |
| `npm run dev`             | Start dev server (port 1420)                               |
| `npm run build`           | Build production bundle                                    |
| `npm run check`           | Svelte type-check                                          |
| `npx tsc --noEmit`        | TypeScript type-check                                      |
| `npm run test`            | Vitest watch mode                                          |
| `npm run test:run`        | Vitest single run                                          |
| `npm run test:coverage`   | Coverage report (90% branches, 90% functions, 85% lines)   |
| `npm run test:e2e`        | Playwright E2E tests                                       |
| `npm run test:all`        | Unit + E2E together                                        |
| `npm run lint`            | ESLint check                                               |
| `npm run lint:fix`        | ESLint auto-fix                                            |
| `npm run format`          | Prettier format all files                                  |
| `npm run format:check`    | Prettier check (CI)                                        |
| `npm run dev:web`         | Rust HTTP server (3001) + Vite dev (1420) via concurrently |
| `cargo test --workspace`  | Run all Rust tests (from src-tauri/)                       |
| `cargo build --workspace` | Build all Rust crates (from src-tauri/)                    |

## Dev Tools (dev server only)

- **URL routing:** `?convention=stayman` jumps to game screen with that convention (IDs: `stayman`, `gerber`, `dont`, `bergen-raises`, `landy`, `sayc`)
- **Deterministic seed:** `?seed=42` seeds the PRNG for reproducible deals. Seed advances per deal (42, 43, 44...). Reload resets.
- **Autoplay:** `?autoplay=true` auto-bids correct calls, dismisses feedback, and skips declarer prompts to reach Review phase instantly. Combine with convention: `?convention=stayman&autoplay=true`
- **Bid button test IDs:** `data-testid="bid-{callKey}"` on all bid buttons — e.g., `bid-1C`, `bid-7NT`, `bid-pass`, `bid-double`, `bid-redouble`

## Conventions

- **Pure engine.** `src/engine/` has zero imports from svelte, tauri, DOM APIs, or `strategy/`. Engine imports `shared/types` for cross-boundary types (`BiddingStrategy`, `BidResult`)
- **Shared types layer.** `src/shared/types.ts` contains types used by both `engine/` and `strategy/`. Do not add types only used by one module.
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
  shared/          Cross-boundary types (BidResult, BiddingStrategy, PlayStrategy, ConditionDetail)
  conventions/     Convention system
    core/            Registry, evaluator, tree system, conditions (stable infrastructure)
    definitions/     Convention files (stayman, gerber, dont, bergen-raises, landy, sayc)
  inference/       Auction inference system (per-partnership information asymmetry)
  strategy/        AI strategies
    bidding/         Convention-to-strategy adapter, pass strategy
    play/            Play strategies (random, heuristic; future: DDS, signal/discard)
  drill/           Drill lifecycle (session, config, helpers)
  display/         UI display utilities (format, tokens, sort-cards, seat-mapping, rules-display, hcp)
  util/            Zero-dep pure utilities (delay, seeded-rng)
  test-support/    Shared test factories (engine stub, deal/session fixtures)
  stores/          Svelte stores (app, game coordinator + bidding/play/dds sub-stores, context DI)
  components/      Svelte UI components
    screens/       Screen-level components (ConventionSelectScreen, game-screen/GameScreen)
    game/          Game components (BridgeTable, HandFan, AuctionTable, BidPanel, BiddingReview, TrickArea, RulesPanel)
    shared/        Reusable components (Card, Button, ConventionCallout)
src-tauri/         Cargo workspace with three crates
  crates/
    bridge-engine/   Pure Rust engine logic (types, hand eval, deal gen, auction, scoring, play)
    bridge-tauri/    Tauri app with #[tauri::command] handlers delegating to BridgeEngine trait
    bridge-server/   Axum HTTP server (port 3001) for browser dev mode
tests/
  e2e/             Playwright E2E tests
```

**Subsystems:**

- **Engine:** Pure TS game logic — types, hand evaluation, deal generation, auction, scoring, play rules, EnginePort. `bid-suggester.ts` is standalone (not on EnginePort). `call-helpers.ts` provides canonical `callsMatch()`. `tauri-ipc-engine.ts` (desktop) and `http-engine.ts` (dev/browser) provide Rust-backed transports — no fallback, Rust server required. (entry: `src/engine/types.ts`)
- **Conventions:** Split into `core/` (registry, evaluator, tree system, conditions — stable infrastructure) and `definitions/` (6 convention files — grows unboundedly). All conventions use hierarchical rule trees. `evaluateBiddingRules(context, config)` — tree-only. (entry: `src/conventions/core/registry.ts`)
- **Shared:** Cross-boundary type definitions — `BiddingStrategy`, `PlayStrategy`, `PlayContext`, `InferredHoldings`, `BidHistoryEntry`, `TreeEvalSummary`/`TreePathEntry`/`TreeForkPoint`/`SiblingBid` (tree traversal DTOs). Also `hand-summary.ts` (`formatHandSummary`). (entry: `src/shared/types.ts`)
- **Inference:** Auction inference system — per-partnership information asymmetry with `InferenceProvider` spectrum (natural → convention-aware → full knowledge = difficulty axis). Negative inference via tree rejection data. (entry: `src/inference/inference-engine.ts`)
- **Strategy:** Bidding strategies (`conventionToStrategy()` adapter, `passStrategy`) and play strategies (`createHeuristicPlayStrategy()` 7-heuristic chain, `randomPlayStrategy` fallback). (entry: `src/strategy/bidding/convention-strategy.ts`)
- **Drill:** Unified drill lifecycle — `DrillConfig`/`DrillSession` types, session factory, config factory, `startDrill()` helper. (entry: `src/drill/types.ts`)
- **Display:** UI display utilities — `formatCall()`, `formatRuleName()`, suit symbols, design tokens, `sortCards`, `computeTableScale`, `filterConventions`, `viewSeat`, `prepareRulesForDisplay`, `groupBidsByRound`, HCP display helpers. (entry: `src/display/format.ts`)
- **Util:** Zero-dependency pure utilities — `delay()` async helper, `mulberry32` seedable PRNG. (entry: `src/util/delay.ts`)
- **Test Support:** Shared test factories — `createStubEngine` (minimal EnginePort), `makeDeal`, `makeSimpleTestDeal`, `makeDrillSession`, `makeContract`, `makeCard`, flush helpers. Imports from `engine/`, `drill/`, `shared/` only. (entry: `src/test-support/engine-stub.ts`)
- **Components:** Svelte 5 UI organized in `screens/` (ConventionSelectScreen, `game-screen/GameScreen` phase router + `BiddingPhase`/`DeclarerPromptPhase`/`PlayingPhase`/`ExplanationPhase`), `game/` (BridgeTable, HandFan, AuctionTable, BidPanel, BidFeedbackPanel, BiddingReview, TrickArea, RulesPanel), `shared/` (Card, Button, ConventionCallout). Midnight Table dark theme via CSS custom properties + Tailwind.
- **Stores:** App store (screen navigation, selected convention, dev seed state) + Game store coordinator/facade with sub-stores: `bidding.svelte.ts` (auction, bid history, feedback), `play.svelte.ts` (tricks, AI play loop), `dds.svelte.ts` (DDS solution). Phase state machine with `transitionTo()` guard. `context.ts` provides Svelte context DI. (entry: `src/stores/app.svelte.ts`)
- **Tests:** Vitest unit + Playwright E2E (entry: `tests/e2e/`)

**Game phases:** BIDDING → DECLARER_PROMPT (conditional) → PLAYING (optional) → EXPLANATION (tracked in `stores/game.svelte.ts`). User always bids as South. When user is dummy (North declares), DECLARER_PROMPT offers "Play as Declarer" (rotates table 180° via `viewSeat()` in `src/display/seat-mapping.ts`) or "Skip to Review". When E/W declares, DECLARER_PROMPT offers "Play as Defender" (user stays South) or "Skip to Review". When South declares, auction completes directly to EXPLANATION. Play phase entered via `acceptDeclarerSwap` (dummy) or `acceptDefend` (defender). AI plays using heuristic strategy (opening leads, second-hand-low, third-hand-high, trump management) with 500ms delay; falls back to random if no strategy configured.

**V1 storage:** localStorage for user preferences only — no stats/progress tracking until V2 (SQLite)

## Roadmap

**Completed:** DDS Review Integration (1), Rule Tree Migration (1.5a-c), Bridge Bum Test Audit (1.6a-f), Rules Tab (2a).

**Active/upcoming:**

2. **User Learning Enhancements**
   - (b) Dedicated learning screen — Browse full convention rule sets outside of game context. Accessible from ConventionSelectScreen. Reuses RulesPanel component.
3. **Difficulty Configuration** — UI for inference spectrum (easy/medium/hard), wires `InferenceProvider` selection per partnership

## Test-Driven Development

This project follows TDD (Red-Green-Refactor, Kent Beck). All plans and implementations must follow this workflow:

- **Failing test first.** Write a test that fails before writing implementation code. No exceptions for "simple" changes — if it changes behavior, it gets a test first.
- **Behavior over implementation.** Tests verify WHAT code does, not HOW (Kent Beck / Michael Feathers). A test should pass unchanged if you rewrite the implementation with a different algorithm.
- **Test through public interfaces.** Don't test private methods or internal state. Test the contract the module exposes.
- **One concern per test.** Each test verifies one behavior. If it has "and" in the description, split it.
- **Characterization tests for unknowns.** When modifying code you don't fully understand, write tests that capture current behavior before changing it (Michael Feathers).
- **No test rewrites on refactor.** If a refactoring breaks tests, the tests were coupled to implementation — fix the tests to test behavior, then refactor.

## Testing Scope

**Run only the tests affected by your changes — not the full suite.** Vitest supports file-pattern filtering:

| Changed files in…              | Test command                      | When to use full suite                 |
| ------------------------------ | --------------------------------- | -------------------------------------- |
| `src/components/`              | `npx vitest run src/components/`  | Never for UI-only (CSS, props, layout) |
| `src/stores/`                  | `npx vitest run src/stores/`      | If store interface changed             |
| `src/engine/`                  | `npx vitest run src/engine/`      | If types/exports changed               |
| `src/display/`                 | `npx vitest run src/display/`     | If shared utility signatures changed   |
| CSS-only / layout tweaks       | `npm run check` (type-check only) | Never                                  |
| Cross-cutting (types, exports) | `npm run test:run` (full suite)   | Always for type/interface changes      |

**Rule:** If you only changed `.svelte` files, CSS values, or added optional props — run targeted tests or just type-check. Full suite (`npm run test:run`) only when changing shared types, store interfaces, or engine logic.

## Gotchas

- `npm run dev` uses Vite with HMR — the dev server stays running and reflects file changes instantly. Do NOT restart the server or browser after editing source files; just save and the page updates automatically
- Read a subsystem's CLAUDE.md before working in that directory
- Full testing playbook is in **TESTING.md**, not here
- `src-tauri/` is boilerplate scaffold until Phase 5 — don't add custom Rust commands yet
- No vendored bridge libraries — clean-room implementation only
- DONT uses Standard DONT (original Marty Bergen) variant. Bergen Raises uses Standard Bergen (3C=constructive 7-10, 3D=limit 10-12, 3M=preemptive 0-6, splinter with shortage 12+)
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
- `src/inference/CLAUDE.md` — inference architecture, negation, invariants
- `src/strategy/CLAUDE.md` — strategy pattern, conventionToStrategy, play heuristics
- `src/drill/CLAUDE.md` — DrillConfig, DrillSession, drill lifecycle
- `src/display/CLAUDE.md` — display utility inventory, dependency rules
- `src/components/CLAUDE.md` — component conventions, screen flow, Svelte 5 patterns
- `src/stores/CLAUDE.md` — factory DI pattern, game store methods, race condition handling
- `src/test-support/CLAUDE.md` — shared test factories, dependency rules
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

<!-- context-layer: generated=2026-02-20 | last-audited=2026-02-25 | version=10 | dir-commits-at-audit=52 | tree-sig=dirs:16,files:180+ -->
