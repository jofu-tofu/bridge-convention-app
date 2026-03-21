<!-- context-layer: service | version: 1 | last-audited: 2026-03-20 -->

# Service

Session-handle-oriented service module that owns all game state and exposes only viewport data. The client holds an opaque `SessionHandle` and gets back `BiddingViewport`, `ViewportBidFeedback`, `TeachingDetail` — never `Deal`, `BidResult`, `ArbitrationResult`, or strategy internals.

## Architecture

| File | Role |
|------|------|
| `index.ts` | Barrel: ServicePort, DevServicePort, createLocalService(), boundary types, store-facing re-exports |
| `request-types.ts` | Request DTOs: SessionHandle, SessionConfig |
| `response-types.ts` | Response DTOs: DrillStartResult, BidSubmitResult, PlayCardResult, etc. |
| `port.ts` | ServicePort + DevServicePort interfaces |
| `local-service.ts` | In-process implementation (implements DevServicePort) |
| `session-manager.ts` | Map<SessionHandle, SessionState>, createHandle() |
| `session-state.ts` | Per-session state (deal, auction, strategy, inference, phase, play state) |
| `bidding-controller.ts` | Pure bidding logic: processBid(), runInitialAiBids(), initializeAuction() |
| `play-controller.ts` | Pure play logic: processPlayCard(), trick scoring, AI play loop |
| `dds-controller.ts` | DDS solve logic with timeout and stale-result guard |

## Conventions

- **No Svelte `tick()` in controllers.** Extracted controller functions never import or call `tick()`. They operate on plain state and return results. Stores apply results to `$state`.
- **`retryBid()` is intentionally absent from `ServicePort`.** Wrong bids never modify session state (correct-path-only). Retry is store-local: clear `$state` feedback.
- **`submitBid` is atomic.** Grade + apply + run AI bids + return next viewport — one call. The service runs AI bids with NO delays. The store owns animation timing: iterates through `aiBids` list with local delays.
- **`DevServicePort` vs `ServicePort`.** Debug methods (`getExpectedBid`, `getDebugSnapshot`, `getDebugLog`, `getInferenceTimeline`) on `DevServicePort` only. Production stores type against `ServicePort`.

## Boundary Types

**Allowed to cross:** `BiddingViewport`, `ViewportBidFeedback`, `TeachingDetail`, `Call`, `Card`, `Seat`, `Vulnerability`, `BidGrade`, `BidHistoryEntry`, `GamePhase`, `SessionHandle` (opaque string), session config DTOs.

**Never crosses:** `Deal`, `BidResult`, `DrillSession`, `DrillBundle`, `ConventionStrategy`, `StrategyEvaluation`, `ArbitrationResult`, `BidMeaning`, `InferenceEngine`.

## Dependency Direction

```
components/ → stores/ → service/ → {bootstrap, evaluation, engine, conventions, strategy, teaching, inference, core}
cli/agent-commands → evaluation/ (unchanged)
```

Nothing imports from `service/` except `stores/` and `components/`.

## Inference Invariant

`SessionState` preserves the existing inference model: only hard inference from the chosen bid's clauses + within-module exhaustive closure. `InferenceCoordinator` is stateful per-session; `processBid()` is called on every bid; `capturePlayInferences()` at auction end.

## IP Protection Affordance

This boundary enables three future strategies:
- **Server-side evaluation**: Deploy `local-service.ts` on a server; convention definitions never leave the server
- **Tiered WASM**: Free tier WASM includes only free conventions; paid tier includes all
- **Hybrid**: Free conventions client-side, premium conventions server-side

---

## Context Maintenance

**Staleness anchor:** This file assumes `local-service.ts` exists. If it doesn't, this file is stale.
