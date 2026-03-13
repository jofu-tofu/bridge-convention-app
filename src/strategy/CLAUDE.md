# Strategy

AI bidding and play strategies. Consumer of `conventions/core/`, `engine/`, `inference/`, and `contracts/`.

## Conventions

- **Dependency direction:** `strategy/ → contracts/ + conventions/core/ + engine/ + inference/`. Engine never imports from strategy/. Conventions never import from strategy/.
- **Strategy pattern.** `BiddingStrategy` and `PlayStrategy` (defined in `contracts/`) are the core interfaces. Strategies are passed to callers by the drill system.
- **`null` means "no opinion."** A strategy returning `null` defers to the next strategy in a chain.
- **Boundary adapter pattern.** `convention-strategy.ts`, `tree-eval-mapper.ts`, and `fit-ranker.ts` are boundary adapters that legitimately import from `conventions/core/` (`ResolvedCandidate`, `TreeEvalResult`, `EffectiveConventionContext`, `PathEntry`). Their job is to map core types to contract DTOs (`ResolvedCandidateDTO`, `DecisionTrace`, `CandidateSet`, `BeliefData`). Do not convert ranker signatures to `ResolvedCandidateDTO` — this would require map→rank→map-back inside the adapter for zero benefit.

## Architecture

```
strategy/
  bidding/
    convention-strategy.ts   conventionToStrategy() — wraps ConventionConfig as BiddingStrategy
    strategy-chain.ts        createStrategyChain(strategies, options?) — tries strategies in order, first non-null wins; optional resultFilter rejects results
    natural-fallback.ts      naturalFallbackStrategy — 6+ HCP with 5+ suit → bid cheapest legal
    pass-strategy.ts         Always-pass placeholder strategy
    practical-recommender.ts computePracticalRecommendation() — fail-closed practical recommendation from candidates + belief. Accepts optional interpretationProvider and pragmaticCandidates.
    practical-scorer.ts      scoreCandidatePractically(), buildPracticalRecommendation() — pure scoring functions. Accepts ScorableCandidate (normative or pragmatic) union type.
    practical-types.ts       PracticalScoreBreakdown, PracticalScoredCandidate, ScorableCandidate — local types (not contracts/)
    pragmatic-generator.ts   generatePragmaticCandidates() — heuristic tactical bids (NT downgrade, competitive overcall, protective double). Import boundary: engine/ + inference/ types only (no conventions/core/ runtime imports).
    tree-eval-mapper.ts      mapVisitedWithStructure(), extractForkPoint(), mapConditionResult() — TreeEvalResult-to-DTO mapping
  play/
    random-play.ts           randomPlay() + randomPlayStrategy (PlayStrategy wrapper)
    heuristic-play.ts        createHeuristicPlayStrategy() — 7-heuristic chain
  __tests__/                 Tests (convention-strategy.test.ts, tree-eval-mapper.test.ts, strategy-chain.test.ts, etc.)
```

**Convention adapter:** `conventionToStrategy(config, options?)` wraps a `ConventionConfig` as a `ConventionBiddingStrategy` (extends `BiddingStrategy` with `getLastPracticalRecommendation()`, `getAcceptableAlternatives()`, and `getIntentFamilies()` accessors). Optional `ConventionStrategyOptions` provides `beliefProvider` (called per-suggest, exceptions caught → undefined), `lookupConvention` (DI seam for registry-free tests), and `ranker` (composes after `config.rankCandidates`: config first, then options). Maps `TreeEvalResult` to `DecisionTrace` + `CandidateSet` DTOs with depth/parent enrichment, fork point extraction, sibling alternatives, and candidate bids. `mapVisitedWithStructure()`, `extractForkPoint()`, `mapConditionResult()` extracted to `tree-eval-mapper.ts`. Also populates `BidResult.treeInferenceData` (`TreeInferenceData` in `contracts/inference.ts`) — extracts hand conditions with `.inference` from the tree evaluation path and rejected branches for positive/negative inference. **Candidate pipeline:** Uses `evaluateBiddingRules(context, config, options?.lookupConvention)`, then `buildEffectiveContext(..., publicBelief?, options?.lookupConvention)` to bundle context + dialogue state + active overlays + optional `BeliefData`, then `generateCandidates()` to resolve all candidates through the intent system (returns `CandidateGenerationResult` with `matchedIntentSuppressed` flag), then `selectMatchedCandidate(candidates, ranker?, forcingState?)` which returns a `SelectionResult` (`{ selected, tierPeers, preRankingPeers, rankerApplied }`). Tiers within `selectMatchedCandidate` use `isSelectable()` (from `candidate-selector.ts`) which checks three eligibility dimensions (hand satisfied, protocol satisfied, encoding legal) — pedagogical is NOT a selection gate instead of raw `c.legal` / `c.failedConditions.length === 0` checks. Within each tier, candidates are sorted by orderKey for deterministic tie-breaking. DTO consumer code uses `isDtoSelectable()` from `contracts/` (falls back to legacy fields when `eligibility` absent). Forcing rules: `ForcingOneRound`/`GameForcing` exclude Pass; `PassForcing` allows only Pass. `generateCandidates()` annotates each `ResolvedCandidate` with optional `provenance` (`tree` | `replacement-tree` | `overlay-injected` | `overlay-override`) and `conventionToStrategy()` maps it onto `ResolvedCandidateDTO`. Candidates with `protocol.satisfied=false` (suppressed/declined) are kept in the array but filtered out by `isSelectable()`. Returns null (defers to next strategy) when selection yields no candidate — whether due to overlay suppression, declined resolvers, illegal resolved calls, or any other reason. Imports from `conventions/core/`: `buildEffectiveContext`, `generateCandidates`, `selectMatchedCandidate`. `formatHandSummary()` now lives in `src/core/display/hand-summary.ts`.

