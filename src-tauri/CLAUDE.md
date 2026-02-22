# Rust Backend (src-tauri/)

Cargo workspace with three crates implementing the bridge engine in Rust.

## Commands

| Command                       | Purpose                                  |
| ----------------------------- | ---------------------------------------- |
| `cargo build --workspace`     | Build all crates (run from `src-tauri/`) |
| `cargo test --workspace`      | Run all Rust tests                       |
| `cargo test -p bridge-engine` | Test engine crate only                   |
| `cargo test -p bridge-server` | Test HTTP server crate only              |
| `cargo run -p bridge-server`  | Start HTTP dev server on port 3001       |

## Workspace Structure

```
crates/
  bridge-engine/   Pure Rust game logic (types, eval, deal gen, auction, scoring, play)
  bridge-tauri/    Tauri v2 app — #[tauri::command] handlers delegating to bridge-engine
  bridge-server/   Axum HTTP server — POST /api/{method} routes for browser dev mode
```

## Conventions

- **bridge-engine purity:** Zero platform deps (no tauri, axum, tokio). Only serde, rand, thiserror.
- **Free functions, not a trait:** Engine functions called directly. Transport crates are the abstraction.
- **Stateless HTTP:** Every request sends full state. No sessions, no shared mutable state.
- **Error boundary:** `EngineError` for domain logic. HTTP returns `(400, error.to_string())`. Tauri returns `Result<T, String>`.
- **RNG:** ChaCha8Rng with `seed: Option<u64>`. Same seed = deterministic Rust output. NOT cross-engine portable with TS (different PRNG algorithms).
- **Serde contract:**
  - Enums: `#[serde(rename = "C")]` etc. to match TS string values
  - Structs: `#[serde(rename_all = "camelCase")]`
  - `Call`: `#[serde(tag = "type")]` (internally tagged) → `{"type":"bid","level":1,"strain":"C"}`
  - `Deal.hands`: `HashMap<Seat, Hand>` → `{"N":{...},"E":{...},...}` (Seat has Ord derive)
  - `Option<Contract>`: `null` for passout
  - `leadSuit`: explicit `null` in JSON (never omitted), deserialized as `Option<Suit>`

## Adding a New EnginePort Method

1. Add function to `bridge-engine/src/{module}.rs`
2. Add `#[tauri::command]` handler to `bridge-tauri/src/commands.rs`, wire in `lib.rs`
3. Add POST route handler to `bridge-server/src/routes.rs`, wire in `api_routes()`
4. Add request struct if new parameters needed
5. Add tests in all three locations

## Extensibility Traits (defined but not yet implemented)

- `HandEvaluationStrategy` — V1: `HcpStrategy`. Future: Bergen, Zar, LTC.
- `PlayStrategy` — Phase 7: heuristic → DDS-assisted play AI.
- `DoubleDummySolver` — V2: wraps `dds-bridge-sys` FFI.

## Gotchas

- `Cargo.lock` is auto-generated — commit it for reproducible builds
- Tauri `generate_context!()` requires RGBA PNG icons in `bridge-tauri/icons/`
- `HashMap<Seat, Hand>` serde works because `Seat` has `Ord` derive and single-char renames
- `DealConstraints` has no `customCheck`/`rng` fields (TS-only). Uses `seed: Option<u64>` instead.
- `generate_deal` Tauri command returns `Deal` (not `DealGeneratorResult`) — matches TS `HttpEngine` which returns `Deal`

<!-- context-layer: generated=2026-02-22 | version=1 -->
