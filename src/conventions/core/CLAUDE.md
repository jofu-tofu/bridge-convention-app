# Conventions Core

Infrastructure for the meaning-centric convention system: registry, meaning pipeline (surfaces → facts → evaluation → arbitration), conversation machine (FSM), runtime (profile activation, commitment extraction, snapshot building), witness system (deal generation).

## Module Graph

```
core/
  index.ts              Public API barrel — external consumers import from here (ESLint-enforced)
  context-factory.ts    createBiddingContext — canonical BiddingContext constructor
  registry.ts           registerConvention, getConvention, listConventions, clearRegistry
  surface-helpers.ts    Surface utility functions (bid(), suitToBidSuit(), otherMajorBidSuit())
  surface-builder.ts    createSurface() builder — simplified MeaningSurface construction with auto-derived clauseId/description/moduleId/modulePrecedence
  profile-builder.ts    Profile building utilities
  bundle/               Bundle registry (ConventionBundle CRUD)
    bundle-types.ts       ConventionBundle interface
    bundle-registry.ts    registerBundle, getBundle, findBundleForConvention
    composite-builder.ts  Composite bundle builder for multi-module bundles
    create-bundle.ts      Bundle factory from convention spec + base-track
  pipeline/             Meaning pipeline (surfaces → facts → evaluation → arbitration)
    fact-evaluator.ts     evaluateFacts() — 3-tier fact evaluation (primitive → bridge-derived → module-derived) + optional relational + posterior
    meaning-evaluator.ts  evaluateMeaningSurface(), evaluateAllSurfaces() — clause evaluation against facts
    meaning-arbitrator.ts arbitrateMeanings() — tiered selection (band → specificity → precedence), zipProposalsWithSurfaces()
    arbitration-helpers.ts evaluateProposal(), classifyIntoSets() — gate logic and truth/acceptable bucketing
    surface-composer.ts   composeSurfaces() — suppress/inject/remap transforms, mergeUpstreamProvenance()
    surface-adapter.ts    adaptMeaningSurface() — MeaningSurface ↔ DecisionSurfaceIR mapping
    encoder-resolver.ts   resolveEncoding() — direct/choice-set/frontier-step/relay-map encoders
    gate-order.ts         evaluateGates() — 4-gate sequence (semantic, obligation, encoder, legality)
    deal-constraint-evaluator.ts  evaluateDealConstraint() — fit-check, combined-hcp, custom constraints
    witness-generator.ts  resolveRole(), compileWitnessSpec(), generateWitnessSpec() — deal generation
    binding-resolver.ts   $suit binding resolution for parameterized surfaces
    clause-derivation.ts  deriveClauseId(), deriveClauseDescription(), fillClauseDefaults() — auto-derive clause metadata from factId/operator/value
    hand-fact-resolver.ts Hand fact resolution utilities
    priority-mapping.ts   Priority class mapping logic
    fact-utils.ts         Fact evaluation utility functions
    shared-fact-catalog.ts Shared fact catalog construction
    witness-constants.ts  Witness generation constants
  runtime/              Meaning-centric evaluation runtime (FSM + profiles + snapshots)
    machine-types.ts      ConversationMachine, MachineState, MachineTransition, MachineEffect, TransitionMatch
    machine-evaluator.ts  evaluateMachine() — generic FSM stepper (SCXML-inspired)
    machine-validation.ts 7 validators: validateMachine (structural), validateTransitionCompleteness (parent leaks), validateInterruptScoping (scope-only, local-target, coverage), validateRoleSafety (no opponent on call/any-bid), validateInterruptedStateWellFormedness (surfaceGroupId, competitionMode, pass handler), validateTerminalReachability, validateInterruptPathCompleteness (double + bid covered)
    machine-enumeration.ts Machine state enumeration for coverage analysis
    evaluation-runtime.ts evaluate() — two-phase orchestrator (public snapshot → decision surfaces)
    public-snapshot-builder.ts  buildSnapshotFromAuction() — Phase 1 output
    decision-surface-emitter.ts emitDecisionSurfaces() — Phase 2 output
    bundle-adapter.ts     bundleToRuntimeModules() — ConventionBundle → RuntimeModule[]
    commitment-extractor.ts extractCommitments() — auto-derives PublicConstraint[] (promises + entailed denials from closure policy)
    profile-activation.ts resolveActiveModules() — SystemProfileIR activation
    profile-validation.ts validateProfile() — semantic collision detection
    fact-compiler.ts      FactConstraintIR compilation from surface conditions
    coverage-spec-compiler.ts  Coverage spec compilation for CLI coverage runner
    types.ts              RuntimeModule, DecisionSurfaceEntry, RuntimeDiagnostic
  composition/          Module composition system (new: package-based composition)
    module-package.ts     ModulePackage — separates exports from runtime
    module-types.ts       ConventionModule type definition
    machine-fragment.ts   MachineFragment, FrontierDeclaration — module-local FSM contribution
    machine-assembler.ts  Machine assembly from fragments
    compose.ts            Module composition orchestration
    compile-from-packages.ts  Package → compiled module pipeline
    handoff.ts            HandoffSpec, HandoffTrigger — cross-module coupling
    interference-detector.ts  Interference pattern detection in composed machines
  modules/              Package-based module authoring (legacy adapter layer)
    module-package.ts     ModulePackage — separates exports (facts, surfaces, explanations) from runtime (activation, machine, handoffs)
    machine-fragment.ts   MachineFragment, FrontierDeclaration — module-local FSM contribution
    handoff.ts            HandoffSpec, HandoffTrigger — cross-module coupling via frontiers/capabilities
    surface-emitter.ts    SurfaceEmitterSpec — surface emission strategy (placeholder)
    legacy-adapter.ts     conventionBundleToPackages(), packagesToConventionBundle() — migration bridge
  profile/              Profile-centric composition
    types.ts              CompiledProfile, LegacyCompiledProfile, ResolvedModuleEntry
    compile-profile.ts    compileProfileFromBundle() — legacy adapter (bundle → LegacyCompiledProfile)
    compile-from-packages.ts  Package-based profile compilation
    machine-assembler.ts  Machine assembly from profile modules
    registry-merger.ts    Registry merging for multi-bundle profiles
  protocol/             Convention protocol system (see protocol/CLAUDE.md for details)
    boot-router.ts, bridge-schema.ts, coverage-enumeration.ts, protocol-lifecycle.ts,
    replay.ts, spec-assembler.ts, surface-stack.ts, types.ts
  witness/              Deal witness system
    witness-compiler.ts   compileWitnessSpec() — WitnessSpecIR → deal generation constraints
    witness-unsat.ts      detectUnsat() — satisfiability checking
```

