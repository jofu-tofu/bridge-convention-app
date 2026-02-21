# Stores

Svelte 5 rune-based stores for application state. Factory pattern with dependency injection.

## Conventions

- **Factory + DI.** `createGameStore(engine)` takes `EnginePort` as parameter. Tests inject a stub engine. No `vi.mock`.
- **Object-with-getters pattern.** `$state` inside factory, exported as object properties via getters. Preserves Svelte 5 reactivity.
- **Named exports only.** `export function createGameStore`, `export function createAppStore`.
- **No engine internal imports.** Stores import `EnginePort` type and `nextSeat` from constants. Never import `hand-evaluator`, `auction`, etc.

## Architecture

| File | Role |
|------|------|
| `app.svelte.ts` | `createAppStore()` — screen navigation (`select`/`game`/`explanation`), selected convention |
| `game.svelte.ts` | `createGameStore(engine)` — deal, auction, bid history, phase transitions, AI bid loop |

**Game store key methods:**
- `startDrill(deal, session, initialAuction?)` — initializes state, replays default auction, runs AI bids
- `userBid(call)` — validates turn, adds bid, advances, runs AI bids
- `runAiBids()` — async loop: AI bids until user seat or auction complete
- `completeAuction()` — gets contract, transitions to EXPLANATION phase

**Race condition protection:** `isProcessing` flag + `userBid()` early return guard.

## Gotchas

- `EnginePort` methods are async (for V2 Tauri IPC). `TsEngine` resolves synchronously via `Promise.resolve()`, so no actual async gaps in V1.
- `BidHistoryEntry` maps directly from `BidResult` fields (`call`, `ruleName`, `explanation`) + `seat` and `isUser`
- Default auction entries get generic explanations (e.g., "Opening 1NT bid") — richer explanations deferred to V2
- `isUserTurn` is `$derived` — combines `currentTurn`, `drillSession.isUserSeat()`, and `!isProcessing`

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Staleness anchor:** This file assumes `game.svelte.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-02-21 | last-audited=2026-02-21 | version=1 -->
