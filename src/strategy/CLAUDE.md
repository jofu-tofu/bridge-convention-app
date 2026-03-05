# Strategy

AI bidding and play strategies. Consumer of `conventions/core/`, `engine/`, `inference/`, and `shared/types`.

## Conventions

- **Dependency direction:** `strategy/ → shared/ + conventions/core/ + engine/ + inference/`. Engine never imports from strategy/. Conventions never import from strategy/.
- **Strategy pattern.** `BiddingStrategy` and `PlayStrategy` (defined in `shared/types.ts`) are the core interfaces. Strategies are passed to callers by the drill system.
- **`null` means "no opinion."** A strategy returning `null` defers to the next strategy in a chain.

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
    practical-types.ts       PracticalScoreBreakdown, PracticalScoredCandidate, ScorableCandidate — local types (not shared/)
    pragmatic-generator.ts   generatePragmaticCandidates() — heuristic tactical bids (NT downgrade, competitive overcall, protective double). Import boundary: engine/ + inference/ types only (no conventions/core/ runtime imports).
    tree-eval-mapper.ts      mapVisitedWithStructure(), extractForkPoint(), mapConditionResult() — TreeEvalResult-to-DTO mapping
  play/
    random-play.ts           randomPlay() + randomPlayStrategy (PlayStrategy wrapper)
    heuristic-play.ts        createHeuristicPlayStrategy() — 7-heuristic chain
  __tests__/                 Tests (convention-strategy.test.ts, tree-eval-mapper.test.ts, strategy-chain.test.ts, etc.)
```

**Convention adapter:** `conventionToStrategy(config, options?)` wraps a `ConventionConfig` as a `BiddingStrategy`. Optional `ConventionStrategyOptions` provides `beliefProvider` (called per-suggest, exceptions caught → undefined), `lookupConvention` (DI seam for registry-free tests), and `ranker` (composes after `config.rankCandidates`: config first, then options). Maps `TreeEvalResult` to `TreeEvalSummary` DTO with depth/parent enrichment, fork point extraction, sibling alternatives, and candidate bids. `mapVisitedWithStructure()`, `extractForkPoint()`, `mapConditionResult()` extracted to `tree-eval-mapper.ts`. Also populates `BidResult.treeInferenceData` (`TreeInferenceData` in `shared/types.ts`) — extracts hand conditions with `.inference` from the tree evaluation path and rejected branches for positive/negative inference. **Candidate pipeline:** Uses `evaluateBiddingRules(context, config, options?.lookupConvention)`, then `buildEffectiveContext(..., publicBelief?, options?.lookupConvention)` to bundle context + dialogue state + active overlays + optional `BeliefData`, then `generateCandidates()` to resolve all candidates through the intent system (returns `CandidateGenerationResult` with `matchedIntentSuppressed` flag), then `selectMatchedCandidate(candidates, ranker?, forcingState?)` to pick the matched candidate's resolved call. Forcing rules: `ForcingOneRound`/`GameForcing` exclude Pass; `PassForcing` allows only Pass. `generateCandidates()` annotates each `ResolvedCandidate` with optional `provenance` (`tree` | `replacement-tree` | `overlay-injected` | `overlay-override`) and `conventionToStrategy()` maps it onto `ResolvedCandidateDTO`. When `matchedIntentSuppressed && !selected`, returns `null` (convention declines to bid, deferring to next strategy). Falls back to `defaultCall` if no candidate is selected or resolver returns null/illegal/throws. Imports from `conventions/core/`: `buildEffectiveContext`, `generateCandidates`, `selectMatchedCandidate`.

**Tree DTO pipeline:** `TreeEvalResult` (conventions/core/) -> mapped by `mapTreeEvalResult(result, tree, context, conventionId?, roundName?)` -> `TreeEvalSummary` (shared/types.ts) -> `BidResult.treePath` -> `BidHistoryEntry.treePath` -> UI. `mapTreeEvalResult` calls `findSiblingBids()` and `findCandidateBids()` from conventions/core/ with try/catch for production safety. `TreeEvalSummary.candidates` carries `CandidateBid[]` with intent + source metadata alongside backward-compatible `siblings`.

**Heuristic play chain** (first non-null wins): opening-lead -> second-hand-low -> third-hand-high -> cover-honor-with-honor -> trump-management -> discard-management -> default-lowest.

- `second-hand-low` only fires when following suit (defers to trump/discard when void)
- `trump-management` won't ruff partner's winning trick
- All heuristics return cards from `legalPlays` only; fallback always returns lowest legal card
- `strategy/play/` depends only on `engine/` and `shared/` — deliberately isolated for independent testing

## Gotchas

- `conventionToStrategy` maps `BiddingRuleResult.rule` to `BidResult.ruleName` (field name change)
- **`systemMode` guard in resolvers:** Convention `IntentResolverFn` implementations must check system mode and return `{ status: "declined" }` when off. Use `getSystemModeFor(state, CAPABILITY_CONSTANT)` from `core/dialogue/dialogue-state` with the convention's capability constant (e.g., `STAYMAN_CAPABILITY` from `definitions/stayman/constants.ts`), NOT `state.systemMode` directly (that's the global default). Do NOT return `{ status: "use_default" }` which would leak the defaultCall. See `stayman/resolvers.ts` for the pattern.
- **EvaluationTrace:** `conventionToStrategy()` attaches an `EvaluationTrace` DTO to every `BidResult`. `createStrategyChain()` records strategy attempts on the trace (including `"filtered"` outcome when `resultFilter` rejects). Always-on (not DEV-gated). `TraceCollector` builder in `trace-collector.ts`. Trace flags: `forcingDeclined` (protocol matched + no selected candidate in forcing auctions), `forcingFiltered` (strategy result rejected by chain's `resultFilter`), `effectivePath` (selected candidate name + overlay/resolver remap indicators when non-default path chosen).
- **`resultFilter` on `createStrategyChain()`:** Generic `(result: BidResult, context: BiddingContext) => boolean` predicate. When the filter returns false, the chain treats the result as "declined" and tries the next strategy. Used by `config-factory.ts` with `createForcingFilter(config)` — rejects Pass results when DialogueState has active forcing. End-to-end guarantee: no strategy (including `passStrategy`) can produce a result that fails the filter.
- **Sibling enrichment:** `enrichSiblingsWithResolvedCalls()` in `convention-strategy.ts` joins sibling bids with resolved candidates on `bidName` so the UI shows hand-specific resolved calls, not just `defaultCall`. Pure function — no new imports. Wired in `mapTreeEvalResult()` after both collections are computed. Fixes Gap 3 (defaultCall/resolved call mismatch in display).
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
