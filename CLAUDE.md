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

- **URL routing:** `?convention=nt-bundle` jumps to game screen with that convention (IDs: `nt-bundle`, `nt-stayman`, `nt-transfers`, `bergen-bundle`, `weak-twos-bundle`, `dont-bundle`). `?learn=nt-bundle` jumps to learning screen.
- **Deterministic seed:** `?seed=42` seeds the PRNG for reproducible deals. Seed advances per deal (42, 43, 44...). Reload resets.
- **Autoplay:** `?autoplay=true` auto-bids correct calls, dismisses feedback, and skips declarer prompts to reach Review phase instantly. Combine with convention: `?convention=nt-bundle&autoplay=true`
- **Target surface:** `?targetSurface=Z` exercises a specific meaning surface at target state
- **Coverage screen:** `?coverage=true&convention=X` opens coverage screen for a specific bundle
- **CLI coverage:** `npx tsx src/cli/main.ts list --bundle=nt-bundle` runs headless coverage tests. Subcommands: `list` (enumerate atoms), `eval` (per-atom evaluation), `play` (playthrough evaluation), `selftest` (CI mode), `plan` (evaluation plan). Same seed = same deal across `eval`/`eval --bid`.
- **Compositional verification:** `npx tsx src/cli/main.ts verify preflight --bundle=nt-bundle --budget=fast` runs full structural health check (lint + interference + exploration + fuzz). Individual runtime stages: `verify explore`, `verify motif`, `verify fuzz`. Static checks (lint, interference) run as vitest tests and internally as part of preflight.
- **Bid button test IDs:** `data-testid="bid-{callKey}"` on all bid buttons — e.g., `bid-1C`, `bid-7NT`, `bid-P` (pass), `bid-X` (double), `bid-XX` (redouble). Container test IDs: `level-bids` (contract grid), `special-bids` (pass/dbl/rdbl row).

## Code Hygiene

- **Fix all lint errors and warnings you encounter** — even if they weren't caused by your changes. If `npm run lint` or a hook reports errors/warnings in files you touched, fix them before finishing.
- **Lint is scoped to app code, tests, and root JS/TS config files.** `npm run lint` is not a workspace-wide sweep; it excludes generated/tooling directories outside the app surface.
- **Lint enforces architecture, not just style.** ESLint guards key import boundaries (`engine/`, `inference/`, `conventions/`, `strategy/`, `bootstrap/`, `stores/`, `cli/`, `components/`), design token usage in game components (`no-hardcoded-style-classes`), and protocol trigger scope (`no-full-scope-trigger`). `npm run lint:dead` uses Knip for dead-file detection, with `static/dds/dds.js` ignored because it is loaded by the DDS worker via `importScripts()`.

## Conventions

- **Pure engine.** `src/engine/` has zero imports from svelte, tauri, DOM APIs, or `strategy/`. Engine imports `core/contracts/` for cross-boundary types (`BiddingStrategy`, `BidResult`)
- **Contracts layer.** `src/core/contracts/` contains cross-boundary DTOs and strategy interfaces shared across module boundaries. Keep files domain-grouped; do not add types used by only one subsystem.
- **Registry pattern.** Use registries for conventions and strategies, not hardcoded switch statements
- **EnginePort abstraction.** UI communicates with engine through `EnginePort` interface; engine never imports UI
- **Svelte 5 runes.** Use `$state`, `$derived`, `$effect` — no legacy `$:` reactive statements
- **Named exports only.** No `export default` — for greppability
- **No `const enum`** — breaks Vite/isolatedModules; use regular `enum`
- **No `any` without comment** — annotate with `// any: <reason>`
- **No mocking own modules** — use dependency injection instead
- **PlayerViewport boundary.** Game phase components never access raw `Deal`. Everything the player sees flows through viewport types: `BiddingViewport` (bidding), `DeclarerPromptViewport` (declarer prompt), `PlayingViewport` (play), `ExplanationViewport` (review). Builders in `src/core/viewport/` filter hands through faceUpSeats. `EvaluationOracle` is the answer key — only grading code touches it.
- **Evaluation facade enforces viewport boundary at type level.** `src/evaluation/` encapsulates strategy → viewport → grading pipeline. Its exports use ONLY viewport types (`BiddingViewport`, `ViewportBidFeedback`, `TeachingDetail`). Agent-facing CLI commands (`eval.ts`, `play.ts`) import from `evaluation/` only — ESLint blocks direct imports from `strategy/`, `teaching/`, `conventions/`, `core/viewport/`, `core/contracts/`, and `engine/` in those files.
- **Coverage optimization.** Tree LP computes minimal test sessions; two-phase algorithm (leaf sweep + gap fill) covers all (state, surface) pairs efficiently. Module interference detection uses static prefix-overlap analysis.

