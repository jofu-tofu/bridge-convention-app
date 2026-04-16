# Rust Workspace (crates/)

Cargo workspace with seven crates implementing the bridge engine, convention data model, session logic, service layer, API server, and static data extraction in Rust.

## Commands

| Command                       | Purpose                                                     |
| ----------------------------- | ----------------------------------------------------------- |
| `cargo build --workspace`     | Build all crates                                            |
| `cargo test --workspace`      | Run all Rust tests                                          |
| `cargo test -p bridge-engine` | Test engine crate only                                      |
| `cargo test -p bridge-conventions` | Test conventions crate (includes golden-master fixture tests) |
| `cargo test -p bridge-session` | Test session crate (353 tests) |
| `wasm-pack build crates/bridge-wasm --target web --out-dir pkg` | Build WASM package        |
| `wasm-pack test --node crates/bridge-wasm` | Run WASM integration tests                   |

## Workspace Structure

```
crates/
  bridge-engine/       Pure Rust game logic (types, eval, deal gen, auction, scoring, play)
  bridge-conventions/  Rust convention data model + fact evaluation + meaning pipeline.
                       Mirrors TS types from src/conventions/. Depends on bridge-engine for Hand/Suit/etc.
                       Key design choices: newtype wrappers for branded strings, FactDefinitionSet (not
                       FactCatalogExtension — data only, no evaluator functions), typed enums for unknown
                       fields, serde_json::Number to preserve integer/float distinction in round-trips.
                       Phase 2 adds `fact_dsl/` module: FactComposition tree interpreter, evaluate_facts()
                       orchestrator. All fact compositions are inline JSON in fixture files.
                       Rust FactComposition is a superset of TS — includes Match, Compute, Extended nodes
                       and TopHonorCount/SuitCompare/LongestSuitIs/AceCount/KingCount/VulnerabilityIs
                       clause types. Zero built-in evaluator registry.
                       Point formula configuration via `PointConfig` on `SystemConfig`.
                       Centralized computation in `fact_dsl/point_helpers.rs`.
                       Phase 3 adds `pipeline/` (observation + evaluation + run_pipeline), `teaching/`
                       (resolution, projection, parse tree), and `adapter/` (protocol adapter, strategy
                       evaluation, practical scorer). `ConventionStrategy::suggest()` returns
                       `(Option<BidResult>, StrategyEvaluation)` — immutable &self, debug payload as
                       out-param (intentional Rust idiom divergence from TS &mut self pattern).
                       **Negative Doubles opener rebids are synthesized at load time:** the
                       `negative-doubles` fixture still defines responder and overcall surfaces, but
                       `registry/module_registry.rs` replaces the coarse `after-neg-dbl` opener states
                       with route-specific states keyed to the exact opening + overcall sequence. Edit
                       that synthesis table when changing opener rebid behavior or legal rebid levels.
                       **Authored reference facts are now catalog-backed:** `types/fact_id.rs`
                       validates authored `FactId`s at deserialize time against the closed
                       `fact_catalog/` static. Quick-reference axes are now `SystemFactLadder` or
                       `PartitionLadder` only; add new renderable facts there, not as ad-hoc
                       strings in fixtures.
                       **Static learn pages now use authored module display names:** the
                       bridge-static extractor and learning viewport preserve each fixture's
                       `displayName` for catalog cards and page titles instead of deriving names
                       from `moduleId`. Rename modules in the fixture, then rerun
                       `npm run static:extract`.
                       The catalog now covers responder slam values, weak-two / strong-2C opening ranges,
                       classic ace/king-count partitions, and transfer-target suit labels for reference work.
                       **Positive usage bullets are typed:** `ModuleReference.when_to_use` stores
                       `PredicateBullet { predicate, gloss }`. The viewport currently renders the
                       gloss, while the predicate remains available for validation/preview work.
                       **Quick-reference grids now bind surfaces, not prose:** `ModuleReferenceQuickReference::Grid`
                       stores `CellBinding`s (`Auto | Surface { id } | NotApplicable { reason }`).
                       The learning viewport projects `Auto` against the module's entry surfaces; if
                       more than one surface survives for a cell, static extraction fails and the
                       fixture author must promote that cell to an explicit `Surface { id }`.
                       **State scope is explicit in fixture JSON:** `StateEntry` now carries a
                       `scope` field (`enumerated | delegate_to | out_of_scope`). Deserialization
                       defaults missing values to `enumerated` only for migration, but structural
                       invariants require every reachable fixture state to spell the field out in
                       source JSON. Modules may also opt into `symmetricPairs` checks, and fact
                       definitions can be marked `forTeachingOnly` to exempt them from the
                       "every fact must back a surface clause" invariant.
                       **Authority canaries live in an integration test:** `bridge-conventions/tests/canary_authority.rs`
                       encodes authority-backed `(auction, hand, expected call)` regressions. Keep
                       current engine mismatches as explicit `#[ignore]` canaries with a short
                       blocker reason rather than deleting them; the file is meant to document the
                       audit queue as well as fixed behavior.
                       **Bundle modules are runtime-derived:** Bundle JSON fixtures (`fixtures/*.json`)
                       do not contain a `modules` array. The `bundle_registry` populates
                       `ConventionBundle.modules` at cache-init time by looking up each `member_id`
                       in the module registry. Module fixture files (`fixtures/modules/*.json`) are
                       the single source of truth for module content.
                       **System fact clause descriptions:** The `description` field on clauses with
                       `system.*` fact IDs is ignored at runtime. The learning viewport
                       (`bridge-session/src/session/learning_viewport.rs:map_clauses()`) derives
                       system fact descriptions dynamically using `derive_neutral_description()`,
                       which prefers the clause's `rationale` field and falls back to `display_name()`.
                       Editing system fact descriptions in fixture JSON has no UI effect — edit
                       `rationale` or `display_name()` instead.
                       **Deal constraints are witness-derived, not authored:** bundle JSON fixtures
                       carry no `dealConstraints` / `offConventionConstraints` fields. Phase 2
                       flow: at drill-creation, `bridge-service::drill_setup` picks a target
                       `(module_id, surface_id)` seeded by `config.seed`, enumerates witnesses via
                       `fact_dsl::witness::enumerate_witnesses`, and projects a chosen witness through
                       `project_witness` to tight per-seat `DealConstraints`. The projection
                       expands `system.*` clauses to concrete `hand.hcp` bounds via `SystemConfig`
                       and `module.*` / `bridge.*` derived facts via their authored `FactComposition`
                       trees. When multiple meaning_id-sharing surfaces exist on the target module,
                       the most-specific variant (highest `specificity_score`) is projected rather
                       than a union — this avoids dilution when variants have disjoint HCP ranges.
                       Opponent pass slots implied between witness bids synthesize "no interference"
                       caps from loaded `turn=opponent` surfaces, falling back to `max_hcp=10`.
                       The v1 loose-union `derive_deal_constraints` was removed in phase 2;
                       `invert_composition` primitives remain and are reused by witness projection.
  bridge-session/      Rust session logic: inference, heuristics, controllers, viewports.
                       Phase 4 of the migration. Depends on bridge-engine + bridge-conventions.
                       Inference: natural inference + Monte Carlo posterior (rejection sampling)
                       + private belief conditioning (observer hand caps partner ranges).
                       Heuristics: bidding strategy chain + 10 play heuristics (8 core +
                       card counting + restricted choice) + play profiles.
                       Session: state management, bidding/play controllers (synchronous),
                       drill lifecycle, 4 viewport builders with information boundary.
                       Phase 1 DDS module (`bridge-session/src/dds/`) ports MC sampling,
                       PBN conversion, batched DDS evaluation, and suggest logic into Rust
                       behind an async solver closure. Play-controller integration and
                       learning viewports remain deferred.
  bridge-service/      Service layer — ServicePort trait + ServicePortImpl wrapping SessionManager.
                       Thin hexagonal port between UI/WASM/CLI and game logic. Depends on
                       bridge-engine, bridge-conventions, bridge-session.
                       `witness_selection::select_witness` picks a target `(module, surface)` and
                       chosen witness at drill creation. `deal_gating::build_witness_acceptance_predicate`
                       builds the rejection-sampling predicate that replays the adapter and accepts a
                       deal iff the auto-played prefix matches the witness prefix (opponent seats must
                       pass) AND the user-turn pipeline selection's `module_id`/`meaning_id` equal the
                       witness target. Witness-selected drills now derive their startup auction directly
                       from the witness prefix (inserting opponent passes up to the user turn) for both
                       live session initialization and rejection-sampling replay; projected deal
                       constraints remain the fallback only when no witness override exists. Injected as
                       `Arc<DealAcceptancePredicate>` into
                       `StartDrillOptions`; budget `NORMAL_DEAL_ATTEMPTS = 32`. On exhaustion,
                       `start_drill` returns `Err`; `drill_setup::build_drill_setup` catches it and
                       retries internally up to `MAX_DRILL_SETUP_RETRIES = 8` times, shifting the
                       seed (splitmix-style XOR/rotate via `shift_seed`) each attempt to diversify
                       both witness selection and deal sampling. Only if all 8 attempts exhaust
                       does it return `ServiceError::DealGenerationExhausted { witness_summary }`
                       — that path now indicates a genuine bug, not routine UI churn. The
                       negative-doubles bundle retains its own custom predicate + budget and skips
                       witness selection entirely.
  bridge-wasm/         WASM bindings via wasm-bindgen — WasmServicePort wraps ServicePortImpl
                       for browser deployment. All 20 ServicePort methods + async DDS play
                       methods (play_card_dds, needs_dds_play, set_dds_solver) +
                       5 DevServicePort methods (debug_assertions gated).
  bridge-api/          Axum API server library + binary — auth, user data (DataPort).
                       `src/lib.rs` owns `AppState` + router assembly so integration tests
                       can drive the full app in-process; `src/test_support.rs` provides the
                       SQLite/session harness used by crate-level tests. Runtime remains an
                       independent :3001 service with no game-crate deps
                       (no bridge-engine/conventions/session/service deps). SQLite via sqlx,
                       OAuth (Google + GitHub), server-side sessions. See infra/Dockerfile.api
                       for container build. Optional `dev-tools` cargo feature mounts
                       `/api/dev/login` and swaps `LiveStripeOps` for an in-process mock;
                       absent from release builds, intended for Playwright e2e only.
  bridge-static/       Static data extractor — outputs convention JSON for build-time
                       HTML generation. Thin binary that calls bridge-session viewport
                       builders — MUST NOT contain convention logic or data.
