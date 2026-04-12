# Stores

Svelte 5 rune-based stores for application state. Factory pattern with dependency injection.

## Conventions

- **Factory + DI.** `createGameStore(service)` takes `DevServicePort` as parameter. Tests inject a stub engine via `createLocalService(engine)`. No `vi.mock`.
- **Object-with-getters pattern.** `$state` inside factory, exported as object properties via getters. Preserves Svelte 5 reactivity.
- **Flat GameStore surface.** Use top-level getters (`auction`, `tricks`, `ddsSolution`, etc.); the old namespaced `bidding`/`play`/`dds` accessors were removed.
- **Named exports only.** `export function createGameStore`, `export function createAppStore`.
- **No engine imports.** The game store does not import `EnginePort` — all engine access goes through the service.
- **Minimal conventions/core imports.** `app.svelte.ts` imports type `ConventionInfo`. Viewport building delegated entirely to `ServicePort` methods — no direct `buildXxxViewport` calls.

## Architecture

| File                 | Role                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `app.svelte.ts`      | `createAppStore()` — selected convention, learning state, coverage state, dev seed, dev flags (`autoplay`, `debugExpanded`, `autoDismissFeedback`, `skipToPhase`), drill tuning (persisted to localStorage). Screen navigation handled by SvelteKit file-based routing (`goto()` from `$app/navigation`), not store-driven. No `Screen` type or `navigateToX` methods. |
| `game.svelte.ts`     | `createGameStore(service)` — coordinator/facade, drill lifecycle, user action handlers, thin reactive cache over service viewports. Delegates to sub-modules for bidding, play, phase transitions, viewport caching, and DDS |
| `bidding-phase.svelte.ts` | `createBiddingPhase(deps)` — bidding state, AI bid animation, user bid submission, feedback, session stats |
| `play-phase.svelte.ts` | `createPlayPhase(deps)` — play state, AI play animation, user card play, trick display |
| `phase-transitions.svelte.ts` | `createPhaseTransitions(deps)` — phase state machine (`transitionTo`), unified lifecycle executor (`executeTransition`), `dispatchPlayTransition`, `handlePostAuction`, `guarded()` wrapper, prompt mode |
| `viewport-cache.svelte.ts` | `createViewportCache(deps)` — reactive viewport cache (`ViewportCache`), `fetchAndCache`, `viewportNeededForPhase` pure helper |
| `dds-solver.svelte.ts` | `createDDSSolver(deps)` — DDS solution/solving/error state, `triggerSolve` |
| `entitlements.ts`    | `canPractice(user, bundleId)`, `isPremium(user)` — resolves what bundles the user can access based on subscription tier. Free tier gets one bundle (`nt-bundle`), premium gets all. Plain module, no runes. |
| `feature-flags.ts`   | `FEATURES` const registry — build-time feature flags (`workshop`, etc.). Plain module, no runes. `import.meta.env.DEV`-gated flags are dead-code-eliminated in prod. Use `FEATURES.flagName` at gate points. |
| `local-storage.ts`   | Shared `loadFromStorage` / `saveToStorage` helpers — all stores use these instead of inlining try/catch JSON read/write |
| `prompt-logic.ts`    | Pure functions: `computePromptMode`, `computeFaceUpSeats` |
| `animate.ts`         | Pure animation helpers: `animateIncremental`, delay constants (`AI_BID_DELAY`, `AI_PLAY_DELAY`, `TRICK_PAUSE`) |
| `custom-systems.svelte.ts` | `createCustomSystemsStore()` — CRUD for custom systems, localStorage persistence. `resolveSystemForSession()` maps `SystemSelectionId` to `{systemConfig, baseModuleIds}` for session creation. Healing allows `user:*` module IDs through without validation. |
| `user-modules.svelte.ts` | `createUserModuleStore()` — CRUD for user-owned convention modules (forked/created), localStorage persistence (`bridge-app:user-modules`). Full-copy fork model, no deltas. |
| `practice-packs.svelte.ts` | `createPracticePacksStore()` — CRUD for custom practice packs, localStorage persistence (`bridge-app:practice-packs`). Each pack is a named, ordered list of convention module IDs. |
| `drill-presets.svelte.ts` | `createDrillPresetsStore()` — CRUD for named drill presets (conventionId + practiceMode + practiceRole + `SystemSelectionId` + name). MRU sort (`lastUsedAt` DESC, nulls last, `createdAt` tiebreaker). Soft cap 20. localStorage key `bridge-app:drill-presets`. Persists `SystemSelectionId` only, never `SystemConfig` — stored shape survives system-internal changes. |
| `dev-params.ts`      | `applyDevParams()` — consolidated URL param API (params: `?convention=`, `?learn=`, `?seed=`, `?phase=`, `?dev=`, `?practiceMode=`, `?practiceRole=`, `?targetState=/targetSurface=`). Convention deep links default to `decision-drill` unless `practiceMode` is explicit, so `?convention=` lands directly in-game. Screen navigation uses SvelteKit routes (`/settings`, `/coverage`, `/workshop`) via `goto()` from `$app/navigation`; `?profiles=true` backward compat alias redirects to `/workshop`. `?dev=auth:<tier>` overrides subscription tier for paywall testing. Called from `AppReady.svelte` at startup. |
| `types.ts`           | `GameStore` interface — explicit facade interface for context DI consumers |

