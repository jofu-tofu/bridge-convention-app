# Teaching

Convention teaching resolution, projection building, and parse-tree construction. Sibling of `pipeline/` and `definitions/` inside `conventions/`. Consumer of `engine/`, `conventions/core/`, and sibling `pipeline/`.

## Architecture

| File                       | Role                                                              |
| -------------------------- | ----------------------------------------------------------------- |
| `teaching-types.ts`        | Merged teaching contract types (from former `core/contracts/teaching-grading.ts` + `teaching-projection.ts`). Contains: `BidGrade`, `TeachingResolution`, `AcceptableBid`, `SurfaceGroup`, `SurfaceGroupRelationship`, `TeachingProjection`, `CallProjection`, `MeaningView`, `ExplanationNode`, `WhyNotEntry`, `ConventionContribution`, `HandSpaceSummary`, `ParseTreeView`, `ParseTreeModuleNode`, `ParseTreeCondition`, `ParseTreeModuleVerdict`. |
| `teaching-resolution.ts`   | `BidGrade` (3 grades: Correct/Acceptable/Incorrect), `AcceptableBid` (with optional `relationship: SurfaceGroupRelationship`), `TeachingResolution`, `resolveTeachingAnswer(bidResult, surfaceGroups?)`, `gradeBid(userCall, resolution)` — three-grade bid feedback layer with SurfaceGroup-aware grading |
| `teaching-projection-builder.ts` | `projectTeaching(result: PipelineResult, options?)` — single-signature entry point, builds read-only `TeachingProjection` from `PipelineResult`. Internally converts to `ArbitrationResult`/`DecisionProvenance` for sub-builders. Pure function, no side effects. Produces `CallProjection[]` (with `projectionKind` classification), `MeaningView[]`, `WhyNotEntry[]`, `ConventionContribution[]`, `ExplanationNode[]`, `HandSpaceSummary`. All types imported from `teaching-types.ts`. |
| `parse-tree-builder.ts` | `buildParseTree(result: PipelineResult, catalogIndex?)` — builds `ParseTreeView` from `PipelineResult`. Shows full post-bid decision chain: which convention modules were considered, why each was accepted or rejected, and the path to the correct bid. Each module gets a `ParseTreeModuleVerdict` (`selected` / `applicable` / `eliminated`) with conditions, truth-set meanings, and elimination reasons. Sorted: selected → applicable → eliminated. Integrated into Incorrect and NearMiss feedback panels via `ParseTreePanel.svelte`. |
| `call-view-builder.ts` | `buildCallViews(arbitration)` — builds `CallProjection[]` from truth set and acceptable set. |
| `meaning-view-builder.ts` | `buildMeaningViews(arbitration, provenance)` — builds `MeaningView[]` from truth set, acceptable set, and eliminated proposals. |
| `explanation-builder.ts` | `buildClauseDescriptionIndex(arbitration)`, `buildPrimaryExplanation(arbitration, provenance, catalogIndex?)` — builds primary explanation nodes. |
| `why-not-builder.ts` | `buildWhyNot(arbitration, provenance, catalogIndex?, surfaceGroups?, truthMeaningIds?)` — builds `WhyNotEntry[]` for calls in acceptable set but not truth set. Grades entries as "near-miss" or "wrong" based on SurfaceGroup membership. |

## Boundary Rules

- **Allowed imports:** `../../engine/`, sibling `../core/` (convention types), sibling `../pipeline/` (evidence-bundle, provenance, pipeline-types)
- **Blocked imports:** `components/`, `stores/`, `service/display/`, `strategy/`, `inference/`
- **Circular import warning:** Teaching files must use direct sibling imports (e.g., `../pipeline/pipeline-types`), never the conventions barrel (`../index` or `../../conventions`). Importing the barrel from inside conventions creates a circular dependency. This matches the pattern used by `pipeline/` and `core/` files.

## Public API

Only 3 entry points are exported via the conventions barrel (`conventions/index.ts`):
- `resolveTeachingAnswer`, `gradeBid`, `BidGrade` (+ types `AcceptableBid`, `TeachingResolution`)
- `projectTeaching` (+ type `TeachingProjectionOptions`)
- `buildParseTree`

Sub-builders (`call-view-builder`, `meaning-view-builder`, `explanation-builder`, `why-not-builder`) are internal — zero external consumers.

## Pedagogical Separation

Pedagogical acceptability is NOT a selection gate in the candidate pipeline. Instead, `isDtoTeachingAcceptable()` (contracts) is a post-selection annotation. `isTeachingEligible()` in `teaching-resolution.ts` checks hand+encoding+pedagogical for teaching candidate filtering.

---

## Context Maintenance

**Staleness anchor:** This file assumes `teaching-resolution.ts` exists. If it doesn't, this file is stale.
