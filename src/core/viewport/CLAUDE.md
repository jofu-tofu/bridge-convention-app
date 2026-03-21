# core/viewport — Player Information Boundary

Explicit information boundary between engine internals and player-facing consumers (UI + CLI).

## Key Rule
Everything the player sees flows through viewport types. No component or CLI agent should access `Deal`, opponent hands, or internal evaluation state directly. The bidding phase uses `BiddingViewport`; the three post-bidding phases use `DeclarerPromptViewport`, `PlayingViewport`, and `ExplanationViewport`.

## Files

| File | Purpose |
|------|---------|
| `player-viewport.ts` | Type definitions: BiddingViewport, DeclarerPromptViewport, PlayingViewport, ExplanationViewport, ViewportBidFeedback, AuctionEntryView, BiddingOptionView, TeachingDetail (with optional `observationHistory`), ObservationStepView, ObservationView, KernelView |
| `evaluation-oracle.ts` | EvaluationOracle (answer key — NEVER exposed to player) |
| `build-viewport.ts` | Build functions: buildBiddingViewport(), buildDeclarerPromptViewport(), buildPlayingViewport(), buildExplanationViewport(), buildEvaluationOracle(), gradeAgainstOracle(), buildViewportFeedback(), buildTeachingDetail(), projectObservationHistory() |

## Two Consumers

1. **Svelte UI** — Game store exposes `biddingViewport`, `declarerPromptViewport`, `playingViewport`, `explanationViewport` computed getters; phase components receive them as props
2. **CLI harness** — `src/cli/playthrough.ts` and `src/cli/commands/eval.ts` call buildViewportFeedback() and buildTeachingDetail() directly

## Viewport Types

| Viewport | Phase | Hands visible |
|----------|-------|---------------|
| `BiddingViewport` | BIDDING | Player's own hand only (+ face-up seats) |
| `DeclarerPromptViewport` | DECLARER_PROMPT | Filtered through faceUpSeats |
| `PlayingViewport` | PLAYING | Filtered through faceUpSeats (user + dummy) |
| `ExplanationViewport` | EXPLANATION | All 4 hands (`allHands`) — review phase |

## Information Boundary

**In viewport (player sees):** own hand, visible hands (filtered by phase rules), auction with alerts, legal calls, system-card knowledge (surface labels), partner alerts, vulnerability/dealer.

**NOT in viewport (engine keeps):** opponent hands (except in review), expected correct answer, internal ranking scores, clause satisfaction, inference engine state.

---

## Context Maintenance

**Staleness anchor:** This file assumes `build-viewport.ts` exports `buildBiddingViewport`, `buildDeclarerPromptViewport`, `buildPlayingViewport`, `buildExplanationViewport`. If it doesn't, regenerate.
