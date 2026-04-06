<!-- context-layer: service | version: 8 | last-audited: 2026-04-05 -->

# Service

WASM proxy layer — the **sole interface** between UI/CLI and the Rust backend (23 methods). The client holds an opaque `DrillHandle` and gets back `BiddingViewport`, `ViewportBidFeedback`, `TeachingDetail` — never raw domain types. All game logic (conventions, inference, session) runs in Rust via `bridge-service`. TS `service/` is a thin serialize/call/deserialize proxy. DDS solver is wired automatically during `init()` — the WASM layer routes Expert/WorldClass profiles through async DDS play internally.

**ServicePort methods (23):**
- **Lifecycle:** `init` (must be called once before any other method; idempotent; DDS wiring is fire-and-forget in browser)
- **Session:** `createDrillSession`, `startDrill`
- **Bidding:** `submitBid`
- **Transitions:** `enterPlay`, `declinePlay`, `returnToPrompt`, `restartPlay`
- **Play:** `playCard`, `skipToReview`, `updatePlayProfile`
- **Query:** `getBiddingViewport`, `getDeclarerPromptViewport`, `getPlayingViewport`, `getExplanationViewport`
- **Inference:** `getPublicBeliefState`
- **DDS:** `getDDSSolution`
- **Catalog:** `listConventions`
- **Learning:** `listModules`, `getModuleLearningViewport`, `getBundleFlowTree`, `getModuleFlowTree`

## Architecture

| File | Role |
|------|------|
| `index.ts` | Barrel organized by consumer concern: (1) port & impl, (2) viewports/responses, (3) engine primitives, (4) convention catalog, (5) coverage utils, (6) session config, (7) display, (8) evaluation facade, (9) cross-cutting. Debug types route through `debug-types.ts`. |
| `debug-types.ts` | Debug-only types for DevServicePort — allowed to import backend types by design. |
| `request-types.ts` | Request DTOs: DrillHandle, SessionConfig (includes `practiceMode` and `targetModuleId`) |
| `response-types.ts` | Response DTOs: DrillStartResult, BidSubmitResult, PlayCardResult, viewports, ModuleCatalogEntry, ModuleLearningViewport, FlowTreeNode, etc. |
| `session-types.ts` | Stub type definitions matching Rust JSON schema — TS interfaces for types that cross the WASM boundary |
| `port.ts` | ServicePort + DevServicePort interfaces |
| `wasm-service.ts` | `BridgeService` — thin proxy implementing ServicePort via `wasm-bindgen` calls to Rust `WasmServicePort`. `init()` handles WASM module loading + DDS solver wiring. |
| `service-helpers.ts` | Sync WASM wrappers for UI components: `listConventions()`, `listModules()`, `buildBaseModuleInfos()`, `getModuleLearningViewportSync()` |
| `display/` | Call/contract/card formatting, convention card builders (`convention-card.ts` — `buildConventionCardPanel` for App format, `buildAcblCardPanel` for ACBL format, wired to WASM via service-helpers) |
| `util/delay.ts` | Pure delay utility |

## Hexagonal Boundary Rules

- **Callers own types.** Service defines its own viewport/response types.
- **All UI imports go through service.** Components and stores must import from `service/index.ts` only.
- **Test: "does this work if service runs remotely?"** If a change requires the UI to import a backend type directly, it's wrong.
- **WASM proxy contract.** `BridgeService` methods serialize args to JSON, call the WASM function, and deserialize the result. No domain logic in TS.

## Conventions

- **`retryBid()` is intentionally absent from `ServicePort`.** Wrong bids never modify session state (correct-path-only). Retry is store-local: clear `$state` feedback.
- **`submitBid` is atomic.** Grade + apply + run AI bids + return next viewport — one call. The service runs AI bids with NO delays. The store owns animation timing.
- **Single-session invariant.** `createDrillSession` destroys the previous session — ServicePort supports only one active session per client.
- **Phase transitions are explicit.** Four focused methods replace the old polymorphic `acceptPrompt`: `enterPlay(handle, seat?)` enters the play phase, `declinePlay(handle)` skips to review, `returnToPrompt(handle)` returns to the declarer prompt (used in "play this hand" flow), `restartPlay(handle)` restarts the play phase.
- **`DevServicePort` vs `ServicePort`.** Debug methods on `DevServicePort` only. Production stores type against `ServicePort`.

## Boundary Types

**Allowed to cross:** `BiddingViewport`, `ViewportBidFeedback`, `TeachingDetail`, `ServiceTeachingLabel`, `Call`, `Card`, `Seat`, `Vulnerability`, `BidGrade`, `BidHistoryEntry`, `GamePhase`, `DrillHandle` (opaque string), session config DTOs.

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
