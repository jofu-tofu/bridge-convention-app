# Bridge Practice App

Bridge bidding convention practice app (Stayman, Bergen Raises, SAYC, Weak Twos, Lebensohl Lite). Tauri 2 desktop + WASM browser (Vercel). Svelte 5 (runes) + TypeScript strict.

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
| `npm run format`          | Prettier format all files                                  |
| `npm run format:check`    | Prettier check (CI)                                        |
| `cargo test --workspace`  | Run all Rust tests (from src-tauri/)                       |
| `cargo build --workspace` | Build all Rust crates (from src-tauri/)                    |

## Dev Tools (dev server only)

- **URL routing:** `?convention=stayman` jumps to game screen with that convention (IDs: `stayman`, `bergen-raises`, `sayc`, `weak-twos`, `lebensohl-lite`). `?learn=stayman` jumps to learning screen.
- **Deterministic seed:** `?seed=42` seeds the PRNG for reproducible deals. Seed advances per deal (42, 43, 44...). Reload resets.
- **Autoplay:** `?autoplay=true` auto-bids correct calls, dismisses feedback, and skips declarer prompts to reach Review phase instantly. Combine with convention: `?convention=stayman&autoplay=true`
- **Bid button test IDs:** `data-testid="bid-{callKey}"` on all bid buttons — e.g., `bid-1C`, `bid-7NT`, `bid-pass`, `bid-double`, `bid-redouble`

## Code Hygiene

- **Fix all lint errors and warnings you encounter** — even if they weren't caused by your changes. If `npm run lint` or a hook reports errors/warnings in files you touched, fix them before finishing.
- **Lint is scoped to app code, tests, and root JS/TS config files.** `npm run lint` is not a workspace-wide sweep; it excludes generated/tooling directories outside the app surface.
- **Lint enforces architecture, not just style.** ESLint guards key import boundaries (`engine/`, `inference/`, `conventions/`, `strategy/`, `bootstrap/`, `stores/`, `components/`). `npm run lint:dead` uses Knip for dead-file detection, with `static/dds/dds.js` ignored because it is loaded by the DDS worker via `importScripts()`.

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

## Design Philosophy

