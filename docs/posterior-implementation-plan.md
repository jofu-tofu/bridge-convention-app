# Posterior Engine Boundary Redesign — Implementation Plan

## Summary

Redesign the posterior engine's I/O boundary around a convention-erased `FactorGraphIR`, evict beliefs from `PublicSnapshot`, and introduce a `PosteriorQueryPort` that all consumers call explicitly. The internal canonical state becomes weighted particles over full latent worlds (deal + branch assignments). The boundary is designed so a Rust/WASM backend can replace the TS sampler later without changing any consumer code.

## References

- Critical thinking synthesis: `_output/thinking/criticalthinking/20260315-posterior-io-boundary/synthesis.md`
- Boundary presentation: `docs/posterior-boundaries-presentation.html`
- Current posterior contracts: `src/core/contracts/posterior.ts`
- Current posterior engine: `src/inference/posterior/`
- Protocol spec (posterior section): `~/Obsidian/Bridge Convention Vault/Sparks/2026-03-09-better-convention-protocol.md` § Posterior Engine

---

## Phase 0: Characterization Tests (before any changes)

**Goal:** Lock current behavior so refactoring can't silently break consumers.

### Tests to write

| Test file | What it locks |
|-----------|--------------|
| `src/inference/posterior/__tests__/boundary-characterization.test.ts` | Current `PosteriorEngine` contract: `compilePublic()` produces `PublicHandSpace[]` from commitments; `conditionOnHand()` produces `SeatPosterior` with working `probability()` and `distribution()`; `deriveActingHandFacts()` returns values for shared fact IDs |
| `src/conventions/core/runtime/__tests__/snapshot-beliefs-characterization.test.ts` | Current `buildSnapshotFromAuction()` populates `publicBeliefs` when posteriorEngine is provided; empty when not |

### Strategy
- Test through public interfaces only (`createPosteriorEngine()`, `buildSnapshotFromAuction()`)
- Use real 1NT auction fixtures (already exist in `posterior-engine.test.ts` and `posterior-1nt-gold.test.ts`)
- These tests will be updated (not deleted) as the boundary changes — they document the migration

---

## Phase 1: Define the Declarative IR (contracts only, no implementation changes)

**Goal:** Add the new types to `src/core/contracts/`. Nothing breaks — old types stay, new types are additive.

### New types

```
FactorGraphIR                    — the compiled, convention-erased IR
  factors: FactorSpec[]          — typed factor specifications
  ambiguitySchema: AmbiguityFamilyIR[]  — public unresolved families
  evidencePins: EvidencePin[]    — observed values (auction record, own hand)
  compilationTrace: FactorOrigin[] — maps each factor to its pedagogical source

FactorSpec (discriminated union)
  | HcpRangeFactor    { seat, min, max, strength }
  | SuitLengthFactor  { seat, suit, min, max, strength }
  | ShapeFactor       { seat, pattern, strength }
  | ExclusionFactor   { seat, constraint, strength }
  | FitFactor         { seats, suit, minCombined, strength }

PosteriorQueryPort               — the consumer-facing query interface
  marginalHcp(seat): PosteriorQueryResult<number>
  suitLength(seat, suit): PosteriorQueryResult<number>
  fitProbability(seats, suit, threshold): PosteriorQueryResult<number>
  isBalanced(seat): PosteriorQueryResult<number>
  jointHcp(seats, range): PosteriorQueryResult<number>
  branchProbability(familyId, branchId): PosteriorQueryResult<number>
  activeFactors(): FactorIntrospection[]

PosteriorBackend                  — replaceable compute boundary
  initialize(context: ConditioningContext): PosteriorState
  query(state: PosteriorState, query: PosteriorQueryIR): PosteriorQueryResult
  conditionOnHand(state, seat, hand): PosteriorState
  introspect(state): FactorIntrospection[]
```

### Rust compatibility design

The `FactorGraphIR` and `ConditioningContext` types are serializable, convention-erased, use discriminated unions (map to Rust enums via serde), and avoid TypeScript-specific features.

---

## Phase 2: Evict `publicBeliefs` from `PublicSnapshot`

**Goal:** Break the circular dependency. Snapshot becomes purely public/deterministic state.

---

## Phase 3: Factor Compiler

**Goal:** Replace `compilePublicHandSpace()` with `compileFactorGraph()` that produces `FactorGraphIR`.

New file: `src/inference/posterior/factor-compiler.ts` — convention-erased, reads `publicCommitments`, maps each `PublicConstraint` to a typed `FactorSpec`, produces `compilationTrace`.

---

## Phase 4: PosteriorQueryPort + Backend Boundary

**Goal:** Replace the current `PosteriorEngine` interface with `PosteriorBackend` + `PosteriorQueryPort` split.

---

## Phase 5: CI Boundary Tests

**Goal:** Make the boundary self-defending against regression.

Tests enforce: schema closure (no convention imports), constraint integrity, no beliefs on snapshot, factor graph serializable, query health present.

---

## Phase 6: Documentation Updates

---

## Phase 7 (future): Soft Evidence + Weighted Sampling

Not implemented now. Reserved in the schema. When needed: add `EvidenceProgram` with typed correlation groups, change sampler from rejection to importance sampling.

## Phase 8 (future): Rust/WASM Backend

Not implemented now. The boundary supports it. `ConditioningContext` is serializable → send over WASM bridge.

---

## Dependency Graph

```
Phase 0 (characterization tests)
  ↓
Phase 1 (IR types — additive)
  ↓
Phase 2 (evict publicBeliefs)
  ↓
Phase 3 (factor compiler)
  ↓
Phase 4 (query port + backend)
  ↓
Phase 5 (CI boundary tests)
  ↓
Phase 6 (documentation)
  ↓
Phase 7 (soft evidence — future)
  ↓
Phase 8 (Rust backend — future)
```

Each phase is independently shippable.

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| 5 factor templates insufficient | Compositional operators planned as extension |
| Rejection sampling too slow | Current 200-sample budget fine for teaching; IR supports incremental processing |
| Consumer migration breaks something | Characterization tests lock current behavior |
| `publicBeliefs` removal breaks UI | Field only populated when `posteriorEngine` injected; no UI reads directly |

---

## Estimated Scope

| Phase | Files touched | New files | Tests |
|-------|--------------|-----------|-------|
| 0 | 0 | 2 test files | ~10 characterization tests |
| 1 | 0 | 3 contract files + 2 test files | ~15 type/shape tests |
| 2 | 5-7 files | 0 | Update ~10 existing tests |
| 3 | 3 files | 1 new + 1 test file | ~12 compiler tests |
| 4 | 6-8 files | 2 new + rewrite 3 test files | ~20 tests |
| 5 | 0 | 1 test file | 6 invariant tests |
| 6 | 6+ doc files | 1 new CLAUDE.md | 0 |
