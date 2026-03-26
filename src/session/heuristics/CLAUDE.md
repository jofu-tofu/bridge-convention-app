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
| `heuristic-play.ts` | createHeuristicPlayStrategy() — 8-heuristic play chain (L0). Exports individual heuristics + `PlayHeuristic` type for composition by profile providers. |
| `play-profiles.ts` | `PlayProfileId`, `PlayProfile`, `PlayStrategyProvider` DI interface. Four frozen profile constants: `BEGINNER_PROFILE`, `CLUB_PLAYER_PROFILE`, `EXPERT_PROFILE`, `WORLD_CLASS_PROFILE`. |
| `inference-play.ts` | L1 inference-enhanced heuristics: `auctionAwareLeadHeuristic`, `inferenceHonorPlayHeuristic`, `inferenceAwareDiscardHeuristic`. Read `PublicBeliefs` from `PlayContext.inferences`. |
| `profile-play-strategy.ts` | `createProfileStrategyProvider(profile, options?)` factory. Assembles heuristic chains per profile: beginner (skip wrapper), club player (L1 + L0), expert (L1 + expert + L0), world-class (MC+DDS via engine). |
| `play-constraint-tracker.ts` | `PlayConstraintTracker` — tracks card play observations (voids, suit counts) for Monte Carlo sampling. Cursor-based update for efficiency. |
| `montecarlo-play.ts` | `samplePlayDeals()` — play-phase deal sampler with void pre-assignment. `createWorldClassProvider(engine, rng)` — Monte Carlo + DDS strategy provider with batched `Promise.allSettled` dispatch (batch size 10) and margin-based early termination (≥0.5 trick gap after ≥10 successful solves). |

## Dependency Direction

Heuristics depend only on `engine/` and `conventions/` (for types + LEVEL_HCP_TABLE). No inference/ dependency — `pragmatic-generator.ts` accepts `partnerMinHcp: number` directly. Exception: `inference-play.ts`, `profile-play-strategy.ts`, and `montecarlo-play.ts` import from `inference/` for `PublicBeliefs`, `PosteriorBackend`, and sampler helpers — session→inference import is allowed.

## Play Profile System

Four named difficulty profiles control AI card play:
- **Beginner (L0):** Base heuristic chain with 15% skip rate on selected heuristics (cover-honor, trump-management). No inference reading.
- **Club Player (L0+L1):** Inference-enhanced heuristics (auction-aware lead, inference honor play) + full base chain. Reads `PlayContext.inferences`.
- **Expert (L0+L1+Expert):** Full inference + card counting + restricted choice + base chain. Posterior queries planned (Phase 3 hook wired).
- **World Class (MC+DDS):** Monte Carlo deal sampling (30 samples) + DDS solving via `EnginePort.solveBoard()`. Dispatches DDS calls in batches of 10 via `Promise.allSettled`; early-terminates when the best card leads by ≥0.5 tricks after ≥10 successful solves. Falls back to expert heuristics when DDS unavailable or sampling fails. Requires `engine` in `ProfileStrategyOptions`.

`PlayStrategy.suggest()` returns `Promise<PlayResult>` (async). All existing profiles wrap sync results in `Promise.resolve()`. World-class profile is truly async (DDS calls).

`PlayStrategyProvider` is the DI interface: session owns the provider, controller calls `await getStrategy().suggest(ctx)` per play. Expert and world-class providers' `onAuctionComplete()` is called at auction end to condition on completed auction inferences.

## Heuristic Play Chain

First non-null wins: opening-lead → mid-game-lead → second-hand-low → third-hand-high → fourth-hand-play → cover-honor-with-honor → trump-management → discard-management → default-lowest.

---

## Context Maintenance

**Staleness anchor:** This file assumes `strategy-chain.ts` exists. If it doesn't, this file is stale.