**Game store key methods:** `startNewDrill`, `startDrillFromHandle`, `userBid`, `retryBid`, `dismissFeedback`, `getExpectedBid` (bidding); `acceptPrompt()`, `declinePrompt()` (declarer prompt — route through `acceptPromptAction`/`declinePromptAction`); `userPlayCard`, `skipToReview`, `skipToPhase`, `playThisHand`, `restartPlay` (play). **Internally**, all phase transitions route through `executeTransition(handle, event)` which enforces the pipeline: service actions → viewport fetch → phase transition → side effects. `dispatchPlayTransition` wraps `executeTransition` + AI play animation for events that produce `aiPlays`. See `game.svelte.ts` for signatures.

**Key state:** `effectiveUserSeat` — defaults to South, set to North on declarer swap. Reset by `startDrillFromHandle()`. `isProcessing` + `play.aborted` flags guard animation races. `transitioning` flag (lifecycle guard) prevents concurrent lifecycle actions. `practiceMode` and `playPreference` are set from `DrillStartResult` and control phase transitions. `handleAutoPromptTransition()` auto-transitions from DECLARER_PROMPT based on `playPreference` (`skip` → EXPLANATION, `always` → PLAYING). `sessionStats` — in-memory per-bid tracking (`correct`, `incorrect`, `streak`), resets on `resetImpl()`. Tracks first attempts only (retries via `isRetryAttempt` flag are skipped). Lives in game store (not a separate store) because it's only 3 fields — extract to `session.svelte.ts` if this grows to per-convention breakdown or persistence.

**Lifecycle guard (`guarded()` wrapper).** Most public lifecycle methods (skipToReview, restartPlay, playThisHand, acceptPrompt, declinePrompt) are wrapped with `guarded()`. The guard sets `transitioning = true` synchronously, drops concurrent calls, and clears the flag in `.finally()`. Internal callers (e.g., `handleAutoPromptTransition` calling `acceptPrompt`) use the inner functions directly — they bypass the guard because they execute within an already-running guarded chain. `startDrillFromHandle` is NOT guarded (tests need to await it). **`startNewDrill` uses cancel-based concurrency (NOT guarded):** a new drill always supersedes any in-progress drill via `activeHandle` comparison. An `isStarting` flag provides UI-disabling behavior that `guarded()` would have provided. `isTransitioning` getter exposes the guard flag for UI button disabling. `isProcessing` includes `transitioning` and `isStarting`.

**Grouped phase state.** DDS state lives in `dds-solver.svelte.ts`, viewport cache in `viewport-cache.svelte.ts`, phase machine + transition executor in `phase-transitions.svelte.ts`. Bidding/play sub-modules own their own local grouped state. Each sub-module has a `reset()` method; `resetImpl()` in the coordinator calls all of them.

**`bidFeedback` stays flat.** Always replaced wholesale (never mutated in-place), so `$state` works correctly. Do NOT fold into `BiddingPhaseState`.

**Animation fields stay flat.** `biddingAnim` and `animatedTrickOverride` have independent lifecycles and never reset together. Grouping would add no benefit.

**Rejected alternatives:** Discriminated union `PhaseState` (fights Svelte 5 proxy reactivity).

**Viewport getters:** `gameStore.biddingViewport` — cached `BiddingViewport` from `ServicePort.getBiddingViewport()`. `gameStore.viewportFeedback` — `ViewportBidFeedback` from bid grading. `gameStore.declarerPromptViewport` — cached `DeclarerPromptViewport` from `ServicePort.getDeclarerPromptViewport()`. `gameStore.playingViewport` — cached `PlayingViewport` from `ServicePort.getPlayingViewport()`. `gameStore.explanationViewport` — cached `ExplanationViewport` from `ServicePort.getExplanationViewport()`. All viewports are `$state` variables refreshed via service calls after state changes. Components consume these instead of raw deal/engine state.

**Exported types:** `BidFeedback` (viewport-safe: `grade: ViewportBidGrade` (string), `viewportFeedback: ViewportBidFeedback`, `teaching: TeachingDetail | null`). `BidHistoryEntry` (re-exported from `service/`), `GamePhase`, `PlayLogEntry`.

