# Teaching

Convention evaluation and teaching content extraction. Consumer of `conventions/core/`, `engine/`, `core/contracts/`, `core/util/`.

## Architecture

| File                       | Role                                                              |
| -------------------------- | ----------------------------------------------------------------- |
| `teaching-content.ts`      | `extractTeachingContent()`, `evaluateTeachingRound()` — extract structured teaching data from convention trees |
| `condition-explanations.ts` | `getConditionExplanation()`, `getConditionExplanationWithParams()`, `getFailureExplanation()` — condition teaching text from inference types |
| `teaching-resolution.ts`   | `BidGrade`, `AcceptableBid` (with optional `relationship: IntentRelationship`), `TeachingResolution`, `resolveTeachingAnswer(bidResult, alternativeGroups?, intentFamilies?)`, `gradeBid()` — multi-grade bid feedback layer with IntentFamily-aware grading |

## Boundary Rules

- **Allowed imports:** `conventions/core/`, `engine/`, `core/contracts/`, `core/util/`
- **Blocked imports:** `components/`, `stores/`, `core/display/`, `strategy/`, `bootstrap/`, `inference/`

## Pedagogical Separation

Pedagogical acceptability is NOT a selection gate in the candidate pipeline (`isSelectable()` checks 3 dims: hand, protocol, encoding). Instead, `isPedagogicallyAcceptable()` (pipeline) and `isDtoPedagogicallyAcceptable()` (contracts) are post-selection annotations. `isTeachingEligible()` in `teaching-resolution.ts` checks hand+protocol+encoding for teaching candidate filtering.

---

## Context Maintenance

**Staleness anchor:** This file assumes `teaching-content.ts` exists. If it doesn't, this file is stale.

<!-- context-layer: generated=2026-03-07 | version=1 | tree-sig=dirs:2,files:5,exts:ts:4,md:1 -->
