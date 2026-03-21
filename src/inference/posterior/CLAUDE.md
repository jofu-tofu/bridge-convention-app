# Posterior

Posterior inference engine — sampling, factor compilation, and probabilistic hand queries.

## Architecture

| File | Role |
|------|------|
| `posterior-engine.ts` | **Deprecated.** `createPosteriorEngine()` — old interface, still used by consumers during migration. |
| `posterior-compiler.ts` | **Deprecated.** `compilePublicHandSpace()` — old compilation path. Used internally by `ts-posterior-backend.ts`. |
| `factor-compiler.ts` | `compileFactorGraph()`, `validateFactorGraph()` — new compilation: `PublicSnapshot` → `FactorGraph`. Convention-erased. |
| `ts-posterior-backend.ts` | `createTsBackend()` — `PosteriorBackend` implementation. Wraps existing sampler, answers `PosteriorQuery` queries. |
| `query-port.ts` | `createQueryPort()` — creates `PosteriorQueryPort` from backend + state. Consumer-facing query interface. |
| `posterior-sampler.ts` | `sampleDeals()` — Monte Carlo rejection sampling. Used by both old engine and new backend. |
| `posterior-facts.ts` | `POSTERIOR_FACT_HANDLERS` — 5 posterior fact handlers (used by old engine path). |
| `posterior-catalog.ts` | `createPosteriorFactEvaluators()`, `createPosteriorFactProvider()` — bridges posterior to fact catalog. |
| `latent-branch-resolver.ts` | `resolveLatentBranches()` — computes marginal probabilities for latent branches. |

## New Boundary (Phase 4)

The redesigned posterior boundary separates concerns:

1. **Factor Compiler** (`factor-compiler.ts`): `PublicSnapshot` → `FactorGraph` (convention-erased)
2. **Backend** (`ts-posterior-backend.ts`): `ConditioningContext` → `PosteriorState` (weighted particles)
3. **Query Port** (`query-port.ts`): `PosteriorState` → typed queries (`PosteriorQueryPort`)

Consumers call `PosteriorQueryPort` methods (e.g., `marginalHcp()`, `fitProbability()`). The backend is replaceable — a Rust/WASM implementation can swap in without changing consumer code.

## Migration Status

The old `PosteriorEngine` → `SeatPosterior` path still works and is used by `meaning-strategy.ts` and `config-factory.ts`. Consumer migration (Phase 4B) will replace these with `createTsBackend()` → `createQueryPort()`.

## Gotchas

- `ts-posterior-backend.ts` uses the OLD `compilePublicHandSpace()` internally (the sampler still expects `PublicHandSpace[]`)
- `branch-probability` queries return 0 (not yet wired to latent branch resolution)
- `FactorGraph` is serializable (designed for future WASM boundary)
- Boundary invariant tests in `boundary-invariants.test.ts` enforce: no convention imports, no publicBeliefs on snapshot, JSON round-trip, compilation trace integrity

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Staleness anchor:** This file assumes `ts-posterior-backend.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-03-15 | version=1 | tree-sig=dirs:1,files:10,exts:ts:9,md:1 -->
