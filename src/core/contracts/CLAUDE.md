# Contracts

Cross-boundary DTOs and strategy interfaces shared across subsystem boundaries.

## Conventions

- `contracts/` is the fan-in/fan-out boundary for types shared by `engine/`, `conventions/`, `strategy/`, `inference/`, `bootstrap/`, `stores/`, and UI code.
- Keep files domain-grouped. Prefer adding to an existing contract file (`bidding.ts`, `inference.ts`, `tree-evaluation.ts`, `play.ts`, `recommendation.ts`) over recreating a monolith.
- `contracts/` may import `engine/types` and other `contracts/` files only. Do not import from `conventions/`, `display/`, `bootstrap/`, `inference/`, `strategy/`, `stores/`, or `components/`.
- **Convention-universal by definition.** Never add a type or field that only one convention would use. Every contract type must make sense across all conventions. If a type is convention-specific, it belongs in `conventions/definitions/`, not here.

## Architecture

| File | Role |
|------|------|
| `index.ts` | Barrel re-export for all contract files |
| `bidding.ts` | `BiddingContext`, `ForcingState`, `BidAlert` (with `kind: "alert" \| "announce"`, `publicConstraints`, `teachingLabel`), `BiddingStrategy`, `BidResult` (with optional `alert`), `BidHistoryEntry` |
| `inference.ts` | `SuitInference`, `HandInference`, `InferredHoldings`, `BeliefData` |
| `tree-evaluation.ts` | `SiblingConditionDetail`, `CandidateEligibility`, `ResolvedCandidateDTO` (with optional `allEncodings`), `AlternativeGroup`, `IntentFamily`, `IntentRelationship`, `EvaluationTrace`, `isDtoSelectable()`, `isDtoPedagogicallyAcceptable()` |
| `play.ts` | `PlayContext`, `PlayResult`, `PlayStrategy` |
| `recommendation.ts` | `PracticalRecommendation`, `PosteriorSummary`, `ConventionBiddingStrategy` (extends `BiddingStrategy` with `getLastPracticalRecommendation()`, `getAcceptableAlternatives()`, `getIntentFamilies()`, `getLastProvenance()`, `getLastArbitration()`, `getLastPosteriorSummary()`, `getExplanationCatalog()`, `getLastTeachingProjection()`) |
| `module-surface.ts` | `PublicSnapshot` (with epistemic layers: `publicRecord`, `publicCommitments`, `latentBranches` — populated by runtime's `buildSnapshotFromAuction()`; `publicBeliefs` removed in Phase 2, belief views now via `PosteriorQueryPort`), `ModuleSurface`, `MultiModuleSurface`, `EncodedProposal`, `EliminationRecord`, `ArbitrationResult`, `SurfaceEvaluationResult`, `TransformApplication`, `SurfaceCompositionDiagnostic`, `buildPublicSnapshot()` |
| `meaning.ts` | `MeaningId`, `SemanticClassId`, `RecommendationBand`, `RankingMetadata`, `MeaningClause`, `EvidenceBundle`, `MeaningProposal`, `BAND_PRIORITY`, `compareRanking()`, `CandidateTransform`, `TransformTrace` |
| `fact-catalog.ts` | `FactLayer`, `EvaluationWorld`, `FactMetadata`, `FactDefinition` (with `derivesFrom`, optional `metadata`), `FactValue`, `EvaluatedFacts`, `getFactValue()`, `FactEvaluatorFn`, `RelationalFactEvaluatorFn`, `FactCatalog` (with optional `relationalEvaluators`, optional `posteriorEvaluators`), `FactCatalogExtension`, `createFactCatalog()`, `PRIMITIVE_FACTS` (6), `BRIDGE_DERIVED_FACTS` (8, including 4 relational: `supportForBoundSuit`, `fitWithBoundSuit`, `shortageInSuit`, `totalPointsForRaise`, plus `hasShortage` non-relational), `SHARED_FACTS` (19 = primitive + bridge-derived + posterior-derived) |
| `semantic-classes.ts` | `BRIDGE_SEMANTIC_CLASSES` (platform-owned canonical IDs). Convenience catalog, not a gating registry — modules declare their own semantic class IDs as strings. |
| `meaning-surface.ts` | `MeaningSurfaceClause`, `MeaningSurface` (with optional `publicConsequences`, optional `alert: "alert" \| "announce"`) — authored, hand-independent meaning units (pre-evaluation). Evaluated by `conventions/core/pipeline/meaning-evaluator.ts` into `MeaningProposal`. |
| `alert.ts` | `AlertResolvable`, `resolveAlert()` — derives `BidAlert` from surface properties (explicit `alert` field, or inferred from `priorityClass`/`sourceIntent`). Returns null for natural bids. |
| `provenance.ts` | `EncoderKind`, `DecisionProvenance` (with optional `surfaceDiagnostics`), `ApplicabilityEvidence`, `EliminationTrace`, `ActivationTrace`, `TransformTraceEntry`, `ArbitrationTrace`, `EncodingTrace`, `LegalityTrace`, `HandoffTrace` — full decision provenance DTOs for pipeline tracing. `ApplicabilityEvidence.evaluatedConditions` and `EliminationTrace.evidence` use `ConditionEvidenceIR` from `evidence-bundle.ts`. |
| `teaching-projection.ts` | `TeachingProjection`, `CallProjection`, `MeaningView`, `ExplanationNode`, `WhyNotEntry`, `PedagogicalRelationEntry`, `PedagogicalRelationKind`, `ConventionContribution`, `HandArchetypeSummary`, `WitnessHand`, `SeatRelativeHandSpaceSummary` (with optional `partnerSummary`, `archetypes`, `witnessHands`) — teaching-optimized views for "why not X?" UI |
| `pedagogical-relations.ts` | `PedagogicalRelation` — discriminated union for pedagogical relations between bids/meanings |
| `predicate-surfaces.ts` | `AuctionPatternIR`, `PublicGuardIR`, `HandPredicateIR`, `DealConstraintIR` — site-specific typed predicate surfaces scoped by evaluation world |
| `evidence-bundle.ts` | `ConditionEvidenceIR` (canonical evidence type: `conditionId`, `satisfied`, `factId?`, `observedValue?`, `threshold?`), `RejectionEvidence` (with optional `negatableFailures` for negative inference / `invertInference()`), `AlternativeEvidence` (with optional `conditionDelta` for per-condition diff vs. matched meaning), `EvidenceBundleIR` — evidence types for decision program representations. `ConditionEvidenceIR` is the single evidence type used across provenance, teaching, and evidence bundles. |
| `posterior.ts` | **Deprecated** (kept for backward compat during migration). `PosteriorEngine`, `SeatPosterior`, `PublicHandSpace` (with optional `latentBranches`), `PosteriorFactor`, `LikelihoodModel`, `PosteriorFactRequest`, `PosteriorFactValue`, `SubjectRef`, `PosteriorSourceRef`, `EvidenceGroupId`, `BeliefView` (enriched: `beliefId`, `subject`, `constraint`, `provenance`, `explanationKey`, `evidenceGroupId` — all optional), `LatentBranchAlternative`, `LatentBranchSet`, `PosteriorFactProvider` — old posterior engine contract types. Consumers should migrate to `factor-graph.ts` / `posterior-query.ts` / `posterior-backend.ts`. |
| `factor-graph.ts` | `FactorStrength`, `FactorOrigin`, `FactorSpec` (discriminated union: `HcpRangeFactor`, `SuitLengthFactor`, `ShapeFactor`, `ExclusionFactor`, `FitFactor`), `AmbiguityFamilyIR`, `AmbiguityAlternativeIR`, `EvidencePin`, `FactorGraphIR` — convention-erased factor graph IR for posterior boundary |
| `posterior-query.ts` | `InferenceHealth`, `PosteriorQueryResult<T>`, `FactorIntrospection`, `ConditioningContext`, `PosteriorQueryPort` — consumer-facing query interface for posterior inference |
| `posterior-backend.ts` | `LatentWorld`, `WeightedParticle`, `PosteriorState`, `PosteriorQueryIR`, `PosteriorBackend` — backend contract for posterior sampling (replaceable: TS or Rust/WASM) |
| `agreement-module.ts` | `ActivationKind`, `ModuleKind`, `PriorityClass`, `DecisionSurfaceIR`, `AttachmentIR`, `FactConstraintIR`, `PublicConsequences`, `ChoiceClosurePolicy`, `ClosureDomain`, `SystemProfileIR`, `ModuleEntryIR`, `ConflictPolicyIR`, `DeclaredEncoderKind`, `PublicEvent`, `PublicConstraint` — agreement module IR types |
| `capability-vocabulary.ts` | `CAP_OPENING_1NT`, `CAP_OPENING_MAJOR`, `CAP_OPENING_MINOR`, `CAP_OPENING_NATURAL_SUIT`, `CAP_OPENING_WEAK_TWO`, `CAP_OPENING_STRONG_2C`, `CAP_OPPONENT_1NT`, `CAP_OPPONENT_OVERCALL`, `CAP_OPPONENT_WEAK_TWO`, `CAP_CONTEXT_NT_REBID`, `CAP_CONTEXT_PASSED_HAND`, `ALL_CAPABILITIES`, `CapabilityId` — stable host-attachment capability vocabulary (`{scope}.{context}` naming) |
| `witness-spec.ts` | `SeatRole`, `SeatConstraint`, `JointConstraint`, `PublicGuardConstraint`, `ExclusionConstraint`, `ConstraintLayer`, `PedagogicalControls`, `GeneratorStrategy`, `WitnessTarget`, `WitnessSpecIR`, `WitnessUnsatResult` — witness spec IR types for deal generation |
| `explanation-catalog.ts` | `ExplanationRole`, `ExplanationLevel`, `ExplanationEntry`, `ExplanationCatalogIR`, `createExplanationCatalog()` |

## Design Decisions

- **`DecisionSurfaceIR` is consumed via dual-path adapter in the pipeline.** `evaluateAllSurfaces()` accepts both `MeaningSurface[]` and `DecisionSurfaceIR[]`. The adapter `adaptMeaningSurface()` / `adaptMeaningSurfaces()` in `conventions/core/pipeline/surface-adapter.ts` maps `MeaningSurface` to `DecisionSurfaceIR`. Existing `MeaningSurface[]` callers are unchanged.
- **`DeclaredEncoderKind` (agreement-module.ts) is distinct from `EncoderKind` (provenance.ts).** `DeclaredEncoderKind` describes the authored encoder type on a surface (`"direct"`, `"choice-set"`, `"frontier-step"`, `"relay-map"`). `EncoderKind` describes how encoding was resolved at runtime (`"default-call"`, `"resolver"`, etc.).
- **`ConditionEvidenceIR` is the sole evidence type.** Unified from the former `ConditionEvidence` (provenance.ts, removed) and `ConditionEvidenceIR` (evidence-bundle.ts). Fields: `conditionId`, `satisfied`, `factId?`, `observedValue?`, `threshold?`. Used by `EvidenceBundleIR`, `ApplicabilityEvidence.evaluatedConditions`, `EliminationTrace.evidence`, and `MeaningView.supportingEvidence`.

## Gotchas

- `index.ts` is the public entry point for most consumers; prefer importing from `../contracts` unless a narrower file import materially improves clarity.
- `hand-summary.ts` is intentionally not here; it moved to `src/core/display/hand-summary.ts` because it is formatting logic, not a contract.
- `ResolvedCandidateDTO.allEncodings` carries the full set of resolver encodings with per-encoding legality. `resolvedCall` is always the first legal encoding (or the first encoding if none are legal). Consumers needing the full encoding set (e.g., obligation affinity checking for major suit bids) should use `allEncodings`; consumers needing just the winning call should use `resolvedCall`.

## Shared Vocabulary Placement

The five-registry shared vocabulary model (see root `CLAUDE.md` § Shared Vocabulary Architecture) determines which vocabulary types belong in `contracts/` versus other locations:

| Registry | Where types live | Notes |
|---|---|---|
| **Fact vocabulary** (shared facts) | `contracts/fact-catalog.ts` for `FactDefinition` (with `derivesFrom` DAG), `FactValue`, `EvaluatedFacts`, `FactEvaluatorFn`, `FactCatalog`, `FactCatalogExtension`, `createFactCatalog()`, `SHARED_FACTS` (19 entries: 6 primitive + 8 bridge-derived + 5 posterior-derived). | Shared fact definitions (`hand.hcp`, `bridge.majorFit`) are cross-boundary by nature. Module-derived facts (`module.stayman.*`, `module.transfer.*`, `module.ntResponse.*`) live in `FactCatalogExtension`s in `conventions/definitions/nt-bundle/facts.ts`, composed via `createFactCatalog()`. |
| **Public-state vocabulary** | `contracts/bidding.ts` (`ForcingState`, `BidAlert`). Machine registers in `conventions/core/runtime/machine-types.ts`. | Built-in registers (`force`, `obligation`, `agreement`, `competition`, `captaincy`) managed by conversation machine. |
| **Meaning vocabulary** | `contracts/meaning.ts` for `MeaningId`, `SemanticClassId`, `MeaningProposal`, `MeaningClause`, `EvidenceBundle`, `RankingMetadata`, `RecommendationBand`, `BAND_PRIORITY`, `compareRanking()`. | Semantic class IDs (`bridge:nt-invite`, `stayman:ask-major`) are cross-module by definition. |
| **Arbitration / transform vocabulary** | `contracts/meaning.ts` for `RankingMetadata` (`recommendationBand`, `specificity`, `modulePrecedence`, `intraModuleOrder`). `contracts/tree-evaluation.ts` for ranking DTOs (`ResolvedCandidateDTO`). | The selector reads these as scalars, never as raw fact names. |
| **Capability / attachment vocabulary** | Future: `contracts/` for `CapabilityId`, `AttachmentIR`. | Stable feature names used for module composition. |

**The boundary rule for `contracts/`:** A type belongs here only if it is consumed by multiple subsystems AND is convention-universal. Convention-specific derived facts, module-local registers, and convention-internal meaning IDs stay in `conventions/definitions/`. The boundary test from the five-registry model applies: if a type only describes one convention's internal reasoning, it does not belong in `contracts/`.

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Add** an entry only if an agent would fail without knowing it, it is not obvious from
the code, and it belongs at this scope (project-wide rule → root CLAUDE.md; WHY decision
→ inline comment or ADR; inferable from code → nowhere).

**Remove** any entry that fails the falsifiability test: if removing it would not change
how an agent acts here, remove it. If a convention here conflicts with the codebase,
the codebase wins — update this file, do not work around it. Prune aggressively.

**Track follow-up work:** After modifying files, evaluate whether changes create incomplete
work or break an assumption tracked elsewhere. If so, create a task or update tracking before ending.

**Staleness anchor:** This file assumes `index.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-03-07 | last-audited=2026-03-07 | version=1 | dir-commits-at-audit=0 | tree-sig=dirs:0,files:1,exts:md:1 -->
