<!-- context-layer: service | version: 5 | last-audited: 2026-03-25 -->

# Service

Thin hexagonal port — the **sole interface** between UI/CLI and backend game logic. The client holds an opaque `SessionHandle` and gets back `BiddingViewport`, `ViewportBidFeedback`, `TeachingDetail` — never `Deal`, `BidResult`, `ArbitrationResult`, or strategy internals. Domain logic (controllers, state, drill lifecycle) lives in `session/`; service is just the port + barrel + display/util/evaluation.

## Architecture

| File | Role |
|------|------|
| `index.ts` | Barrel organized by consumer concern: (1) port & impl, (2) viewports/responses, (3) engine primitives, (4) convention catalog, (5) coverage utils, (6) session config, (7) display, (8) evaluation facade, (9) cross-cutting. Debug types (`StrategyEvaluation`, `BidFeedbackDTO`) route through `debug-types.ts`, not this barrel. |
| `debug-types.ts` | Debug-only types for DevServicePort — allowed to import backend types by design. Re-exports `StrategyEvaluation`, `BidFeedbackDTO`, `EvaluatedFacts`, `PipelineResult`, `MachineDebugSnapshot`. Future agents must not move these to `index.ts`. |
| `request-types.ts` | Request DTOs: SessionHandle, SessionConfig (includes `practiceMode` and `targetModuleId`) |
| `response-types.ts` | Response DTOs: DrillStartResult, BidSubmitResult, PlayCardResult, viewports, ModuleCatalogEntry, ModuleLearningViewport, PhaseGroupView, SurfaceDetailView, FlowTreeNode, BundleFlowTreeViewport, ModuleFlowTreeViewport |
| `port.ts` | ServicePort + DevServicePort interfaces |
| `local-service.ts` | In-process implementation (implements DevServicePort) — delegates to session/ |
| `display/` | Call/contract/card formatting, hand summary, convention card builder (`convention-card.ts`) |
| `util/delay.ts` | Pure delay utility |
| `evaluation/` | Stateless CLI grading logic — see below |

## Hexagonal Boundary Rules

- **Callers own types.** Service defines its own viewport/response types.
- **All UI imports go through service.** Components and stores must import from `service/index.ts` only. When the UI needs something new, add it to `ServicePort` or as a re-export from `index.ts` — never add a direct import from `engine/`, `conventions/`, `inference/`, or `session/` in UI code.
- **Test: "does this work if service runs remotely?"** If a change requires the UI to import a backend type directly, it's wrong.

## Conventions

- **No Svelte `tick()` in controllers.** Extracted controller functions never import or call `tick()`. They operate on plain state and return results. Stores apply results to `$state`.
- **`retryBid()` is intentionally absent from `ServicePort`.** Wrong bids never modify session state (correct-path-only). Retry is store-local: clear `$state` feedback.
- **`submitBid` is atomic.** Grade + apply + run AI bids + return next viewport — one call. The service runs AI bids with NO delays. The store owns animation timing: iterates through `aiBids` list with local delays.
- **`DevServicePort` vs `ServicePort`.** Debug methods (`getExpectedBid`, `getDebugSnapshot`, `getDebugLog`, `getInferenceTimeline`) on `DevServicePort` only. Production stores type against `ServicePort`.

## Evaluation Subfolder

The `evaluation/` subfolder contains stateless CLI grading logic (atom evaluation, playthrough evaluation). It is internal to service — all external imports go through `service/index.ts`. The subfolder encapsulates strategy invocation, teaching resolution, and viewport construction behind viewport-typed APIs. Convention authors never modify these files.

## Boundary Types

**Allowed to cross:** `BiddingViewport`, `ViewportBidFeedback`, `TeachingDetail`, `ServiceTeachingLabel`, `Call`, `Card`, `Seat`, `Vulnerability`, `BidGrade`, `BidHistoryEntry`, `GamePhase`, `SessionHandle` (opaque string), session config DTOs.

`ServiceTeachingLabel` is a plain `{ name: string; summary: string }` — no branded types at the service boundary. Branded types (`BidName`, `BidSummary`) widen implicitly to `string` at assignment in the viewport builders. Do NOT add an explicit converter.

`updatePlayProfile()` — swaps `PlayStrategyProvider` on active session. Must transfer `onAuctionComplete` state to new provider.

**Never crosses (main barrel):** `Deal`, `BidResult`, `DrillSession`, `DrillBundle`, `ConventionStrategy`, `StrategyEvaluation`, `ArbitrationResult`, `BidMeaning`, `InferenceEngine`. Exception: `StrategyEvaluation` and `BidFeedbackDTO` are routed through `debug-types.ts` for debug drawer consumption — this is a deliberate boundary exception, not a barrel re-export.

## Dependency Direction

```
components/ → stores/ → service/ (thin port) → session/ → {engine, conventions, inference}
cli/commands/ → service/
```

Nothing imports from `service/` except `stores/`, `components/`, and `cli/commands/`. `session/` must never import from `service/` (ESLint enforced).

## Known Gaps

- `submitBid()` always builds `nextViewport` for accepted bids (including auction-completing bids) so the store can animate AI bids before transitioning phases

---

## Context Maintenance

**Staleness anchor:** This file assumes `local-service.ts` exists. If it doesn't, this file is stale.
