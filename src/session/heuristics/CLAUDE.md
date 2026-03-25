# Session Heuristics

Pure bridge heuristics with no convention pipeline dependency. These are convention-independent strategies that work with any bidding system.

## Architecture

| File | Role |
|------|------|
| `natural-fallback.ts` | naturalFallbackStrategy — 6+ HCP with 5+ suit → bid cheapest legal |
| `pass-strategy.ts` | Always-pass placeholder strategy |
| `strategy-chain.ts` | createStrategyChain(strategies, options?) — tries strategies in order, first non-null wins |
| `pragmatic-generator.ts` | generatePragmaticCandidates() — heuristic tactical bids (NT downgrade, competitive overcall, protective double) |
| `random-play.ts` | createRandomPlayStrategy(rng?) factory + randomPlayStrategy default instance |
| `heuristic-play.ts` | createHeuristicPlayStrategy() — 7-heuristic play chain |

## Dependency Direction

Heuristics depend only on `engine/` and `conventions/` (for types + LEVEL_HCP_TABLE). No inference/ dependency — `pragmatic-generator.ts` accepts `partnerMinHcp: number` directly.

## Heuristic Play Chain

First non-null wins: opening-lead → second-hand-low → third-hand-high → cover-honor-with-honor → trump-management → discard-management → default-lowest.

---

## Context Maintenance

**Staleness anchor:** This file assumes `strategy-chain.ts` exists. If it doesn't, this file is stale.
