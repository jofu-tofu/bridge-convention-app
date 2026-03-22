# Strategy

AI bidding and play strategies. Consumer of `conventions/core/`, `engine/`, `inference/`, and `contracts/`.

## Conventions

- **Dependency direction:** `strategy/ → contracts/ + conventions/core/ + engine/ + inference/`. Engine never imports from strategy/. Conventions never import from strategy/.
- **Strategy pattern.** `BiddingStrategy` and `PlayStrategy` (defined in `contracts/`) are the core interfaces. Strategies are passed to callers by the drill system.
- **`null` means "no opinion."** A strategy returning `null` defers to the next strategy in a chain.

## Architecture

```
strategy/
  bidding/
    meaning-strategy.ts      meaningToStrategy() / meaningBundleToStrategy() — wraps MeaningSurfaces as ConventionStrategy via fact-evaluator → meaning-evaluator → meaning-arbitrator pipeline
    strategy-chain.ts        createStrategyChain(strategies, options?) — tries strategies in order, first non-null wins; optional resultFilter rejects results
    natural-fallback.ts      naturalFallbackStrategy — 6+ HCP with 5+ suit → bid cheapest legal
    pass-strategy.ts         Always-pass placeholder strategy
    practical-scorer.ts      scoreCandidatePractically(), buildPracticalRecommendation() — pure scoring functions. Accepts ScorableCandidate (normative or pragmatic) union type.
    practical-types.ts       PracticalScoreBreakdown, ScoredCandidate, ScorableCandidate — local types (not contracts/)
    protocol-adapter.ts      protocolSpecToStrategy() — ConventionSpec → ConventionStrategy. Rule-only path: buildObservationLogViaRules() with per-step kernel threading, no FSM replay. All bundles use `ConventionSpec.modules` (unified ConventionModule). Phase 6: incremental local FSM phase caching in `buildObservationLogViaRules()` — O(N×M) instead of O(N²×M). Claims carry deltas directly (no `enrichResults()` re-scan). Exports buildObservationLogViaRules(), findMatchingClaimForCall().
    pragmatic-generator.ts   generatePragmaticCandidates() — heuristic tactical bids (NT downgrade, competitive overcall, protective double). Import boundary: engine/ + inference/ types only (no conventions/core/ runtime imports).
    trace-collector.ts       TraceCollector — mutable builder for EvaluationTrace DTO
  play/
    random-play.ts           createRandomPlayStrategy(rng?) factory + randomPlayStrategy default instance
    heuristic-play.ts        createHeuristicPlayStrategy() — 7-heuristic chain
  __tests__/                 Tests (evaluation-trace.test.ts, strategy-chain.test.ts, meaning-strategy.test.ts, etc.)
```

**Meaning strategy:** `meaningBundleToStrategy(moduleSurfaces, bundleId, options?)` wraps a bundle's meaning surfaces as a `ConventionStrategy` (extends `BiddingStrategy` with single `getLastEvaluation(): StrategyEvaluation | null` returning all pipeline outputs). `PipelineOutput.result` is `PipelineResult`. `StrategyEvaluation` has `pipelineResult: PipelineResult | null` (not the old `provenance` + `arbitration` fields). `getLastEvaluation().teachingProjection` lazily calls `projectTeaching()` from `teaching/teaching-projection-builder.ts` after arbitration, caching the result per `suggest()` call. Accepts optional `surfaceRouter`, optional `conversationMachine` (from `conventions/core/runtime/machine-types`), optional `posteriorEngine` (`PosteriorEngine`), and optional `surfaceRouterForCommitments` (used to build `PublicHandSpace[]` for posterior fact enrichment). Memoizes compiled `PublicHandSpace[]` by auction length to avoid recompilation on each call. **Surface selection precedence:** (1) `conversationMachine` -- FSM evaluates auction state, `activeSurfaceGroupIds` select surfaces via `selectSurfacesViaMachine()`; (2) `surfaceRouter` -- legacy `(auction, seat) -> BidMeaning[]` function; (3) all surfaces when neither present. `runMeaningPipeline()` is the core pipeline entry point: surfaces -> facts -> evaluate -> arbitrate. Imports from `conventions/core/runtime/` (machine-types) for FSM support.

**Heuristic play chain** (first non-null wins): opening-lead -> second-hand-low -> third-hand-high -> cover-honor-with-honor -> trump-management -> discard-management -> default-lowest.

- `second-hand-low` only fires when following suit (defers to trump/discard when void)
- `trump-management` won't ruff partner's winning trick
- All heuristics return cards from `legalPlays` only; fallback always returns lowest legal card
- `strategy/play/` depends only on `engine/` and `contracts/` — deliberately isolated for independent testing

## Gotchas

- **EvaluationTrace:** `TraceCollector` in `trace-collector.ts` builds `EvaluationTrace` DTOs. `createStrategyChain()` records strategy attempts on the trace (including `"filtered"` outcome when `resultFilter` rejects). Always-on (not DEV-gated). Trace flags: `forcingFiltered` (strategy result rejected by chain's `resultFilter`).
- **`resultFilter` on `createStrategyChain()`:** Generic `(result: BidResult, context: BiddingContext) => boolean` predicate. When the filter returns false, the chain treats the result as "declined" and tries the next strategy. Available infrastructure not yet wired into production.
- **Pragmatic generator** `callKeyForDedup()` is a local utility in `pragmatic-generator.ts` — creates string keys from Calls for deduplication against existing convention candidates.

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

**Staleness anchor:** This file assumes `bidding/meaning-strategy.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-02-25 | last-audited=2026-03-01 | version=4 | dir-commits-at-audit=0 | tree-sig=dirs:4,files:8,exts:ts:7,md:1 -->
