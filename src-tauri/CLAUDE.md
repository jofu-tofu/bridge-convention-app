# Tauri Backend

Tauri v2 desktop shell. Currently a wrapper only — no custom Rust commands.

## Current State (Phase 5)

- Shell wrapper around the Vite frontend
- No custom `#[tauri::command]` handlers
- `tauri_plugin_opener` for external links
- Minimum window 800x600, default 1024x768
- CSP allows self + localhost dev server for HMR

## Phase 6 Roadmap: Rust Engine Port

- `TauriIpcEngine` implementing `EnginePort` interface via `#[tauri::command]` handlers
- Each EnginePort method becomes a Rust command with serde serialization for Deal, Auction, Contract, Trick types
- `dds-bridge-sys` crate integration for DDS solver (`solveDeal()`, `suggestPlay()`)
- Migration strategy: one method at a time, TS fallback during transition
- Performance benefits: deal generation, hand evaluation in compiled Rust

## Gotchas

- `beforeDevCommand` runs `npm run dev` which starts the Vite server — Tauri connects to it
- CSP in `tauri.conf.json` under `app.security.csp`, not via capabilities
- Capabilities in `capabilities/default.json` — `core:default` + `opener:default` sufficient for Phase 5

---

## Context Maintenance

**Staleness anchor:** This file assumes `src/lib.rs` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-02-21 | last-audited=2026-02-21 | version=1 -->
