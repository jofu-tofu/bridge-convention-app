# Bootstrap

Dependency assembly and drill lifecycle — session management, config construction, deal generation, and inference engine wiring.

## Conventions

- **Dependency direction:** `bootstrap/ → engine/ + conventions/core/ + contracts/ + strategy/ + inference/`. Nothing imports from bootstrap/ except `stores/` and `components/`.
- **DrillBundle is the bridge between bootstrap and stores.** `startDrill()` returns a `DrillBundle` containing deal, session, inference engines, and strategy. The caller (GameScreen) passes the bundle to `gameStore.startDrill(bundle)`.
- **No Svelte imports.** Bootstrap is plain .ts — inference engines are created statically (no dynamic import workaround needed).

## Architecture

```
bootstrap/
  types.ts            DrillConfig, DrillSession, DrillBundle, DrillTuning, VulnerabilityDistribution, DEFAULT_DRILL_TUNING
  session.ts          createDrillSession() — DrillSession implementation
  config-factory.ts   createDrillConfig() — builds DrillConfig from convention ID + user seat
  start-drill.ts      startDrill() + pickVulnerability() + rotation utilities (rotateSeat180, rotateDealConstraints, rotateAuction)
  __tests__/          Tests for all bootstrap files
```

**DrillTuning** (`types.ts`): Configurable practice session parameters, threaded from app store → GameScreen → `startDrill()`.
- `VulnerabilityDistribution` — weights for `none`/`ours`/`theirs`/`both` (default: equal 1 each = 25%). Seat-relative: "ours"/"theirs" resolved to NS/EW based on user seat.
- `includeOffConvention?` — enable off-convention deals (hands where the convention doesn't apply)
- `offConventionRate?` — fraction 0–1 (default 0.3) controlling how often off-convention deals appear
- `moduleWeights?` — per-module exercise weighting (future)

**Drill lifecycle flow:**
1. `startDrill(engine, convention, userSeat, rng?, seed?, options?)` in `start-drill.ts`
2. Resolves dealer from `convention.allowedDealers` (if set) — picks random dealer, rotates constraints 180° if different from base
3. Picks vulnerability via `pickVulnerability(dist, userSeat, roll)` — weighted random selection from `DrillTuning.vulnerabilityDistribution`, resolving seat-relative "ours"/"theirs" to NS/EW
4. Decides on-convention vs off-convention: if `tuning.includeOffConvention` and roll < `offConventionRate`, swaps to `convention.offConventionConstraints` (if defined on the bundle)
5. Calls `createDrillConfig(conventionId, userSeat, options?)` from `config-factory.ts`
6. Generates a deal via `engine.generateDeal(constraints)` (or `tsGenerateDeal` for seeded deterministic generation)
7. Creates session via `createDrillSession(config)` from `session.ts`
8. Creates inference engines from config's inference configs
9. Returns `DrillBundle` — caller wires it to the game store

**Options:** `startDrill` accepts an options object including `targetSurfaceId` for surface-level targeting (used by `?targetSurface=Z` URL param and CLI coverage runner to exercise a specific meaning surface at the target auction state).

**DrillBundle:** `{ deal, session, initialAuction?, strategy?, nsInferenceEngine, ewInferenceEngine, isOffConvention }`. Decouples bootstrap from store — bootstrap assembles dependencies, store applies them. `isOffConvention` signals to UI/teaching that the deal was generated from `offConventionConstraints`.

**Rotation utilities** (`start-drill.ts`): `rotateSeat180(seat)` swaps N↔S, E↔W. `rotateDealConstraints(base, newDealer)` rotates all seat constraints. `rotateAuction(auction)` rotates all auction entry seats.

**Config factory wiring:** `createDrillConfig()` builds both `nsInferenceConfig` and `ewInferenceConfig`. Options: `lookupConvention` (DI seam, currently unused). `buildBundleStrategy()` converts bundles to runtime modules via `bundleToRuntimeModules()` and passes `evaluationRuntime` to `meaningBundleToStrategy()`, activating the two-phase `evaluate()` path in `meaning-strategy.ts`.

## Gotchas

- `DrillSession.getNextBid()` returns `null` for user seats (signals UI to wait)
- `DrillConfig.ewInferenceConfig` — natural by default, convention-aware when `opponentBidding: true`

---

## Context Maintenance

**Staleness anchor:** This file assumes `types.ts` exists. If it doesn't, this file is stale.

<!-- context-layer: generated=2026-03-07 | last-audited=2026-03-18 | version=2 | tree-sig=dirs:2,files:5,exts:ts:4,md:1 -->
