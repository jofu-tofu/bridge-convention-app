# Posterior

Posterior inference engine — sampling, factor compilation, and probabilistic hand queries.

## Architecture

| File | Role |
|------|------|
| `posterior-compiler.ts` | `compilePublicHandSpace()` — compilation path used internally by `ts-posterior-backend.ts`. |
| `factor-compiler.ts` | `compileFactorGraph()`, `validateFactorGraph()` — new compilation: `PublicSnapshot` → `FactorGraph`. Convention-erased. |
| `ts-posterior-backend.ts` | `createTsBackend()` — `PosteriorBackend` implementation. Wraps existing sampler, answers `PosteriorQuery` queries. |
| `query-port.ts` | `createQueryPort()` — creates `PosteriorQueryPort` from backend + state. Consumer-facing query interface. |
| `posterior-sampler.ts` | `sampleDeals()` — Monte Carlo rejection sampling. Used by backend. |
| `posterior-facts.ts` | `POSTERIOR_FACT_HANDLERS` — 5 posterior fact handlers. |
| `posterior-catalog.ts` | `createPosteriorFactEvaluators()`, `createPosteriorFactProviderFromBackend()` — bridges posterior to fact catalog. |
| `latent-branch-resolver.ts` | `resolveLatentBranches()` — computes marginal probabilities for latent branches. |

## New Boundary (Phase 4)

The redesigned posterior boundary separates concerns:

1. **Factor Compiler** (`factor-compiler.ts`): `PublicSnapshot` → `FactorGraph` (convention-erased)
2. **Backend** (`ts-posterior-backend.ts`): `ConditioningContext` → `PosteriorState` (weighted particles)
3. **Query Port** (`query-port.ts`): `PosteriorState` → typed queries (`PosteriorQueryPort`)

Consumers call `PosteriorQueryPort` methods (e.g., `marginalHcp()`, `fitProbability()`). The backend is replaceable — a Rust/WASM implementation can swap in without changing consumer code.

## Migration Status

Phase 4B complete — deprecated `PosteriorEngine`, `SeatPosterior`, `LikelihoodModel`, and `createPosteriorFactProvider(SeatPosterior)` have been removed. All consumers use `createTsBackend()` → `createQueryPort()` or `createPosteriorFactProviderFromBackend()`.

## Gotchas

- `ts-posterior-backend.ts` uses `compilePublicHandSpace()` internally (the sampler expects `PublicHandSpace[]`)
- `branch-probability` queries return 0 (not yet wired to latent branch resolution)
- `FactorGraph` is serializable (designed for future WASM boundary)
- Boundary invariant tests in `boundary-invariants.test.ts` enforce: no convention imports, no publicBeliefs on snapshot, JSON round-trip, compilation trace integrity

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Staleness anchor:** This file assumes `ts-posterior-backend.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-03-22 | version=2 | tree-sig=dirs:1,files:9,exts:ts:8,md:1 -->
