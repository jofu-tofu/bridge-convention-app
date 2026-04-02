# Rust/WASM Migration (Complete)

Backend modules (`conventions/`, `inference/`, `session/`, `service/`) have been migrated from TypeScript to Rust/WASM. All 5 phases are complete. See `docs/product-direction.md` for the product decisions that drove this migration.

## Phase Tracker

| Phase | Name | Status | Est. LOC | Dependencies |
|-------|------|--------|----------|--------------|
| 1 | [Convention Data Model](phase-1-convention-data-model.md) | Complete | ~1,500 | None |
| 2 | [Fact Evaluation](phase-2-fact-evaluation.md) | Complete | ~1,500 | Phase 1 |
| 3 | [Meaning Pipeline](phase-3-meaning-pipeline.md) | Complete | ~4,000-5,000 | Phase 2 |
| 4 | [Inference + Session](phase-4-inference-session.md) | Complete | ~5,000 | Phase 3 |
| 5 | [Service Cleanup](phase-5-service-cleanup.md) | Complete | ~2,000 | Phase 4 |
| 6 | [TS/Rust Reconciliation](phase-6-reconciliation.md) | In Progress (P0/P1 done, P2/P3 remaining) | TBD | Phase 5 |

**Total estimated Rust LOC:** ~15,000-17,000

## Architecture Overview

### Crate Structure

```
src-tauri/crates/
  bridge-engine/        Pure Rust game logic
  bridge-conventions/   Convention types, fact DSL, pipeline, teaching, adapter
  bridge-session/       Session state, controllers, heuristics, inference
  bridge-service/       ServicePort impl, viewport builders
  bridge-wasm/          WASM bindings for full ServicePort (23 + 6 debug methods)
  bridge-tauri/         Tauri commands for full ServicePort
```

### Data Flow

```
Convention JSON definitions
  → bridge-conventions (deserialize, interpret fact DSL, run pipeline)
  → bridge-session (session state, controllers, inference)
  → bridge-service (ServicePort impl, viewports)
  → bridge-wasm (wasm-bindgen boundary, serialize responses)
  → TS service/ thin proxy (deserialize, pass to stores)
```

### WASM Boundary

ServicePort (23 methods) exposed via `wasm-bindgen`. TS `service/` becomes a thin serialize/call/deserialize proxy (~100 LOC). All types cross the boundary as JSON (serde ↔ TS).

## Key Architectural Decisions

### 1. Declarative Fact DSL

`FactComposition` trees (`and`/`or`/`not`/`primitive`) interpreted by Rust runtime. No Rust code per convention. Convention definitions are 100% JSON-serializable. Posterior evaluators are a fixed set of built-in Rust functions keyed by ID.

**Rust superset (Phase 2):** Rust `FactComposition` is a superset of TS — includes `Match`, `Compute`, `Extended` node kinds and `TopHonorCount`, `SuitCompare`, `LongestSuitIs`, `AceCount`, `KingCount`, `VulnerabilityIs`, `BooleanFact`, `NumericFact` extended clause types not present in the TS type system. The TS export script (`scripts/export-conventions.ts`) does not emit these node types. Facts using them have Rust-constructed compositions in `fact_dsl/rust_compositions.rs`, not JSON-deserialized ones. Zero built-in evaluator registry — every fact goes through the composition interpreter.

### 2. Convention Definitions as Data

Modules serialize as JSON: FSM, states, surfaces, fact definitions (with `FactComposition`), explanations, teaching text. `SystemConfig` baked into runtime. Free conventions embedded in static build; paid conventions fetched from server.

### 3. ServicePort = WASM Boundary

All 23 methods exposed via `wasm-bindgen`. TS `service/` becomes a thin proxy.

### 4. Two-Port Model

- **ServicePort** (compute, WASM, stateless per-request) — client-side, no network after load
- **DataPort** (auth/entitlements/progress, server) — future addition

They don't mix. See `docs/product-direction.md`.

### 5. Dual-Path Validation

Phases 1-3 run TS and Rust in parallel. No TS code deleted until Rust produces equivalent results. Golden-master snapshots captured from TS before each phase as a **reference for catching unintentional drift** — not a rigid spec. Intentional simplifications and design improvements are expected during the port. When Rust output differs from TS, the question is "bug or improvement?" — update the fixture and document the decision if it's an improvement.

### 6. Free/Paid Content Loading

One WASM binary for everyone. Free definitions baked into static build. Paid definitions fetched from server after auth, loaded into running WASM runtime via `ServicePort.loadBundleDefs()`.

## Per-Phase Docs

- [Phase 1: Convention Data Model](phase-1-convention-data-model.md)
- [Phase 2: Fact Evaluation](phase-2-fact-evaluation.md)
- [Phase 3: Meaning Pipeline](phase-3-meaning-pipeline.md)
- [Phase 4: Inference + Session](phase-4-inference-session.md)
- [Phase 5: Service Cleanup](phase-5-service-cleanup.md)
- [Phase 6: TS/Rust Reconciliation](phase-6-reconciliation.md)
- [Architecture Decisions](architecture.md)

## Known Remaining Stubs

| Stub | Impact | Status |
|------|--------|--------|
| Posterior inference implemented (MC rejection sampling) | Monte Carlo posterior with 200-sample budget, wired into 3 heuristics | **Completed** |
| MC+DDS play implemented | Expert/WorldClass use TS-driven MC+DDS via `playSingleCard` + `mcDdsSuggest`; Beginner/ClubPlayer use Rust heuristic chain | **Completed** |
| DDS browser solving wired | `getDDSSolution` falls back to JS DDS Web Worker via `getDealPBN` | **Completed** |
| Deal filtering (`customCheck`) not ported | Rust drills may produce off-convention deals more often | Grading system still works correctly |