**Debug log is log-based, not reactive.** The debug drawer derives all state (`currentSnap`, `lastBidSnap`, `feedback`) from `gameStore.debugLog` entries via `$derived`. No separate reactive snapshot state — the log accumulates entries over the bidding phase with full `StrategyEvaluation` snapshots and `BidFeedbackDTO` embedded by Rust. Intended for extension to a review-phase analysis panel.

**Viewport as single source of truth.** The store is a thin reactive cache of viewports from the service. Bidding state (`auction`, `bidHistory`, `legalCalls`, `currentTurn`, `isUserTurn`) and play state (`tricks`, `currentTrick`, `currentPlayer`, etc.) are derived from `cachedBiddingViewport` / `cachedPlayingViewport` via `$derived`. No local state mutation during the game — the service owns the truth. There is no legacy local path — all game operations go through the service.

**Animation via incremental reveal.** AI bid/play animation uses `biddingAnim` plus `animatedTrickOverride` to control how much of a complete viewport to display. The service returns the *final* viewport (including all AI bids/plays); the store holds `{ totalAiBids, revealed }` and increments `revealed` with delays. `displayedAuctionEntries` / `displayedCurrentTrick` are `$derived` values that slice the viewport's entries. No state mutation during animation.

**Inference via service.** Inference state is fetched from `service.getPublicBeliefState(handle)` after bids complete — no local inference coordinator in the store.

**Cancellation via handle comparison.** Every animation loop captures `handle` at the start and checks `activeHandle !== handle` after each await. If a new drill started mid-animation, the operation bails cleanly. `resetImpl()` sets `activeHandle = null` and clears all animation state.

**Race condition protection:** `biddingProcessing` / `playProcessing` flags + `playAborted` cancellation flag. `biddingProcessing` stays true throughout animation AND phase transitions, so bid buttons are disabled the entire time.

## Game Phases

**Phase machine:** BIDDING → DECLARER_PROMPT (conditional) → PLAYING (optional) → EXPLANATION. Tracked in `phase-transitions.svelte.ts` via `transitionTo()` guard.

**User always bids as South.** The `effectiveUserSeat` handles play-phase seat swaps.

**DECLARER_PROMPT conditions:**
- **North declares (user is dummy):** Offers "Play as Declarer" (rotates table 180° via `viewSeat()` in `src/components/shared/seat-mapping.ts`) or "Skip to Review"
- **E/W declares:** Offers "Play as Defender" (user stays South) or "Skip to Review"
- **South declares:** Shows DECLARER_PROMPT with Play/Skip options (`acceptPrompt`/`declinePrompt`).

**Play phase entry:** `acceptPrompt()` handles all cases (declarer swap, defend, south play). `declinePrompt()` skips to review.

**AI play behavior:** Heuristic strategy chain (opening leads, second-hand-low, third-hand-high, cover honor, trump management, discard, fallback) with 500ms delay between plays. Falls back to random play if no strategy configured.

**Unified lifecycle executor.** All phase transitions go through `executeTransition(handle, event)` in `phase-transitions.svelte.ts`. Never call `transitionTo()` directly from lifecycle functions — the executor enforces viewport-before-transition ordering that prevents blank-screen bugs. The pipeline is: resolve descriptor → reset play state → run service actions → fetch viewports → phase transitions (intermediate then target) → side effects (DDS) → chained events. `dispatchPlayTransition` wraps `executeTransition` + AI play animation for the 3 events that produce `aiPlays` (ACCEPT_PLAY, RESTART_PLAY, PLAY_THIS_HAND). `handlePostAuction` is a thin wrapper for AUCTION_COMPLETE (effectiveUserSeat + auto-prompt chaining). PLAYING→PLAYING is intentionally absent from `VALID_TRANSITIONS` (`session-types.ts`). `RESTART_PLAY` works because the executor skips `transitionTo()` when target === current phase. Do NOT add self-transitions to the valid transitions table.
- **Phase authority:** Rust `bidding-controller` decides the phase at auction completion (mutates `SessionState.phase`). The coordinator does NOT recompute this — it receives `servicePhase` and maps it to orchestration actions.
- **Reactive execution:** The store owns animation, cancellation (`activeHandle`), and Svelte `$state` mutations.

## Gotchas

- `EnginePort` methods are async. Rust backend (WasmEngine) wraps sync calls in Promises.
- `BiddingContext` constructed via `createBiddingContext()` factory from `conventions/core/context-factory.ts` (includes optional `vulnerability`/`dealer` with safe defaults)
- `context.ts` provides Svelte context DI helpers (`setGameStore`, `setAppStore`, `setService`, `setCustomSystemsStore`, `setUserModuleStore`, `setPracticePacksStore`, `setDrillPresetsStore` + matching getters) — used by `AppReady.svelte` and components
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

<!-- context-layer: generated=2026-02-21 | last-audited=2026-04-11 | version=15 | dir-commits-at-audit=15 | tree-sig=dirs:2,files:23,exts:ts:22,md:1 -->
