# Evaluation — Type-Enforced Viewport Boundary

Integration layer between engine internals and CLI agent-facing commands. All exports use viewport types only — no strategy, teaching, or convention internals leak.

## Conventions

- **Dependency direction:** `evaluation/ → engine/ + conventions/ + strategy/ + service/`. Teaching is accessed via the conventions barrel. Viewport builders live in `service/`. CLI commands (`eval.ts`, `play.ts`) import from `evaluation/` only — ESLint blocks direct strategy/conventions imports in those files.
- **Orchestrator exception:** diagnostic commands (`plan`, `selftest`, `list`, `describe`, `bundles`) access convention internals directly; they are not agent-facing.
- **Convention authors never modify this module** — it is infrastructure.

## Architecture

| File | Role |
|------|------|
| `index.ts` | Barrel exports: types + all public functions |
| `types.ts` | Result types composed ONLY from viewport types (`BiddingViewport`, `ViewportBidFeedback`, `TeachingDetail`, `BidGrade`) + basic engine types (`Seat`, `Vulnerability`, `Call`) |
| `atom-evaluator.ts` | `buildAtomViewport()`, `gradeAtomBid()`, `validateAtomId()`, `parseAtomId()` — single-bid evaluation |
| `playthrough-evaluator.ts` | `startPlaythrough()`, `getPlaythroughStepViewport()`, `gradePlaythroughBid()`, `getPlaythroughRevealSteps()` — multi-step auction walkthrough |

## What This Module Encapsulates

Strategy invocation (`protocolSpecToStrategy` → `suggest()`), teaching resolution (`resolveTeachingAnswer`, `gradeBid`), and viewport construction (`buildBiddingViewport`, `buildViewportFeedback`, `buildTeachingDetail`) — all hidden behind the viewport-typed API.

---

## Context Maintenance

**Staleness anchor:** `index.ts` must export `buildAtomViewport` and `startPlaythrough`. If either is missing, this file is stale — update or regenerate.

<!-- context-layer: generated=2026-03-19 | last-audited=2026-03-19 | version=1 | tree-sig=dirs:1,files:5,exts:ts:4,md:1 -->
