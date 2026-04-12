# Phase 2: Fact Evaluation

Port fact evaluation logic to Rust. Implement the `FactComposition` tree interpreter and `evaluateFacts()` orchestrator.

**Status:** Complete
**Estimated LOC:** ~1,500 Rust (actual)
**Dependencies:** Phase 1 (convention data model)
**Rust concepts to learn:** trait objects, pattern matching on recursive trees, iterators

## Goal

Given a hand and convention context, Rust produces the same fact evaluation results as TS. Primitive, bridge-derived, system, and module-derived facts all evaluate correctly.

## TS Source Locations

| Component | TS source | Purpose |
|-----------|-----------|---------|
| Primitive + bridge-derived facts | `src/conventions/pipeline/facts/shared-fact-catalog.ts` | HCP, suit lengths, shape, derived booleans, relational evaluators |
| Module-derived facts | Per-module `facts.ts` files (e.g., `definitions/modules/dont/facts.ts`) | Convention-specific derived facts |
| System facts | `src/conventions/pipeline/facts/system-fact-catalog.ts` | System-config-driven facts |
| Fact factory | `src/conventions/pipeline/facts/fact-factory.ts` | `defineBooleanFact`, `defineHcpRangeFact`, `definePerSuitFacts` |
| Deal constraints | `src/conventions/definitions/capability-constraint-registry.ts` | Deal constraint derivation |
| Constraint derivation | `src/conventions/pipeline/facts/derive-deal-constraints.ts` | `deriveBundleDealConstraints()` |

## Key Implementation Notes

**FactComposition promotion:** TS currently has two paths — imperative `FactEvaluatorFn` functions and declarative `FactComposition` trees. `FactComposition` already exists in the TS codebase at `src/conventions/core/fact-catalog.ts` and is used for deal constraint loosening. This migration promotes `FactComposition` to the **primary** evaluation path, replacing imperative evaluator functions entirely. The Rust implementation only needs the tree interpreter.

**Fact evaluation flow:**
1. Primitive facts: extract from hand (HCP, suit lengths, shape classification)
2. Bridge-derived facts: compute from primitives (balanced, stoppers, controls, quick tricks)
3. System facts: resolve from `SystemConfig` (opening ranges, response thresholds)
4. Module-derived facts: evaluate `FactComposition` trees from module definitions
5. `evaluateFacts()` orchestrator: combines all fact sources into a single fact map

## Pre-Phase: Reference Snapshots

Historical note: before the Rust port, this phase captured TS fact-evaluation outputs with `scripts/capture-fact-snapshots.ts`. That migration scaffolding has been removed. Keep this section as design history, not as a current command to run.

Run all 6 bundles × 100 sample hands through the TS fact evaluator. Serialize outputs as JSON fixtures. These are a safety net for catching unintentional drift — not a rigid spec. The TS fact system has design decisions made early; simplify where appropriate during the port.

When Rust output differs from a snapshot, ask: "bug or improvement?" Update the fixture and document the decision if it's an improvement.

## Verification

- **Reference snapshot comparison:** Rust fact evaluation compared against TS snapshots — differences reviewed and classified as bugs (fix) or improvements (update fixture, document)
- **Edge cases:** empty hands, extreme distributions, all fact types exercised
- **CI gate:** `cargo test -p bridge-conventions` (fact evaluation tests) must pass before Phase 3

## Completion Checklist

- [x] `FactComposition` tree interpreter implemented (`fact_dsl/composition.rs`)
- [x] Primitive fact evaluators ported (`fact_dsl/primitives.rs`)
- [x] Bridge-derived fact evaluators ported (`fact_dsl/bridge_derived.rs`) — standard + relational
- [x] System fact evaluation ported (`fact_dsl/system_facts.rs`) — standard + relational
- [x] Module-derived fact evaluation via Rust-constructed compositions (`fact_dsl/rust_compositions.rs`)
- [x] `evaluateFacts()` orchestrator ported (`fact_dsl/evaluator.rs`)
- [x] Topological sort ported (`fact_dsl/topo_sort.rs`)
- [x] Fact inversion ported (`fact_dsl/inversion.rs`)
- [x] Expanded PrimitiveClause + Match/Compute/Extended composition nodes
- [ ] Golden-master snapshot script (deferred — snapshot capture requires TS integration)
- [ ] Golden-master snapshot tests against TS output (deferred — requires snapshot script)
- [ ] Deal constraint derivation ported (Phase 3 — depends on pipeline context)
- [x] Update `docs/architecture/migration/index.md` phase tracker status
- [x] Update `crates/CLAUDE.md` — Rust fact evaluator documentation