## Convention-Universality Validation

Every subsystem here exists because simpler designs failed the convention-universality test. When modifying any abstraction in this directory, validate the change against all conventions using the meaning pipeline — not just the one motivating the change. If a change would require a convention-specific `if` branch in core infrastructure, the abstraction needs rethinking.

## Meaning Pipeline

**Entry point:** `meaningBundleToStrategy()` in `strategy/bidding/meaning-strategy.ts`.

**Pipeline flow:**
1. **Surface selection** — ConversationMachine produces `activeSurfaceGroupIds`, or `surfaceRouter` filters, or all surfaces used
2. **Surface composition** — `composeSurfaces()` applies suppress/inject/remap transforms
3. **Fact evaluation** — `evaluateFacts()` runs 3-tier evaluation: primitive (hand → fact), bridge-derived (fact → fact), module-derived (convention-specific)
4. **Surface evaluation** — `evaluateAllSurfaces()` checks each surface's clauses against facts → `MeaningProposal[]`
5. **Encoding resolution** — `resolveEncoding()` per-proposal for non-direct encoders
6. **Gate evaluation** — `evaluateGates()` 4-gate sequence per proposal
7. **Arbitration** — `arbitrateMeanings()` selects best proposal (band ranking → specificity → deduplication)

`clauseId`, `description`, `moduleId`, and `modulePrecedence` are optional on `MeaningSurface`. The `createSurface()` builder stamps them at definition time. The pipeline derives fallbacks for any surface not created via the builder (via `fillClauseDefaults()` and `?? 0` / `?? "unknown"` defaults).

**All pipeline stages are convention-agnostic.** They operate on generic types (`MeaningSurface`, `EvaluatedFacts`, `MeaningProposal`). Convention-specific data comes from `definitions/` via `ConventionBundle`.

## Conversation Machine (FSM)

`ConversationMachine` in `runtime/machine-types.ts` — hierarchical state machine tracking auction progression.

