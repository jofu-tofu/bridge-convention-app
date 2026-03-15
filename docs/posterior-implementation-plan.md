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

### Verification
```bash
npx vitest run src/inference/posterior/__tests__/boundary-characterization
npx vitest run src/conventions/core/runtime/__tests__/snapshot-beliefs-characterization
```

---

## Phase 1: Define the Declarative IR (contracts only, no implementation changes)

**Goal:** Add the new types to `src/core/contracts/`. Nothing breaks — old types stay, new types are additive.

### New file: `src/core/contracts/factor-graph.ts`

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

  strength: "hard" | "soft"      — separate types, not a string tag
  origin: FactorOrigin           — compilation trace entry

FactorOrigin
  sourceConstraint: PublicConstraint ref
  sourceSurface?: MeaningSurface ref
  sourceModule?: string
  originKind: "call-meaning" | "announcement" | "explicit-denial" | "entailed-denial"

AmbiguityFamilyIR               — public schema of unresolved alternatives
  familyId: string
  alternatives: AmbiguityAlternativeIR[]
  exclusivity: "xor" | "or"

EvidencePin
  kind: "own-hand" | "auction-record" | "alert"
  seat?: Seat
  value: Hand | PublicEvent[] | StructuredAlert
```

### New file: `src/core/contracts/posterior-query.ts`

```
PosteriorQueryPort               — the consumer-facing query interface
  marginalHcp(seat): PosteriorQueryResult<number>
  suitLength(seat, suit): PosteriorQueryResult<number>
  fitProbability(seats, suit, threshold): PosteriorQueryResult<number>
  isBalanced(seat): PosteriorQueryResult<number>
  jointHcp(seats, range): PosteriorQueryResult<number>
  branchProbability(familyId, branchId): PosteriorQueryResult<number>
  activeFactors(): FactorIntrospection[]

PosteriorQueryResult<T>
  value: T
  health: InferenceHealth

InferenceHealth
  effectiveSampleSize: number
  totalParticles: number
  acceptanceRate: number
  posteriorEntropy?: number

ConditioningContext               — branded input type
  snapshot: PublicSnapshot (without beliefs)
  factorGraph: FactorGraphIR
  observerSeat: Seat
  ownHand?: Hand
```

### New file: `src/core/contracts/posterior-backend.ts`

```
PosteriorBackend                  — replaceable compute boundary
  initialize(context: ConditioningContext): PosteriorState
  query(state: PosteriorState, query: PosteriorQueryIR): PosteriorQueryResult
  conditionOnHand(state, seat, hand): PosteriorState
  introspect(state): FactorIntrospection[]

PosteriorState                    — opaque to consumers
  (internal: weighted particles over LatentWorld)

LatentWorld                       — canonical hidden state
  hiddenDeal: Map<Seat, Hand>     — full card allocation
  branchAssignment: Map<string, string>  — familyId → branchId
