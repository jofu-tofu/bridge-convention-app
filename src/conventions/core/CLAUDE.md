# Conventions Core

Infrastructure for the meaning-centric convention system: registry, meaning pipeline (surfaces → facts → evaluation → arbitration), rule interpreter (ConventionModule-based surface selection), runtime (profile activation, commitment extraction, snapshot building), witness system (deal generation).

## Module Graph

```
core/
  index.ts              Public API barrel — external consumers import from here (ESLint-enforced)
  convention-module.ts  Unified ConventionModule interface — the single module type (moduleId, facts, explanationEntries, local: LocalFsm, rules: Rule[]). Exports `moduleSurfaces()` helper (extracts deduplicated surfaces from a module's rules). Re-exports `Claim` and `LocalFsm` from `rule-module.ts` for convenience.
  rule-module.ts        Pattern primitives for rule-based surface selection: `LocalFsm`, `Claim` (surface + negotiationDelta), `Rule`, `TurnRole`, `ObsPattern`, `RouteExpr`, `NegotiationExpr`, `PhaseTransition`. No `RuleModule` interface — modules use unified `ConventionModule`.
  context-factory.ts    createBiddingContext — canonical BiddingContext constructor
  registry.ts           registerConvention, getConvention, listConventions, clearRegistry
  surface-helpers.ts    Surface utility functions (bid(), suitToBidSuit(), otherMajorBidSuit())
  surface-builder.ts    createSurface() builder — simplified BidMeaning construction with auto-derived clauseId/description/moduleId. modulePrecedence defaults to 0.
  profile-builder.ts    Profile building utilities
  bundle/               Bundle registry (ConventionBundle CRUD)
    bundle-types.ts       ConventionBundle interface — `category` and `description` are required; includes `teaching`, `allowedDealers`, `modules` fields. `BundleInput` no longer has `ruleModules`; modules are resolved by `buildBundle()` from `memberIds` via module-registry.
    bundle-registry.ts    registerBundle (auto-derives and registers ConventionConfig), getBundle, findBundleForConvention
    composite-builder.ts  Composite bundle builder for multi-module bundles
    create-bundle.ts      Bundle factory from convention spec + base-track
  pipeline/             Meaning pipeline (surfaces → facts → evaluation → arbitration)
    fact-evaluator.ts     evaluateFacts() — 3-tier fact evaluation (primitive → bridge-derived → module-derived) + optional relational + posterior
    meaning-evaluator.ts  evaluateBidMeaning(), evaluateAllBidMeanings() — clause evaluation against facts
    meaning-arbitrator.ts arbitrateMeanings() — tiered selection (band → specificity → precedence), zipProposalsWithSurfaces()
    arbitration-helpers.ts evaluateProposal(), classifyIntoSets() — gate logic and truth/acceptable bucketing
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
    rule-interpreter.ts   collectMatchingClaims() — collects matching claims from ConventionModule[] against AuctionContext (replays local FSMs, checks turn/phase/kernel/route constraints). `ModuleClaimResult` returns `claims: readonly Claim[]` (where `Claim` has `surface` + `negotiationDelta`). `flattenSurfaces()` converts claims to surfaces. deriveTurnRole() maps nextSeat to opener/responder/opponent
    rule-enumeration.ts   enumerateRuleAtoms(), generateRuleCoverageManifest() — enumerates coverage atoms from ConventionModule[] for CLI commands. Atom ID format: moduleId/meaningId.
    clause-derivation.ts  deriveClauseId(), deriveClauseDescription(), fillClauseDefaults() — auto-derive clause metadata from factId/operator/value
    hand-fact-resolver.ts Hand fact resolution utilities
    fact-utils.ts         Fact evaluation utility functions
    shared-fact-catalog.ts Shared fact catalog construction
    fact-factory.ts       defineBooleanFact(), definePerSuitFacts(), defineHcpRangeFact(), buildExtension() — factory helpers for module-derived fact definitions
    witness-constants.ts  Witness generation constants
  runtime/              Meaning-centric evaluation runtime (profiles + snapshots)
    machine-types.ts      MachineRegisters re-export + ForcingState default. All FSM types (ConversationMachine, MachineState, etc.) removed — rule-based system replaced FSM.
    public-snapshot-builder.ts  buildSnapshotFromAuction() — Phase 1 output
    commitment-extractor.ts extractCommitments() — auto-derives PublicConstraint[] (promises + entailed denials from closure policy)
    profile-activation.ts resolveActiveModules() — SystemProfile activation
    fact-compiler.ts      FactConstraint compilation from surface conditions
    types.ts              RuntimeModule, DecisionSurfaceEntry, RuntimeDiagnostic
  protocol/             Convention protocol types (retained for ConventionSpec — narrowing from 20+ bundle fields to 4 strategy-facing fields)
    types.ts              ConventionSpec ({ id, name, modules, systemConfig? }), declarative expression types (BoolExpr, Ref, EffectSpec), SurfaceFragment — used by strategy and bootstrap layers
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
1. **Surface selection** — `collectMatchingClaims()` replays local FSMs per ConventionModule, checks turn/phase/kernel/route constraints, returns matching claims (converted to `BidMeaning[]` via `flattenSurfaces()`)
2. **Fact evaluation** — `evaluateFacts()` runs 3-tier evaluation: primitive (hand → fact), bridge-derived (fact → fact), module-derived (convention-specific)
3. **Surface evaluation** — `evaluateAllBidMeanings()` checks each surface's clauses against facts → `MeaningProposal[]`
4. **Encoding resolution** — `resolveEncoding()` per-proposal for non-direct encoders
5. **Gate evaluation** — `evaluateGates()` 4-gate sequence per proposal
6. **Arbitration** — `arbitrateMeanings()` selects best proposal (band ranking → specificity → deduplication), producing `PipelineResult` (not raw `ArbitrationResult`). Teaching sub-builders internally convert `PipelineResult` to legacy `ArbitrationResult`/`DecisionProvenance` types.

`clauseId`, `description`, and `moduleId` are optional on `BidMeaning`. The `createSurface()` builder stamps them at definition time. `modulePrecedence` defaults to 0. The pipeline derives fallbacks for any surface not created via the builder (via `fillClauseDefaults()` and `?? 0` / `?? "unknown"` defaults).

**All pipeline stages are convention-agnostic.** They operate on generic types (`BidMeaning`, `EvaluatedFacts`, `MeaningProposal`). Convention-specific data comes from `definitions/` via `ConventionBundle`.

## Rule Interpreter (Surface Selection)

All bundles use `ConventionModule`-based surface selection via `collectMatchingClaims()` in `rule-interpreter.ts`. The old `ConversationMachine` FSM infrastructure has been removed.

**How it works:** For each `ConventionModule`, the interpreter replays its local FSM phases (`advanceLocalFsm()`) against the auction history, then evaluates each rule's constraints (turn role, phase match, route pattern via `matchRoute()`, kernel state via `matchKernel()`) to produce matching `Claim[]` (each with `surface` + `negotiationDelta`). `flattenSurfaces()` extracts the `BidMeaning[]` from claims. `deriveTurnRole()` maps the next seat to opener/responder/opponent.

**Key files:**
- `rule-interpreter.ts` — `collectMatchingClaims()` entry point
- `local-fsm.ts` — `advanceLocalFsm()` per-module phase advancement
- `route-matcher.ts` — `matchRoute()` evaluates `RouteExpr` patterns against `CommittedStep[]`
- `negotiation-matcher.ts` — `matchKernel()` evaluates `NegotiationExpr` against `NegotiationState`

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

**Shared test factories** in `src/test-support/convention-factories.ts` and inline synthetic data in test files provide BidMeaning factories, fact factories, bundle factories, and pipeline fixtures.

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

<!-- context-layer: generated=2026-03-14 | last-audited=2026-03-22 | version=8 | dir-commits-at-audit=70 -->
