# Conventions Core

Infrastructure for the meaning-centric convention system: registry, meaning pipeline (surfaces → facts → evaluation → arbitration), conversation machine (FSM), runtime (profile activation, commitment extraction, snapshot building), witness system (deal generation).

## Module Graph

```
core/
  index.ts              Public API barrel — external consumers import from here (ESLint-enforced)
  convention-module.ts  ConventionModule interface — formal contract for self-contained convention modules (surfaces, facts, FSM states, explanations). Also exports ModuleProvider — minimal shared contract (moduleId, entrySurfaces, surfaceGroups, facts, explanationEntries) that both ConventionModule and rule-only modules conform to.
  rule-module.ts        RuleModule interface — declarative convention module for rule-based surface selection (ObsPattern, RouteExpr, NegotiationExpr, PhaseTransition, Rule). Claims carry optional `negotiationDelta?: NegotiationDelta` for kernel threading. All bundles use rule-only path.
  context-factory.ts    createBiddingContext — canonical BiddingContext constructor
  registry.ts           registerConvention, getConvention, listConventions, clearRegistry
  surface-helpers.ts    Surface utility functions (bid(), suitToBidSuit(), otherMajorBidSuit())
  surface-builder.ts    createSurface() builder — simplified BidMeaning construction with auto-derived clauseId/description/moduleId. modulePrecedence defaults to 0.
  profile-builder.ts    Profile building utilities
  bundle/               Bundle registry (ConventionBundle CRUD)
    bundle-types.ts       ConventionBundle interface — `category` and `description` are required; includes `teaching`, `allowedDealers`, `ruleModules` fields
    bundle-registry.ts    registerBundle (auto-derives and registers ConventionConfig), getBundle, findBundleForConvention
    composite-builder.ts  Composite bundle builder for multi-module bundles
    create-bundle.ts      Bundle factory from convention spec + base-track
  pipeline/             Meaning pipeline (surfaces → facts → evaluation → arbitration)
    fact-evaluator.ts     evaluateFacts() — 3-tier fact evaluation (primitive → bridge-derived → module-derived) + optional relational + posterior
    meaning-evaluator.ts  evaluateBidMeaning(), evaluateAllBidMeanings() — clause evaluation against facts
    meaning-arbitrator.ts arbitrateMeanings() — tiered selection (band → specificity → precedence), zipProposalsWithSurfaces()
    arbitration-helpers.ts evaluateProposal(), classifyIntoSets() — gate logic and truth/acceptable bucketing
    surface-adapter.ts    adaptMeaningSurface() — BidMeaning ↔ DecisionSurface mapping
    encoder-resolver.ts   resolveEncoding() — direct/choice-set/frontier-step/relay-map encoders
    gate-order.ts         evaluateGates() — 4-gate sequence (semantic, obligation, encoder, legality)
    deal-constraint-evaluator.ts  evaluateDealConstraint() — fit-check, combined-hcp, custom constraints
    deal-spec-generator.ts  resolveRole(), compileDealSpec(), generateDealSpec() — deal generation
    binding-resolver.ts   $suit binding resolution for parameterized surfaces
    normalize-intent.ts   normalizeIntent() — sourceIntent → BidAction[] translation (migration bridge for continuation composition)
    negotiation-extractor.ts   extractKernelState() — MachineRegisters → NegotiationState mapping; computeKernelDelta() — diff between kernel states
    committed-step-builder.ts  buildCommittedStep() — constructs one CommittedStep from arbitration result + registers + normalizeIntent
    observation-log-builder.ts  buildObservationLog() — single-pass O(n) construction of CommittedStep[] from per-step data, threading kernel state
    route-matcher.ts      matchRoute() — evaluates RouteExpr patterns (subseq, last, contains, and/or/not) against CommittedStep log; matchObs() — single observation pattern matching
    negotiation-matcher.ts     matchKernel() — evaluates NegotiationExpr predicates (fit, forcing, captain, competition, combinators) against NegotiationState
    local-fsm.ts          advanceLocalFsm() — advances a module's local phase based on CommittedStep observations
    rule-interpreter.ts   collectMatchingClaims() — collects matching BidMeaning[] from RuleModule[] against AuctionContext (replays local FSMs, checks turn/phase/kernel/route constraints). deriveTurnRole() maps nextSeat to opener/responder/opponent
    rule-enumeration.ts   enumerateRuleAtoms(), generateRuleCoverageManifest() — enumerates coverage atoms from RuleModule[] for CLI commands. Atom ID format: moduleId/meaningId.
    clause-derivation.ts  deriveClauseId(), deriveClauseDescription(), fillClauseDefaults() — auto-derive clause metadata from factId/operator/value
    hand-fact-resolver.ts Hand fact resolution utilities
    priority-mapping.ts   Priority class mapping logic
    fact-utils.ts         Fact evaluation utility functions
    shared-fact-catalog.ts Shared fact catalog construction
    witness-constants.ts  Witness generation constants
  runtime/              Meaning-centric evaluation runtime (profiles + snapshots)
    machine-types.ts      ConversationMachine, MachineState, MachineTransition, MachineEffect, TransitionMatch
    public-snapshot-builder.ts  buildSnapshotFromAuction() — Phase 1 output
    commitment-extractor.ts extractCommitments() — auto-derives PublicConstraint[] (promises + entailed denials from closure policy)
    profile-activation.ts resolveActiveModules() — SystemProfile activation
    fact-compiler.ts      FactConstraint compilation from surface conditions
    types.ts              RuntimeModule, DecisionSurfaceEntry, RuntimeDiagnostic
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
  protocol/             Convention protocol types (retained for ConventionSpec)
    types.ts              ConventionSpec, ModuleSpec, FrameStateSpec, etc. — used by strategy and bootstrap layers
  witness/              Deal witness system
    deal-spec-compiler.ts   compileDealSpec() — DealSpec → deal generation constraints
    deal-spec-unsat.ts      detectUnsat() — satisfiability checking
```