```

### What this IR depends on

| Dependency | Source | Status |
|-----------|--------|--------|
| `PublicConstraint` | `agreement-module.ts` | Exists |
| `FactConstraintIR` | `agreement-module.ts` | Exists |
| `HandPredicateIR` | `predicate-surfaces.ts` | Exists |
| `Hand`, `Seat`, `Card` | `engine/types.ts` | Exists |
| `PublicSnapshot` | `module-surface.ts` | Exists (will be modified in Phase 2) |
| `MeaningSurface` | `meaning-surface.ts` | Exists |

### What consumes the IR (output consumers)

| Consumer | What it reads | How |
|----------|--------------|-----|
| Posterior engine (sampler) | `FactorGraphIR.factors` + `evidencePins` | Compiles factors into rejection/weighting predicates |
| Teaching backend | `FactorGraphIR.compilationTrace` | Maps factors to pedagogical origins for "why" explanations |
| UI belief display | `PosteriorQueryPort` results + `InferenceHealth` | Shows belief summaries with confidence indicators |
| Strategy/AI | `PosteriorQueryPort` results | Makes bidding decisions based on posterior queries |
| Future Rust backend | `ConditioningContext` (serializable) | Receives same IR over WASM boundary |

### Rust compatibility design

The `FactorGraphIR` and `ConditioningContext` types are designed to be:
- **Serializable** — plain data, no functions, no closures
- **Convention-erased** — no convention-specific types cross the boundary
- **Discriminated unions** — map cleanly to Rust enums via `serde`
- **No TypeScript-specific features** — no branded types in the IR itself (branding is at the factory/chokepoint level in TS)

A future Rust implementation would:
1. Receive `ConditioningContext` as JSON or MessagePack over WASM bridge
2. Implement `PosteriorBackend` in Rust
3. Return `PosteriorQueryResult` as serialized data
4. The TS `PosteriorQueryPort` wraps the WASM calls

### Testing (Phase 1)

| Test | What it verifies |
|------|-----------------|
| `src/core/contracts/__tests__/factor-graph.test.ts` | Type construction: each factor template builds correctly, discriminated union exhaustiveness, serialization round-trip |
| `src/core/contracts/__tests__/posterior-query.test.ts` | `InferenceHealth` construction, `PosteriorQueryResult` shape |

### Verification
```bash
npx tsc --noEmit   # types compile
npx vitest run src/core/contracts/__tests__/factor-graph
npx vitest run src/core/contracts/__tests__/posterior-query
```

---

## Phase 2: Evict `publicBeliefs` from `PublicSnapshot`

**Goal:** Break the circular dependency. Snapshot becomes purely public/deterministic state.

### Files changed

| File | Change |
|------|--------|
| `src/core/contracts/module-surface.ts` | Remove `publicBeliefs` field from `PublicSnapshot` interface and `buildPublicSnapshot()` factory |
| `src/conventions/core/runtime/public-snapshot-builder.ts` | Remove the `posteriorEngine` option and the 30-line belief-population block (lines 40-77) |
| `src/conventions/core/runtime/__tests__/public-beliefs.test.ts` | Delete or repurpose — these tests verify the exact behavior being removed |
| `src/conventions/core/runtime/__tests__/public-snapshot-builder.test.ts` | Remove `publicBeliefs` assertions from the snapshot builder tests |
| `src/conventions/__tests__/nt-bundle/machine-integration.test.ts` | Remove `publicBeliefs` assertion (line 308-317) |
| `src/core/contracts/CLAUDE.md` | Update `module-surface.ts` entry to remove `publicBeliefs` mention |
| `src/inference/CLAUDE.md` | Update to reflect belief views are no longer on snapshot |

### What stays

- `latentBranches` stays on `PublicSnapshot` for now (rename to `publicAmbiguitySchema` in Phase 4)
- `BeliefView` type stays in `posterior.ts` (it becomes a view type returned by `PosteriorQueryPort`)
- `publicRecord` and `publicCommitments` stay — they are deterministic public state

### Testing (Phase 2)

- Run `npx vitest run src/conventions/ src/inference/ src/core/` — fix all compilation errors from removed field
- Characterization tests from Phase 0 are updated to reflect new behavior (no `publicBeliefs` on snapshot)
- All existing posterior engine tests should still pass (they don't depend on `publicBeliefs`)

### Verification
```bash
npx tsc --noEmit
npx vitest run src/conventions/ src/inference/ src/core/ src/strategy/
```

---

## Phase 3: Factor Compiler

**Goal:** Replace `compilePublicHandSpace()` with `compileFactorGraph()` that produces `FactorGraphIR`.

### New file: `src/inference/posterior/factor-compiler.ts`

Replaces `posterior-compiler.ts`. Takes `PublicSnapshot` → `FactorGraphIR`.

- Reads `publicCommitments` and maps each `PublicConstraint` to a typed `FactorSpec`
- Reads `latentBranches` and maps to `AmbiguityFamilyIR`
- Produces `compilationTrace` mapping each factor to its source constraint
- Convention-erased: no convention-specific imports

### Mapping from current code

| Current (`posterior-compiler.ts`) | New (`factor-compiler.ts`) |
|----------------------------------|---------------------------|
| `negateConstraint()` for denials | Denial constraints produce `ExclusionFactor` with negated bounds |
| `hasContradiction()` | `validateFactorGraph()` — returns diagnostics instead of silent `estimatedSize: 0` |
| Per-seat grouping into `PublicHandSpace[]` | Factors are not per-seat — they reference seats via `FactorSpec.seat` |
| `HandPredicateIR` conjunction | Individual `FactorSpec` entries (one per constraint clause) |

### Files changed

| File | Change |
|------|--------|
| `src/inference/posterior/posterior-compiler.ts` | Deprecated, replaced by `factor-compiler.ts` |
| `src/inference/posterior/index.ts` | Export `compileFactorGraph` instead of `compilePublicHandSpace` |
| `src/inference/posterior/__tests__/posterior-compiler.test.ts` | Rewrite as `factor-compiler.test.ts` testing new compilation |

### Testing (Phase 3)

| Test | What it verifies |
|------|-----------------|
| `factor-compiler.test.ts` | Each `PublicConstraint` origin type compiles to correct `FactorSpec` template |
| `factor-compiler.test.ts` | Denial constraints produce negated factors |
| `factor-compiler.test.ts` | `latentBranches` compile to `AmbiguityFamilyIR` |
| `factor-compiler.test.ts` | `compilationTrace` maps every factor to its source |
| `factor-compiler.test.ts` | Empty commitments produce empty factor graph |
| `factor-compiler.test.ts` | Contradictory constraints produce validation diagnostics |

### Verification
```bash
npx vitest run src/inference/posterior/__tests__/factor-compiler
```

---

## Phase 4: PosteriorQueryPort + Backend Boundary

**Goal:** Replace the current `PosteriorEngine` interface with the new `PosteriorBackend` + `PosteriorQueryPort` split.

### Files changed

| File | Change |
|------|--------|
| `src/inference/posterior/posterior-engine.ts` | Rewrite to implement `PosteriorBackend` interface. Internal state becomes `PosteriorState` (weighted `LatentWorld[]`). |
| `src/inference/posterior/posterior-sampler.ts` | Refactored: samples full deals (not per-seat), returns `WeightedDealSample` with non-unit weights when soft factors exist. For Phase 4/v1, still rejection sampling with unit weights — but the interface accepts `FactorGraphIR` instead of `PublicHandSpace[]`. |
| `src/inference/posterior/posterior-facts.ts` | Retired as the default extension pattern. The 5 handlers become implementations of specific `PosteriorQueryPort` methods. Logic unchanged, architectural role transformed. |
| `src/inference/posterior/posterior-catalog.ts` | Simplified: `createPosteriorFactProvider` wraps `PosteriorQueryPort` instead of `SeatPosterior` |
| `src/core/contracts/posterior.ts` | Mark `PosteriorEngine`, `SeatPosterior`, `PublicHandSpace`, `LikelihoodModel` as `@deprecated`. Keep for backward compat during migration. |

### New file: `src/inference/posterior/query-port.ts`

Creates `PosteriorQueryPort` from a `PosteriorBackend` + `PosteriorState`:

```typescript
function createQueryPort(
  backend: PosteriorBackend,
  state: PosteriorState,
): PosteriorQueryPort
```

### Consumer migration

| Consumer | Current | New |
|----------|---------|-----|
| `bootstrap/config-factory.ts` | `createPosteriorEngine()` injected into strategy | `createPosteriorBackend()` + `compileFactorGraph()` + `createQueryPort()` |
| `strategy/bidding/meaning-strategy.ts` | Calls `posteriorEngine.conditionOnHand()` → `SeatPosterior.probability()`. Has `PosteriorCache` memoizing `PublicHandSpace[]` by auction length. | Calls `queryPort.marginalHcp()`, `queryPort.fitProbability()`, etc. Cache key changes to `FactorGraphIR` (still keyed by auction length). |
| `conventions/core/pipeline/fact-evaluator.ts` | `PosteriorFactProvider.queryFact()` | Same interface, backed by `PosteriorQueryPort` |
| `conventions/core/runtime/public-snapshot-builder.ts` | No longer needs posteriorEngine (removed in Phase 2) | No change |
| `teaching/teaching-projection-builder.ts` | Reads `PosteriorSummary.factValues` from strategy | Reads same `PosteriorSummary`, now populated from `PosteriorQueryPort` results |

**Note on `posterior-integration.test.ts`:** This is the only test file using `vi.fn()` spies (verifies `compilePublic` is called, memoization behavior). These tests are implementation-coupled and will need rewriting to test through the new `PosteriorBackend` + `PosteriorQueryPort` boundary. The behavioral assertions (memoization, graceful degradation) should survive; the spy-based call-count assertions should be replaced with observable outcome tests.

### Rename in this phase

| Old | New | Why |
|-----|-----|-----|
| `PublicSnapshot.latentBranches` | `PublicSnapshot.publicAmbiguitySchema` | Separates public schema from per-world realized assignment |
| `LatentBranchSet` | `AmbiguityFamilyIR` | Clearer name for public-level concept |
| `SeatPosterior` | `SeatPosteriorView` (deprecated alias) | It's a view, not canonical state |

### Testing (Phase 4)

| Test | What it verifies |
|------|-----------------|
| `query-port.test.ts` | Each query method returns correct `PosteriorQueryResult` with `InferenceHealth` |
| `query-port.test.ts` | `InferenceHealth` reflects actual sample quality (low acceptance → low ESS) |
| `query-port.test.ts` | `activeFactors()` returns introspection data matching compiled factors |
| `posterior-engine.test.ts` (rewritten) | `PosteriorBackend.initialize()` → `query()` round-trip with 1NT constraints |
| `posterior-sampler.test.ts` (updated) | Sampler accepts `FactorGraphIR`, produces `LatentWorld[]` with weights |
| Integration: `posterior-1nt-gold.test.ts` (updated) | End-to-end: 1NT auction → factor compilation → sampling → query port → correct probabilities |

### Verification
```bash
npx vitest run src/inference/posterior/
npx vitest run src/strategy/__tests__/posterior-
npx tsc --noEmit
```

---

## Phase 5: CI Boundary Tests

**Goal:** Make the boundary self-defending against regression.

### New test file: `src/inference/posterior/__tests__/boundary-invariants.test.ts`

| Test | What it enforces |
|------|-----------------|
| Schema closure | No file in `src/inference/posterior/` imports from `src/conventions/definitions/` |
| Constraint integrity | For every test auction with hard constraints, 100% of sampled worlds satisfy all hard factors |
| No beliefs on snapshot | `PublicSnapshot` type has no `publicBeliefs` field (compile-time, but also runtime assertion) |
| Factor graph serializable | `JSON.parse(JSON.stringify(factorGraph))` round-trips without loss |
| Query health present | Every `PosteriorQueryResult` has non-null `InferenceHealth` |
| Latent dimensionality | For standard conventions, `LatentWorld` has only `hiddenDeal` + `branchAssignment` (no extra variables) |

### Verification
```bash
npx vitest run src/inference/posterior/__tests__/boundary-invariants
```

---

## Phase 6: Documentation Updates

### Files to update

| File | Changes |
|------|---------|
| `CLAUDE.md` (root) | Update open questions table (posterior → resolved). Update next steps. Add factor graph IR to architecture description. Update alignment summary. |
| `src/core/contracts/CLAUDE.md` | Add `factor-graph.ts`, `posterior-query.ts`, `posterior-backend.ts` entries. Update `posterior.ts` entry. Remove `publicBeliefs` from `module-surface.ts` entry. |
| `src/inference/CLAUDE.md` | Rewrite posterior section: factor compiler, query port, backend boundary. Remove `publicBeliefs` references. |
| `src/conventions/core/CLAUDE.md` | Remove posterior engine injection from runtime description. |
| `src/bootstrap/CLAUDE.md` | Update drill lifecycle to show factor compilation + query port wiring. |
| Protocol spec `§ Posterior Engine` | Update to reflect factor graph IR, query port, backend boundary. Mark posterior open questions as resolved. |

### New documentation

| File | Content |
|------|---------|
| `src/core/contracts/factor-graph.ts` (JSDoc) | Each type gets a doc comment explaining its role in the boundary |
| `src/inference/posterior/CLAUDE.md` (new) | Posterior subsystem context: factor compiler, sampler, query port, backend interface, how to add new factor templates |

---

## Phase 7 (future): Soft Evidence + Weighted Sampling

**Not implemented now.** Reserved in the schema.

- `ProbabilisticPrior` type exists but sampler ignores it
- When needed: add `EvidenceProgram` with typed correlation groups (`IndependentGroup`, `ExclusiveAlternativeGroup`, `SharedSourceJointGroup`, `TemporalChainGroup`)
- Sampler changes from rejection (unit weights) to importance sampling (non-unit weights)
- `InferenceHealth.posteriorEntropy` becomes meaningful
- Per-factor temperature tuning becomes available

## Phase 8 (future): Rust/WASM Backend

**Not implemented now.** The boundary supports it.

- `ConditioningContext` is serializable → send over WASM bridge
- `PosteriorBackend` interface → implement in Rust
- `PosteriorQueryPort` wraps WASM calls → consumers unchanged
- `FactorGraphIR` maps to Rust enums via serde
- Same `InferenceHealth` comes back from Rust

---

## Dependency Graph

```
Phase 0 (characterization tests)
  ↓
