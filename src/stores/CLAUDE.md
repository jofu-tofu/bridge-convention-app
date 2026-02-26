# Stores

Svelte 5 rune-based stores for application state. Factory pattern with dependency injection.

## Conventions

- **Factory + DI.** `createGameStore(engine)` takes `EnginePort` as parameter. Tests inject a stub engine. No `vi.mock`.
- **Object-with-getters pattern.** `$state` inside factory, exported as object properties via getters. Preserves Svelte 5 reactivity.
- **Named exports only.** `export function createGameStore`, `export function createAppStore`.
- **Minimal engine imports.** Stores import `EnginePort` type, `nextSeat`/`partnerSeat` from constants, and `evaluateHand` from hand-evaluator (for bid correctness checking). Never import `auction`, `scoring`, etc.

## Architecture

| File                 | Role                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `app.svelte.ts`      | `createAppStore()` — screen navigation (`select`/`game`), selected convention, dev seed state, autoplay flag |
| `game.svelte.ts`     | `createGameStore(engine)` — coordinator/facade, phase machine, drill lifecycle, delegates to sub-stores |
| `bidding.svelte.ts`  | Bidding sub-store — auction state, bid history, feedback, AI bid loop, convention strategy          |
| `play.svelte.ts`     | Play sub-store — trick state, AI play loop, score calculation, legal plays                         |
| `dds.svelte.ts`      | DDS sub-store — async DDS solve with timeout, stale-result guard, generation counter               |

**Game store key methods:** `startDrill`, `userBid`, `dismissBidFeedback`, `skipFromFeedback`, `runAiBids`, `completeAuction`, `getExpectedBid` (bidding); `acceptPlay(seatOverride?)`, `declinePlay()`, `isDefenderPrompt` (declarer prompt); `startPlay`, `userPlayCard`, `runAiPlays`, `completeTrick`, `completePlay`, `skipToReview`, `triggerDDSSolve`, `getLegalPlaysForSeat`, `getRemainingCards` (play). See `game.svelte.ts` for signatures.

**Key state:** `effectiveUserSeat` — defaults to South, set to North on declarer swap. Reset by `startDrill()`. `isProcessing` + `playAborted` flags guard AI play loop races.

**Sub-store accessors:** `gameStore.bidding` (auction, bidHistory, bidFeedback, legalCalls, currentTurn, isUserTurn), `gameStore.play` (tricks, currentTrick, currentPlayer, declarerTricksWon, defenderTricksWon, dummySeat, score, trumpSuit), `gameStore.dds` (solution, solving, error).

**Exported types:** `BidFeedback`, `BidHistoryEntry`, `GamePhase`, `PlayLogEntry`, `seatController()`.

**Race condition protection:** `isProcessing` flag + `playAborted` cancellation flag for AI play loop.

## Gotchas

- `EnginePort` methods are async (for V2 Tauri IPC). Rust backends (TauriIpcEngine, HttpEngine) are truly async.
- `BiddingContext` constructed via `createBiddingContext()` factory from `conventions/core/context-factory.ts` (includes optional `vulnerability`/`dealer` with safe defaults)
- `context.ts` provides Svelte context DI helpers (`setEngine`, `setGameStore`, `setAppStore`, `getEngine`, `getGameStore`, `getAppStore`) — used by `App.svelte` and components
- `BidHistoryEntry` maps directly from `BidResult` fields (`call`, `ruleName`, `explanation`) + `seat` and `isUser`
- Default auction entries get generic explanations (e.g., "Opening 1NT bid") — richer explanations deferred to V2
- `isUserTurn` is `$derived` — combines `currentTurn`, `drillSession.isUserSeat()`, and `!isProcessing`

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

**Staleness anchor:** This file assumes `game.svelte.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-02-21 | last-audited=2026-02-25 | version=9 | dir-commits-at-audit=13 | tree-sig=dirs:2,files:19,exts:ts:18,md:1 -->