**Key types:**
- `MachineState` — `stateId`, `parentId` (hierarchy), `transitions`, `entryEffects`, `surfaceGroupId`, `transforms`
- `MachineTransition` — 5-kind `TransitionMatch`: `call`, `any-bid`, `pass`, `opponent-action`, `predicate`. `allowedRoles` field overrides default role matching (see role-safe matching below).
- `MachineEffect` — sets `forcingState`, `obligation`, `agreedStrain`, `competitionMode`, `captain`, `systemCapabilities`
- `MachineContext` — includes `interruptedFromStateId` capturing the source state when a scope interrupt fires (provenance for interrupted states)

**`evaluateMachine()`** walks auction entries with descendant-first transition preemption. **Role-safe matching:** `call` and `any-bid` transitions default to self+partner only — opponent bids are blocked unless `allowedRoles` explicitly includes opponents. Use `opponent-action` with `callType: "bid"` to match opponent bids. Output: `MachineEvalResult` with `currentStateId`, `activeSurfaceGroupIds`, `collectedTransforms`. Machine-over-profile precedence: profile = "what's installed", machine = "what's live".

**`areSamePartnership()`** is used by machine `seatRole` functions — defined in `engine/constants.ts` and imported by machine files.

## Runtime System

**Two-phase evaluation** via `evaluate()`:
1. Phase 1: Build `PublicSnapshot` from auction (with optional machine registers, commitments, beliefs)
2. Phase 2: Emit `DecisionSurfaceEntry[]` from active `RuntimeModule[]`

**Profile activation:** `resolveActiveModules()` evaluates `SystemProfileIR` attachments against auction patterns, capabilities, and public guards. Exclusivity groups enforce one-winner-per-group.

**Commitment extraction:** `extractCommitments()` matches auction calls against surfaces with `publicConsequences` to produce `PublicConstraint[]` (promises, entailed denials from closure policy).

## Test Architecture

**Convention-agnostic core tests** (`core/pipeline/__tests__/`, `core/runtime/__tests__/`) use:
- Inline synthetic data (factory functions with `Partial<T>` override pattern)
- Shared fixtures from `conventions/__tests__/infrastructure/_synthetic-fixtures.ts`
- **Zero imports from `conventions/definitions/`** — enforced by design

**Convention-specific integration tests** live in `conventions/__tests__/nt-bundle/`:
- `machine-integration.test.ts` — gold scenarios with real NT bundle
- `fact-evaluation.test.ts` — NT fact evaluation (stayman/transfer/response facts)
- `profile-tests.test.ts` — NT profile activation/validation
- `commitment-integration.test.ts` — NT commitment extraction
- `snapshot-integration.test.ts` — NT snapshot building

**Synthetic fixtures** (`_synthetic-fixtures.ts`) provide:
- `makeSurface()`, `makeHcpSurface()`, `makeBooleanSurface()` — MeaningSurface factories
- `buildFacts()`, `makeSyntheticFactCatalog()` — fact factories
- `buildMachine()`, `makeSyntheticMachine()` — ConversationMachine factories
- `makeSyntheticProfile()`, `makeSnapshot()` — profile/snapshot factories
- `makeRuntimeModule()`, `makeSyntheticBundle()` — runtime/bundle factories
- `makeArbitrationInput()`, `makeSuppressTransform()`, `makeInjectTransform()` — pipeline factories

**Boundary rule:** When adding new pipeline infrastructure, write tests using synthetic fixtures first. Convention-specific tests go in `conventions/__tests__/<bundle-name>/`.

## Known Gaps (Pattern 2-6 conventions)

| Gap | Impact | Blocks |
|-----|--------|--------|
| `mergeRegisters` is a no-op in `machine-evaluator.ts` | Can't track custom per-machine state (relay step count, controls shown) | Pattern 2, 5, 6 |
| No `AttachmentIR` for host-state attachment | Add-on modules can't attach to host states | Pattern 4 (Negative Doubles, Drury) |
| `ActivationTrace` always `[]` in meaning arbitrator | Provenance can't answer "which modules were live and why?" | Diagnostics |
| `evaluateFacts()` only evaluates `acting-hand` world | No `public` or `full-deal` world facts can be evaluated | Future scope |

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Add** an entry only if an agent would fail without knowing it, it is not obvious from
the code, and it belongs at this scope.

**Remove** any entry that fails the falsifiability test: if removing it would not change
how an agent acts here, remove it.

**Staleness anchor:** This file assumes `core/registry.ts` and `core/pipeline/meaning-evaluator.ts` exist. If they don't, this file is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-03-14 | last-audited=2026-03-18 | version=4 | dir-commits-at-audit=70 -->
