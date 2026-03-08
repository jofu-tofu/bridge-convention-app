# Bootstrap

Dependency assembly and drill lifecycle — session management, config construction, deal generation, and inference engine wiring.

## Conventions

- **Dependency direction:** `bootstrap/ → engine/ + conventions/core/ + contracts/ + strategy/ + inference/`. Nothing imports from bootstrap/ except `stores/` and `components/`.
- **DrillBundle is the bridge between bootstrap and stores.** `startDrill()` returns a `DrillBundle` containing deal, session, inference engines, and strategy. The caller (GameScreen) passes the bundle to `gameStore.startDrill(bundle)`.
- **No Svelte imports.** Bootstrap is plain .ts — inference engines are created statically (no dynamic import workaround needed).

## Architecture

```
bootstrap/
  types.ts            DrillConfig, DrillSession, DrillBundle interfaces
  session.ts          createDrillSession() — DrillSession implementation
  config-factory.ts   createDrillConfig() — builds DrillConfig from convention ID + user seat
  start-drill.ts      startDrill() + rotation utilities (rotateSeat180, rotateDealConstraints, rotateAuction)
  __tests__/          Tests for all bootstrap files
```

**Drill lifecycle flow:**
1. `startDrill(engine, convention, userSeat, rng?, seed?, options?)` in `start-drill.ts`
2. Resolves dealer from `convention.allowedDealers` (if set) — picks random dealer, rotates constraints 180° if different from base
3. Calls `createDrillConfig(conventionId, userSeat, options?)` from `config-factory.ts`
4. Generates a deal via `engine.generateDeal(constraints)`
5. Creates session via `createDrillSession(config)` from `session.ts`
6. Creates inference engines from config's inference configs
7. Returns `DrillBundle` — caller wires it to the game store

**DrillBundle:** `{ deal, session, initialAuction?, strategy?, nsInferenceEngine, ewInferenceEngine }`. Decouples bootstrap from store — bootstrap assembles dependencies, store applies them.

**Rotation utilities** (`start-drill.ts`): `rotateSeat180(seat)` swaps N↔S, E↔W. `rotateDealConstraints(base, newDealer)` rotates all seat constraints. `rotateAuction(auction)` rotates all auction entry seats.

**Config factory wiring:** `createDrillConfig()` builds both `nsInferenceConfig` and `ewInferenceConfig`. Options: `opponentBidding`, `opponentConventionId` (defaults to "sayc"), `beliefProvider`, `lookupConvention` (DI seam).

## Gotchas

- `DrillSession.getNextBid()` returns `null` for user seats (signals UI to wait)
- `DrillConfig.ewInferenceConfig` — natural by default, convention-aware when `opponentBidding: true`

---

## Context Maintenance

**Staleness anchor:** This file assumes `types.ts` exists. If it doesn't, this file is stale.

<!-- context-layer: generated=2026-03-07 | version=1 | tree-sig=dirs:2,files:5,exts:ts:4,md:1 -->
