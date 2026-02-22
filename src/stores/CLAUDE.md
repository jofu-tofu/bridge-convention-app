# Stores

Svelte 5 rune-based stores for application state. Factory pattern with dependency injection.

## Conventions

- **Factory + DI.** `createGameStore(engine)` takes `EnginePort` as parameter. Tests inject a stub engine. No `vi.mock`.
- **Object-with-getters pattern.** `$state` inside factory, exported as object properties via getters. Preserves Svelte 5 reactivity.
- **Named exports only.** `export function createGameStore`, `export function createAppStore`.
- **Minimal engine imports.** Stores import `EnginePort` type, `nextSeat`/`partnerSeat` from constants, and `evaluateHand` from hand-evaluator (for bid correctness checking). Never import `auction`, `scoring`, etc.

## Architecture

| File | Role |
|------|------|
| `app.svelte.ts` | `createAppStore()` — screen navigation (`select`/`game`), selected convention, dev seed state |
| `game.svelte.ts` | `createGameStore(engine)` — deal, auction, bid history, phase transitions, AI bid loop, play phase |

**Game store key methods (bidding):**
- `startDrill(deal, session, initialAuction?, strategy?)` — initializes state, stores convention strategy, replays default auction, runs AI bids
- `userBid(call)` — validates turn, checks correctness against convention strategy, adds bid; pauses on wrong bid (user must dismiss feedback), auto-continues on correct bid
- `dismissBidFeedback()` — clears wrong bid feedback and resumes auction (runs AI bids)
- `skipFromFeedback()` — clears feedback and jumps directly to EXPLANATION phase
- `runAiBids()` — async loop: AI bids until user seat or auction complete
- `completeAuction()` — gets contract, transitions to DECLARER_PROMPT (when user is dummy) or EXPLANATION (when user is declarer or for passout)

**Game store key methods (declarer prompt):**
- `acceptDeclarerSwap()` — sets `effectiveUserSeat` to `contract.declarer` (North), calls `startPlay()`. Table rotates 180°.
- `declineDeclarerSwap()` — skips play phase, goes straight to EXPLANATION. Used as "Skip to Review" in UI.

**Game store key methods (play):**
- `startPlay()` — called by `completeAuction()` or declarer swap methods, sets up play state, determines declarer/dummy/opening leader
- `userPlayCard(card, seat)` — validates legality and seat control, adds to trick, triggers AI plays
- `runAiPlays()` — async loop: AI plays with 500ms delay until user's turn or trick complete
- `completeTrick()` — determines trick winner, updates counts, pauses 1s for UI
- `completePlay()` — calculates score via engine, transitions to EXPLANATION
- `skipToReview()` — sets `playAborted` flag, synchronously finishes all remaining tricks
- `getLegalPlaysForSeat(seat)` — returns legal cards for a seat in current trick context
- `getRemainingCards(seat)` — returns hand minus already-played cards

**App store dev seed state (dev-only):**
- `devSeed` (`number | null`) — seed for deterministic PRNG, set via `?seed=` URL param
- `devDealCount` (`number`) — increments per deal; effective seed = `devSeed + devDealCount`
- `setDevSeed(seed)` — sets seed and resets deal count to 0
- `advanceDevDeal()` — increments deal count

**Exported types:** `BidFeedback` (isCorrect, userCall, expectedResult), `BidHistoryEntry`, `GamePhase` (includes `"DECLARER_PROMPT"`)

**Exported helper:** `seatController(seat, declarer, userSeat)` → `'user' | 'ai'`

**Key state:** `effectiveUserSeat` — defaults to `userSeat` (South), set to North when user accepts declarer swap. Used by `isUserControlled()` during play. Reset to `null` by `startDrill()`.

**Race condition protection:** `isProcessing` flag + `playAborted` cancellation flag for AI play loop.

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

<!-- context-layer: generated=2026-02-21 | last-audited=2026-02-22 | version=5 | dir-commits-at-audit=4 | tree-sig=dirs:1,files:6,exts:ts:5,md:1 -->
