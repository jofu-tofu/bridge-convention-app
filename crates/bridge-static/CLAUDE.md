# bridge-static

Static data extractor — outputs convention viewport JSON for build-time HTML generation.

## Purpose

Thin binary that calls `bridge-session` viewport builders (`build_module_catalog`, `build_module_learning_viewport`, `build_module_flow_tree`) for all 14 modules and serializes the output as a single JSON file. This JSON is consumed by `scripts/build-learn-html.ts` to produce static HTML learn pages for SEO.

## Architectural Constraint

**MUST NOT contain convention logic or data.** This crate is purely a caller — it imports viewport builders from `bridge-session` and serialization from `serde_json`. If you need to change what data appears in static pages, change the viewport builders in `bridge-session`, not this crate.

## JSON Contract

Rust types are authoritative. All viewport structs use `#[serde(rename_all = "camelCase")]` and `Serialize` — the same serialization used at the WASM boundary. The TS build script (`scripts/build-learn-html.ts`) documents the expected JSON shape as TS interfaces, but those interfaces are documentation, not a schema. If Rust types change, the TS script breaks at runtime — this is intentional and forces the template to be updated when data changes.

## Usage

```
bridge-static [--output <path>]
```

Writes JSON to `<path>` (default: stdout). Exits non-zero if any module fails to produce a learning viewport.

## Files

```
src/main.rs    Binary entry point (~80 LOC)
Cargo.toml     Dependencies: bridge-conventions, bridge-session, serde, serde_json
```

<!-- context-layer: generated=2026-04-11 | last-audited=2026-04-11 | version=1 | dir-commits-at-audit=0 | tree-sig=dirs:1,files:3 -->
