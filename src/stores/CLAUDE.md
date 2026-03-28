# Stores

Svelte 5 rune-based stores for application state. Factory pattern with dependency injection.

## Conventions

- **Factory + DI.** `createGameStore(service)` takes `DevServicePort` as parameter. Tests inject a stub engine via `createLocalService(engine)`. No `vi.mock`.
- **Object-with-getters pattern.** `$state` inside factory, exported as object properties via getters. Preserves Svelte 5 reactivity.
- **Named exports only.** `export function createGameStore`, `export function createAppStore`.
- **No engine imports.** The game store does not import `EnginePort` — all engine access goes through the service.
- **Minimal conventions/core imports.** `app.svelte.ts` imports type `ConventionConfig`. Viewport building delegated entirely to `ServicePort` methods — no direct `buildXxxViewport` calls.

## Architecture

| File                 | Role                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `app.svelte.ts`      | `createAppStore()` — screen navigation, selected convention, learning state, coverage state, dev seed, dev flags (`autoplay`, `debugExpanded`, `autoDismissFeedback`, `skipToPhase`), drill tuning (persisted to localStorage) |
| `game.svelte.ts`     | `createGameStore(service)` — coordinator/facade, phase machine, drill lifecycle, thin reactive cache over service viewports |
| `dev-params.ts`      | `applyDevParams()` — consolidated URL param API (9 params: `?convention=`, `?learn=`, `?seed=`, `?screen=`, `?phase=`, `?dev=`, `?practiceMode=`, `?practiceRole=`, `?targetState=/targetSurface=`). Backward compat aliases for legacy params. Called from `App.svelte` at startup |
| `types.ts`           | `GameStore` interface — explicit facade interface for context DI consumers |

**Game store key methods:** `startNewDrill`, `startDrillFromHandle`, `userBid`, `retryBid`, `getExpectedBid`, `getDebugSnapshot` (bidding); `acceptPlay(seatOverride?)`, `declinePlay()`, `acceptPrompt()`, `declinePrompt()` (declarer prompt); `userPlayCard`, `skipToReview`, `restartPlay`, `skipToPhase`, `playThisHand` (play). See `game.svelte.ts` for signatures.

**Key state:** `effectiveUserSeat` — defaults to South, set to North on declarer swap. Reset by `startDrillFromHandle()`. `isProcessing` + `play.aborted` flags guard animation races. `transitioning` flag (lifecycle guard) prevents concurrent lifecycle actions. `practiceMode` and `playPreference` are set from `DrillStartResult` and control phase transitions. `maybeAutoTransitionFromPrompt()` auto-transitions from DECLARER_PROMPT based on `playPreference` (`skip` → EXPLANATION, `always` → PLAYING). `sessionStats` — in-memory per-bid tracking (`correct`, `incorrect`, `streak`), resets on `resetImpl()`. Tracks first attempts only (retries via `isRetryAttempt` flag are skipped). Lives in game store (not a separate store) because it's only 3 fields — extract to `session.svelte.ts` if this grows to per-convention breakdown or persistence.

**Lifecycle guard (`guarded()` wrapper).** All public lifecycle methods (startNewDrill, skipToReview, restartPlay, playThisHand, acceptPrompt, declinePrompt, acceptDeclarerSwap, declineDeclarerSwap, acceptDefend, declineDefend, acceptSouthPlay, declineSouthPlay, acceptPlay, declinePlay) are wrapped with `guarded()`. The guard sets `transitioning = true` synchronously, drops concurrent calls, and clears the flag in `.finally()`. Internal callers (e.g., `handleAutoPromptTransition` calling `acceptPrompt`) use the inner functions directly — they bypass the guard because they execute within an already-running guarded chain. `startDrillFromHandle` is NOT guarded (tests need to await it); instead `startNewDrill` wraps `createSession` + `startDrillFromHandle` and is guarded. `isTransitioning` getter exposes the flag for UI button disabling. `isProcessing` includes `transitioning`.

**Grouped phase state.** Internal `$state` variables are grouped into typed objects: `bidding: BiddingPhaseState`, `play: PlayPhaseState`, `dds: DDSState`, `inference: InferenceState`, `viewports: ViewportCache`. Factory functions (`freshBiddingState()`, etc.) handle resets. Individual field updates use direct property mutation (`bidding.processing = true`) which Svelte 5's proxy tracks fine-grained. Full object replacement (`bidding = freshBiddingState()`) is correct for resets only.

**`bidFeedback` stays flat with `$state.raw`.** Deep proxy would break reference equality checks. Do NOT fold into `BiddingPhaseState`.

**Animation fields stay flat.** `biddingAnim` and `animatedTrickOverride` have independent lifecycles and never reset together. Grouping would add no benefit.

**Rejected alternatives:** Discriminated union `PhaseState` (fights Svelte 5 proxy reactivity). Phase-scoped sub-store files (too much churn, moves animation away from transition logic).

**Sub-store accessors:** `gameStore.bidding` (auction, bidHistory, bidFeedback, legalCalls, currentTurn, isUserTurn), `gameStore.play` (tricks, currentTrick, currentPlayer, declarerTricksWon, defenderTricksWon, dummySeat, score, trumpSuit), `gameStore.dds` (solution, solving, error).

**Viewport getters:** `gameStore.biddingViewport` — cached `BiddingViewport` from `ServicePort.getBiddingViewport()`. `gameStore.viewportFeedback` — `ViewportBidFeedback` from bid grading. `gameStore.declarerPromptViewport` — cached `DeclarerPromptViewport` from `ServicePort.getDeclarerPromptViewport()`. `gameStore.playingViewport` — cached `PlayingViewport` from `ServicePort.getPlayingViewport()`. `gameStore.explanationViewport` — cached `ExplanationViewport` from `ServicePort.getExplanationViewport()`. All viewports are `$state` variables refreshed via service calls after state changes. Components consume these instead of raw deal/engine state.

