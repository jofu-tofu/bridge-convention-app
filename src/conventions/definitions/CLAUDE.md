# Convention Definitions

Convention bundles that each implement a bridge bidding convention using the meaning pipeline. Each bundle is self-contained with deal constraints, meaning surfaces, fact extensions, convention modules (`ConventionModule`), and teaching metadata.

## Folder Structure

**Shared files** (at `definitions/` root):
- `system-registry.ts` — Bundle registry. Stores `BundleInput` definitions (no modules, no deal constraints). `getBundleInput(id)`, `listBundleInputs()`, `resolveBundle(input, sys)` (resolves modules + derives deal constraints for a SystemConfig), `specFromBundle(input, sys)`. Also contains `deriveSurfaceGroupsFromModules()` which auto-derives `SurfaceGroup`s from module state structure (each state entry with 2+ surfaces = a `mutually_exclusive` group). Pre-resolved bundle constants (`ntBundle`, `bergenBundle`, etc.) live in each bundle's own `config.ts`.
- `derive-deal-constraints.ts` — `deriveBundleDealConstraints(input, modules, sys)` — derives deal constraints from capability archetype + R1 surface clause analysis + complement negation. Called by `resolveBundle()`.
- `capability-constraint-registry.ts` — Maps each capability ID to a `CapabilityArchetype` defining opener constraints, default auction, allowed dealers, and practitioner turn/seat.
- `module-registry.ts` — Convention module registry.
- `capability-vocabulary.ts` — Stable host-attachment capability IDs (`CAP_OPENING_1NT`, `CAP_OPENING_MAJOR`, `CAP_OPENING_WEAK_TWO`, `CAP_OPPONENT_1NT`).
- `system-config.ts` — Merged from former `core/contracts/system-config.ts` + `core/contracts/base-system-vocabulary.ts`. Contains `BaseSystemId`, `BASE_SYSTEM_SAYC`, `BASE_SYSTEM_TWO_OVER_ONE`, `BASE_SYSTEM_ACOL`, `SystemConfig`, concrete system configs (`SAYC_SYSTEM_CONFIG`, etc.), `getSystemConfig()`, `AVAILABLE_BASE_SYSTEMS`.
- `system-fact-vocabulary.ts` — System-provided fact IDs that modules reference for system-dependent thresholds and properties. Modules import these IDs, never concrete system configs. Moved from former `core/contracts/`.

**Architectural rule:** Pedagogical content is auto-derived from module structure. Surface groups come from `deriveSurfaceGroupsFromModules()` (state entries with 2+ surfaces). Cross-module alternatives are handled by `truthSetCalls` in `teaching-resolution.ts`. No manual teaching tags, scope annotations, or derivation files needed. Modules are portable building blocks.

4 convention bundles: `nt-bundle/`, `bergen-bundle/`, `weak-twos-bundle/`, `dont-bundle/`. Each folder has a parallel set of modules:

| File | Purpose |
|------|---------|
| `config.ts` | Pre-resolved SAYC bundle constant via `resolveBundle(getBundleInput(...), SAYC_SYSTEM_CONFIG)` |
| `meaning-surfaces.ts` | `BidMeaning[]` definitions — the core bidding logic (single-module bundles). In multi-module bundles like nt-bundle, this is `composed-surfaces.ts` (cross-module composition re-exports). |
| `facts.ts` | `FactCatalogExtension`s for module-derived facts. Use factory helpers from `conventions/pipeline/fact-factory.ts` for common patterns. |
| `semantic-classes.ts` | Module-local semantic class constants (not in central registry) |
| `system-profile.ts` | `SystemProfile` for profile-based module activation |
| `explanation-catalog.ts` | `ExplanationCatalog` entries for teaching projections |
| `ids.ts` | `as const` typed ID constants for all module-derived fact IDs and meaning IDs (merged from former separate `fact-ids.ts` + `meaning-ids.ts` + `semantic-classes.ts`) |
| `module.ts` | *(dont-bundle, weak-twos-bundle only)* Single-module convention definition |
| `index.ts` | Barrel exports |
| `__tests__/` | Bundle-specific tests |


**`nt-bundle/`** — Bottom-up composition of Stayman + Jacoby Transfers + Smolen + Natural NT into a single 1NT response bundle. Each convention is a self-contained `ConventionModule` in `modules/`; modules are assembled in `module-registry.ts` from raw parts (facts/explanations from module files, LocalFsm/Rules from rules files).
- `modules/` — Convention modules (source of truth for all bidding logic):
  - `stayman.ts` — Stayman convention: facts + explanation entries. Factory returns `{ facts, explanationEntries }`.
  - `jacoby-transfers.ts` — Jacoby Transfers convention: facts + explanation entries. Factory returns `{ facts, explanationEntries }`.
  - `smolen.ts` — Smolen convention: facts + explanation entries. Factory returns `{ facts, explanationEntries }`.
  - `natural-nt.ts` — Natural NT responses: facts + explanation entries. Factory returns `{ facts, explanationEntries }`.
  - `natural-nt-rules.ts` — LocalFsm + StateEntry[] for natural-nt (phases: idle/opened/responded). No negotiationDelta needed (INITIAL_NEGOTIATION correct for opening/R1).
  - `stayman-rules.ts` — LocalFsm + StateEntry[] for Stayman (phases: idle/asked/shown-hearts/shown-spades/denied/inactive). Claims carry `negotiationDelta` for forcing/captain effects.
  - `jacoby-transfers-rules.ts` — LocalFsm + StateEntry[] for Jacoby Transfers (phases: idle/inactive/transferred-*/accepted-*/placing-*/invited-*). Claims carry `negotiationDelta` for forcing/fitAgreed/captain effects.
  - `smolen-rules.ts` — LocalFsm + StateEntry[] for Smolen (phases: idle/post-r1/placing-hearts/placing-spades/done). Claims carry `negotiationDelta` for game-forcing/fitAgreed/captain effects. Proof case: uses route pattern `subseq([inquire(majorSuit), deny(majorSuit)])` instead of hookTransitions.
