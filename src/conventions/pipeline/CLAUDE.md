# Pipeline

Meaning pipeline: surfaces → facts → evaluation → arbitration → encoding. Convention-agnostic infrastructure that transforms `BidMeaning[]` surfaces and hand facts into a ranked `PipelineResult`. All stages operate on generic types; convention-specific data flows in from `definitions/` via `ConventionBundle`.

## Module Graph

| File | Role |
| ---- | ---- |
| `run-pipeline.ts` | `runPipeline()` entry point — orchestrates the 4-step core pipeline (evaluate facts → evaluate meanings → arbitrate). Extracted from `strategy/`. Caller handles surface selection before and result mapping after. |
| `pipeline-types.ts` | `PipelineResult` (complete pipeline output with per-surface carriers and cross-surface provenance), `PipelineCarrier` (surface + traces through entire pipeline), `ArbitrationResult` (post-gate/dedup arbitration), `EncodedProposal` (meaning after call assignment), `EliminationRecord` (gate attribution for eliminated candidates) |
| `strategy-evaluation.ts` | `StrategyEvaluation` (unified snapshot of all pipeline outputs from a `suggest()` call), `MachineDebugSnapshot` (lightweight DTO for convention machine state), `ConventionStrategy` |
| `alert.ts` | `resolveAlert()` (derives alertability from `disclosure` field), `isAlertable()`. Natural disclosure produces no alert; everything else defaults to conventional. Constraints carry `isPublic` on `FactConstraint` itself — no separate publicConstraints pipeline. |
| `fact-evaluator.ts` | `evaluateFacts()` — 3-tier evaluation: primitive (hand → fact), bridge-derived (fact → fact), module-derived (convention-specific). Optional relational + posterior tiers. `RelationalFactContext` for binding-aware evaluation. |
| `meaning-evaluator.ts` | `evaluateBidMeaning()`, `evaluateAllBidMeanings()` — clause evaluation against `EvaluatedFacts`, producing `MeaningProposal[]`. Resolves `$suit` bindings via `binding-resolver.ts`, derives specificity, fills clause defaults. |
| `meaning-arbitrator.ts` | `arbitrateMeanings()` — tiered selection (band ranking → specificity → precedence → deduplication), producing `PipelineResult`. `zipProposalsWithSurfaces()` pairs proposals with their source surfaces. |
| `arbitration-helpers.ts` | `evaluateProposal()` (runs single proposal through gate pipeline), `classifyIntoSets()` (buckets carriers into truth/acceptable sets) |
| `encoder-resolver.ts` | `resolveEncoding()` — resolves encoding for non-direct encoders (choice-set, frontier-step, relay-map). `EncoderConfig`, `FrontierStepConfig`, `ChoiceSetConfig`. |
| `gate-order.ts` | `evaluateGates()` — 4-gate sequence: semantic-applicability → obligation-satisfaction → encoder-availability → concrete-legality. `GateId` type. |
| `rule-interpreter.ts` | `collectMatchingClaims()` — collects matching surfaces from `ConventionModule[]` against `AuctionContext`. Replays local FSMs, checks turn/phase/kernel/route constraints. `ModuleSurfaceResult`, `flattenSurfaces()`, `deriveTurnRole()`. |
| `rule-enumeration.ts` | `enumerateRuleAtoms()`, `generateRuleCoverageManifest()` — walks `ConventionModule[].states[].surfaces[]` for CLI coverage commands. Atom ID format: `moduleId/meaningId`. |
| `local-fsm.ts` | `advanceLocalFsm()` — advances a module's local phase based on `CommittedStep` observations. Actor-agnostic by design. |
| `route-matcher.ts` | `matchRoute()` — evaluates `RouteExpr` patterns (subseq, last, contains, and/or/not) against `CommittedStep[]`. `matchObs()` for single observation matching. Supports `ObsPattern.actor` for actor-aware filtering. |
| `negotiation-matcher.ts` | `matchKernel()` — evaluates `NegotiationExpr` predicates (fit, forcing, captain, competition, combinators) against `NegotiationState` |
| `negotiation-extractor.ts` | `extractKernelState()` (MachineRegisters → NegotiationState), `computeKernelDelta()` (diff between kernel states) |
| `committed-step-builder.ts` | `buildCommittedStep()` — constructs one `CommittedStep` from arbitration result + registers + `normalizeIntent` |
| `observation-log-builder.ts` | `buildObservationLog()` — single-pass O(n) construction of `CommittedStep[]` from per-step data, threading kernel state. Current bid is NOT in the log. |
| `normalize-intent.ts` | `normalizeIntent()` — translates convention-shaped `sourceIntent` strings into canonical `BidAction[]`. Migration bridge until modules emit observations directly. Unknown intents return `[]`. |
| `binding-resolver.ts` | `resolveFactId()`, `resolveClause()` — canonical `$suit` placeholder resolution in fact IDs and clauses |
| `clause-derivation.ts` | `deriveClauseId()`, `deriveClauseDescription()`, `fillClauseDefaults()` — auto-derive clause metadata from factId/operator/value |
| `specificity-deriver.ts` | `deriveSpecificity()` — counts unique communicative constraint dimensions. Source of truth for surface specificity values. Handles inherited dimensions, `$suit` bindings, exclusion gates. |
| `specificity-classifier.ts` | `classifySpecificityBasis()` — classifies how a surface's specificity was determined: "derived" (transparent chain to primitives), "asserted" (opaque module-derived fact), or "partial" (mix) |
| `specificity-canons.ts` | Linearization canons for resolving specificity between incomparable surfaces. Canon numbering is stable (append-only). |
| `fact-inversion.ts` | `invertComposition()` — converts `FactComposition` trees into `InvertedConstraint` (partial `SeatConstraint`). Used by deal constraint derivation to convert module-derived fact compositions into engine-level constraints. |
| `fact-factory.ts` | `defineBooleanFact()`, `definePerSuitFacts()`, `defineHcpRangeFact()`, `buildExtension()` — factory helpers for module-derived fact definitions |
| `fact-helpers.ts` | Re-exports `num`, `bool`, `fv` from `core/contracts/fact-helpers.ts` |
| `fact-utils.ts` | `topologicalSort()` — dependency-ordered sort of `FactDefinition[]` by `derivesFrom` edges |
| `hand-fact-resolver.ts` | `createHandFactResolver()` — bridge between fact catalog and posterior sampler. Evaluates any factId against a hand using catalog evaluators in dependency order. |
| `shared-fact-catalog.ts` | `createSharedFactCatalog()`, `SHARED_EVALUATORS` — shared (non-module) fact catalog with primitive and bridge-derived evaluators |
| `system-fact-catalog.ts` | System-level fact definitions and evaluators for system-semantic facts (HCP thresholds, forcing durations) whose meaning varies by bidding system (SAYC, 2/1, Acol) |
| `deal-constraint-evaluator.ts` | `evaluateDealConstraint()` — fit-check, combined-hcp, custom constraint evaluation for deal generation |
| `deal-spec-generator.ts` | `resolveRole()`, `compileDealSpec()`, `generateDealSpec()` — compiles `DealSpec` into engine-level `DealConstraints` for rejection-sampling deal generation |
| `witness-constants.ts` | Witness generation constants (seat ordering, suit/vulnerability mappings) |

