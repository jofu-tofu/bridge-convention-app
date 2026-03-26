# Architecture Specs & Alignment

Design specifications, open questions, and spec status for the full architecture.

## Design Specs

The authoritative vision for the full architecture:

- `~/Obsidian/Bridge Convention Vault/Sparks/2026-03-09-better-convention-protocol.md` — Agreement Module IR: composable convention modules, system profiles, conversation machines, two-phase evaluation, public state layers, DealSpec, FactCatalog
- `~/Obsidian/Bridge Convention Vault/Sparks/2026-03-09-better-candidate-pipeline.md` — Meaning-centric pipeline: BidMeaning as canonical unit, semantic arbitration, TeachingProjection, DecisionProvenance, PedagogicalRelation graph, ExplanationCatalog
- `docs/posterior-implementation-plan.md` — Posterior engine boundary redesign: 8-phase plan covering FactorGraphIR, PosteriorQueryPort, PosteriorBackend, factor compiler, CI invariant tests, and Rust/WASM upgrade path

**Spec status:** Both specs are `status: active`, `confidence: medium-high`. Most contracts are frozen. The posterior engine boundary has a detailed implementation plan. Do not implement against unresolved areas — resolve the spec first.

## Open Questions in the Protocol Spec

| Open Question | Status | Blocks |
|---|---|---|
| Posterior consumer migration (Phase 4B) | Complete — deprecated `PosteriorEngine`, `SeatPosterior`, `LikelihoodModel` removed | Inference spectrum / difficulty config |
| Evidence group correlation model | Design complete; reserved as Phase 7 (soft evidence) | Posterior combiner accuracy |
| Host-attachment activation | Spec designed, vocabulary resolved (`conventions/definitions/capability-vocabulary.ts`), not yet exercised | Negative Doubles, Fourth Suit Forcing |
| DealSpec wiring | Types + test code exist; not wired to deal generation | Future deal generation enhancements |
| Multi-system UI | Backend wired; UI system selector not yet connected | User-facing system choice |

## Posterior Boundary (Phases 0-5 Complete)

The redesigned posterior boundary separates concerns into three layers:

1. **Factor Compiler** (`posterior/factor-compiler.ts`): `PublicSnapshot` → `FactorGraph` — convention-erased compilation. No convention imports cross the boundary.
2. **Backend** (`posterior/ts-posterior-backend.ts`): `ConditioningContext` → `PosteriorState` — weighted particle generation via Monte Carlo sampling. The backend is replaceable (future Rust/WASM swap).
3. **Query Port** (`posterior/query-port.ts`): `PosteriorState` → typed queries via `PosteriorQueryPort` — consumer-facing interface (`marginalHcp()`, `fitProbability()`, etc.).

The deprecated `PosteriorEngine` → `SeatPosterior` path has been removed (Phase 4B complete). All consumers use the new boundary: `createTsBackend()` → `createQueryPort()`. Boundary invariant tests in `boundary-invariants.test.ts` enforce: no convention imports, no `publicBeliefs` on snapshot, JSON round-trip, compilation trace integrity.

## Migration Status (Posterior)

Phase 4B complete — deprecated `PosteriorEngine`, `SeatPosterior`, `LikelihoodModel`, and `createPosteriorFactProvider(SeatPosterior)` have been removed. All consumers use `createTsBackend()` → `createQueryPort()` or `createPosteriorFactProviderFromBackend()`.

## Known Gaps (Core Infrastructure)

| Gap | Impact | Blocks |
|-----|--------|--------|
| No `Attachment` for host-state attachment | Add-on modules can't attach to host states | Pattern 4 (Negative Doubles, Drury) |
| `ActivationTrace` always `[]` in meaning arbitrator | Provenance can't answer "which modules were live and why?" | Diagnostics |
| `evaluateFacts()` only evaluates `acting-hand` world | No `public` or `full-deal` world facts can be evaluated | Future scope |
