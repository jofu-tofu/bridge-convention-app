# Contracts

Cross-boundary DTOs and strategy interfaces shared across subsystem boundaries.

## Conventions

- `contracts/` is the fan-in/fan-out boundary for types shared by `engine/`, `conventions/`, `strategy/`, `inference/`, `bootstrap/`, `stores/`, and UI code.
- Keep files domain-grouped. Prefer adding to an existing contract file (`bidding.ts`, `inference.ts`, `tree-evaluation.ts`, `play.ts`, `recommendation.ts`) over recreating a monolith.
- `contracts/` may import `engine/types` and other `contracts/` files only. Do not import from `conventions/`, `display/`, `bootstrap/`, `inference/`, `strategy/`, `stores/`, or `components/`.
- **Convention-universal by definition.** Never add a type or field that only one convention would use. Every contract type must make sense across all 100+ future conventions. If a type is convention-specific, it belongs in `conventions/definitions/`, not here. Contract types must not grow linearly with module count — no per-module fields, no module-name enums.

## Stability Tiers

The barrel is split into 3 sub-barrels by change-frequency. `index.ts` re-exports all three for backwards compatibility. Prefer the narrowest tier import that covers your needs.

| Sub-barrel | Stability | Contents |
|---|---|---|
| `engine-types.ts` | Tier 1 — rarely changes | Bridge primitives: meaning, fact-catalog, agreement-module, bid-action, committed-step |
| `convention-types.ts` | Tier 2 — convention/strategy/teaching scope | Pipeline infrastructure: bidding, explanation-catalog, inference, play, recommendation, tree-evaluation, module-surface, provenance, predicates, evidence-bundle, posterior, factor-graph, posterior-query, posterior-backend, alert, teaching-tag |
| `session-types.ts` | Tier 3 — orchestration/presentation scope | Session lifecycle & UI: teaching-projection, deal-spec, convention, system-config, base-system-vocabulary, teaching-grading, drill, practice-preferences |

**When to use each tier import:**
- `engine-types` — you only need core bridge semantics (meanings, facts, observations, kernel state)
- `convention-types` — you need pipeline evaluation, inference, or strategy types
- `session-types` — you need session configuration, teaching UI, or drill settings
- `index` (main barrel) — backwards-compatible catch-all; works everywhere existing imports work

## Architecture

