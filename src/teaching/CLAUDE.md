# Teaching

Convention evaluation and teaching content extraction. Consumer of `conventions/core/`, `engine/`, `core/contracts/`, `core/util/`.

## Architecture

| File                       | Role                                                              |
| -------------------------- | ----------------------------------------------------------------- |
| `teaching-content.ts`      | `extractTeachingContent()`, `evaluateTeachingRound()` — extract structured teaching data from convention trees |
| `condition-explanations.ts` | `getConditionExplanation()`, `getConditionExplanationWithParams()`, `getFailureExplanation()` — condition teaching text from inference types |
| `teaching-resolution.ts`   | `BidGrade` (5 grades: Correct/CorrectButNotPreferred/Acceptable/NearMiss/Wrong), `AcceptableBid` (with optional `relationship: IntentRelationship`), `NearMissContext`, `TeachingResolution`, `resolveTeachingAnswer(bidResult, alternativeGroups?, intentFamilies?)`, `gradeBid(userCall, resolution, nearMissContext?)` — five-grade bid feedback layer with IntentFamily-aware grading and near-miss detection |
| `teaching-projection-builder.ts` | `projectTeaching(arbitration, provenance, options?)` — builds read-only `TeachingProjection` from `ArbitrationResult` + `DecisionProvenance`. Pure function, no side effects. Produces `CallProjection[]` (with `projectionKind` classification), `MeaningView[]`, `WhyNotEntry[]` (with optional `familyRelation` from pedagogical graph), `ConventionContribution[]`, `ExplanationNode[]`, `SeatRelativeHandSpaceSummary`. `TeachingProjectionOptions` accepts optional `pedagogicalRelations` for enriching WhyNot entries with family context. All types imported from `core/contracts/` (provenance, teaching-projection, module-surface, meaning, evidence-bundle, evaluation-dtos, pedagogical-relations). Re-exports contract types for downstream consumers. |
| `pedagogical-graph.ts` | `buildPedagogicalGraph(relations)` — indexes `PedagogicalRelation[]` by meaning ref for O(1) lookup. `findRelationsFor(graph, meaningRef)` — returns all relations involving a given meaning ref. Pure functions, consumed by `teaching-projection-builder.ts`. |

## Boundary Rules

- **Allowed imports:** `conventions/core/`, `engine/`, `core/contracts/`, `core/util/`
- **Blocked imports:** `components/`, `stores/`, `core/display/`, `strategy/`, `bootstrap/`, `inference/`

## Pedagogical Separation

Pedagogical acceptability is NOT a selection gate in the candidate pipeline (`isSelectable()` checks 3 dims: hand, protocol, encoding). Instead, `isPedagogicallyAcceptable()` (pipeline) and `isDtoPedagogicallyAcceptable()` (contracts) are post-selection annotations. `isTeachingEligible()` in `teaching-resolution.ts` checks hand+protocol+encoding for teaching candidate filtering.

---

## Context Maintenance

**Staleness anchor:** This file assumes `teaching-content.ts` exists. If it doesn't, this file is stale.

<!-- context-layer: generated=2026-03-07 | version=1 | tree-sig=dirs:2,files:5,exts:ts:4,md:1 -->