Phase 1 (IR types — additive, nothing breaks)
  ↓
Phase 2 (evict publicBeliefs — snapshot cleanup)
  ↓
Phase 3 (factor compiler — replaces posterior-compiler)
  ↓
Phase 4 (query port + backend — replaces PosteriorEngine)
  ↓
Phase 5 (CI boundary tests — locks the boundary)
  ↓
Phase 6 (documentation — reflects new reality)
  ↓
Phase 7 (soft evidence — future, reserved)
  ↓
Phase 8 (Rust backend — future, boundary ready)
```

Each phase is independently shippable. No phase requires reverting a prior phase.

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| 5 factor templates insufficient for future conventions | Compositional operators (And/Or/Not/CrossSeat/BranchGuard) are a planned extension. Start closed, open when a convention hits the wall. |
| Rejection sampling too slow with full-deal worlds | Current 200-sample budget is fine for teaching. Factor graph IR supports incremental processing when benchmarks justify it. |
| Consumer migration breaks something subtle | Characterization tests (Phase 0) lock current behavior. Each consumer is migrated individually with its own test. |
| `publicBeliefs` removal breaks UI code | The field is only populated when `posteriorEngine` is injected. Currently no UI component reads it directly — it flows through `PosteriorFactProvider` which is being migrated to `PosteriorQueryPort`. |
| Rename churn (`latentBranches` → `publicAmbiguitySchema`) | Done in Phase 4 alongside the query port migration. One rename pass, not multiple. |

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
