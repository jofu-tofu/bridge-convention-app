# Teaching

Convention teaching resolution, projection building, and pedagogical weighting. Consumer of `engine/`, `core/contracts/`.

## Architecture

| File                       | Role                                                              |
| -------------------------- | ----------------------------------------------------------------- |
| `teaching-resolution.ts`   | `BidGrade` (3 grades: Correct/Acceptable/Incorrect), `AcceptableBid` (with optional `relationship: IntentRelationship`), `TeachingResolution`, `resolveTeachingAnswer(bidResult, alternativeGroups?, intentFamilies?)`, `gradeBid(userCall, resolution)` — three-grade bid feedback layer with IntentFamily-aware grading |
| `teaching-projection-builder.ts` | `projectTeaching(arbitration, provenance, options?)` — builds read-only `TeachingProjection` from `ArbitrationResult` + `DecisionProvenance`. Pure function, no side effects. Produces `CallProjection[]` (with `projectionKind` classification), `MeaningView[]`, `WhyNotEntry[]` (with optional `familyRelation` from pedagogical graph), `ConventionContribution[]`, `ExplanationNode[]`, `SeatRelativeHandSpaceSummary`. All types imported from `core/contracts/`. |
| `pedagogical-graph.ts` | `buildPedagogicalGraph(relations)` — indexes `PedagogicalRelation[]` by meaning ref for O(1) lookup. `findRelationsFor(graph, meaningRef)`. Pure functions, consumed by `teaching-projection-builder.ts`. |
| `pedagogical-weighting.ts` | `computeScenarioDistribution(controls)` — maps `PedagogicalControls.weightingMode` to scenario distribution parameters (positive/nearBoundary/competitive fractions). |

## Deleted Files (old pipeline)

The following files were removed as part of the old tree-pipeline cleanup:
- `teaching-content.ts` — walked protocol trees to extract teaching content. Replaced by `TeachingProjection` via `teaching-projection-builder.ts`.
- `condition-explanations.ts` — provided condition explanations tied to `RuleCondition` system. Replaced by explanation catalog in `core/contracts/`.
- `tree-projection-adapter.ts` — adapted tree-pipeline `BidResult` → `TeachingProjection`. No longer needed; `teaching-projection-builder.ts` builds projections from `ArbitrationResult`.

## Boundary Rules

- **Allowed imports:** `engine/`, `core/contracts/`
- **Blocked imports:** `conventions/core/`, `components/`, `stores/`, `core/display/`, `strategy/`, `bootstrap/`, `inference/`

## Pedagogical Separation

Pedagogical acceptability is NOT a selection gate in the candidate pipeline. Instead, `isPedagogicallyAcceptable()` (pipeline) and `isDtoPedagogicallyAcceptable()` (contracts) are post-selection annotations. `isTeachingEligible()` in `teaching-resolution.ts` checks hand+protocol+encoding+pedagogical for teaching candidate filtering.

---

## Context Maintenance

**Staleness anchor:** This file assumes `teaching-resolution.ts` exists. If it doesn't, this file is stale.

<!-- context-layer: generated=2026-03-07 | last-audited=2026-06-11 | version=2 | tree-sig=dirs:2,files:5,exts:ts:4,md:1 -->