- `config.ts` — Re-exports `ntBundle` from `system-registry.ts`.
- `sub-bundles.ts` — Stayman-only and Transfer-only pre-resolved SAYC sub-bundle constants via `resolveBundle(getBundleInput(...), SAYC_SYSTEM_CONFIG)`.
- `composed-surfaces.ts` — Cross-module composition re-exports. `RESPONDER_SURFACES` assembled from modules; individual arrays re-exported from owning modules.
- `semantic-classes.ts` — Re-export shim from modules.
- `explanation-catalog.ts` — Composed from all modules' explanation entries.

**`bergen-bundle/`** — Bergen Raises using the meaning pipeline with `$suit` binding parameterization for hearts and spades.
- `config.ts` — `ConventionBundle` with `meaningSurfaces` (13 groups), `factExtensions`, `modules`. `memberIds: ["bergen-raises"]`. `internal: true` (parity testing). Activation handled by `systemProfile: BERGEN_PROFILE`.
- `meaning-surfaces.ts` — `createBergenR1Surfaces(suit)` factory producing 5 surfaces per suit (splinter, game, limit, constructive, preemptive) parameterized by `$suit` bindings. Also includes R2–R4 surfaces.
- `facts.ts` — 1 `FactCatalogExtension`: `bergenFacts` for `module.bergen.hasMajorSupport` (hearts ≥ 4 or spades ≥ 4). Uses `buildExtension()` from fact-factory.
- `modules/bergen/bergen-rules.ts` — LocalFsm + StateEntry[] for Bergen (15 phases: idle/opened-H/S/after-constructive-H/S/after-limit-H/S/after-preemptive-H/S/after-game/after-signoff/after-game-try-H/S/r4/done). Includes stub 1H/1S opening surfaces with `MajorOpen` intent for phase transitions. Claims carry captain/fitAgreed kernel deltas.

See `docs/convention-authoring.md` for the full convention authoring guide: quick reference, completeness checklist, step-by-step instructions, file templates, authoring rules, common pitfalls, and per-convention edge cases.

## Test Organization

```
definitions/
  __tests__/
  nt-bundle/__tests__/
    explanation-catalog.test.ts          Explanation catalog entry tests
    sub-bundles.test.ts                  Sub-bundle composition tests
    system-profile.test.ts               Profile activation tests
  bergen-bundle/__tests__/
    config-factory-e2e.test.ts           Bundle config + factory integration
    golden-master.test.ts                Golden master snapshot tests
    surface-evaluation.test.ts           Surface clause evaluation tests
  weak-twos-bundle/__tests__/
    golden-master.test.ts                Golden master snapshot tests
    surface-evaluation.test.ts           Surface clause evaluation tests
  dont-bundle/__tests__/
    bundle-composition.test.ts           Bundle composition tests
    surface-evaluation.test.ts           R1 overcaller + reveal + relay response tests

__tests__/                          (at src/conventions/__tests__/)
  fixtures.test.ts                 Shared test helper tests
  fixtures.ts                      Shared helpers (hand, auctionFromBids, makeBiddingContext)
  infrastructure/
    structural-health.test.ts      Structural health checks
    module-conventions.test.ts     Module convention enforcement tests
  nt-bundle/
    commitment-integration.test.ts Commitment-level integration tests
    fact-evaluation.test.ts        Fact catalog evaluation tests
    machine-integration.test.ts    Pipeline integration tests
    profile-tests.test.ts          Profile-based activation tests
    snapshot-integration.test.ts   Snapshot-based regression tests
```

Bundle-local tests (`definitions/{name}-bundle/__tests__/`) test individual modules in isolation. Cross-cutting integration tests (`src/conventions/__tests__/nt-bundle/`) test the full pipeline end-to-end.

## Boundary Contract

Adding a new convention is a **definitions-only** change. The following directories must NOT be modified:

| Directory | Reason |
|-----------|--------|
| `src/engine/` | Bridge engine types/logic are convention-agnostic |
| `src/strategy/` | Strategy layer consumes bundles generically via `meaningBundleToStrategy()` |
| `src/conventions/teaching/` | Teaching system reads `ExplanationCatalog` and `SurfaceGroup[]` from bundles |
| `src/service/` | Service layer is convention-agnostic orchestration |
| `src/stores/` | Stores bind to the convention registry, not individual conventions |
| `src/components/` | UI renders from generic `ConventionConfig` and `DecisionSurfaceEntry[]` |
| `src/conventions/core/` | Pipeline infrastructure is convention-universal (see `core/CLAUDE.md`) |

If any of these need changes to support a new convention, the boundary has leaked and the core architecture should be fixed instead. ESLint import boundaries enforce this at build time -- a convention that compiles and passes lint has respected the contract.

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Staleness anchor:** This file assumes `nt-bundle/config.ts`, `bergen-bundle/config.ts`, `weak-twos-bundle/config.ts`, and `dont-bundle/config.ts` exist.
If any is missing, this file is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-03-03 | last-audited=2026-03-22 | version=10 | dir-commits-at-audit=unknown | tree-sig=dirs:6,files:90+,exts:ts:88+,md:1 -->
