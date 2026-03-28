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

---

## Context Maintenance

**Staleness anchor:** This file assumes `protocol-adapter.ts` exists. If it doesn't, this file is stale.
