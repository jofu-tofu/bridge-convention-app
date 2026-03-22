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
| `index.ts` | Barrel re-export (delegates to the 3 tier sub-barrels) |
| `engine-types.ts` | Tier 1 sub-barrel: engine-stable bridge primitives |
| `convention-types.ts` | Tier 2 sub-barrel: convention pipeline infrastructure |
| `session-types.ts` | Tier 3 sub-barrel: session lifecycle and UI preferences |
| `bidding.ts` | Bidding context, forcing state, bid alerts, strategy interface, bid results |
| `inference.ts` | Suit/hand inference, qualitative constraints, public beliefs |
| `tree-evaluation.ts` | Candidate eligibility, alternative groups, intent families, evaluation trace |
| `play.ts` | Play context, results, strategy interface |
| `recommendation.ts` | Practical recommendation, posterior summary, strategy evaluation DTO |
| `module-surface.ts` | Public snapshot (epistemic layers), module surfaces, arbitration results |
| `meaning.ts` | BidMeaning (authored meaning units), clauses, ranking, semantic classes, teaching tags |
| `fact-catalog.ts` | Fact definitions (with `constrainsDimensions`), evaluators, catalog, extensions, shared facts (19) |
| `alert.ts` | Alert resolution and public constraint derivation from surface properties |
| `provenance.ts` | Full decision provenance DTOs for pipeline tracing |
| `teaching-projection.ts` | Teaching-optimized views for "why not X?" UI |
| `predicates.ts` | Typed predicate surfaces scoped by evaluation world |
| `evidence-bundle.ts` | `ConditionEvidence` (sole evidence type), rejection/alternative evidence |
| `posterior.ts` | **Deprecated** — old posterior engine contracts. Migrate to factor-graph/query/backend. |
| `factor-graph.ts` | Convention-erased factor graph IR for posterior boundary |
| `posterior-query.ts` | Consumer-facing query interface for posterior inference |
| `posterior-backend.ts` | Backend contract for posterior sampling (replaceable: TS or Rust/WASM) |
| `agreement-module.ts` | Agreement module IR: priority specs, decision surfaces, system profiles, closure policies |
| `deal-spec.ts` | DealSpec IR types for deal generation |
| `explanation-catalog.ts` | Explanation catalog entries for teaching projections |
| `convention.ts` | Convention registry types and deal constraint shapes |
| `fact-helpers.ts` | Shared utilities for fact evaluators (`num()`, `bool()`, `fv()`) |
| `shared-facts.ts` | Bridge-universal fact vocabulary (primitive + bridge-derived) |
| `teaching-grading.ts` | BidGrade, TeachingResolution — cross-boundary grading types |
| `drill.ts` | Drill session tuning DTOs (opponent mode, vulnerability, tuning) |
| `teaching-tag.ts` | Teaching tag types for deriving pedagogical content from surfaces |
| `bid-action.ts` | 17-act bridge-universal observation vocabulary for convention-erased pattern matching |
| `system-config.ts` | SystemConfig with per-system thresholds (SAYC, 2/1, Acol) |
| `system-fact-vocabulary.ts` | System-provided fact IDs for system-dependent surface clauses |
| `committed-step.ts` | NegotiationState, CommittedStep, AuctionContext — adjudicated auction actions |

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

1. **`AuthoredRankingMetadata`** (meaning.ts): What convention authors write — `recommendationBand`, `declarationOrder`, optional `modulePrecedence` (defaults to 0 — not hand-authored). No specificity.

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

## System Parameterization

The app supports multiple base bidding systems (SAYC, 2/1 Game Forcing, Acol). Modules are system-agnostic — the same module works in any system. System differences flow through `SystemConfig` → system facts → surface clause evaluation.

**How it works:**

1. `SystemConfig` (`system-config.ts`) captures system-level parameters: HCP thresholds, forcing durations, 1NT response forcing status. Concrete configs: `SAYC_SYSTEM_CONFIG`, `TWO_OVER_ONE_SYSTEM_CONFIG`, `ACOL_SYSTEM_CONFIG`.

2. System facts (`system-fact-vocabulary.ts`) provide stable fact IDs that modules reference in surface clauses without knowing the thresholds. Evaluators in `system-fact-catalog.ts` are parameterized by `SystemConfig` via closures.

3. At runtime, `specFromBundle(bundle, systemConfigOverride?)` injects the selected system's config. `createProtocolDrillConfig()` requires `{ baseSystem: BaseSystemId }` to select the active system.

4. **Backend never defaults; boundaries default.** Backend functions take `BaseSystemId` explicitly. Only user-facing boundaries provide defaults: UI store (`app.svelte.ts`), CLI (`parseBaseSystem()`), service layer (`local-service.ts`).

**Three categories of system differences:**

| Category | Example | Mechanism |
|----------|---------|-----------|
| **Parametric** (different thresholds, same meaning) | 2-level response: 10+ HCP (SAYC) vs 12+ HCP (2/1) | `SystemConfig` field → system fact → surface clause |
| **Semantic** (different forcing promise, same bid) | 2-level response: one-round forcing (SAYC) vs game-forcing (2/1) | `SystemConfig` field → system fact → `NegotiationDelta` on claims |
| **Inverted** (same bid, opposite meaning) | Jump shift: strong (SAYC) vs weak (2/1) | One module, both meanings as surfaces, gated by system fact clause |

**Module author guide:**

- **Never import concrete system configs.** Receive `SystemConfig` via factory parameter.
- **Reference system facts by ID** from `system-fact-vocabulary.ts`. Never hardcode system-dependent thresholds.
- **For inverted meanings:** Author surfaces for ALL system variants in the same module, gated by system fact clauses.
- **Convention-intrinsic thresholds** (Bergen 7-10, Weak Two 5-10) stay as named constants — they don't change between systems.
- **SystemConfig naming:** Use convention-universal names scoped to auction context (`suitResponse` not `twoOverOne`).

**SystemConfig fields:**

| Group | Field | SAYC | 2/1 | Purpose |
|-------|-------|------|-----|---------|
| `ntOpening` | `minHcp`, `maxHcp` | 15, 17 | 15, 17 | 1NT opening HCP range |
| `responderThresholds` | `inviteMin`, `inviteMax`, `gameMin`, `slamMin` | 8, 9, 10, 15 | 8, 9, 10, 15 | Responder HCP buckets (1NT context) |
| `openerRebid` | `notMinimum` | 16 | 16 | Opener rebid threshold |
| `interference` | `redoubleMin` | 10 | 10 | Interference threshold |
| `suitResponse` | `twoLevelMin` | 10 | 12 | Min HCP for 2-level new suit |
| `suitResponse` | `twoLevelForcingDuration` | `"one-round"` | `"game"` | Forcing promise of 2-level response |
| `oneNtResponseAfterMajor` | `forcing` | `"non-forcing"` | `"semi-forcing"` | 1NT response forcing status after 1M |
| `oneNtResponseAfterMajor` | `maxHcp` | 10 | 12 | Max HCP for 1NT response to 1M |

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
| **Arbitration vocabulary** | `contracts/meaning.ts` for `RankingMetadata` (`recommendationBand`, `specificity`, `modulePrecedence`, `declarationOrder`). `contracts/tree-evaluation.ts` for ranking DTOs (`ResolvedCandidateDTO`). | The selector reads these as scalars, never as raw fact names. |
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

<!-- context-layer: generated=2026-03-07 | last-audited=2026-03-22 | version=5 | dir-commits-at-audit=0 | tree-sig=dirs:1,files:27,exts:ts:25,md:1 -->
