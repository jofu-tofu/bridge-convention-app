# Protocol Frame Architecture

Replaces the skeleton + module composition model with a layered frame architecture: a boot router selects exactly one base track from the opening pattern, then zero or more protocol frames guard-activate on top based on public state (registers, tags, capabilities).

## Architecture

```
Boot Router (compiled prefix trie over opening patterns)
    ↓ selects one
Base Track (primary conversation FSM — one active per deal)
    ↓ layered above
Protocol Frames (guard-activated, zero or more, ordered by depth)
```

Runtime snapshot is a **sparse state vector**: `{ bootNodeId, base?, protocols[], registers, activeTags, doneLatches, ply }`.

## File Roles

| File | Role |
|------|------|
| `types.ts` | All core types: `ModuleSpec` (unified `BaseModuleSpec` / `ProtocolModuleSpec`), `FrameStateSpec`, `TransitionSpec`, `BoolExpr`, `EffectSpec`, `SurfaceFragment`, `RuntimeSnapshot`, `ConventionSpec`, `BootRouter`. Expression helpers (`and`, `or`, `not`, `exists`, `eq`, `reg`, `activeTag`, `cap`). |
| `boot-router.ts` | Compiles `OpeningPatternSpec[]` into a prefix trie. `compileBootRouter()`, `advanceBootRouter()`, `getViableTracks()`. |
| `surface-stack.ts` | Composes surface fragments across the frame stack. `composeSurfaceStack()`, `buildSurfaceStack()`. Handles augment/compete/shadow relations and layer priority. |
| `replay.ts` | `replay()` — replays an auction through the full frame architecture (boot router + base track + protocol lifecycle). `computeActiveSurfaces()` — derives the effective decision surface from the snapshot. |
| `protocol-lifecycle.ts` | Protocol instance management: `evaluateBoolExpr()`, `resolveRef()`, `applyEffects()`, `advanceProtocolState()`, `settleProtocolLifecycle()`. Full `ExpressionContext` for runtime evaluation. |
| `bridge-schema.ts` | `BRIDGE_SEMANTIC_SCHEMA` — the shared vocabulary of registers, tags, and capabilities that base tracks and protocols coordinate through. |
| `coverage-enumeration.ts` | Static coverage analysis: `enumerateBaseTrackStates()` (BFS), `enumerateBaseTrackAtoms()`, `enumerateProtocolAtomsAtBaseState()`, `generateProtocolCoverageManifest()`. Approximates protocol attachment via simulated register/tag state. |
| `index.ts` | Barrel exports for the protocol directory. |

## Key Concepts

- **Sparse state vector:** Runtime state is `{ bootNodeId, base, protocols[], registers, activeTags, doneLatches, ply }` — not a flat FSM state. Base track + protocol positions are tracked independently.
- **Surface fragments:** Each frame state can reference a `SurfaceFragment` containing `MeaningSurface[]`. Fragments compose via relation (`augment`/`compete`/`shadow`) and layer priority. The effective decision surface is the composed stack.
- **Settle phase:** After protocol exits (POP), zero-event `ReactionSpec` rules fire. `settleProtocolLifecycle()` evaluates reactions until the frame stack stabilizes. This is where cascading protocol exits and re-entries happen.
- **BoolExpr tree:** Guard conditions (`attachWhen`, `surfaceWhen`, transition `guard`) use a declarative expression tree over public state. `evaluateBoolExpr()` for full runtime evaluation; `evaluateSimpleBoolExpr()` (in coverage-enumeration) for static approximation.
- **Module unification:** `BaseModuleSpec` (role: "base") and `ProtocolModuleSpec` (role: "protocol") share `ModuleSpecBase`. `ConventionSpec.modules` is one list; use `getBaseModules()`/`getProtocolModules()` to separate.

## Gotchas

- **Done latches:** `doneLatches` prevent immediate re-entry of completed protocols. The latch key is `"protocolId:scopeKey"`. `doneLatchUntil` in `ProtocolModuleSpec.completion` controls when the latch clears. Forgetting latches causes infinite protocol re-activation loops.
- **No-reentry invariant:** Once a protocol POP fires, the same instance cannot re-attach in the same settle cycle. Enforced by done latches.
- **Scope key interpolation:** `ProtocolModuleSpec.scopeKey` supports `${reg.path}` interpolation — each distinct scope key value creates a separate protocol instance. Two protocols with different scope keys can coexist even if they share the same `ProtocolModuleSpec.id`.
- **Coverage enumeration is approximate:** `enumerateProtocolAtomsAtBaseState()` simulates register/tag state by walking `onEnter` effects along the BFS path. It does NOT evaluate full `ExpressionContext` — complex expressions (history refs, local state, multi-writer registers from other tracks) may be inaccurate.
- **STAY/POP transitions:** `enumerateBaseTrackStates()` skips STAY and POP targets during BFS — they don't represent new reachable states.

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Add** an entry only if an agent would fail without knowing it, it is not obvious from
the code, and it belongs at this scope (project-wide rule -> root CLAUDE.md; WHY decision
-> inline comment or ADR; inferable from code -> nowhere).

**Remove** any entry that fails the falsifiability test: if removing it would not change
how an agent acts here, remove it. If a convention here conflicts with the codebase,
the codebase wins — update this file, do not work around it. Prune aggressively.

**Track follow-up work:** After modifying files, evaluate whether changes create incomplete
work or break an assumption tracked elsewhere. If so, create a task or update tracking before ending.

**Staleness anchor:** This file assumes `types.ts` exports `ConventionSpec` and `coverage-enumeration.ts` exports `generateProtocolCoverageManifest`. If they don't, this file is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-03-15 | version=1 | tree-sig=dirs:1,files:8,exts:ts:8 -->