## Convention-Universality Validation

Every subsystem here exists because simpler designs failed the convention-universality test. When modifying any abstraction in this directory, validate the change against all conventions using the meaning pipeline — not just the one motivating the change. If a change would require a convention-specific `if` branch in core infrastructure, the abstraction needs rethinking.

**Route matching vs phase transitions:** Route matching (`matchRoute()`) supports `ObsPattern.actor` for actor-aware filtering. Phase transitions (`advanceLocalFsm()`) are actor-agnostic by design — they fire on observation shape regardless of who bid. Do not add actor matching to phase transitions.

## Meaning Pipeline

**Entry point:** `meaningBundleToStrategy()` in `strategy/bidding/meaning-strategy.ts`.

**Pipeline flow:**
1. **Surface selection** — ConversationMachine produces `activeSurfaceGroupIds`, or `surfaceRouter` filters, or all surfaces used
2. **Fact evaluation** — `evaluateFacts()` runs 3-tier evaluation: primitive (hand → fact), bridge-derived (fact → fact), module-derived (convention-specific)
3. **Surface evaluation** — `evaluateAllBidMeanings()` checks each surface's clauses against facts → `MeaningProposal[]`
4. **Encoding resolution** — `resolveEncoding()` per-proposal for non-direct encoders
5. **Gate evaluation** — `evaluateGates()` 4-gate sequence per proposal
6. **Arbitration** — `arbitrateMeanings()` selects best proposal (band ranking → specificity → deduplication)

`clauseId`, `description`, and `moduleId` are optional on `BidMeaning`. The `createSurface()` builder stamps them at definition time. `modulePrecedence` defaults to 0. The pipeline derives fallbacks for any surface not created via the builder (via `fillClauseDefaults()` and `?? 0` / `?? "unknown"` defaults).

**All pipeline stages are convention-agnostic.** They operate on generic types (`BidMeaning`, `EvaluatedFacts`, `MeaningProposal`). Convention-specific data comes from `definitions/` via `ConventionBundle`.

## Conversation Machine (FSM)

`ConversationMachine` in `runtime/machine-types.ts` — hierarchical state machine tracking auction progression.

**Key types:**
- `MachineState` — `stateId`, `parentId` (hierarchy), `transitions`, `entryEffects`, `surfaceGroupId`
- `MachineTransition` — 5-kind `TransitionMatch`: `call`, `any-bid`, `pass`, `opponent-action`, `predicate`. `allowedRoles` field overrides default role matching (see role-safe matching below).
- `MachineEffect` — sets `forcingState`, `obligation`, `agreedStrain`, `competitionMode`, `captain`, `systemCapabilities`
- `MachineContext` — includes `interruptedFromStateId` capturing the source state when a scope interrupt fires (provenance for interrupted states)

**`evaluateMachine()`** walks auction entries with descendant-first transition preemption. **Role-safe matching:** `call` and `any-bid` transitions default to self+partner only — opponent bids are blocked unless `allowedRoles` explicitly includes opponents. Use `opponent-action` with `callType: "bid"` to match opponent bids. Output: `MachineEvalResult` with `currentStateId`, `activeSurfaceGroupIds`. Machine-over-profile precedence: profile = "what's installed", machine = "what's live".

**`areSamePartnership()`** is used by machine `seatRole` functions — defined in `engine/constants.ts` and imported by machine files.

## Runtime System

**Snapshot building** via `buildSnapshotFromAuction()`: builds `PublicSnapshot` from auction (with optional machine registers, commitments, beliefs).

**Profile activation:** `resolveActiveModules()` evaluates `SystemProfile` attachments against auction patterns, capabilities, and public guards. Exclusivity groups enforce one-winner-per-group.

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
- `makeSurface()`, `makeHcpSurface()`, `makeBooleanSurface()` — BidMeaning factories
- `buildFacts()`, `makeSyntheticFactCatalog()` — fact factories
- `buildMachine()`, `makeSyntheticMachine()` — ConversationMachine factories
- `makeSyntheticProfile()`, `makeSnapshot()` — profile/snapshot factories
- `makeRuntimeModule()`, `makeSyntheticBundle()` — runtime/bundle factories
- `makeArbitrationInput()` — pipeline factories

**Boundary rule:** When adding new pipeline infrastructure, write tests using synthetic fixtures first. Convention-specific tests go in `conventions/__tests__/<bundle-name>/`.

## Known Gaps (Pattern 2-6 conventions)

| Gap | Impact | Blocks |
|-----|--------|--------|
| No `Attachment` for host-state attachment | Add-on modules can't attach to host states | Pattern 4 (Negative Doubles, Drury) |
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

<!-- context-layer: generated=2026-03-14 | last-audited=2026-03-21 | version=7 | dir-commits-at-audit=70 -->