## Design Philosophy

- **Design for 100+ modules.** The system will eventually have 100+ convention modules composed into many bundles. Every interface, registry, and derivation mechanism must scale to that volume. No O(N²) cross-references between modules; no hand-authored wiring that grows with module count. If adding a new module requires editing existing modules or shared files (beyond the vocabulary), the design is wrong.
- **Modules are portable building blocks.** A module must work correctly when composed into ANY bundle — not just the one it was written for. Modules never import from other modules. Cross-module relationships emerge from shared vocabulary tags, not explicit references to foreign IDs. Test: if you move a module from bundle A to bundle B, does everything still derive correctly?
- **Convention-universality is the litmus test.** When choosing between design approaches, ask: "does this work for all conventions — including ones we haven't written yet?" If you can imagine a convention where approach A breaks, A is the wrong approach. Never optimize for a single convention at the expense of generality.
- **Contain complexity through modularity.** Low impact radius (changes to one convention don't ripple), clean module boundaries (runtime/pipeline are separate subsystems), and convention-agnostic infrastructure in `core/` that never assumes convention-specific structure.
- **Semantic ownership: fields belong where they mean something.** Before adding a field to a type, ask: "does this describe what this type IS, or is it metadata about how something else uses it?" Derive what you can from existing data; don't store what can be computed.
- **Bundle-specific knowledge stays in the bundle.** Core infrastructure (`core/`, `inference/`, `conventions/core/`) must not contain convention-specific fact IDs, heuristics, or special-case logic. If a behavior differs between conventions, the bundle declares it (e.g., `isPublic` on clauses) and the framework reads the declaration.
- **System-agnostic modules, system-aware facts.** Modules never import concrete system configs or branch on system identity. System-level differences (HCP thresholds, forcing durations) are expressed as `SystemConfig` fields, surfaced as system facts via `system-fact-vocabulary.ts`, and referenced in surface clauses. See `src/core/contracts/CLAUDE.md` § System Parameterization for the full module author guide.

## System Parameterization

Multi-system support (SAYC, 2/1, Acol). Modules are system-agnostic — differences flow through `SystemConfig` → system facts → surface clause evaluation. Details in `src/core/contracts/CLAUDE.md` § System Parameterization.

## Architecture

```
src/
  engine/          Pure TS game logic (zero platform deps)
  core/            Shared infrastructure
    contracts/       Cross-boundary DTOs and strategy interfaces (bidding, meaning, facts, provenance, posterior)
    display/         UI display utilities (format, hand-summary, tokens, sort-cards, seat-mapping, hcp)
    viewport/        Player information boundary (BiddingViewport, DeclarerPromptViewport, PlayingViewport, ExplanationViewport, EvaluationOracle)
    util/            Zero-dep pure utilities (delay, seeded-rng)
  conventions/     Convention system
    core/            Registry, context factory, bundle registry, meaning pipeline (pipeline/), runtime (runtime/) — public API via index.ts barrel
    definitions/     Convention bundles: nt-bundle/ (1NT Responses), bergen-bundle/ (Bergen Raises), weak-twos-bundle/ (Weak Two Bids + Ogust), dont-bundle/ (DONT competitive overcalls) — each with meaning-surfaces.ts, machine.ts, facts.ts, config.ts
  teaching/        Teaching resolution (teaching-resolution.ts), projection builder, teaching graph
  inference/       Auction inference system (natural inference, posterior engine, belief accumulator)
  strategy/        AI strategies
    bidding/         Meaning-pipeline strategy adapter (meaning-strategy.ts), pass strategy, natural fallback, practical recommender
    play/            Play strategies (random, heuristic; future: DDS, signal/discard)
  service/         Session-handle-oriented service layer — owns game state, exposes viewport-only data
  bootstrap/       Dependency assembly (session, config, start-drill, DrillBundle)
  evaluation/      Type-enforced viewport boundary — facade for strategy→viewport→grading pipeline
  cli/             Headless coverage test runner (modular: main.ts + shared.ts + commands/)
  test-support/    Shared test factories (engine stub, deal/session fixtures)
  stores/          Svelte stores (app, game coordinator + bidding/play/dds sub-stores, context DI, dev-params)
  components/      Svelte UI components
    screens/       Screen-level components (ConventionSelectScreen, LearningScreen, game-screen/GameScreen)
    game/          Game components + co-located .ts companions (DecisionTree.ts, RoundBidList.ts, BidFeedbackPanel.ts)
    shared/        Reusable components (Card, Button, ConventionCallout)
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
| Core | `src/core/` | Shared infrastructure (contracts, display, util) |
| Contracts | `src/core/contracts/index.ts` | Cross-boundary DTOs and strategy interfaces |
| Display | `src/core/display/format.ts` | UI display utilities |
| Util | `src/core/util/delay.ts` | Zero-dep pure utilities |
| Viewport | `src/core/viewport/player-viewport.ts` | Player information boundary (BiddingViewport, DeclarerPromptViewport, PlayingViewport, ExplanationViewport, EvaluationOracle) |
| Conventions | `src/conventions/core/index.ts` | Convention system (core/ + definitions/) |
| Teaching | `src/teaching/teaching-resolution.ts` | Teaching resolution and projection |
| Inference | `src/inference/inference-engine.ts` | Auction inference |
| Strategy | `src/strategy/bidding/meaning-strategy.ts` | AI strategies (meaning pipeline) |
| Service | `src/service/index.ts` | Session-handle service layer (local-service, bidding/play/dds controllers) |
| Bootstrap | `src/bootstrap/types.ts` | Dependency assembly + drill lifecycle |
| Evaluation | `src/evaluation/index.ts` | Type-enforced viewport boundary (facade for strategy/teaching/viewport pipeline) |
| CLI | `src/cli/main.ts` | Headless coverage test runner (modular) |
| Test Support | `src/test-support/engine-stub.ts` | Shared test factories |
| Stores | `src/stores/app.svelte.ts` | Svelte stores + game coordinator |
| Components | — | Svelte UI (screens/game/shared) |
| Tests | `tests/e2e/` | Vitest + Playwright |

**Game phases:** BIDDING → DECLARER_PROMPT (conditional) → PLAYING (optional) → EXPLANATION. User always bids as South. Details in `src/stores/CLAUDE.md`.

**V1 storage:** localStorage for user preferences only — no stats/progress tracking until V2 (SQLite)

## Typography & Responsive Sizing

Single-source typography system: `--panel-font` base → `--text-*` em-relative tokens → consistent sizing across panels and CSS-transformed table. Z-index hierarchy via `--z-*` tokens. ESLint enforces token usage in game components. Details in `src/components/CLAUDE.md` § Typography & Responsive Sizing.

## Teaching Architecture

The app separates two concerns: **deterministic convention teaching** and **probabilistic realism**.

- **Meaning pipeline** (fact evaluation → surface routing → meaning proposal → arbitration → encoding) defines the canonical answer key. Each `BidMeaning` describes a bidding meaning with clauses evaluated against facts. `semanticClassId` and `teachingLabel` are required on every surface.
- **Alert system.** `resolveAlert()` derives alertability from `sourceIntent.type` — natural intents (small, well-defined set in `alert.ts`) produce no alert; everything else defaults to conventional (alertable). `BidMeaning` does not carry `prioritySpec` or `priorityClass`; the pipeline derives alertability in `resolveAlert()`. Public constraints are auto-derived from primitive/bridge-observable clauses via `derivePublicConstraints()`. `annotation-producer.ts` converts `publicConstraints` to `HandInference` for Layer 1 belief updates. Inference model: only hard constraints from chosen bid's clauses + entailed denials from within-module exhaustive closure policy. No cross-module soft inference.
- **`TeachingResolution`** (`src/teaching/teaching-resolution.ts`) wraps `BidResult` with multi-grade feedback: Correct (exact match), CorrectNotPreferred (truth set but not recommended), Acceptable (preferred/alternative tier candidates), NearMiss (same family, fails constraint), Incorrect. `resolveTeachingAnswer(bidResult, alternativeGroups?, intentFamilies?)` extracts acceptable alternatives and near-miss candidates. `gradeBid()` grades user input with 5-grade cascade.
- **`TeachingProjection`** (`src/teaching/teaching-projection-builder.ts`) projects arbitration results + provenance into teaching-optimized views for "why not X?" UI. Teaching relations and explanation catalogs flow end-to-end from bundle → config-factory → strategy → projection.
- **Parse-tree feedback.** After a bid, `buildParseTree()` (`src/teaching/parse-tree-builder.ts`) shows the full decision chain — which convention modules were considered, why each was accepted or rejected, and the path to the correct bid. Data flows: `ArbitrationResult` + `DecisionProvenance` → `ParseTreeView` → `ParseTreePanel.svelte` (integrated into Incorrect and NearMiss feedback panels). Verdict per module: `selected` / `applicable` / `eliminated`.
- **Off-convention drills.** Generate hands where the convention doesn't apply, training recognition ("does this convention apply?") not just execution. `ConventionBundle.offConventionConstraints` defines the anti-constraints (e.g., South 0–7 HCP for NT). `DrillTuning.includeOffConvention` + `offConventionRate` control frequency (default 30%). `DrillBundle.isOffConvention` flag tells the UI/teaching layer the deal is off-convention.
- **Grading is deterministic.** Same hand + same auction = same grade. No probabilistic scoring in V1.
- **Opponent modes:** "none" (opponents always pass) or "natural" (opponents bid with 6+ HCP and 5+ suit). Configurable via settings dropdown, persisted in localStorage.

## Roadmap

**Completed:** See `docs/roadmap-history.md`. Phases 4-10 plus Continuation Composition Phases 4-6 are complete. All 4 bundles (NT, Bergen, Weak Twos, DONT) on RuleModule with per-step kernel threading. Old tree/protocol/overlay pipeline and FSM infrastructure fully removed. Dead CandidateTransform system removed. Multi-system backend wired (SAYC, 2/1, Acol base profiles). CLI `--system` flag live.

**Upcoming (all blocked on design work or specs):**

1. **Posterior Engine Consumer Migration (Phase 4B)** — boundary Phases 0-5 done; consumers not yet migrated. See `docs/posterior-implementation-plan.md`. Unblocks difficulty config / inference spectrum.
2. **User Learning Enhancements** — learning screen needs rebuild + design spec.
3. **Difficulty Configuration** — blocked on posterior consumer migration.
4. **Convention Migration** — Lebensohl (blocked on relay encoding spec), Negative Doubles (blocked on host-attachment exercise), SAYC (full base system).

## Architecture Spec & Alignment

**Design specs** (the authoritative vision for the full architecture):

- `~/Obsidian/Bridge Convention Vault/Sparks/2026-03-09-better-convention-protocol.md` — Agreement Module IR: composable convention modules, system profiles, conversation machines, two-phase evaluation, public state layers, DealSpec, FactCatalog
- `~/Obsidian/Bridge Convention Vault/Sparks/2026-03-09-better-candidate-pipeline.md` — Meaning-centric pipeline: BidMeaning as canonical unit, semantic arbitration, TeachingProjection, DecisionProvenance, PedagogicalRelation graph, ExplanationCatalog
- `docs/posterior-implementation-plan.md` — Posterior engine boundary redesign: 8-phase plan covering FactorGraphIR, PosteriorQueryPort, PosteriorBackend, factor compiler, CI invariant tests, and Rust/WASM upgrade path

**Spec status:** Both specs are `status: active`, `confidence: medium-high`. Most contracts are frozen. The posterior engine boundary has a detailed implementation plan. Do not implement against unresolved areas — resolve the spec first.

**Open questions in the protocol spec:**

| Open Question | Status | Blocks |
|---|---|---|
| Posterior consumer migration (Phase 4B) | Boundary complete; consumers still on old `PosteriorEngine` → `SeatPosterior` path | Inference spectrum / difficulty config |
| Evidence group correlation model | Design complete; reserved as Phase 7 (soft evidence) | Posterior combiner accuracy |
| Host-attachment activation | Spec designed, vocabulary resolved (`conventions/definitions/capability-vocabulary.ts`), not yet exercised | Negative Doubles, Fourth Suit Forcing |
| DealSpec wiring | Types + test code exist; not wired to deal generation | Deal constraints |
| DecisionSurface migration | Adapter exists (test-only); pipeline still consumes BidMeaning[] | Pipeline modernization |
| Multi-system UI | Backend wired; UI system selector not yet connected | User-facing system choice |

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
| `src/core/display/`            | `npx vitest run src/core/display/` | If display utility signatures changed  |
| CSS-only / layout tweaks       | `npm run check` (type-check only) | Never                                  |
| Cross-cutting (types, exports) | `npm run test:run` (full suite)   | Always for type/interface changes      |

**Rule:** If you only changed `.svelte` files, CSS values, or added optional props — run targeted tests or just type-check. Full suite (`npm run test:run`) only when changing contracts types, store interfaces, or engine logic.

## Gotchas

- `npm run dev` builds WASM if `pkg/` missing, then starts Vite with HMR — the dev server stays running and reflects file changes instantly. Do NOT restart the server or browser after editing source files; just save and the page updates automatically
- WASM must build before Vite (`npm run dev` handles this automatically via `wasm:ensure`)
- **No pure-TS EnginePort exists.** Browser builds require WASM (`WasmEngine`); desktop uses Tauri IPC (`TauriIpcEngine`). If `initWasm()` fails, the app shows an error screen — there is no fallback. The TS engine modules (`deal-generator.ts`, `auction.ts`, etc.) contain all the logic but are not wired into an `EnginePort` adapter. Vercel deploys install Rust + wasm-pack via `scripts/vercel-build.sh` and produce a real WASM build. Stub files (`scripts/ensure-wasm-stubs.sh`) are retained as a fallback if the WASM toolchain is unavailable.
- DDS `solveDeal()` works in browser via Emscripten-compiled C++ DDS in a Web Worker (`dds-client.ts`). Par is always null in browser (mode=-1). `suggestPlay()` remains desktop-only. DDS WASM artifacts (`static/dds/`) are committed; rebuild with `npm run dds:build` (requires Emscripten).
- Never build bridge-wasm via `cargo build --workspace`; always use `wasm-pack` to isolate feature resolution and prevent `getrandom/js` from bleeding into native builds
- Read a subsystem's CLAUDE.md before working in that directory
- Full testing playbook is in **TESTING.md**, not here
- `vendor/dds/` is an upstream DDS C++ source checkout and `vendor/dds-patches/` holds local Emscripten/build patches for producing the browser double-dummy WASM bundle (`static/dds/`); app-level bridge logic in `src/` and `src-tauri/` remains clean-room
- Bergen Raises uses Standard Bergen (3C=constructive 7-10, 3D=limit 10-12, 3M=preemptive 0-6, splinter with shortage 12+)
- Only duplicate bridge scoring implemented (rubber bridge out of scope for V1)
- All conventions use meaning pipeline bundles — no tree/protocol/overlay pipeline remains. `ConventionConfig` is minimal (id, name, description, category, dealConstraints, teaching); convention logic lives in `ConventionBundle` with `meaningSurfaces`, `conversationMachine`, `factExtensions`, `explanationCatalog`. All teaching content (relations, alternatives, intent families) is derived from `pedagogicalTags` on surfaces — modules are portable building blocks that compose into any bundle. 6 general-purpose tags (`SAME_FAMILY`, `STRONGER_THAN`, `CONTINUATION_OF`, `NEAR_MISS_OF`, `FALLBACK_OF`, `ALTERNATIVES`) with scope-based grouping; derivation in `conventions/definitions/derive-cross-module.ts`
- **CLI commands use rule enumeration.** All CLI commands (`list`, `plan`, `selftest`, `describe`, `bundles`) use `enumerateRuleAtoms()` / `generateRuleCoverageManifest()` from `conventions/core/pipeline/rule-enumeration.ts`. Atom ID format: `moduleId/meaningId`. The old FSM-based BFS enumeration (`findPathToState`, `buildTargetedAuction`, `resolveAuction`) has been removed from `cli/shared.ts`. Selftest uses strategy-driven forward auction construction instead of FSM path targeting.
- Deal generator uses flat rejection sampling (no relaxation) with configurable `maxAttempts`, `minLengthAny` OR constraints, and `customCheck` escape hatch
- Tailwind v4 uses `@tailwindcss/vite` plugin (no PostCSS config) — plugin goes before svelte() in `vite.config.ts`
- `vitest.config.ts` has `resolve.conditions: ["browser"]` so Svelte 5 `mount()` works in jsdom tests — don't use `require()` in tests, use ES imports
- Component tests use `@testing-library/svelte` — components needing context (stores/engine) need wrapper setup in test-helpers.ts
- Svelte `{#each}` blocks require keyed iteration (`{#each items as item (item.id)}`) per ESLint rule `svelte/require-each-key`

**Reference docs** (detailed architecture, not auto-loaded):

- `docs/architecture-reference.md` — convention constraints, AI heuristics, screen flow, phase details
- `docs/bridge-rules-sources.md` — authoritative bridge rules sources, ambiguity resolution
- `docs/conventions/` — per-convention reference docs (bergen-raises.md, dont.md) with sources, rules, edge cases
- `docs/learning/research-summary.md` — learning screen design vision: four views (guided flow, explorable map, cheat sheet, quiz), learning science principles, what's built vs needed

**Context tree** (read the relevant one before working in that directory):

- `src/engine/CLAUDE.md` — engine purity, module graph, key patterns
- `src/core/CLAUDE.md` — shared infrastructure overview (contracts, display, util)
- `src/core/contracts/CLAUDE.md` — cross-boundary contract inventory and dependency rules
- `src/core/viewport/CLAUDE.md` — player information boundary (BiddingViewport, EvaluationOracle)
- `src/conventions/CLAUDE.md` — registry pattern, convention bundles
- `src/conventions/core/CLAUDE.md` — runtime, pipeline, bundle systems
- `src/conventions/definitions/CLAUDE.md` — convention bundle authoring guide
- `src/inference/CLAUDE.md` — inference architecture, posterior engine, new posterior boundary
- `src/inference/posterior/CLAUDE.md` — posterior subsystem: factor compiler, backend, query port, migration status
- `src/strategy/CLAUDE.md` — meaning-strategy pattern, play heuristics
- `src/service/CLAUDE.md` — session-handle service layer, viewport-only boundary, controllers
- `src/bootstrap/CLAUDE.md` — DrillConfig, DrillSession, DrillBundle, drill lifecycle
- `src/cli/CLAUDE.md` — headless coverage test runner
- `src/core/display/CLAUDE.md` — display utility inventory, dependency rules
- `src/teaching/CLAUDE.md` — convention evaluation for teaching
- `src/components/CLAUDE.md` — component conventions, screen flow, Svelte 5 patterns
- `src/stores/CLAUDE.md` — factory DI pattern, game store methods, race condition handling
- `src/test-support/CLAUDE.md` — shared test factories, dependency rules
- `tests/CLAUDE.md` — E2E config, test running

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

<!-- context-layer: generated=2026-02-20 | last-audited=2026-03-22 | version=17 | dir-commits-at-audit=62 | tree-sig=dirs:20,files:150+ -->
