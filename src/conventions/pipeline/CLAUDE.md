# Pipeline

Meaning pipeline: surfaces → facts → evaluation → arbitration → encoding. Convention-agnostic infrastructure that transforms `BidMeaning[]` surfaces and hand facts into a ranked `PipelineResult`. All stages operate on generic types; convention-specific data flows in from `definitions/` via `ConventionBundle`.

## Directory Structure

```
pipeline/
  index.ts                    Root barrel (re-exports from subfolders + root files)
  run-pipeline.ts             Orchestrator — imports from all 3 subfolders
  pipeline-types.ts           PipelineResult, PipelineCarrier, ArbitrationResult
  strategy-evaluation.ts      StrategyEvaluation, MachineDebugSnapshot
  tree-evaluation.ts          CandidateEligibility, ResolvedCandidateDTO
  evidence-bundle.ts          ConditionEvidence, ConditionResult (cross-cutting)
  bid-action.ts               BidAction discriminated union
  rule-enumeration.ts         CLI utility (atom enumeration)
  deal-constraint-evaluator.ts CLI utility (deal constraint eval)
  deal-spec-generator.ts      CLI utility (DealSpec compilation)
  witness-constants.ts        CLI utility (seat/suit/vuln mappings)

  facts/                      8 files — "evaluate facts" step
  evaluation/                 13 files — "evaluate meanings" + "arbitrate" steps
  observation/                8 files — surface selection + observation log
  __tests__/                  32 test files (flat, shared helpers)
```

### Why 3 subfolders

| Folder | What it does | Entry points |
|--------|-------------|--------------|
| `facts/` | Evaluates hand → facts (primitive, bridge-derived, module-derived). Catalogs + factories + utilities. | `fact-evaluator.ts` |
| `evaluation/` | Evaluates surfaces' clauses against facts, resolves encoding, runs gates, arbitrates winner. Types: `meaning.ts`, `provenance.ts`. | `meaning-evaluator.ts`, `meaning-arbitrator.ts` |
| `observation/` | Pre-pipeline: selects matching surfaces via FSM/route/negotiation. Post-pipeline: builds observation log. | `rule-interpreter.ts`, `observation-log-builder.ts` |

### Layering rules

- **Subfolders → root:** Allowed. Subfolders import from root-level pipeline files (`pipeline-types.ts`, `tree-evaluation.ts`, `evidence-bundle.ts`, `bid-action.ts`).
- **Root → subfolders:** Only `run-pipeline.ts` (orchestrator) and `index.ts` (barrel). Root type files (`pipeline-types.ts`, `tree-evaluation.ts`, `strategy-evaluation.ts`) use `import type` from `evaluation/` for cross-cutting types — this is acceptable since it creates no runtime dependency.
- **Subfolder → subfolder:** Avoided. Each subfolder depends only on root pipeline files + `engine/` + `conventions/core/`. Exception: `facts/fact-factory.ts` uses `import type { ConstraintDimension }` from `evaluation/meaning.ts`.
- **Tests stay flat:** All in `__tests__/` — `npx vitest run src/conventions/pipeline/` works unchanged.

### What stays at root (and why)

Root files are cross-cutting — imported by 2+ subfolders or by many external consumers:
- `pipeline-types.ts` — used by all 3 subfolders
- `tree-evaluation.ts` — used by evaluation/ AND adapter/ AND teaching/
- `evidence-bundle.ts` — `tree-evaluation.ts` (root) imports `ConditionResult`; placing in evaluation/ would invert layering
- `bid-action.ts` — used by observation/ AND core/
- `strategy-evaluation.ts` — consumes types from evaluation/ AND teaching/
- CLI utilities (`rule-enumeration.ts`, `deal-spec-generator.ts`, etc.) — depend heavily on pipeline internals

## Module Graph (Root)

