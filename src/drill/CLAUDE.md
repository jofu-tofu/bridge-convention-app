# Drill

Unified drill lifecycle — session management, config construction, and game startup helpers.

## Conventions

- **Dependency direction:** `drill/ → engine/ + conventions/core/ + shared/ + strategy/ + inference/`. Nothing imports from drill/ except `stores/` and `components/`.
- **DrillSession is the bridge between strategy and stores.** It wraps a `DrillConfig` and provides `getNextBid()` per seat (returns `null` for user seats, wraps null strategy results as pass for AI seats).

## Architecture

```
drill/
  types.ts            DrillConfig, DrillSession interfaces
  session.ts          createDrillSession() — DrillSession implementation
  config-factory.ts   createDrillConfig() — builds DrillConfig from convention ID + user seat
  helpers.ts          startDrill() + rotation utilities (rotateSeat180, rotateDealConstraints, rotateAuction)
  __tests__/          Tests for all drill files
```

**Drill lifecycle flow:**
1. `startDrill(engine, convention, userSeat, gameStore)` in `helpers.ts`
2. Resolves dealer from `convention.allowedDealers` (if set) — picks random dealer, rotates constraints 180° if different from base
3. Calls `createDrillConfig(conventionId, userSeat, options?)` from `config-factory.ts`
4. Generates a deal via `engine.generateDeal(constraints)`
5. Creates session via `createDrillSession(config)` from `session.ts`
6. Rotates `initialAuction` if dealer was rotated
7. Calls `gameStore.startDrill(deal, session, ...)`

**Rotation utilities** (`helpers.ts`): `rotateSeat180(seat)` swaps N↔S, E↔W. `rotateDealConstraints(base, newDealer)` rotates all seat constraints. `rotateAuction(auction)` rotates all auction entry seats. Used by `startDrill()` when `allowedDealers` picks a non-base dealer.

**Config factory wiring:** `createDrillConfig()` builds both `nsInferenceConfig` and `ewInferenceConfig`. Options: `opponentBidding` (enables E-W convention inference), `opponentConventionId` (defaults to "sayc", falls back to natural on invalid ID), `beliefProvider` (for convention strategy), and `lookupConvention` (DI seam replacing global registry lookup in drill/strategy/inference wiring).

## Teaching Resolution

`teaching-resolution.ts` defines the multi-grade bid feedback layer:

- **`BidGrade`** enum: `Correct`, `Acceptable`, `Incorrect`
- **`AcceptableBid`**: a non-primary candidate that's legal, hand-satisfied, and has `preferred` or `alternative` priority
- **`TeachingResolution`**: wraps `primaryBid` + `acceptableBids[]` + `gradingType` (exact/primary_plus_acceptable/intent_based) + `ambiguityScore` (0..1)
- **`resolveTeachingAnswer(bidResult)`**: extracts acceptable alternatives from `BidResult.treePath.resolvedCandidates`. Gracefully degrades to exact grading when candidates empty.
- **`gradeBid(userCall, resolution)`**: returns `BidGrade` — primary match → Correct, acceptable match → Acceptable, else Incorrect.

**Dependency:** `drill/ → shared/ + engine/` only (reads DTOs, uses `callsMatch`). No inverse: `strategy/` does NOT import from `drill/`. Store re-exports `BidGrade` and `TeachingResolution` for component consumption.

## Gotchas

- `DrillSession.getNextBid()` returns `null` for user seats (signals UI to wait)
- `DrillConfig.ewInferenceConfig` — natural by default, convention-aware when `opponentBidding: true`

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

**Staleness anchor:** This file assumes `types.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-02-25 | last-audited=2026-02-25 | version=2 | dir-commits-at-audit=0 | tree-sig=dirs:2,files:9,exts:ts:8,md:1 -->
