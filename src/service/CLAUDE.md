<!-- context-layer: service | version: 11 | last-audited: 2026-04-12 -->

# Service

WASM proxy layer — the **sole interface** between UI/CLI and the Rust backend (25 methods). The client holds an opaque `DrillHandle` and gets back `BiddingViewport`, `ViewportBidFeedback`, `TeachingDetail` — never raw domain types. All game logic (conventions, inference, session) runs in Rust via `bridge-service`. TS `service/` is a thin serialize/call/deserialize proxy. DDS solver is wired automatically during `init()` — the WASM layer routes Expert/WorldClass profiles through async DDS play internally.

**ServicePort methods (25):**
- **Lifecycle:** `init` (must be called once before any other method; idempotent; DDS wiring is fire-and-forget in browser)
- **Session:** `createDrillSession`, `startDrill`
- **Bidding:** `submitBid`
- **Transitions:** `enterPlay`, `declinePlay`, `returnToPrompt`, `restartPlay`
- **Play:** `playCard`, `skipToReview`, `updatePlayProfile`
- **Query:** `getBiddingViewport`, `getDeclarerPromptViewport`, `getPlayingViewport`, `getExplanationViewport`
- **Inference:** `getPublicBeliefState`
- **DDS:** `getDDSSolution`
- **Catalog:** `listConventions`
- **Learning:** `listModules`, `getModuleLearningViewport`, `getModuleFlowTree`
- **Module forking:** `forkModule`
- **Module config:** `getModuleConfigSchema`, `validateModule`

## Architecture

| File | Role |
|------|------|
| `index.ts` | Barrel organized by consumer concern: (1) port & impl, (2) viewports/responses, (3) engine primitives, (4) convention catalog, (5) coverage utils, (6) session config, (7) display, (8) evaluation facade, (9) cross-cutting. Debug types route through `debug-types.ts`. |
| `debug-types.ts` | Debug-only types for DevServicePort — allowed to import backend types by design. |
| `request-types.ts` | Request DTOs: DrillHandle, SessionConfig (includes `practiceMode`, `targetModuleId`, `playProfileId`, `vulnerabilityDistribution`). `playProfileId` selects the MC+DDS / heuristic profile for AI seats. `vulnerabilityDistribution` is a probability weight `{none, ours, theirs, both}` that drives Rust's `pick_vulnerability` sampler. An explicit `vulnerability` override (tests/dev) outranks the distribution. |
| `response-types.ts` | Response DTOs: DrillStartResult, BidSubmitResult, PlayCardResult, viewports, ModuleCatalogEntry, ModuleLearningViewport, FlowTreeNode, etc. |
| `session-types.ts` | Stub type definitions matching Rust JSON schema — TS interfaces for types that cross the WASM boundary |
| `port.ts` | ServicePort + DevServicePort interfaces |
| `wasm-service.ts` | `BridgeService` — thin proxy implementing ServicePort via `wasm-bindgen` calls to Rust `WasmServicePort`. `init()` handles WASM module loading + DDS solver wiring. |
| `service-helpers.ts` | Sync WASM wrappers for UI components: `listConventions()`, `listModules()`, `buildBaseModuleInfos()`, `getModuleLearningViewportSync()` |
| `display/` | Call/contract/card formatting, convention card builders (`convention-card.ts` — `buildConventionCardPanel` for App format, `buildAcblCardPanel` for ACBL format, wired to WASM via service-helpers) |
| `util/delay.ts` | Pure delay utility |
| `auth.ts` | DataPort boundary for `/api/*` calls. `DataPort` interface now covers auth + billing methods, `DataPortClient` (production HTTP), `DevDataPort` (dev-only auth fake with billing no-ops and paid-content fetch delegation). Exports `AuthUser`, `SubscriptionTier`. `DevDataPort` is client-only; for a real server session in e2e use `POST /api/dev/login` (bridge-api `dev-tools` feature) via `tests/e2e/helpers.ts:devLogin`. |
| `billing.ts` | DataPort billing types and typed server-gate errors (`AuthRequiredError`, `SubscriptionRequiredError`) shared by `auth.ts` callers. |

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
- **DataPort** (auth/billing/entitlements/progress, server) — implemented as `bridge-api` (Axum :3001, SQLite). `auth.ts` is the TS client and `billing.ts` carries the shared billing boundary types/errors.

They don't mix. See `docs/product/product-direction.md`.

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Staleness anchor:** This file assumes `wasm-service.ts` exists. If it doesn't, this file is stale.