| File | Role |
| ---- | ---- |
| `run-pipeline.ts` | `runPipeline()` entry point — orchestrates the 4-step core pipeline. |
| `pipeline-types.ts` | `PipelineResult`, `PipelineCarrier`, `ArbitrationResult`, `EncodedProposal`, `EliminationRecord` |
| `strategy-evaluation.ts` | `StrategyEvaluation`, `MachineDebugSnapshot`, `ConventionStrategy` |
| `tree-evaluation.ts` | `CandidateEligibility`, `ResolvedCandidateDTO`, `isDtoSelectable()`, `isDtoTeachingAcceptable()` |
| `evidence-bundle.ts` | `EvidenceBundle`, `ConditionEvidence`, `ConditionResult` |
| `bid-action.ts` | `BidAction` discriminated union |
| `rule-enumeration.ts` | `enumerateRuleAtoms()`, `generateRuleCoverageManifest()` — CLI coverage |
| `deal-constraint-evaluator.ts` | `evaluateDealConstraint()` — fit-check, combined-hcp, custom |
| `deal-spec-generator.ts` | `resolveRole()`, `compileDealSpec()`, `generateDealSpec()` |
| `witness-constants.ts` | Witness generation constants |

## Module Graph (facts/)

| File | Role |
| ---- | ---- |
| `fact-evaluator.ts` | `evaluateFacts()` — 3-tier evaluation: primitive, bridge-derived, module-derived. Optional relational + posterior tiers. `RelationalFactContext` includes `fitAgreed` for trump-context detection. Facts with both standard and relational evaluators run standard as baseline; relational overrides when context provided. |
| `shared-fact-catalog.ts` | `createSharedFactCatalog()`, `SHARED_EVALUATORS` — shared fact catalog |
| `system-fact-catalog.ts` | System-level fact definitions and evaluators per bidding system. 6 hand-dependent facts have BOTH standard (HCP-only) and relational (fitAgreed-aware, trump TP) evaluators. Standard runs as baseline; relational overrides when `RelationalFactContext.fitAgreed` is present. Exports `computeTrumpTotalPoints()` and `detectTrumpSuit()`. |
| `hand-fact-resolver.ts` | `createHandFactResolver()` — bridge between fact catalog and posterior sampler |
| `fact-factory.ts` | `defineBooleanFact()`, `definePerSuitFacts()`, `defineHcpRangeFact()`, `buildExtension()` |
| `fact-helpers.ts` | Re-exports `num`, `bool`, `fv` fact constraint builder helpers |
| `fact-utils.ts` | `topologicalSort()` — dependency-ordered sort of `FactDefinition[]` |
| `fact-inversion.ts` | `invertComposition()` — converts `FactComposition` to `InvertedConstraint` |

## Module Graph (evaluation/)

| File | Role |
| ---- | ---- |
| `meaning.ts` | `BidMeaning`, `MeaningProposal`, `MeaningClause`, `BidMeaningClause` types. `BidMeaning.teachingLabel` is `TeachingLabel` (structured object with `name: BidName` and `summary: BidSummary`), not `string`. |
| `meaning-evaluator.ts` | `evaluateBidMeaning()`, `evaluateAllBidMeanings()` — clause evaluation |
| `binding-resolver.ts` | `resolveFactId()`, `resolveClause()` — `$suit` placeholder resolution |
| `clause-derivation.ts` | `deriveClauseId()`, `deriveClauseDescription()`, `fillClauseDefaults()` |
| `specificity-deriver.ts` | `deriveSpecificity()` — counts unique communicative constraint dimensions |
| `specificity-classifier.ts` | `classifySpecificityBasis()` — derived/asserted/partial classification |
| `specificity-canons.ts` | Linearization canons for specificity tiebreaking (stable numbering) |
| `alert.ts` | `resolveAlert()`, `isAlertable()` — disclosure-based alertability derivation |
| `meaning-arbitrator.ts` | `arbitrateMeanings()` — tiered selection producing `PipelineResult` |
| `arbitration-helpers.ts` | `evaluateProposal()`, `classifyIntoSets()` — gate pipeline + bucketing |
| `encoder-resolver.ts` | `resolveEncoding()` — non-direct encoder resolution |
| `gate-order.ts` | `evaluateGates()` — 4-gate sequence |
| `provenance.ts` | `DecisionProvenance`, trace types |

