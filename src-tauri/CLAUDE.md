# Rust Backend (src-tauri/)

Cargo workspace with four crates implementing the bridge engine and convention data model in Rust.

## Commands

| Command                       | Purpose                                                     |
| ----------------------------- | ----------------------------------------------------------- |
| `cargo build --workspace`     | Build all crates (run from `src-tauri/`)                    |
| `cargo test --workspace`      | Run all Rust tests                                          |
| `cargo test -p bridge-engine` | Test engine crate only                                      |
| `cargo test -p bridge-conventions` | Test conventions crate (includes golden-master fixture tests) |
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
                       orchestrator, Rust-constructed compositions for TS facts lacking composition fields.
                       Rust FactComposition is a superset of TS — includes Match, Compute, Extended nodes
                       and TopHonorCount/SuitCompare/LongestSuitIs/AceCount/KingCount/VulnerabilityIs
                       clause types not in TS. Facts using these have Rust-constructed trees in
                       fact_dsl/rust_compositions.rs. Zero built-in evaluator registry.
                       Phase 3 adds `pipeline/` (observation + evaluation + run_pipeline), `teaching/`
                       (resolution, projection, parse tree), and `adapter/` (protocol adapter, strategy
                       evaluation, practical scorer). `normalizeIntent` is hand-ported from TS as a Rust
                       match block in `pipeline/observation/normalize_intent.rs` — when the TS mapping
                       in `src/conventions/pipeline/observation/normalize-intent.ts` changes, update the
                       Rust match block to stay in sync. `ConventionStrategy::suggest()` returns
                       `(Option<BidResult>, StrategyEvaluation)` — immutable &self, debug payload as
                       out-param (intentional Rust idiom divergence from TS &mut self pattern).
  bridge-tauri/        Tauri v2 app — #[tauri::command] handlers delegating to bridge-engine
  bridge-wasm/         WASM bindings via wasm-bindgen — wraps bridge-engine for browser deployment
```

## Conventions

- **bridge-engine purity:** Zero platform deps (no tauri, axum, tokio). Only serde, rand, thiserror.
- **Free functions, not a trait:** Engine functions called directly. Transport crates are the abstraction.
- **Error boundary:** `EngineError` for domain logic. Tauri returns `Result<T, String>`. WASM returns `Result<JsValue, JsError>`.
- **RNG:** ChaCha8Rng with `seed: Option<u64>`. Same seed = deterministic Rust output. NOT cross-engine portable with TS (different PRNG algorithms).
- **Serde contract:**
  - Enums: `#[serde(rename = "C")]` etc. to match TS string values
  - Structs: `#[serde(rename_all = "camelCase")]`
  - `Call`: `#[serde(tag = "type")]` (internally tagged) → `{"type":"bid","level":1,"strain":"C"}`
  - `Deal.hands`: `HashMap<Seat, Hand>` → `{"N":{...},"E":{...},...}` (Seat has Ord derive)
  - `Option<Contract>`: `null` for passout
  - `leadSuit`: explicit `null` in JSON (never omitted), deserialized as `Option<Suit>`
- **WASM serialization:** bridge-wasm uses `serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true)` so `HashMap<Seat, Hand>` produces a plain JS object, not a `Map`.

## Adding a New EnginePort Method

1. Add function to `bridge-engine/src/{module}.rs`
2. Add `#[tauri::command]` handler to `bridge-tauri/src/commands.rs`, wire in `lib.rs`
3. Add `#[wasm_bindgen]` export to `bridge-wasm/src/lib.rs` with request struct
4. Add request struct if new parameters needed
5. Add tests in all three locations

## DDS Integration

- `dds-bridge` v0.8 optional dependency behind `dds` feature flag (default on in bridge-tauri only)
- `bridge-engine/src/dds.rs`: `to_dds_deal()`, `from_tricks_table()`, `solve_deal_with_par()` — type conversion + solver wrapper
- `solve_deal` command returns `DDSolution { tricks, par }` with 4×5 tricks table and optional par info
- Requires `libclang-dev` for `dds-bridge-sys` C++ compilation (bindgen)
- DDS cannot compile to `wasm32-unknown-unknown` (C++ FFI) — desktop only

## Gotchas

- `Cargo.lock` is auto-generated — commit it for reproducible builds
- Tauri `generate_context!()` requires RGBA PNG icons in `bridge-tauri/icons/`
- `HashMap<Seat, Hand>` serde works because `Seat` has `Ord` derive and single-char renames
- `DealConstraints` has no `customCheck`/`rng` fields (TS-only). Uses `seed: Option<u64>` instead.
- `generate_deal` Tauri/WASM returns `Deal` (not `DealGeneratorResult`)
- **Never build bridge-wasm via `cargo build --workspace`**; always use `wasm-pack` to prevent `getrandom/js` feature from bleeding into native builds

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

<!-- context-layer: generated=2026-02-22 | last-audited=2026-02-27 | version=3 | dir-commits-at-audit=8 | tree-sig=dirs:12,files:35 -->