## Pipeline Flow

The core pipeline is a 4-step pure transformation orchestrated by `runPipeline()`:

1. **Surface selection** (`rule-interpreter.ts`) — `collectMatchingClaims()` replays local FSMs per `ConventionModule`, checks turn/phase/kernel/route constraints, returns matching claims (converted to `BidMeaning[]` via `flattenSurfaces()`). This step runs BEFORE `runPipeline()` — the caller provides surfaces.
2. **Fact evaluation** (`fact-evaluator.ts`) — `evaluateFacts()` runs 3-tier evaluation: primitive (hand → fact), bridge-derived (fact → fact), module-derived (convention-specific). Optional relational and posterior tiers.
3. **Surface evaluation** (`meaning-evaluator.ts`) — `evaluateAllBidMeanings()` checks each surface's clauses against `EvaluatedFacts`, resolving `$suit` bindings, deriving specificity, and producing `MeaningProposal[]`.
4. **Encoding + gates + arbitration** (`arbitration-helpers.ts`, `encoder-resolver.ts`, `gate-order.ts`, `meaning-arbitrator.ts`) — Each proposal gets encoding resolved, passes through the 4-gate sequence (semantic → obligation → encoder → legality), then `arbitrateMeanings()` selects the best proposal via band ranking → specificity → precedence → deduplication, producing the final `PipelineResult`.

Everything before the pipeline (surface selection) and after it (result mapping, teaching projection) is handled by the caller (typically `meaning-strategy.ts`).

## Test Architecture

Tests live in `__tests__/` and use:
- Inline synthetic data (factory functions with `Partial<T>` override pattern)
- Shared helpers in `__tests__/pipeline-test-helpers.ts`
- **Zero imports from `conventions/definitions/`** — enforced by design

Convention-specific integration tests belong in `conventions/__tests__/<bundle-name>/`, not here.

## Boundary Rules

- **Allowed imports:** `engine/`, `core/contracts/`, `conventions/core/` (for `ConventionModule`, `rule-module` types)
- **Blocked imports:** `conventions/definitions/`, `components/`, `stores/`, `strategy/`, `bootstrap/`, `service/`, `teaching/`

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Add** an entry only if an agent would fail without knowing it, it is not obvious from
the code, and it belongs at this scope.

**Remove** any entry that fails the falsifiability test: if removing it would not change
how an agent acts here, remove it.

**Staleness anchor:** This file assumes `run-pipeline.ts` and `meaning-evaluator.ts` exist. If they don't, this file is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-03-22 | last-audited=2026-03-22 | version=1 | dir-commits-at-audit=70 -->