```

## Conventions

- **Debug log carries evaluation snapshots.** `DebugLogEntry` in `bridge-session` stores `Option<StrategyEvaluation>` captured from `stashed_evaluation()` at each bid. Gated by `cfg!(debug_assertions)` — release builds store `None`. The service DTO serializes this to JSON (`serde_json::Value`) at the transport boundary, injecting an `expectedBid` field to match the TS `DebugSnapshotBase` shape. This log is the single source of truth for the debug drawer and future review-phase analysis panel.
- **bridge-engine purity:** Zero platform deps (no axum, tokio). Only serde, rand, thiserror. No convention awareness — `BidResult` carries no `FactConstraint`. Convention constraints flow through `SessionState::process_bid()` as a separate parameter. `BiddingStrategy::stashed_evaluation()` returns `Box<dyn Any>` so `bridge-session` can downcast to `StrategyEvaluation` without `bridge-engine` importing convention types.
- **Free functions, not a trait:** Engine functions called directly. Transport crates are the abstraction.
- **Error boundary:** `EngineError` for domain logic. WASM returns `Result<JsValue, JsError>`.
- **RNG:** ChaCha8Rng with `seed: Option<u64>`. Same seed = deterministic Rust output. NOT cross-engine portable with TS (different PRNG algorithms).
- **Serde contract:**
  - Enums: `#[serde(rename = "C")]` etc. to match TS string values
  - Structs: `#[serde(rename_all = "camelCase")]`
  - `Call`: `#[serde(tag = "type")]` (internally tagged) → `{"type":"bid","level":1,"strain":"C"}`
  - `Deal.hands`: `HashMap<Seat, Hand>` → `{"N":{...},"E":{...},...}` (Seat has Ord derive)
  - `Option<Contract>`: `null` for passout
  - `leadSuit`: explicit `null` in JSON (never omitted), deserialized as `Option<Suit>`
