# Phase 1: Convention Data Model

Port all convention type definitions to Rust. Build the `bridge-conventions` crate with serde deserialization. Verify with JSON round-trip tests.

**Status:** Complete
**Estimated LOC:** ~1,500 Rust
**Dependencies:** None
**Rust concepts to learn:** serde, enums with data, `Box<T>`, module organization

## Goal

All TS convention types deserialize correctly in Rust. No evaluation logic yet — just the data model and serialization.

## New Crate

```
src-tauri/crates/bridge-conventions/
  Cargo.toml
  src/
    lib.rs
    types/
      mod.rs
      bid_meaning.rs      # BidMeaning, MeaningClause, FactOperator, RecommendationBand, Disclosure
      fact_types.rs        # FactComposition, FactDefinition, PrimitiveClause, EvaluationWorld
      rule_types.rs        # LocalFsm, StateEntry, ResolvedSurface, TurnRole, ObsPattern, RouteExpr, NegotiationExpr, PhaseTransition
      module_types.rs      # ConventionModule, ModuleTeaching
      surface_types.rs     # Surface builder equivalents
      bundle_types.rs      # ConventionBundle, BundleInput
      system_config.rs     # SystemConfig, system profiles
      negotiation.rs       # NegotiationState, MachineRegisters
      spec_types.rs        # ConventionSpec
      authored_text.rs     # BidName, BidSummary, TeachingLabel (newtype wrappers)
```

## TS Source Locations

Each type group with its TS source file:

| Rust module | TS source | Key types |
|-------------|-----------|-----------|
| `fact_types` | `src/conventions/core/fact-catalog.ts` | `FactComposition`, `FactDefinition`, `PrimitiveClause`, `EvaluationWorld` |
| `rule_types` | `src/conventions/core/rule-module.ts` | `LocalFsm`, `StateEntry`, `ResolvedSurface`, `TurnRole`, `ObsPattern`, `RouteExpr`, `NegotiationExpr`, `PhaseTransition` |
| `module_types` | `src/conventions/core/convention-module.ts` | `ConventionModule`, `ModuleTeaching` |
| `bid_meaning` | `src/conventions/pipeline/evaluation/meaning.ts` | `BidMeaning`, `MeaningClause`, `FactOperator`, `RecommendationBand`, `Disclosure` |
| `surface_types` | `src/conventions/core/surface-builder.ts` | `createSurface()` builder types |
| `bundle_types` | `src/conventions/core/bundle/bundle-types.ts` | `ConventionBundle`, `BundleInput` |
| `system_config` | `src/conventions/definitions/system-registry.ts` | `SystemConfig`, bundle inputs, system profiles |
| `negotiation` | `src/conventions/core/committed-step.ts` | `NegotiationState`, `MachineRegisters` |
| `spec_types` | `src/conventions/core/protocol/types.ts` | `ConventionSpec` |
| `authored_text` | `src/conventions/core/authored-text.ts` | Branded string types (`BidName`, `BidSummary`, `TeachingLabel`) |

## Build Script

Create a TS build script that serializes all convention definitions to JSON:

```bash
npx tsx scripts/export-conventions.ts > fixtures/conventions.json
```

This produces the golden-master fixture for round-trip testing.

## Verification

- **Round-trip tests:** Serialize TS conventions to JSON → deserialize in Rust → re-serialize → compare JSON equality
- **Coverage:** Every type variant exercised (ensure all enum arms, optional fields, nested structures round-trip correctly)
- **CI gate:** `cargo test -p bridge-conventions` must pass before Phase 2 begins

## Completion Checklist

- [x] All convention types defined in Rust with serde derives
- [x] Build script exports all 6 bundles to JSON fixtures (bundle JSON no longer embeds modules — modules are runtime-derived from module registry)
- [x] Round-trip tests pass for all bundles
- [x] `Cargo.toml` workspace member added
- [x] Update `src-tauri/CLAUDE.md` (if it exists) with new crate
- [x] Update `src/conventions/CLAUDE.md` — note Rust type mirror exists
- [x] Update `docs/migration/index.md` phase tracker status
