# Convention Definitions

Convention bundles that each implement a bridge bidding convention using the meaning pipeline. Each bundle is self-contained with deal constraints, meaning surfaces, fact extensions, convention modules (`ConventionModule`), and teaching metadata.

## Folder Structure

**Shared files** (at `definitions/` root):
- `teaching-vocabulary.ts` — 6 general-purpose tags (`SAME_FAMILY`, `STRONGER_THAN`, `CONTINUATION_OF`, `NEAR_MISS_OF`, `FALLBACK_OF`, `ALTERNATIVES`). Modules annotate surfaces with these + a scope string to express any pedagogical relationship.
- `derive-cross-module.ts` — `deriveTeachingContent(modules)` — derives all pedagogical relations, alternatives, and intent families from `teachingTags` on surfaces. Groups by `(tagId, scope)`. Supports ordinal chains for strength progressions. Called by `aggregateModuleContent()` in `system-registry.ts`.
- `surface-group-vocabulary.ts` — *(Removed. Cross-module surface groupIds are now defined locally in modules.)*
- `pedagogical-scope-vocabulary.ts` — Type-safe scope constants (branded `PedagogicalScope` type) for `teachingTags` scopes. Replaces free-form strings.
- `system-registry.ts` — Bundle registry. Stores `BundleInput` definitions (no modules). `getBundleInput(id)`, `listBundleInputs()`, `resolveBundle(input, sys)` (resolves modules for a SystemConfig), `specFromBundle(input, sys)`. Pre-resolved bundle constants (`ntBundle`, `bergenBundle`, etc.) live in each bundle's own `config.ts`.
- `module-registry.ts` — Convention module registry.
- `capability-vocabulary.ts` — Stable host-attachment capability IDs (`CAP_OPENING_1NT`, `CAP_OPENING_MAJOR`, `CAP_OPENING_WEAK_TWO`, `CAP_OPPONENT_1NT`).
- `system-fact-vocabulary.ts` (in `core/contracts/`) — System-provided fact IDs that modules reference for system-dependent thresholds and properties. Modules import these IDs, never concrete system configs.

**Architectural rule:** ALL pedagogical content (relations, alternatives, intent families) — both intra-module and cross-module — is derived from `teachingTags` on surfaces. `ConventionModule` has no `teachingRelations`, `alternatives`, or `intentFamilies` fields. Modules are portable building blocks: compose any set into a bundle and pedagogical content derives automatically. Do not create standalone `pedagogical-relations.ts` or `alternatives.ts` files.

4 convention bundles: `nt-bundle/`, `bergen-bundle/`, `weak-twos-bundle/`, `dont-bundle/`. Each folder has a parallel set of modules:

| File | Purpose |
|------|---------|
| `config.ts` | Pre-resolved SAYC bundle constant via `resolveBundle(getBundleInput(...), SAYC_SYSTEM_CONFIG)` |
| `meaning-surfaces.ts` | `BidMeaning[]` definitions — the core bidding logic (single-module bundles). In multi-module bundles like nt-bundle, this is `composed-surfaces.ts` (cross-module composition re-exports). |
| `facts.ts` | `FactCatalogExtension`s for module-derived facts. Use factory helpers from `core/pipeline/fact-factory.ts` for common patterns. |
| `semantic-classes.ts` | Module-local semantic class constants (not in central registry) |
| `system-profile.ts` | `SystemProfile` for profile-based module activation |
| `explanation-catalog.ts` | `ExplanationCatalog` entries for teaching projections |
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

## Convention Quick Reference