- **Convention-universality is the litmus test.** When choosing between design approaches, ask: "does this work for all conventions — including ones we haven't written yet?" If you can imagine a convention where approach A breaks, A is the wrong approach. Never optimize for a single convention at the expense of generality.
- **Universal-but-complex beats simple-but-convention-specific.** Accept complexity when it buys universality across all conventions. The overlay system, intent resolvers, and dialogue state exist because simpler designs couldn't handle the full convention spectrum. Rejecting a complex-but-general solution in favor of a simple-but-partial one creates technical debt that compounds with every new convention.
- **Contain complexity through modularity.** The trade-off for accepting complexity is strict containment: low impact radius (changes to one convention don't ripple), clean module boundaries (protocol/overlay/intent/pipeline are separate subsystems), and convention-agnostic infrastructure in `core/` that never assumes convention-specific structure.

## Architecture

```
src/
  engine/          Pure TS game logic (zero platform deps)
  core/            Shared infrastructure
    contracts/       Cross-boundary DTOs and strategy interfaces (bidding, inference, tree evaluation, play, recommendation)
    display/         UI display utilities (format, hand-summary, tokens, sort-cards, seat-mapping, hcp)
    util/            Zero-dep pure utilities (delay, seeded-rng)
  conventions/     Convention system
    core/            Registry, evaluator, tree/protocol/overlay/pipeline subsystems, conditions (public API via index.ts barrel)
    definitions/     Convention folders (stayman/, bergen-raises/, sayc/, weak-twos/, lebensohl-lite/) each with tree.ts, config.ts, explanations.ts, index.ts
  teaching/        Convention evaluation for teaching (teaching-content, condition-explanations, teaching-resolution)
  inference/       Auction inference system (per-partnership information asymmetry)
  strategy/        AI strategies
    bidding/         Convention-to-strategy adapter, pass strategy
    play/            Play strategies (random, heuristic; future: DDS, signal/discard)
  bootstrap/       Dependency assembly (session, config, start-drill, DrillBundle)
  test-support/    Shared test factories (engine stub, deal/session fixtures)
  stores/          Svelte stores (app, game coordinator + bidding/play/dds sub-stores, context DI)
  components/      Svelte UI components
    screens/       Screen-level components (ConventionSelectScreen, LearningScreen, game-screen/GameScreen)
    game/          Game components + co-located .ts companions (DecisionTree.ts, RoundBidList.ts, DebugDrawer.ts)
    shared/        Reusable components (Card, Button, ConventionCallout)
src-tauri/         Cargo workspace with three crates
  crates/
    bridge-engine/   Pure Rust engine logic (types, hand eval, deal gen, auction, scoring, play)
    bridge-tauri/    Tauri app with #[tauri::command] handlers delegating to BridgeEngine trait
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
| Conventions | `src/conventions/core/index.ts` | Convention system (core/ + definitions/) |
| Teaching | `src/teaching/teaching-content.ts` | Convention evaluation for teaching |
| Inference | `src/inference/inference-engine.ts` | Auction inference |
| Strategy | `src/strategy/bidding/convention-strategy.ts` | AI strategies |
| Bootstrap | `src/bootstrap/types.ts` | Dependency assembly + drill lifecycle |
| Test Support | `src/test-support/engine-stub.ts` | Shared test factories |
| Stores | `src/stores/app.svelte.ts` | Svelte stores + game coordinator |
| Components | — | Svelte UI (screens/game/shared) |
| Tests | `tests/e2e/` | Vitest + Playwright |

**Game phases:** BIDDING → DECLARER_PROMPT (conditional) → PLAYING (optional) → EXPLANATION. User always bids as South. Details in `src/stores/CLAUDE.md`.

**V1 storage:** localStorage for user preferences only — no stats/progress tracking until V2 (SQLite)

## Pedagogical Architecture

The app separates two concerns: **deterministic convention teaching** and **probabilistic realism**.

- **Teaching core** (convention tree + resolver) defines the canonical answer key. The tree is the convention's "textbook" — `defaultCall` is what you'd teach, resolved calls are hand-specific.
- **`TeachingResolution`** (`src/teaching/teaching-resolution.ts`) wraps `BidResult` with multi-grade feedback: Correct (exact match), Acceptable (preferred/alternative tier candidates), Incorrect. `resolveTeachingAnswer(bidResult, alternativeGroups?)` extracts acceptable alternatives via two paths: (1) priority-based filter on `ResolvedCandidateDTO[]` (existing), (2) `AlternativeGroup` lookup that bypasses tree path-condition exclusivity for semantically interchangeable intents. `gradeBid()` grades user input.
- **Sibling enrichment** (`enrichSiblingsWithResolvedCalls()` in `strategy/bidding/convention-strategy.ts`) joins display siblings with resolved calls so the UI shows the hand-specific bid, not just `defaultCall`.
- **Three layers:** (1) convention truth (tree structure), (2) practical preference (resolver + context), (3) world uncertainty (belief/inference — future). Randomness lives in deal generation, not grading.
- **Grading is deterministic.** Same hand + same auction = same grade. No probabilistic scoring in V1.

## Roadmap

**Completed:** See `docs/roadmap-history.md`

**Active/upcoming:**

2. **User Learning Enhancements**
   - (b) Dedicated learning screen — Decision tree with layered depth modes (compact/study/learn), convention teaching header card, sidebar. Read-only mode; hand evaluation / active-path highlighting deferred. Future: Spotlight Walk, Decision Cards, Dual Pane views.
3. **Difficulty Configuration** — UI for inference spectrum (easy/medium/hard), wires `InferenceProvider` selection per partnership
4. **Decision Model Architecture** — DialogueState (protocol memory) + IntentNode (semantic intents) + resolver pipeline. Complete: all 5 conventions migrated to IntentNode, BidNode type removed. SAYC uses empty resolvers (deterministic via defaultCall). Typed DialogueEffect (`set*` prefix fields), CandidateBid DTO (extends SiblingBid with intent+source), event classifier, cross-engine invariant tests — all wired. **Candidate generation pipeline (Steps 1-6 complete):** `EffectiveConventionContext` bundles raw context + dialogue state + active overlays + optional `BeliefData`, `generateCandidates()` resolves `CollectedIntent` proposals through intent system (via `collectIntentProposals()`) → `ResolvedCandidate[]`, `selectMatchedCandidate()` picks resolved call with tiered selection (matched > preferred > null). Tier 2/3 enforce satisfiability (`failedConditions.length === 0`). `conventionToStrategy()` wired to full pipeline with `effectivePath` trace field. **Authority refactor complete:** `ConventionOverlayPatch` type in `core/overlay.ts` with `validateOverlayPatches()` (checked at registration) + optional hooks (`suppressIntent`, `addIntents`, `overrideResolver`, `triggerOverrides`). Intent collector (`core/intent-collector.ts`) decouples production decision path from display/teaching sibling-finder. Stayman interference extracted into overlays (`stayman/overlays.ts`). `evaluateBiddingRules()` also applies overlays. Deferred: nextState projection (not yet planned). **Eligibility model:** `CandidateEligibility` on every `ResolvedCandidate` with four dimensions (hand, protocol, encoding, pedagogical). `isSelectable()` in candidate-selector, `isDtoSelectable()` in contracts. Suppressed/declined candidates kept in array with `protocol.satisfied=false` — `isSelectable()` gates selection. `pedagogicalCheck` optional hook on `ConventionConfig` (seam for future use).
5. **Competitive Auction Hardening** [COMPLETE] — All 9 gaps closed across 4 sub-phases (5a-5d). Key capabilities: `InterferenceDetail` on DialogueState (Gap 6), multi-overlay composition with precedence model (Gap 1), selectable injected intents with priority tiers (Gap 2), multi-encoding resolvers (Gap 8), protocol trigger overlays (Gap 5), teaching under overlays with `TreeDisplayOverlayContext` (Gap 7), ranking seam on `ConventionConfig` (Gap 9). Earlier: suppression fallback (Gap 3), stable node IDs (Gap 4).
6. **Boundary Hardening** [COMPLETE] — 10 gaps across 5 phases. Actor-aware trigger conditions (`partnerBidMade`/`opponentBidMade`), causality contract (`entryIndex` on `TransitionRule`), alternative tier in candidate selection, overlay replacement tree validation, overlay priority sorting, `InterferenceKind` enum, strategy fallback chain (`createStrategyChain` + `naturalFallbackStrategy`), `ResolvedCandidateDTO` on `CandidateSet`. Stayman triggers migrated to `partnerBidMade`. Deferred: family handoff (Gap 5), belief pipeline wiring (Gap 10).
7. **Architectural Gap Resolution** [Phases 7a-7e COMPLETE] — `ResolverResult` discriminated union (declined/use_default/resolved) replacing null ambiguity on `IntentResolverFn`, `EvaluationTrace` DTO on `BidResult` with `TraceCollector` builder, registration-time diagnostics (`getDiagnostics()` for nodeId/overlay-priority checks), overlay-aware display alignment (`suppressedByOverlay`/`overriddenByOverlay` on `TreeDisplayRow`). (7e) Per-capability SystemMode: `systemCapabilities?: Record<string, SystemMode>` on `DialogueState` with `getSystemModeFor(state, capability)` helper. Stayman migrated as proof case. Deferred: 7f belief wiring, 7g ranker layer.
8. **Teaching Resolution Layer** [COMPLETE] — (9a) `enrichSiblingsWithResolvedCalls()` in `convention-strategy.ts` fixes Gap 3 (defaultCall/resolved call mismatch in sibling display). (9b) `TeachingResolution` in `teaching/teaching-resolution.ts` with `BidGrade` (Correct/Acceptable/Incorrect), `resolveTeachingAnswer()`, `gradeBid()`. Store `BidFeedback.grade` replaces binary `isCorrect`. BidFeedbackPanel shows three-branch feedback (green/teal/red). Acceptable bids auto-advance auction. Context philosophy documented. (9c) `AlternativeGroup` on `ConventionConfig` — semantic acceptable-alternative groups that bypass tree path-condition exclusivity (`acceptableAlternatives` field). `resolveTeachingAnswer(bidResult, alternativeGroups?)` uses three-phase logic: priority filter → group lookup → dedup (higher-credit wins). `ConventionBiddingStrategy.getAcceptableAlternatives()` accessor threads groups from config to store. Bergen Raises annotated as proof case (game/limit/constructive raises grouped; splinter and preemptive excluded).
9. **Practical Bidder Layer** [COMPLETE] — (Phase 0) Teaching regression harness freezes grading behavior. (Phase 1) Convention inference fixed via `tree-inference-extractor.ts` (DTO-based, bypasses hollow adapter). HCP narrowing in `private-belief.ts` (`40 - ownHcp`), wired through `belief-converter.ts`. (Phase 2) `PracticalRecommendation` via `ConventionBiddingStrategy.getLastPracticalRecommendation()` accessor (decoupled from `BidResult`, which is now purely normative) — `practical-scorer.ts` scores candidates by fit+HCP+convention distance, `practical-recommender.ts` computes recommendation from resolved candidates + belief data. Fail-closed, isolated from teaching. `EvaluationTrace.practicalError` for diagnostics. `agreesWithTeaching` removed from `PracticalRecommendation`; comparison moved to consumer. (Phase 3) Partner interpretation model — `computePartnerInterpretation()` in `inference/partner-interpretation.ts` computes `misunderstandingRisk` (HCP deviation) and `continuationAwkwardness` (suit length shortfall) per candidate via `InferenceProvider.inferFromBid()`. Wired into practical-recommender via optional `interpretationProvider`, threaded through `ConventionStrategyOptions` and `config-factory.ts`. Fail-open (null inference → risk=0). (Phase 4) Pragmatic candidate generator — `pragmatic-generator.ts` produces tactical bids (ConservativeNTDowngrade, CompetitiveOvercall, ProtectiveDouble). `ScorableCandidate` union in `practical-types.ts`, scorer handles both kinds with convention distance 3 for pragmatic. Wired into recommender and convention-strategy with forcing guard. (Phase 5) UI integration — `BidFeedback.practicalRecommendation` sourced from `ConventionBiddingStrategy` accessor through store. BidFeedbackPanel shows amber "Experienced players might prefer..." note when practical call differs from teaching call. Never changes grade color.

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
- `src/conventions/CLAUDE.md` — registry pattern, shared conventions
- `src/conventions/core/CLAUDE.md` — protocol, dialogue, intent, tree, overlay systems
- `src/conventions/definitions/CLAUDE.md` — convention authoring guide, rules reference
- `src/inference/CLAUDE.md` — inference architecture, negation, invariants
- `src/strategy/CLAUDE.md` — strategy pattern, conventionToStrategy, play heuristics
- `src/bootstrap/CLAUDE.md` — DrillConfig, DrillSession, DrillBundle, drill lifecycle
- `src/core/display/CLAUDE.md` — display utility inventory, dependency rules
- `src/teaching/CLAUDE.md` — convention evaluation for teaching
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

<!-- context-layer: generated=2026-02-20 | last-audited=2026-03-03 | version=12 | dir-commits-at-audit=52 | tree-sig=dirs:22,files:210+ -->