| File | Role |
|------|------|
| `index.ts` | Barrel re-export for all contract files (delegates to the 3 tier sub-barrels) |
| `engine-types.ts` | Tier 1 sub-barrel: engine-stable bridge primitives |
| `convention-types.ts` | Tier 2 sub-barrel: convention pipeline infrastructure |
| `session-types.ts` | Tier 3 sub-barrel: session lifecycle and UI preferences |
| `bidding.ts` | `BiddingContext`, `ForcingState`, `BidAlert` (with `kind: "alert" \| "announce"`, `publicConstraints`, `teachingLabel`), `BiddingStrategy`, `BidResult` (with optional `alert`), `BidHistoryEntry` |
| `inference.ts` | `SuitInference`, `HandInference`, `QualitativeConstraint`, `DerivedRanges`, `PublicBeliefs`, `InferenceProvider`, `BeliefData` (deprecated) |
| `tree-evaluation.ts` | `SiblingConditionDetail`, `CandidateEligibility`, `ResolvedCandidateDTO` (with optional `allEncodings`), `AlternativeGroup`, `IntentFamily`, `IntentRelationship`, `EvaluationTrace`, `isDtoSelectable()`, `isDtoTeachingAcceptable()` |
| `play.ts` | `PlayContext`, `PlayResult`, `PlayStrategy` |
| `recommendation.ts` | `PracticalScoreBreakdown`, `PracticalRecommendation`, `PosteriorSummary`, `StrategyEvaluation` (unified DTO: all pipeline outputs from last suggest()), `ConventionStrategy` (extends `BiddingStrategy` with single `getLastEvaluation(): StrategyEvaluation \| null`) |
| `module-surface.ts` | `PublicSnapshot` (with epistemic layers: `publicRecord`, `publicCommitments`, `latentBranches` — populated by runtime's `buildSnapshotFromAuction()`; `publicBeliefs` removed in Phase 2, belief views now via `PosteriorQueryPort`), `ModuleSurface`, `MultiModuleSurface`, `EncodedProposal`, `EliminationRecord`, `ArbitrationResult`, `CompositionResult`, `TransformApplication`, `CompositionDiagnostic`, `buildPublicSnapshot()` |
| `meaning.ts` | `MeaningId`, `SemanticClassId`, `RecommendationBand`, `RankingMetadata`, `MeaningClause`, `EvidenceBundle`, `MeaningProposal`, `BAND_PRIORITY`, `compareRanking()`, `CandidateTransform`, `TransformTrace`, `BidMeaningClause`, `BidMeaning` (with optional `closurePolicy`, `teachingTags`), `BRIDGE_SEMANTIC_CLASSES`. `BidMeaning` = authored, hand-independent meaning units. `teachingTags` carries `TeachingTagRef[]` for deriving relations/alternatives. **Optional fields:** `BidMeaningClause.clauseId`/`.description` (auto-derived from factId/operator/value by builder or pipeline), `BidMeaning.moduleId` (injected by builder, defaults to `"unknown"`), `AuthoredRankingMetadata.modulePrecedence` (injected by builder, defaults to `0`). |
| `fact-catalog.ts` | `FactLayer`, `EvaluationWorld`, `FactMetadata`, `FactDefinition` (with `derivesFrom`, optional `metadata`, required `constrainsDimensions`), `FactValue`, `EvaluatedFacts`, `getFactValue()`, `FactEvaluatorFn`, `RelationalFactEvaluatorFn`, `FactCatalog` (with optional `relationalEvaluators`, optional `posteriorEvaluators`), `FactCatalogExtension`, `createFactCatalog()`, `PRIMITIVE_FACTS` (6), `BRIDGE_DERIVED_FACTS` (8, including 4 relational: `supportForBoundSuit`, `fitWithBoundSuit`, `shortageInSuit`, `totalPointsForRaise`, plus `hasShortage` non-relational), `SHARED_FACTS` (19 = primitive + bridge-derived + posterior-derived) |
| `alert.ts` | `AlertResolvable`, `resolveAlert()`, `derivePublicConstraints()` — derives `BidAlert` from surface properties and auto-derives public constraints from primitive/bridge-observable clauses. `derivePublicConstraints()` is also used by `commitment-extractor.ts`. |
| `provenance.ts` | `EncoderKind`, `DecisionProvenance` (with optional `surfaceDiagnostics`), `ApplicabilityEvidence`, `EliminationTrace`, `ActivationTrace`, `TransformTraceEntry`, `ArbitrationTrace`, `EncodingTrace`, `LegalityTrace`, `HandoffTrace` — full decision provenance DTOs for pipeline tracing. `ApplicabilityEvidence.evaluatedConditions` and `EliminationTrace.evidence` use `ConditionEvidence` from `evidence-bundle.ts`. |
| `teaching-projection.ts` | `TeachingProjection`, `CallProjection`, `MeaningView`, `ExplanationNode`, `WhyNotEntry`, `TeachingRelation` (discriminated union), `PedagogicalRelationEntry`, `TeachingRelationKind`, `ConventionContribution`, `HandArchetypeSummary`, `ExampleHand`, `HandSpaceSummary` (with optional `partnerSummary`, `archetypes`, `witnessHands`) — teaching-optimized views for "why not X?" UI |
| `predicates.ts` | `AuctionPattern`, `PublicGuard`, `HandPredicate`, `DealConstraint` — site-specific typed predicate surfaces scoped by evaluation world |
| `evidence-bundle.ts` | `ConditionEvidence` (canonical evidence type: `conditionId`, `satisfied`, `factId?`, `observedValue?`, `threshold?`), `RejectionEvidence` (with optional `negatableFailures` for negative inference / `invertInference()`), `AlternativeEvidence` (with optional `conditionDelta` for per-condition diff vs. matched meaning), `EvidenceBundle` — evidence types for decision program representations. `ConditionEvidence` is the single evidence type used across provenance, teaching, and evidence bundles. |
| `posterior.ts` | **Deprecated** (kept for backward compat during migration). `PosteriorEngine`, `SeatPosterior`, `PublicHandSpace` (with optional `latentBranches`), `PosteriorFactor`, `LikelihoodModel`, `PosteriorFactRequest`, `PosteriorFactValue`, `SubjectRef`, `PosteriorSourceRef`, `EvidenceGroupId`, `BeliefView` (enriched: `beliefId`, `subject`, `constraint`, `provenance`, `explanationKey`, `evidenceGroupId` — all optional), `LatentBranchAlternative`, `LatentBranchSet`, `PosteriorFactProvider` — old posterior engine contract types. Consumers should migrate to `factor-graph.ts` / `posterior-query.ts` / `posterior-backend.ts`. |
| `factor-graph.ts` | `FactorStrength`, `FactorOrigin`, `FactorSpec` (discriminated union: `HcpRangeFactor`, `SuitLengthFactor`, `ShapeFactor`, `ExclusionFactor`, `FitFactor`), `AmbiguityFamily`, `AmbiguityAlternative`, `EvidencePin`, `FactorGraph` — convention-erased factor graph IR for posterior boundary |
| `posterior-query.ts` | `InferenceHealth`, `PosteriorQueryResult<T>`, `FactorIntrospection`, `ConditioningContext`, `PosteriorQueryPort` — consumer-facing query interface for posterior inference |
| `posterior-backend.ts` | `LatentWorld`, `WeightedParticle`, `PosteriorState`, `PosteriorQuery`, `PosteriorBackend` — backend contract for posterior sampling (replaceable: TS or Rust/WASM) |
| `agreement-module.ts` | `ActivationKind`, `ModuleKind`, `ObligationLevel`, `Conventionality`, `PrioritySpec` (closed union of 4 attested obligation×conventionality combinations), `FORCED_CONVENTIONAL`, `PREFERRED_CONVENTIONAL`, `ACCEPTABLE_NATURAL`, `RESIDUAL_NATURAL` (named constructors), `PriorityClass` (deprecated — use `PrioritySpec`), `DecisionSurface`, `Attachment`, `FactConstraint`, `ChoiceClosurePolicy`, `ClosureDomain`, `SystemProfile` (with `obligationMapping` + deprecated `priorityClassMapping`), `ModuleEntry`, `ConflictPolicy`, `DeclaredEncoderKind`, `PublicEvent`, `PublicConstraint`, `defaultObligationMapping()`, `defaultPriorityClassMapping()` (deprecated), `prioritySpecToClass()` — agreement module IR types |
| `deal-spec.ts` | `SeatRole`, `SeatConstraint`, `JointConstraint`, `PublicGuardConstraint`, `ExclusionConstraint`, `ConstraintLayer`, `TeachingControls`, `GeneratorStrategy`, `DealSpecTarget`, `DealSpec`, `UnsatisfiableResult` — witness spec IR types for deal generation |
| `explanation-catalog.ts` | `ExplanationRole`, `ExplanationLevel`, `ExplanationEntry`, `ExplanationCatalog`, `createExplanationCatalog()` |
| `convention.ts` | `ConventionCategory`, `ConventionTeaching`, `ConventionConfig`, `DealConstraints` — convention registry types and deal constraint shapes |
| `fact-helpers.ts` | `num()`, `bool()`, `fv()` — shared utilities for convention fact evaluators and pipeline fact evaluation |
| `shared-facts.ts` | `PRIMITIVE_FACTS`, `BRIDGE_DERIVED_FACTS` definitions — bridge-universal fact vocabulary. Module-specific facts belong in their module's `FactCatalogExtension` |
| `teaching-grading.ts` | `BidGrade`, `AcceptableBid`, `TeachingResolution` — cross-boundary teaching grading types used by viewport, stores, teaching, and strategy |
| `drill.ts` | `OpponentMode`, `VulnerabilityDistribution`, `DrillTuning`, `DEFAULT_DRILL_TUNING` — drill session tuning DTOs |
| `teaching-tag.ts` | `TeachingTagDef`, `TagDerivation`, `TeachingTagRef` (with `scope`, optional `role`, optional `ordinal`) — general-purpose types for deriving all pedagogical content from surface-level tags. Relations use `semanticClassId`; alternative groups use `meaningId`. `BidMeaning.teachingTags` carries the annotations. |
| `bid-action.ts` | `BidAction` (17-member discriminated union of bridge communicative acts), `BidActionType`, `BID_ACTION_TYPES`, `ObsSuit`, `BidSuitName`, `HandFeature`, `HandStrength`, `SuitQuality` — bridge-universal observation vocabulary for convention-erased pattern matching. Consumed by continuation composition, CommittedStep pipeline, strategy layer. Produced by `normalizeIntent()` in `conventions/core/pipeline/normalize-intent.ts`. |
| `system-config.ts` | `SystemConfig` (with `suitResponse`, `oneNtResponseAfterMajor` for multi-system support), `SuitResponseForcingDuration`, `OneNtForcingStatus`, `SuitResponseConfig`, `OneNtResponseAfterMajorConfig`, `SAYC_SYSTEM_CONFIG`, `TWO_OVER_ONE_SYSTEM_CONFIG`, `getSystemConfig()`, `AVAILABLE_BASE_SYSTEMS` |
| `system-fact-vocabulary.ts` | System-provided fact IDs (`system.responder.twoLevelNewSuit`, `system.suitResponse.isGameForcing`, `system.oneNtResponseAfterMajor.forcing`, `system.responder.oneNtRange` + 5 original facts). Modules reference these in surface clauses without knowing thresholds. Evaluators parameterized by `SystemConfig` in `conventions/core/pipeline/system-fact-catalog.ts`. |
| `committed-step.ts` | `NegotiationState` (closed semantic negotiation state: `fitAgreed`, `forcing`, `captain`, `competition`), `INITIAL_NEGOTIATION`, `NegotiationDelta`, `ClaimRef` (minimal winning arbitration reference), `CommittedStep` (one adjudicated auction action with `publicActions`, `negotiationDelta`, `stateAfter`, `status`), `AuctionContext` (composite wrapper: `PublicSnapshot` + observation log). Phase 4: `stateAfter` now carries real threaded kernel state for NT (via `negotiationDelta` on rule module claims), not just `INITIAL_NEGOTIATION`. |

## Design Decisions

- **Semantic ownership test for every field.** Before adding a field to a contract type, ask: "does this describe what this type IS in bridge terms, or is it metadata for a different concern?" `BidMeaning` = what a bid means (clauses, encoding, ranking). `BidResult` = what bid was chosen and why. `BidAnnotation` = what a bid reveals to the table. Display formatting, pipeline routing, and table procedures should be derived or computed, not stored. If a field threads through multiple types just to reach a UI consumer, find a different path.
- **Public constraints and alertability are auto-derived, not declared.** Alertability is derived from `sourceIntent.type` — natural intents (small, well-defined set in `alert.ts`) produce no alert; everything else defaults to conventional (alertable). `BidMeaning` does not carry `prioritySpec` or `priorityClass`; the pipeline derives alertability in `resolveAlert()`. Public constraints come from `hand.*` clauses (auto-public) + `isPublic: true` clauses (bundle-declared). Convention authors write clauses and `sourceIntent` once; the framework derives everything else. See `alert.ts` for `isAlertable()`, `resolveAlert()`, and `derivePublicConstraints()`.
- **`DecisionSurface` is consumed via dual-path adapter in the pipeline.** `evaluateAllBidMeanings()` accepts both `BidMeaning[]` and `DecisionSurface[]`. The adapter `adaptMeaningSurface()` / `adaptMeaningSurfaces()` in `conventions/core/pipeline/surface-adapter.ts` maps `BidMeaning` to `DecisionSurface`. Existing `BidMeaning[]` callers are unchanged.
- **`DeclaredEncoderKind` (agreement-module.ts) is distinct from `EncoderKind` (provenance.ts).** `DeclaredEncoderKind` describes the authored encoder type on a surface (`"direct"`, `"choice-set"`, `"frontier-step"`, `"relay-map"`). `EncoderKind` describes how encoding was resolved at runtime (`"default-call"`, `"resolver"`, etc.).
- **`ConditionEvidence` is the sole evidence type.** Unified from the former `ConditionEvidence` (provenance.ts, removed) and `ConditionEvidence` (evidence-bundle.ts). Fields: `conditionId`, `satisfied`, `factId?`, `observedValue?`, `threshold?`. Used by `EvidenceBundle`, `ApplicabilityEvidence.evaluatedConditions`, `EliminationTrace.evidence`, and `MeaningView.supportingEvidence`.

## Canonical Observation Ontology

`bid-action.ts` defines a 17-act bridge-universal vocabulary (`BidAction`) for describing what a bid communicates in convention-erased terms. The acts are: `open`, `show`, `deny`, `inquire`, `transfer`, `accept`, `decline`, `raise`, `place`, `signoff`, `force`, `agree`, `relay`, `overcall`, `double`, `pass`, `redouble`.

**Stability constraint:** New conventions should use existing acts with new parameterizations. Only add a new act when no existing act captures the communicative semantics. The normalization function (`conventions/core/pipeline/normalize-intent.ts`) translates all 77 existing `sourceIntent` types into canonical observations. An exhaustiveness coverage test guards against drift when new surfaces are added.

**Normalization is a migration bridge.** Once modules emit observations directly (Phase 6 of the continuation composition redesign), the normalization layer becomes unnecessary.

## Specificity Derivation System

The `specificity` field is **pipeline-derived, not hand-authored**. `BidMeaning.ranking` uses `AuthoredRankingMetadata` which excludes `specificity` and `specificityBasis`. The pipeline computes specificity via `deriveSpecificity()` at evaluation time and produces a full `RankingMetadata` (with specificity) on `MeaningProposal`. Convention authors cannot and should not set specificity values.

### Architecture

1. **`AuthoredRankingMetadata`** (meaning.ts): What convention authors write — `recommendationBand`, `intraModuleOrder`, optional `modulePrecedence` (defaults to 0 — not hand-authored). No specificity.

2. **`RankingMetadata`** (meaning.ts): Extends `AuthoredRankingMetadata` with `specificity` (number) and `specificityBasis?` (SpecificityBasis). Produced by the pipeline, consumed by arbitration.

3. **`ConstraintDimension`** (meaning.ts): 6-member union type representing communicative dimensions: `suitIdentity`, `suitLength`, `pointRange`, `shapeClass`, `suitRelation`, `suitQuality`.

4. **`constrainsDimensions`** (fact-catalog.ts): REQUIRED field on `FactDefinition`. Lists which dimensions a fact communicates to partner when used in a clause. Assignment rules:
   - Describes what the BID COMMUNICATES, not what the evaluator code reads
   - Boolean facts wrapping multiple checks list the communicative dimensions of the bid, not the code's dependencies
   - Posterior-derived facts use `[]` (they don't contribute to specificity)

5. **`deriveSpecificity()`** (conventions/core/pipeline/specificity-deriver.ts): Computes specificity by collecting the union of constraint dimensions across a surface's clauses. Called by `evaluateBidMeaning()` at pipeline time. Key rules:
   - Boolean clauses with `value: false` are exclusion gates — they contribute nothing when mixed with positive clauses; they contribute `shapeClass` when they ARE the surface's meaning
   - `lte` on suit length = "no fit" = always `shapeClass`
   - Suit-length thresholds below 3 are vacuous (don't count)
   - $suit-bound clauses don't add `suitIdentity` (suit was established by context)
   - Inherited dimensions from prior-round context are unioned in

6. **`classifySpecificityBasis()`** (specificity-classifier.ts): Labels each surface as "derived" / "asserted" / "partial" based on clause transparency.

7. **Linearization canons** (specificity-canons.ts): Numbered rules for resolving incomparable dimension sets. Canon 1 = dimensional count, Canon 2 = dimension priority order.

### Adding new conventions

When adding a new `FactDefinition`, you MUST provide `constrainsDimensions`. The type system enforces this. When adding a new `BidMeaning`, do NOT set `specificity` — `AuthoredRankingMetadata` does not have that field. The pipeline derives it automatically from your clauses and fact definitions.

## Gotchas

- `index.ts` is the public entry point for most consumers; prefer importing from a tier sub-barrel (`engine-types`, `convention-types`, `session-types`) when your dependency is clearly within one tier, or from `../contracts` for backwards compatibility.
- `hand-summary.ts` is intentionally not here; it moved to `src/core/display/hand-summary.ts` because it is formatting logic, not a contract.
- `ResolvedCandidateDTO.allEncodings` carries the full set of resolver encodings with per-encoding legality. `resolvedCall` is always the first legal encoding (or the first encoding if none are legal). Consumers needing the full encoding set (e.g., obligation affinity checking for major suit bids) should use `allEncodings`; consumers needing just the winning call should use `resolvedCall`.

## Shared Vocabulary Placement

The five-registry shared vocabulary model (see root `CLAUDE.md` § Shared Vocabulary Architecture) determines which vocabulary types belong in `contracts/` versus other locations:

| Registry | Where types live | Notes |
|---|---|---|
| **Fact vocabulary** (shared facts) | `contracts/fact-catalog.ts` for `FactDefinition` (with `derivesFrom` DAG), `FactValue`, `EvaluatedFacts`, `FactEvaluatorFn`, `FactCatalog`, `FactCatalogExtension`, `createFactCatalog()`, `SHARED_FACTS` (19 entries: 6 primitive + 8 bridge-derived + 5 posterior-derived). | Shared fact definitions (`hand.hcp`, `bridge.majorFit`) are cross-boundary by nature. Module-derived facts (`module.stayman.*`, `module.transfer.*`, `module.ntResponse.*`) live in `FactCatalogExtension`s in `conventions/definitions/nt-bundle/facts.ts`, composed via `createFactCatalog()`. |
| **Public-state vocabulary** | `contracts/bidding.ts` (`ForcingState`, `BidAlert`). `contracts/alert.ts` (`resolveAlert()`, `derivePublicConstraints()`). Machine registers in `conventions/core/runtime/machine-types.ts`. | Built-in registers (`force`, `obligation`, `agreement`, `competition`, `captaincy`) managed by conversation machine. |
| **Meaning vocabulary** | `contracts/meaning.ts` for `MeaningId`, `SemanticClassId`, `MeaningProposal`, `MeaningClause`, `EvidenceBundle`, `RankingMetadata`, `RecommendationBand`, `BAND_PRIORITY`, `compareRanking()`. | Semantic class IDs (`bridge:nt-invite`, `stayman:ask-major`) are cross-module by definition. |
| **Arbitration / transform vocabulary** | `contracts/meaning.ts` for `RankingMetadata` (`recommendationBand`, `specificity`, `modulePrecedence`, `intraModuleOrder`). `contracts/tree-evaluation.ts` for ranking DTOs (`ResolvedCandidateDTO`). | The selector reads these as scalars, never as raw fact names. |
| **Capability / attachment vocabulary** | `conventions/definitions/capability-vocabulary.ts` for stable capability IDs. `Attachment` in `contracts/agreement-module.ts`. | 4 capabilities defined; more added as conventions exercise host-attachment. |

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

<!-- context-layer: generated=2026-03-07 | last-audited=2026-03-20 | version=4 | dir-commits-at-audit=0 | tree-sig=dirs:1,files:27,exts:ts:25,md:1 -->
