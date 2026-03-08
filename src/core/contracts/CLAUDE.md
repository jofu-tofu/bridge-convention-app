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
| `bidding.ts` | `BiddingContext`, `ForcingState`, `BidAlert`, `BiddingStrategy`, `BidResult`, `BidHistoryEntry` |
| `inference.ts` | `SuitInference`, `HandInference`, `InferredHoldings`, `TreeInferenceConditionEntry`, `TreeInferenceData`, `BeliefData` |
| `tree-evaluation.ts` | `ConditionDetail`, `TreePathEntry`, `TreeForkPoint`, `SiblingConditionDetail`, `SiblingBid`, `CandidateBid`, `CandidateEligibility`, `ResolvedCandidateDTO`, `AlternativeGroup`, `IntentFamily`, `IntentRelationship`, `DecisionTrace`, `CandidateSet`, `EvaluationTrace`, `isDtoSelectable()`, `isDtoPedagogicallyAcceptable()` |
| `play.ts` | `PlayContext`, `PlayResult`, `PlayStrategy` |
| `recommendation.ts` | `PracticalRecommendation`, `ConventionBiddingStrategy` |

## Gotchas

- `index.ts` is the public entry point for most consumers; prefer importing from `../contracts` unless a narrower file import materially improves clarity.
- `hand-summary.ts` is intentionally not here; it moved to `src/core/display/hand-summary.ts` because it is formatting logic, not a contract.

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
