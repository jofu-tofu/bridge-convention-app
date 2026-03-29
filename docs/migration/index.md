# Rust/WASM Migration

Backend modules (`conventions/`, `inference/`, `session/`) are being migrated from TypeScript to Rust/WASM. See `docs/product-direction.md` for the product decisions driving this migration.

## Phase Tracker

| Phase | Name | Status | Est. LOC | Dependencies |
|-------|------|--------|----------|--------------|
| 1 | [Convention Data Model](phase-1-convention-data-model.md) | Complete | ~1,500 | None |
| 2 | [Fact Evaluation](phase-2-fact-evaluation.md) | Not Started | ~1,200 | Phase 1 |
| 3 | [Meaning Pipeline](phase-3-meaning-pipeline.md) | Not Started | ~4,000-5,000 | Phase 2 |
| 4 | [Inference + Session](phase-4-inference-session.md) | Not Started | ~6,000-7,000 | Phase 3 |
| 5 | [Service Cleanup](phase-5-service-cleanup.md) | Not Started | ~2,000 | Phase 4 |

**Total estimated Rust LOC:** ~15,000-17,000

## Architecture Overview

### Target Crate Structure

```
src-tauri/crates/
  bridge-engine/        # (exists) Pure Rust game logic
  bridge-conventions/   # (new, Phase 1-3) Convention types, fact DSL, pipeline, teaching, adapter
  bridge-session/       # (new, Phase 4) Session state, controllers, heuristics, inference
  bridge-service/       # (new, Phase 5) ServicePort impl, viewport builders
  bridge-wasm/          # (exists, extended) WASM bindings for full ServicePort
  bridge-tauri/         # (exists, extended) Tauri commands for full ServicePort
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
- [Architecture Decisions](architecture.md)
