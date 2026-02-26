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
- `DoubleDummySolver` — trait defined. Implementation in `bridge-engine/src/dds.rs` via `dds-bridge` v0.8 (feature-gated).

## DDS Integration

- `dds-bridge` v0.8 optional dependency behind `dds` feature flag (default on in bridge-tauri and bridge-server)
- `bridge-engine/src/dds.rs`: `to_dds_deal()`, `from_tricks_table()`, `solve_deal_with_par()` — type conversion + solver wrapper
- `solve_deal` command/route returns `DDSolution { tricks, par }` with 4×5 tricks table and optional par info
- Requires `libclang-dev` for `dds-bridge-sys` C++ compilation (bindgen)

## Gotchas

- `Cargo.lock` is auto-generated — commit it for reproducible builds
- Tauri `generate_context!()` requires RGBA PNG icons in `bridge-tauri/icons/`
- `HashMap<Seat, Hand>` serde works because `Seat` has `Ord` derive and single-char renames
- `DealConstraints` has no `customCheck`/`rng` fields (TS-only). Uses `seed: Option<u64>` instead.
- `generate_deal` Tauri command returns `Deal` (not `DealGeneratorResult`) — matches TS `HttpEngine` which returns `Deal`

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

<!-- context-layer: generated=2026-02-22 | last-audited=2026-02-25 | version=2 | dir-commits-at-audit=8 | tree-sig=dirs:12,files:35,exts:rs:16,json:6,toml:5,png:3,md:1 -->
