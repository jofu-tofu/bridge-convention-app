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
    pass-strategy.ts         Always-pass placeholder strategy
  play/
    random-play.ts           randomPlay() + randomPlayStrategy (PlayStrategy wrapper)
    heuristic-play.ts        createHeuristicPlayStrategy() — 7-heuristic chain
  __tests__/                 Tests for all strategies
```

**Convention adapter:** `conventionToStrategy()` wraps a `ConventionConfig` as a `BiddingStrategy`. Maps `TreeEvalResult` to `TreeEvalSummary` DTO with depth/parent enrichment and fork point extraction. Exports `mapVisitedWithStructure()`, `extractForkPoint()` for tree-to-DTO mapping.

**Tree DTO pipeline:** `TreeEvalResult` (conventions/core/) -> mapped by `mapTreeEvalResult()` -> `TreeEvalSummary` (shared/types.ts) -> `BidResult.treePath` -> `BidHistoryEntry.treePath` -> UI.

**Heuristic play chain** (first non-null wins): opening-lead -> second-hand-low -> third-hand-high -> cover-honor-with-honor -> trump-management -> discard-management -> default-lowest.

- `second-hand-low` only fires when following suit (defers to trump/discard when void)
- `trump-management` won't ruff partner's winning trick
- All heuristics return cards from `legalPlays` only; fallback always returns lowest legal card
- `strategy/play/` depends only on `engine/` and `shared/` — deliberately isolated for independent testing

## Gotchas

- `conventionToStrategy` maps `BiddingRuleResult.rule` to `BidResult.ruleName` (field name change)
- Tests use `clearRegistry()`/`registerConvention()` in `beforeEach` for isolation

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

<!-- context-layer: generated=2026-02-25 | last-audited=2026-02-25 | version=2 | dir-commits-at-audit=0 | tree-sig=dirs:4,files:8,exts:ts:7,md:1 -->