- **WASM serialization:** bridge-wasm uses `serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true)` so `HashMap<Seat, Hand>` produces a plain JS object, not a `Map`.

## Adding a New ServicePort Method

1. Add the method to `ServicePort` trait in `bridge-service/src/port.rs`
2. Implement it in `ServicePortImpl` in `bridge-service/src/service_impl.rs`
3. Add `#[wasm_bindgen]` wrapper in `bridge-wasm/src/lib.rs` (JsValue in/out via serde_wasm_bindgen)
4. Add tests in service and transport crates

## DDS Integration

- **No native DDS in Rust.** DDS runs in browser via Emscripten C++ Web Worker (`/static/dds/`). JS solver callbacks are injected into WASM at init via `set_dds_solver()` (per-card) and `set_dds_table_solver()` (table-level). Rust MC+DDS logic in `bridge-session/src/dds/` calls the injected solver asynchronously.

## Serde Contract

Rules for all Rust types crossing the WASM boundary:
1. `#[serde(rename_all = "camelCase")]` on all structs
2. Enums: `#[serde(tag = "type")]` or `#[serde(rename = "...")]` to match TS discriminators
3. `Option<T>` serializes as explicit `null` (never omitted from JSON)
4. `HashMap<Seat, T>` uses `serialize_maps_as_objects(true)` at WASM boundary

## Gotchas

- `Cargo.lock` is auto-generated — commit it for reproducible builds
- `HashMap<Seat, Hand>` serde works because `Seat` has `Ord` derive and single-char renames
- `DealConstraints` has no `customCheck`/`rng` fields (TS-only). Uses `seed: Option<u64>` instead.
- `generate_deal` WASM returns `Deal` (not `DealGeneratorResult`)
- WASM must be built via `wasm-pack` (not `cargo build`), because `wasm-pack` handles `--target web`, `.wasm` packaging, and JS glue generation

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Add** an entry only if an agent would fail without knowing it, it is not obvious from
the code, and it belongs at this scope (project-wide rule → root CLAUDE.md; WHY decision
→ inline comment or ADR; inferable from code → nowhere).

**Remove** any entry that fails the falsifiability test: if removing it would not change
how an agent acts here, remove it. If a convention here conflicts with the codebase,
the codebase wins — update this file, do not work around it. Prune aggressively.

**Track follow-up work:** After modifying files, evaluate whether changes create incomplete
work or break an assumption tracked elsewhere. If so, create a task or update tracking before ending.

**Staleness anchor:** This file assumes `crates/bridge-engine/src/lib.rs` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-02-22 | last-audited=2026-04-14 | version=17 | dir-commits-at-audit=12 | tree-sig=dirs:12,files:42 -->
