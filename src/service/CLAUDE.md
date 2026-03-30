<!-- context-layer: service | version: 7 | last-audited: 2026-03-29 -->

# Service

WASM proxy layer — the **sole interface** between UI/CLI and the Rust backend (23 methods). The client holds an opaque `SessionHandle` and gets back `BiddingViewport`, `ViewportBidFeedback`, `TeachingDetail` — never raw domain types. All game logic (conventions, inference, session, evaluation) runs in Rust via `bridge-service`. TS `service/` is a thin serialize/call/deserialize proxy.

**ServicePort methods (23):**
- **Session:** `createSession`, `startDrill`
- **Bidding:** `submitBid`
- **Transitions:** `acceptPrompt` (handles "play", "skip", "replay", "restart")
- **Play:** `playCard`, `skipToReview`, `updatePlayProfile`
- **Query:** `getBiddingViewport`, `getDeclarerPromptViewport`, `getPlayingViewport`, `getExplanationViewport`
- **Inference:** `getPublicBeliefState`
- **DDS:** `getDDSSolution`
- **Evaluation:** `evaluateAtom`, `gradeAtom`, `startPlaythrough`, `getPlaythroughStep`, `gradePlaythroughBid`
- **Catalog:** `listConventions`
- **Learning:** `listModules`, `getModuleLearningViewport`, `getBundleFlowTree`, `getModuleFlowTree`

## Architecture

| File | Role |
|------|------|
| `index.ts` | Barrel organized by consumer concern: (1) port & impl, (2) viewports/responses, (3) engine primitives, (4) convention catalog, (5) coverage utils, (6) session config, (7) display, (8) evaluation facade, (9) cross-cutting. Debug types route through `debug-types.ts`. |
| `debug-types.ts` | Debug-only types for DevServicePort — allowed to import backend types by design. |
| `request-types.ts` | Request DTOs: SessionHandle, SessionConfig (includes `practiceMode` and `targetModuleId`) |
| `response-types.ts` | Response DTOs: DrillStartResult, BidSubmitResult, PlayCardResult, viewports, ModuleCatalogEntry, ModuleLearningViewport, FlowTreeNode, etc. |
| `session-types.ts` | Stub type definitions matching Rust JSON schema — TS interfaces for types that cross the WASM boundary |
| `port.ts` | ServicePort + DevServicePort interfaces |
| `wasm-service.ts` | `WasmService` — thin proxy implementing ServicePort via `wasm-bindgen` calls to Rust `WasmServicePort` |
| `service-helpers.ts` | Sync WASM wrappers for UI components: `listConventions()`, `listModules()`, `buildBaseModuleInfos()`, `getModuleLearningViewportSync()` |
| `dds-bridge.ts` | DDS platform dispatch: Tauri = native DDS via bridge-engine, WASM = JS worker fallback |
| `display/` | Call/contract/card formatting, hand summary, convention card builder (`convention-card.ts` — wired to WASM via service-helpers) |
| `util/delay.ts` | Pure delay utility |

## Hexagonal Boundary Rules

- **Callers own types.** Service defines its own viewport/response types.
- **All UI imports go through service.** Components and stores must import from `service/index.ts` only.
- **Test: "does this work if service runs remotely?"** If a change requires the UI to import a backend type directly, it's wrong.
- **WASM proxy contract.** `WasmService` methods serialize args to JSON, call the WASM function, and deserialize the result. No domain logic in TS.

## Conventions

- **`retryBid()` is intentionally absent from `ServicePort`.** Wrong bids never modify session state (correct-path-only). Retry is store-local: clear `$state` feedback.
- **`submitBid` is atomic.** Grade + apply + run AI bids + return next viewport — one call. The service runs AI bids with NO delays. The store owns animation timing.
- **Single-session invariant.** `createSession` destroys the previous session — ServicePort supports only one active session per client.
- **`acceptPrompt` is polymorphic.** Handles all post-auction transitions: `acceptPrompt(handle, "play")`, `acceptPrompt(handle, "skip")`, `acceptPrompt(handle, "replay")`, `acceptPrompt(handle, "restart")`.
- **`DevServicePort` vs `ServicePort`.** Debug methods on `DevServicePort` only. Production stores type against `ServicePort`.

## Boundary Types

**Allowed to cross:** `BiddingViewport`, `ViewportBidFeedback`, `TeachingDetail`, `ServiceTeachingLabel`, `Call`, `Card`, `Seat`, `Vulnerability`, `BidGrade`, `BidHistoryEntry`, `GamePhase`, `SessionHandle` (opaque string), session config DTOs.

**Never crosses (main barrel):** `Deal`, `BidResult`, `DrillSession`, `DrillBundle`, `ConventionStrategy`, `ArbitrationResult`, `BidMeaning`, `InferenceEngine`. Debug types route through `debug-types.ts`.

## Dependency Direction

```
components/ → stores/ → service/ (WASM proxy) → [Rust: bridge-service → bridge-session → {bridge-engine, bridge-conventions}]
cli/commands/ → service/
```

Nothing imports from `service/` except `stores/`, `components/`, and `cli/commands/`.

## Two-Port Model

- **ServicePort** (compute, WASM, client-side) — all game logic runs locally after initial load
- **DataPort** (auth/entitlements/progress, server) — future addition

They don't mix. See `docs/product-direction.md`.

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Staleness anchor:** This file assumes `wasm-service.ts` exists. If it doesn't, this file is stale.
