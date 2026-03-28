# Conventions Core

Infrastructure for the meaning-centric convention system: registry, rule interpreter (ConventionModule-based surface selection), runtime (profile activation, commitment extraction, snapshot building), witness system (deal generation).

> **Pipeline moved to `conventions/pipeline/`** — see `conventions/pipeline/CLAUDE.md`.

## Module Graph

```
core/
  index.ts              Public API barrel — external consumers import from here (ESLint-enforced)
  convention-module.ts  Unified ConventionModule interface — the single module type (moduleId, facts, explanationEntries, teaching?: ModuleTeaching, local: LocalFsm, states: StateEntry[]). `ModuleTeaching` carries strategic content orthogonal to structure (tradeoffs, principles, common mistakes). Exports `moduleSurfaces()` helper (extracts deduplicated surfaces from a module's states). Re-exports `ResolvedSurface`, `LocalFsm`, `StateEntry` from `rule-module.ts` for convenience.
  rule-module.ts        Pattern primitives for rule-based surface selection: `LocalFsm`, `StateEntry` (phase + turn + surfaces + negotiationDelta), `ResolvedSurface` (surface + negotiationDelta), `TurnRole`, `ObsPattern`, `RouteExpr`, `NegotiationExpr`, `PhaseTransition`. `StateEntry` groups surfaces by conversation state — activation context stays in `conventions/core/`, not on `BidMeaning` in `contracts/`.
  strategy-types.ts     Shared strategy contract types: BiddingStrategy, BidResult, BiddingContext, PlayStrategy, PlayContext, PlayResult, PosteriorSummary, PracticalRecommendation (moved from former strategy/bidding/bidding-types.ts, strategy/play/play-types.ts, strategy/recommendation-types.ts). Lives here because conventions/ imports these types heavily — placing them in service/ would create circular deps.

> Note: `BidAlert.teachingLabel` is intentionally plain `string` — alerts extract only `.name` from the internal `TeachingLabel`. Do not change it to `TeachingLabel`.

  context-factory.ts    createBiddingContext — canonical BiddingContext constructor
  registry.ts           registerConvention, getConvention, listConventions, clearRegistry
  shared-explanation-catalog.ts  Platform shared-fact explanation catalog — FactExplanationEntry for every shared fact (primitive, bridge-derived, posterior) and system fact. Exports PLATFORM_EXPLANATION_ENTRIES. Owns explanations for all IDs in `shared-fact-vocabulary.ts` and `system-fact-vocabulary.ts`. Module-owned facts (including template-form `$suit` IDs) are NOT covered here — they belong in per-module `explanation-catalog.ts` files.
  surface-helpers.ts    Surface utility functions (bid(), suitToBidSuit(), otherMajorBidSuit())
  surface-builder.ts    createSurface() builder — simplified BidMeaning construction with auto-derived clauseId/description/moduleId. modulePrecedence defaults to 0.
  authored-text.ts      Branded string types (BidName, BidSummary, ModuleDescription, ModulePurpose, etc.), TeachingLabel interface, and validating factory functions for all authored text fields. Exported via conventions barrel.
  profile-builder.ts    Profile building utilities
  bundle/               Bundle registry (ConventionBundle CRUD)
    bundle-types.ts       ConventionBundle interface — `category` and `description` are required; includes `teaching`, `allowedDealers`, `modules` fields. `BundleInput` no longer has `ruleModules`; modules are resolved by `buildBundle()` from `memberIds` via module-registry.
    bundle-registry.ts    registerBundle (auto-derives and registers ConventionConfig), getBundle, findBundleForConvention
    composite-builder.ts  Composite bundle builder for multi-module bundles
    create-bundle.ts      Bundle factory from convention spec + base-track
  runtime/              Meaning-centric evaluation runtime (profiles + snapshots)
    machine-types.ts      MachineRegisters re-export + ForcingState default. All FSM types (ConversationMachine, MachineState, etc.) removed — rule-based system replaced FSM.
    public-snapshot-builder.ts  buildSnapshotFromAuction() — Phase 1 output
    commitment-extractor.ts extractCommitments() — auto-derives PublicConstraint[] (promises from public clauses)
    profile-activation.ts resolveActiveModules() — SystemProfile activation
    fact-compiler.ts      FactConstraint compilation from surface conditions
    types.ts              RuntimeModule, DecisionSurfaceEntry, RuntimeDiagnostic
  protocol/             Convention protocol types (retained for ConventionSpec — narrowing from 20+ bundle fields to 4 strategy-facing fields)
    types.ts              ConventionSpec ({ id, name, modules, systemConfig? }), declarative expression types (BoolExpr, Ref, EffectSpec), SurfaceFragment — used by strategy and service layers
  witness/              Deal witness system
    deal-spec-compiler.ts   compileDealSpec() — DealSpec → deal generation constraints
    deal-spec-unsat.ts      detectUnsat() — satisfiability checking
```

## Absorbed Types (from former core/contracts/)

The following types were absorbed from the dissolved `src/core/contracts/` directory:
- `fact-catalog.ts` — FactCatalog, FactDefinition, FactLayer, FactComposition (merged with fact-helpers)
- `agreement-module.ts` — AgreementModule predicates (merged with existing predicates)
- `explanation-catalog.ts` — ExplanationCatalog, FactExplanationEntry, MeaningExplanationEntry
- `fact-layer.ts` — FactLayer enum, fact evaluation types
- `shared-fact-vocabulary.ts` — shared fact ID constants (primitive, bridge-derived)
- `shared-facts.ts` — shared fact definitions
- `module-surface.ts` — BidMeaning, FactConstraint, and surface-related types
- `committed-step.ts` — CommittedStep, NegotiationState, MachineRegisters
- `convention-types.ts` — ConventionConfig, ConventionBundle, and convention DTOs

## Convention-Universality Validation

Every subsystem here exists because simpler designs failed the convention-universality test. When modifying any abstraction in this directory, validate the change against all conventions using the meaning pipeline — not just the one motivating the change. If a change would require a convention-specific `if` branch in core infrastructure, the abstraction needs rethinking.

**Route matching vs phase transitions:** Route matching (`matchRoute()`) supports `ObsPattern.actor` for actor-aware filtering. Phase transitions (`advanceLocalFsm()`) are actor-agnostic by design — they fire on observation shape regardless of who bid. Do not add actor matching to phase transitions.

## Runtime System

**Snapshot building** via `buildSnapshotFromAuction()`: builds `PublicSnapshot` from auction (with optional machine registers, commitments, beliefs).

**Profile activation:** `resolveActiveModules()` evaluates `SystemProfile` attachments against auction patterns, capabilities, and public guards.

**Commitment extraction:** `extractCommitments()` matches auction calls against surfaces with `publicConsequences` to produce `PublicConstraint[]` (promises from public clauses).

## Test Architecture

**Convention-agnostic core tests** (`core/runtime/__tests__/`) use:
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

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Add** an entry only if an agent would fail without knowing it, it is not obvious from
the code, and it belongs at this scope.

**Remove** any entry that fails the falsifiability test: if removing it would not change
how an agent acts here, remove it.

**Staleness anchor:** This file assumes `core/registry.ts` exists. If it doesn't, this file is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-03-14 | last-audited=2026-03-23 | version=10 | dir-commits-at-audit=71 -->