**Exported types:** `BidFeedback` (viewport-safe: `grade: ViewportBidGrade` (string), `viewportFeedback: ViewportBidFeedback`, `teaching: TeachingDetail | null`). `BidHistoryEntry` (re-exported from `service/`), `TeachingResolution` (re-exported from `service/`), `GamePhase`, `PlayLogEntry`, `seatController()`.

**Viewport as single source of truth.** The store is a thin reactive cache of viewports from the service. Bidding state (`auction`, `bidHistory`, `legalCalls`, `currentTurn`, `isUserTurn`) and play state (`tricks`, `currentTrick`, `currentPlayer`, etc.) are derived from `cachedBiddingViewport` / `cachedPlayingViewport` via `$derived`. No local state mutation during the game — the service owns the truth. There is no legacy local path — all game operations go through the service.

**Animation via incremental reveal.** AI bid/play animation uses an overlay counter (`biddingAnim` / `playAnim`) that controls how much of a complete viewport to display. The service returns the *final* viewport (including all AI bids/plays); the store holds `{ totalAiBids, revealed }` and increments `revealed` with delays. `displayedAuctionEntries` / `displayedCurrentTrick` are `$derived` values that slice the viewport's entries. No state mutation during animation.

**Inference via service.** Inference state is fetched from `service.getPublicBeliefState(handle)` after bids complete — no local inference coordinator in the store.

**Cancellation via handle comparison.** Every animation loop captures `handle` at the start and checks `activeHandle !== handle` after each await. If a new drill started mid-animation, the operation bails cleanly. `resetImpl()` sets `activeHandle = null` and clears all animation state.

**Race condition protection:** `biddingProcessing` / `playProcessing` flags + `playAborted` cancellation flag. `biddingProcessing` stays true throughout animation AND phase transitions, so bid buttons are disabled the entire time.

## Game Phases

**Phase machine:** BIDDING → DECLARER_PROMPT (conditional) → PLAYING (optional) → EXPLANATION. Tracked in `game.svelte.ts` via `transitionTo()` guard.

**User always bids as South.** The `effectiveUserSeat` handles play-phase seat swaps.

**DECLARER_PROMPT conditions:**
- **North declares (user is dummy):** Offers "Play as Declarer" (rotates table 180° via `viewSeat()` in `src/components/shared/seat-mapping.ts`) or "Skip to Review"
- **E/W declares:** Offers "Play as Defender" (user stays South) or "Skip to Review"
- **South declares:** Shows DECLARER_PROMPT with Play/Skip options (`acceptSouthPlay`/`declineSouthPlay`).

**Play phase entry:** `acceptDeclarerSwap` (when user is dummy and chooses to play as declarer) or `acceptDefend` (when opponent declares and user chooses to defend) or `acceptSouthPlay` (when South declares and user chooses to play).

**AI play behavior:** Heuristic strategy chain (opening leads, second-hand-low, third-hand-high, cover honor, trump management, discard, fallback) with 500ms delay between plays. Falls back to random play if no strategy configured.

**Phase coordinator pattern.** Phase transition decisions are extracted into `session/phase-coordinator.ts` (pure, stateless). The store uses two helpers:
- **`handlePostAuction(handle, servicePhase)`** — replaces the duplicated post-auction if/else chains in `userBidViaService`, `startDrillFromHandle`, and `skipToPhase`. Uses `resolveTransition("BIDDING", { type: "AUCTION_COMPLETE", servicePhase })` to determine target phase, viewports, and DDS trigger.
- **`handleAutoPromptTransition(handle)`** — replaces `maybeAutoTransitionFromPrompt`. Uses `resolveTransition("DECLARER_PROMPT", { type: "PROMPT_ENTERED", playPreference })` to decide auto-accept/skip chains.
- **Phase authority:** `bidding-controller.ts` decides the phase at auction completion (mutates `SessionState.phase`). The coordinator does NOT recompute this — it receives `servicePhase` and maps it to orchestration actions.
- **Reactive execution:** The store owns animation, cancellation (`activeHandle`), and Svelte `$state` mutations.

## Gotchas

- `EnginePort` methods are async. Rust backends (TauriIpcEngine, WasmEngine) wrap sync calls in Promises.
- `BiddingContext` constructed via `createBiddingContext()` factory from `conventions/core/context-factory.ts` (includes optional `vulnerability`/`dealer` with safe defaults)
- `context.ts` provides Svelte context DI helpers (`setEngine`, `setGameStore`, `setAppStore`, `getEngine`, `getGameStore`, `getAppStore`) — used by `App.svelte` and components
- `BidHistoryEntry` maps directly from `BidResult` fields (`call`, `ruleName`, `explanation`, `meaning`) + `seat` and `isUser`
- Default auction entries get generic explanations (e.g., "Opening 1NT bid") — richer explanations deferred to V2
- `isUserTurn` — derived from `!biddingProcessing && !biddingAnim && phase === "BIDDING" && cachedBiddingViewport?.isUserTurn`. Bidding animation keeps `biddingProcessing` true, so buttons are disabled throughout.

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

<!-- context-layer: generated=2026-02-21 | last-audited=2026-03-25 | version=11 | dir-commits-at-audit=14 | tree-sig=dirs:2,files:19,exts:ts:18,md:1 -->