## Module Graph (observation/)

| File | Role |
| ---- | ---- |
| `rule-interpreter.ts` | `collectMatchingClaims()` — surface selection via local FSM replay |
| `local-fsm.ts` | `advanceLocalFsm()` — advances module's local phase |
| `route-matcher.ts` | `matchRoute()`, `matchObs()` — `RouteExpr` pattern matching |
| `negotiation-matcher.ts` | `matchKernel()` — `NegotiationExpr` predicate evaluation |
| `negotiation-extractor.ts` | `extractKernelState()`, `computeKernelDelta()` |
| `committed-step-builder.ts` | `buildCommittedStep()` — constructs one `CommittedStep` |
| `observation-log-builder.ts` | `buildObservationLog()` — O(n) `CommittedStep[]` construction |
| `normalize-intent.ts` | `normalizeIntent()` — intent→`BidAction[]` migration bridge |

## Pipeline Flow

The core pipeline is a 4-step pure transformation orchestrated by `runPipeline()`:

1. **Surface selection** (`observation/rule-interpreter.ts`) — replays local FSMs, checks constraints, returns matching claims. Runs BEFORE `runPipeline()`.
2. **Fact evaluation** (`facts/fact-evaluator.ts`) — 3-tier: primitive → bridge-derived → module-derived.
3. **Surface evaluation** (`evaluation/meaning-evaluator.ts`) — checks clauses against facts, resolves bindings, derives specificity.
4. **Encoding + gates + arbitration** (`evaluation/arbitration-helpers.ts`, `evaluation/encoder-resolver.ts`, `evaluation/gate-order.ts`, `evaluation/meaning-arbitrator.ts`) — encode, gate-check, rank, select.

## Test Architecture

Tests live in `__tests__/` (flat) and use:
- Inline synthetic data (factory functions with `Partial<T>` override pattern)
- Shared helpers in `__tests__/pipeline-test-helpers.ts`
- **Zero imports from `conventions/definitions/`** — enforced by design

Convention-specific integration tests belong in `conventions/__tests__/<bundle-name>/`, not here.

## Absorbed Types (from former core/contracts/)

- `evaluation/meaning.ts` — BidMeaning, MeaningProposal, and meaning-related types
- `bid-action.ts` — BidAction, intent types
- `tree-evaluation.ts` — EvaluatedFacts, clause evaluation types
- `evaluation/provenance.ts` — DecisionProvenance, ActivationTrace
- `evidence-bundle.ts` — EvidenceBundle, evidence types

## Rust Pipeline Port

The full pipeline has a Rust port in `src-tauri/crates/bridge-conventions/src/pipeline/`
(observation/ + evaluation/ + run_pipeline.rs). TS remains the production path — Rust is
shadow-validated only (Phase 3). When modifying pipeline logic in TS, the Rust port should
be updated to match. The `normalizeIntent` mapping table lives in both
`observation/normalize-intent.ts` (TS) and `pipeline/observation/normalize_intent.rs` (Rust);
keep them in sync.

## Boundary Rules

- **Allowed imports:** `engine/`, `conventions/core/` (for `ConventionModule`, `rule-module` types)
- **Blocked imports:** `conventions/definitions/`, `components/`, `stores/`, `strategy/`, `service/`, `teaching/`

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Add** an entry only if an agent would fail without knowing it, it is not obvious from
the code, and it belongs at this scope.

**Remove** any entry that fails the falsifiability test: if removing it would not change
how an agent acts here, remove it.

**Staleness anchor:** This file assumes `run-pipeline.ts` and `evaluation/meaning-evaluator.ts` exist. If they don't, this file is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-03-25 | last-audited=2026-03-25 | version=2 | dir-commits-at-audit=75 -->
