# Teaching

Convention evaluation and teaching content extraction. Consumer of `conventions/core/`, `engine/`, `core/contracts/`, `core/util/`.

## Architecture

| File                       | Role                                                              |
| -------------------------- | ----------------------------------------------------------------- |
| `teaching-content.ts`      | `extractTeachingContent()`, `evaluateTeachingRound()` — extract structured teaching data from convention trees |
| `condition-explanations.ts` | `getConditionExplanation()`, `getConditionExplanationWithParams()`, `getFailureExplanation()` — condition teaching text from inference types |
| `teaching-resolution.ts`   | `BidGrade`, `AcceptableBid`, `TeachingResolution`, `resolveTeachingAnswer()`, `gradeBid()` — multi-grade bid feedback layer |

## Boundary Rules

- **Allowed imports:** `conventions/core/`, `engine/`, `core/contracts/`, `core/util/`
- **Blocked imports:** `components/`, `stores/`, `core/display/`, `strategy/`, `bootstrap/`, `inference/`

---

## Context Maintenance

**Staleness anchor:** This file assumes `teaching-content.ts` exists. If it doesn't, this file is stale.

<!-- context-layer: generated=2026-03-07 | version=1 | tree-sig=dirs:2,files:5,exts:ts:4,md:1 -->
