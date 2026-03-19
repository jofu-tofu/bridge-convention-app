# core/viewport — Player Information Boundary

Explicit information boundary between engine internals and player-facing consumers (UI + CLI).

## Key Rule
Everything the player sees flows through `BiddingViewport`. No component or CLI agent should access `Deal`, opponent hands, or internal evaluation state directly.

## Files

| File | Purpose |
|------|---------|
| `player-viewport.ts` | Type definitions: BiddingViewport, ViewportBidFeedback, AuctionEntryView, BiddingOptionView |
| `evaluation-oracle.ts` | EvaluationOracle (answer key — NEVER exposed to player) |
| `build-viewport.ts` | Build functions: buildBiddingViewport(), buildEvaluationOracle(), gradeAgainstOracle(), buildViewportFeedback() |

## Two Consumers

1. **Svelte UI** — Game store exposes `biddingViewport` computed getter; BiddingPhase receives it as prop
2. **CLI harness** — `src/cli/playthrough.ts` and `src/cli/commands/eval.ts` call buildViewportFeedback() and buildTeachingDetail() directly

## Information Boundary

**In viewport (player sees):** own hand, auction with alerts, legal calls, system-card knowledge (surface labels), partner alerts, vulnerability/dealer.

**NOT in viewport (engine keeps):** opponent hands, expected correct answer, internal ranking scores, clause satisfaction, inference engine state.

---

## Context Maintenance

**Staleness anchor:** This file assumes `build-viewport.ts` exports `buildBiddingViewport`. If it doesn't, regenerate.

<!-- context-layer: generated=2026-03-18 | last-audited=2026-03-18 | version=1 | tree-sig=dirs:1,files:4,exts:ts:4,md:1 -->
