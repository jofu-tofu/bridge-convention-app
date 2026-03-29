# Conventions Adapter

Bridges the convention pipeline to the BiddingStrategy interface. This is the convention-pipeline orchestration layer — it takes convention modules/specs and wraps them as strategies the session layer can call.

## Architecture

| File | Role |
|------|------|
| `meaning-strategy.ts` | meaningToStrategy() — wraps MeaningSurfaces as ConventionStrategy |
| `protocol-adapter.ts` | protocolSpecToStrategy() — ConventionSpec → ConventionStrategy. Exports buildObservationLogViaRules(), findMatchingClaimForCall(). Threads `fitAgreed` from the observation log's last kernel state into `RelationalFactContext` for trump-context-aware system facts. |
| `bid-result-builder.ts` | Builds BidResult from pipeline output |
| `practical-scorer.ts` | scoreCandidatePractically(), buildPracticalRecommendation(), LEVEL_HCP_TABLE |
| `practical-types.ts` | ScoredCandidate, ScorableCandidate — local types |
| `trace-collector.ts` | TraceCollector — mutable builder for EvaluationTrace DTO |

## Dependency Direction

adapter/ imports from conventions/ internals (pipeline, core, teaching) and engine/. It is exported through the conventions barrel (`conventions/index.ts`).

## Rust Port

The adapter layer has a Rust port in `src-tauri/crates/bridge-conventions/src/adapter/`
(protocol_adapter.rs, meaning_strategy.rs, practical_scorer.rs, strategy_evaluation.rs,
tree_evaluation.rs). TS remains the production path — Rust is shadow-validated only (Phase 3).

**Rust `ConventionStrategy` API:** `suggest(&self, context, next_seat, facts, is_legal, inherited_dims) -> (Option<BidResult>, StrategyEvaluation)` — returns debug payload as out-param so strategy stays `&self` (immutable). This is an intentional Rust idiom divergence from the TS mutable pattern. All Phase 4+ strategy implementors must follow this contract.

---

## Context Maintenance

**Staleness anchor:** This file assumes `protocol-adapter.ts` exists. If it doesn't, this file is stale.
