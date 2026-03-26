# Session

Domain logic for game state, drill lifecycle, controllers, viewport builders, and grading. This is the domain layer that sits between the hexagonal service port above it and the convention/engine/inference modules below.

## Dependency Direction

```
service/ (thin port) → session/ → {engine/, conventions/, inference/}
```

**session/ must never import from service/.** ESLint enforces this. The only exception is `service/response-types.ts` (viewport response DTOs that session builds) and `service/display/` (formatting utilities).

## Architecture

| File | Role |
|------|------|
| `index.ts` | Barrel: GamePhase, DrillSettings, PlayProfileId, PracticePreferences, BidFeedbackDTO re-exports for service/ consumption |
| `session-state.ts` | Per-session mutable state (deal, auction, strategy, inference, phase, play state). Stores `PlayStrategyProvider` and calls `onAuctionComplete()` at auction end via `capturePlayInferences()`. Also stores `playRecommendations` and `worldClassAdvisor` for play review. **Ordering constraint:** `initializePlay()` resets `playRecommendations` but NOT `worldClassAdvisor` — the advisor is set by `local-service.ts` AFTER calling `initializePlay()`. |
| `session-manager.ts` | Map<SessionHandle, SessionState>, createHandle() |
| `drill-session.ts` | createDrillSession() — DrillSession implementation |
| `phase-machine.ts` | GamePhase state machine (BIDDING → DECLARER_PROMPT → PLAYING → EXPLANATION) |
| `bidding-controller.ts` | Pure bidding logic: processBid(), runInitialAiBids(), initializeAuction() |
| `play-controller.ts` | Pure play logic: processPlayCard(), trick scoring, AI play loop. `selectAiCard()` is async (awaits `PlayStrategy.suggest()`). |
| `dds-controller.ts` | DDS solve logic with timeout and stale-result guard |
| `build-viewport.ts` | Viewport builders: buildBiddingViewport(), buildDeclarerPromptViewport(), etc. |
| `learning-viewport.ts` | buildModuleCatalog(), buildModuleLearningViewport(), buildBundleFlowTree() — module-centric learning viewport builders + unified conversation flow tree |
| `evaluation-oracle.ts` | EvaluationOracle (answer key, internal only) |
| `bid-feedback-builder.ts` | assembleBidFeedback() — grades bids, builds feedback DTOs |
| `start-drill.ts` | startDrill() + pickVulnerability() + rotation utilities |
| `config-factory.ts` | createProtocolDrillConfig() — builds DrillConfig from convention ID + user seat. Threads SystemConfig to natural inference providers for system-aware inference. Creates `PlayStrategyProvider` from `playProfileId` option. Accepts optional `engine` for world-class profile (MC+DDS). |
| `strategy-factory.ts` | Strategy composition: createSpecStrategy(), createSpecStrategyWithFallback(), createOpponentStrategy() |
| `drill-types.ts` | DrillConfig, DrillSession, DrillBundle, DrillTuning, DrillSettings, OpponentMode. `DrillSettings.playProfileId` selects opponent play difficulty; `DrillConfig.playStrategyProvider` carries the DI provider. |
| `teaching-weighting.ts` | computeScenarioDistribution() — pedagogical weighting for deal generation |
| `practice-preferences.ts` | User preference DTOs (PracticePreferences, DisplayPreferences) |
| `heuristics/` | Convention-independent bidding and play heuristics (see heuristics/CLAUDE.md) |

## Conventions

- **No Svelte imports.** Session is pure domain logic — no UI framework dependencies.
- **Controllers are pure functions.** They operate on SessionState and return results. No `tick()`, no delays.
- **Viewport builders construct service response types.** They import from `../service/response-types.ts` for the viewport DTOs.

---

## Context Maintenance

**Staleness anchor:** This file assumes `session-state.ts` exists. If it doesn't, this file is stale.