**Tree DTO pipeline:** `TreeEvalResult` (conventions/core/) -> mapped by `mapTreeEvalResult(result, tree, context, conventionId?, roundName?)` -> `{ decisionTrace: DecisionTrace, candidateSet: CandidateSet }` (`contracts/tree-evaluation.ts`) -> `BidResult.decisionTrace` + `BidResult.candidateSet` -> `BidHistoryEntry.decisionTrace` + `BidHistoryEntry.candidateSet` -> UI. `mapTreeEvalResult` calls `findSiblingBids()` and `findCandidateBids()` from conventions/core/ with try/catch for production safety. `CandidateSet.candidates` carries `CandidateBid[]` with intent + source metadata alongside `siblings` (non-optional, `[]` fallback).

**Meaning strategy:** `meaningBundleToStrategy(moduleSurfaces, bundleId, options?)` wraps a bundle's meaning surfaces as a `ConventionBiddingStrategy` (extends `BiddingStrategy` with `getLastProvenance()`, `getLastArbitration()`, `getLastPosteriorSummary()`, `getLastTeachingProjection()` accessors). `getLastTeachingProjection()` lazily calls `projectTeaching()` from `teaching/teaching-projection-builder.ts` after arbitration, caching the result per `suggest()` call. Returns null for tree-pipeline strategies. Accepts optional `surfaceRouter`, optional `conversationMachine` (from `conventions/core/runtime/machine-types`), optional `posteriorEngine` (`PosteriorEngine`), and optional `surfaceRouterForCommitments` (used to build `PublicHandSpace[]` for posterior fact enrichment). Memoizes compiled `PublicHandSpace[]` by auction length to avoid recompilation on each call. **Surface selection precedence:** (1) `conversationMachine` -- FSM evaluates auction state, `activeSurfaceGroupIds` select surfaces via `selectSurfacesViaMachine()`, machine's `collectedTransforms` merged with static transforms; (2) `surfaceRouter` -- legacy `(auction, seat) -> MeaningSurface[]` function; (3) all surfaces when neither present. Both `meaningToStrategy` and `meaningBundleToStrategy` call `composeSurfaces()` upstream (applies suppress transforms to surfaces) then `mergeUpstreamProvenance()` after arbitration to graft transform provenance. `arbitrateMeanings` is transform-free -- all transform handling is upstream. Imports from `conventions/core/runtime/` (machine-types, machine-evaluator) for FSM support.

**Heuristic play chain** (first non-null wins): opening-lead -> second-hand-low -> third-hand-high -> cover-honor-with-honor -> trump-management -> discard-management -> default-lowest.

- `second-hand-low` only fires when following suit (defers to trump/discard when void)
- `trump-management` won't ruff partner's winning trick
- All heuristics return cards from `legalPlays` only; fallback always returns lowest legal card
- `strategy/play/` depends only on `engine/` and `contracts/` — deliberately isolated for independent testing

## Gotchas

- `conventionToStrategy` maps `BiddingRuleResult.rule` to `BidResult.ruleName` (field name change)
- **`systemMode` guard in resolvers:** Convention `IntentResolverFn` implementations must check system mode and return `{ status: "declined" }` when off. Use `getSystemModeFor(state, CAPABILITY_CONSTANT)` from `core/dialogue/dialogue-state` with the convention's capability constant (e.g., `STAYMAN_CAPABILITY` from `definitions/stayman/constants.ts`), NOT `state.systemMode` directly (that's the global default). Do NOT return `{ status: "use_default" }` which would leak the defaultCall. See `stayman/resolvers.ts` for the pattern.
- **EvaluationTrace:** `conventionToStrategy()` attaches an `EvaluationTrace` DTO to every `BidResult`. `createStrategyChain()` records strategy attempts on the trace (including `"filtered"` outcome when `resultFilter` rejects). Always-on (not DEV-gated). `TraceCollector` builder in `trace-collector.ts`. Trace flags: `forcingFiltered` (strategy result rejected by chain's `resultFilter`), `effectivePath` (selected candidate name + overlay/resolver remap indicators when non-default path chosen), `preRankingPeerCount`/`preRankingPeerBidNames` (candidates at same tier before ranker).
- **`resultFilter` on `createStrategyChain()`:** Generic `(result: BidResult, context: BiddingContext) => boolean` predicate. When the filter returns false, the chain treats the result as "declined" and tries the next strategy. Used by `config-factory.ts` with `createForcingFilter(config)` — rejects Pass results when DialogueState has active forcing. End-to-end guarantee: no strategy (including `passStrategy`) can produce a result that fails the filter.
- **Sibling enrichment:** `enrichSiblingsWithResolvedCalls()` in `tree-eval-mapper.ts` joins sibling bids with resolved candidates on `bidName` so the UI shows hand-specific resolved calls, not just `defaultCall`. Also populates optional `resolverContext` (`{ intentType, wasRemapped }`) when the resolver diverged from defaultCall. Pure function. Wired in `mapTreeEvalResult()` after both collections are computed.
- Tests may either use `clearRegistry()`/`registerConvention()` integration setup or inject `lookupConvention` for registry-free unit cases

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

**Staleness anchor:** This file assumes `bidding/convention-strategy.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-02-25 | last-audited=2026-03-01 | version=4 | dir-commits-at-audit=0 | tree-sig=dirs:4,files:8,exts:ts:7,md:1 -->