- **NT Bundle (1NT Responses):** Stayman (2C ask for 4-card majors) + Jacoby Transfers (2D→hearts, 2H→spades) + Smolen (3H/3S game-forcing after 2D denial with 5-4 majors). 35 meaning surfaces, 4 fact extensions, 15-state hierarchical FSM with per-module scope states (`stayman-scope`, `transfers-scope`, `smolen-scope`) for scoped opponent interrupts + 5-state Smolen submachine (first real convention to use submachine invocation with guard-based routing). Deal constraints: opener 15–17 HCP balanced, responder 6+ HCP with 4+ in any major.
- **Bergen Bundle (Bergen Raises):** Responder raises after 1M opening. Standard Bergen variant (3C=constructive 7–10, 3D=limit 10–12, 3M=preemptive 0–6, splinter 12+). `$suit` binding factory for DRY heart/spade parameterization. Deal constraints: opener 12–21 HCP with 5+ major, responder 0+ HCP with 4+ major.
- **Weak Two Bundle:** Weak Two openings (2D/2H/2S) with Ogust responses. `modules/weak-twos/weak-twos-rules.ts` — LocalFsm + StateEntry[] (11 phases: idle/opened-H/S/D/ogust-asked-H/S/D/post-ogust-H/S/D/done). Ogust ask carries `forcing: "one-round"` kernel delta. Deal constraints: opener 5–10 HCP with 6+ in a suit, responder 12+ HCP.
- **DONT Bundle (Disturbing Opponent's No Trump):** Competitive overcalls after opponent's 1NT. `modules/dont/dont-rules.ts` — LocalFsm + StateEntry[] (11 phases: idle/r1/after-2h/2d/2c/2s/double/wait-reveal/wait-2d-relay/wait-2c-relay/done). **No `match.turn`** — uses phase + route scoping because `deriveTurnRole()` classifies the overcaller as "opponent". Includes stub 1NT opening surface for phase transitions. 9 surface groups, 24 surfaces, 21 facts. Deal constraints: East 15–17 HCP (NT opener), South 8–15 HCP with 5+ in any suit.

## Convention Bundle Completeness Checklist

Every convention bundle must satisfy all items before being considered complete:

1. **`meaningSurfaces` with grouped surfaces.** At least one surface group with `groupId` and `surfaces` array. Every surface needs `meaningId`, `encoding`, `clauses` (with `factId`, `operator`, `value`), and `ranking` (`band`, `declarationOrder`). `modulePrecedence` defaults to 0 — do NOT set it on surfaces. **Specificity is pipeline-derived from the communicative dimensions of the surface's clauses** — do NOT set it on surfaces. All `FactDefinition` objects must declare `constrainsDimensions` (required field).
2. **`factExtensions` for module-derived facts.** Any fact referenced in surface clauses that isn't in the shared `BRIDGE_DERIVED_FACTS` must be defined in a `FactCatalogExtension` in `facts.ts`. Evaluators must be pure functions of hand/auction state. Use factory helpers (`defineBooleanFact`, `definePerSuitFacts`, `defineHcpRangeFact`, `buildExtension`) from `core/pipeline/fact-factory.ts` for common patterns.
3. **`modules` for surface selection.** `ConventionModule[]` with `local` (LocalFsm: phases + phase transitions) and `states` (StateEntry[]: phase + turn role + optional route/kernel constraints + surfaces). The rule interpreter (`collectMatchingClaims()`) handles surface selection. Modules are resolved by `buildBundle()` from `memberIds` via module-registry.
4. **`systemProfile` for activation.** Profile-based module activation via `SystemProfile`.
6. **`dealConstraints` with HCP ranges and shape requirements.** Per-seat `minHcp`/`maxHcp` and `minLengthAny`/`maxLength` as appropriate.
7. **`category` and `description` are required** on `ConventionBundle`. `registerBundle()` auto-derives `ConventionConfig` — no separate wrapper needed.
8. **`explanationCatalog` entries.** Template-keyed explanations for teaching projections. Each entry links a `factId` to display text and contrastive templates.
9. **`systemProfile` IR.** Profile-based module activation metadata.
10. **`teachingTags` on surfaces.** All surfaces participating in pedagogical relations or grading alternatives must have `teachingTags` annotations using the 6 general tags from `teaching-vocabulary.ts`. No separate `pedagogical-relations.ts` or `alternatives.ts` files.
12. **`semantic-classes.ts` constants.** Module-local semantic class strings. Do not add to central registry — keep them co-located with the surfaces that reference them.

## File Templates

See `docs/convention-templates.md` for skeleton code templates (config.ts, meaning-surfaces.ts, facts.ts, rules.ts, semantic-classes.ts, system-profile.ts, explanation-catalog.ts).

## Adding a New Convention Bundle

1. Create `definitions/{name}-bundle/` folder with the modules listed in the Folder Structure table above.
2. Define `BidMeaning[]` in `meaning-surfaces.ts`. Each surface needs `meaningId`, `encoding` (the `Call`), `clauses` (fact-based conditions), `semanticClass`, and `ranking`. Use the factory pattern with `$suit` bindings when parameterizing across suits.
3. Define `FactCatalogExtension`s in `facts.ts` for any module-specific facts referenced by surface clauses. Use factory helpers from `core/pipeline/fact-factory.ts` for common patterns.
4. Define module-local semantic class constants in `semantic-classes.ts`.
5. Define `LocalFsm` and `StateEntry[]` in `{name}-rules.ts`. Declare phases, phase transitions (observation patterns that advance the local FSM), and state entries (phase + turn + optional route/kernel constraints + surfaces). The module-registry assembles these into a `ConventionModule`.
6. Define `SystemProfile` in `system-profile.ts`.
7. Populate `ExplanationCatalog` in `explanation-catalog.ts` with template-keyed explanations.
8. Add `teachingTags` to surfaces using the 6 general tags from `teaching-vocabulary.ts`. Use scope strings to group related surfaces.
9. Wire `config.ts` as a thin re-export from `system-registry.ts`.
10. Create `index.ts` barrel with re-exports.
11. Register the module in `module-registry.ts` and define the bundle in `system-registry.ts` via `buildBundle()`.
12. Create `__tests__/` with at minimum: surface evaluation tests and config/factory E2E tests.
13. **Verify:** `npm run lint` (boundary violations), `npm run test:run` (all tests), `npx tsx src/cli/main.ts selftest` (pipeline selftest).
14. Run the completeness checklist above before considering the bundle complete.

## Authoring Rules

- **Use `createSurface()` for all new surfaces.** Import from `conventions/core/surface-builder.ts` with a `ModuleContext`. The builder derives `clauseId` and `description` automatically. Provide `description` only when it adds parenthetical rationale beyond the mechanical constraint (test: contains `(`). `moduleId` is injected from `ModuleContext`. `modulePrecedence` defaults to 0 — not hand-authored.
- **Modules are portable.** A module must work in any bundle. Never import from other modules. Never reference foreign surface IDs. Use `teachingTags` with shared vocabulary scopes for cross-module relationships.
- **Adding a module must not edit existing modules.** If your new module needs to relate to existing ones (same-family, near-miss, etc.), use shared scope strings in `teachingTags`. The derivation function handles the wiring.
- **Cross-module groupIds must use shared constants.** Never use string literals for groupIds that another module also references.
- **Use scope constants from `pedagogical-scope-vocabulary.ts`** for `teachingTags` scopes. The branded `PedagogicalScope` type catches typos at compile time. Do not use free-form strings.
- **Generalize before specializing.** When a convention needs a capability that doesn't exist in `core/`, design the solution to work for any convention — not just yours. If the abstraction only makes sense for one convention, it belongs in `definitions/{name}-bundle/`, not in `core/`.
- **System-fact-gated surfaces for cross-system modules.** When a bid has different meanings in different systems (e.g., jump shift: strong in SAYC, weak in 2/1), author surfaces for ALL meanings in the same module. Gate each with a system fact clause (`{ factId: SYSTEM_SUIT_RESPONSE_IS_GAME_FORCING, operator: "eq", value: true/false }`). The pipeline evaluates all surfaces and selects only those matching the active `SystemConfig`. Never create system-specific modules or branch on `systemId` in module code.

## Common Pitfalls

1. **Surface clause `factId` not in catalog.** Every `factId` referenced in a surface clause must either be in the shared `BRIDGE_DERIVED_FACTS` or defined in a `FactCatalogExtension` in `facts.ts`. Missing facts cause clauses to fail closed (treated as not satisfied).

2. **Reusing `meaningId` across surfaces.** Each surface must have a unique `meaningId`. Duplicates cause unpredictable surface selection.

3. **`$suit` binding errors in parameterized surfaces.** When using the factory pattern (like Bergen's `createBergenR1Surfaces(suit)`), clauses must reference the binding variable (e.g., `hand.suitLength.$suit`) and the surface must include a `bindings: { suit }` field. Missing bindings cause clause evaluation to fail.

4. **Missing `category` or `description` on bundle.** Both are required on `ConventionBundle`. `registerBundle()` auto-derives `ConventionConfig` from these fields.

5. **Hand-authoring clauseId/description in surfaces.** These are auto-derived by the builder and pipeline. Only provide `description` when adding convention-specific rationale in parentheses.

6. **Semantic class IDs are module-local.** Define them in `{bundle}/semantic-classes.ts`, not in the central `BRIDGE_SEMANTIC_CLASSES`. Adding a convention does NOT require editing the central registry.

7. **Phase transition vs route matching confusion.** Phase transitions (`phaseTransitions` in LocalFsm) advance the local FSM state — they are actor-agnostic and fire on observation shape. Route matching (`RouteExpr` in rules) filters which surfaces are active — it supports actor-aware patterns. Do not conflate the two.

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
| `src/teaching/` | Teaching system reads `ExplanationCatalog` and `TeachingRelation[]` from bundles |
| `src/service/` | Service layer is convention-agnostic orchestration |
| `src/stores/` | Stores bind to the convention registry, not individual conventions |
| `src/components/` | UI renders from generic `ConventionConfig` and `DecisionSurfaceEntry[]` |
| `src/conventions/core/` | Pipeline infrastructure is convention-universal (see `core/CLAUDE.md`) |
| `src/core/contracts/` | Shared contracts are stable; adding a new fact type is a separate task |

If any of these need changes to support a new convention, the boundary has leaked and the core architecture should be fixed instead. ESLint import boundaries enforce this at build time -- a convention that compiles and passes lint has respected the contract.

## Design Decisions

- **Why ConventionConfig is kept as a separate DTO:** UI/stores should consume minimal types, not full pipeline bundles with 20+ fields. ConventionConfig is the stable UI contract — auto-derived by `registerBundle()`.
- **Why explicit registration over auto-discovery:** Explicit `registerBundle()` calls are traceable and debuggable. Auto-discovery adds implicit ordering and makes registration non-obvious.
- **Why two layers (Bundle → Config) not three:** BiddingSystem added no fields or behavior that ConventionBundle didn't already provide. The indirection created wiring fragility without architectural benefit.
- **Why PedagogicalScope lives in definitions, not contracts:** Scope strings are convention-specific vocabulary. Contracts contains only convention-agnostic types. Enforcement via scope constants catches errors at authoring time without polluting the contracts tier.

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Staleness anchor:** This file assumes `nt-bundle/config.ts`, `bergen-bundle/config.ts`, `weak-twos-bundle/config.ts`, and `dont-bundle/config.ts` exist.
If any is missing, this file is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-03-03 | last-audited=2026-03-22 | version=10 | dir-commits-at-audit=unknown | tree-sig=dirs:6,files:90+,exts:ts:88+,md:1 -->
