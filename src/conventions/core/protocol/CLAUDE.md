# Protocol Types

Retained type definitions for `ConventionSpec` and related protocol frame types. The runtime protocol infrastructure (boot router, replay, surface stack, spec assembler, bridge schema) has been removed. All bundles now use rule-based surface selection via `RuleModule`.

## File Roles

| File | Role |
|------|------|
| `types.ts` | Core types: `ModuleSpec` (unified `BaseModuleSpec` / `ProtocolModuleSpec`), `FrameStateSpec`, `TransitionSpec`, `BoolExpr`, `EffectSpec`, `SurfaceFragment`, `RuntimeSnapshot`, `ConventionSpec`. Expression helpers (`and`, `or`, `not`, `exists`, `eq`, `reg`, `activeTag`, `cap`). Used by strategy and bootstrap layers. |

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Staleness anchor:** This file assumes `types.ts` exports `ConventionSpec`. If it doesn't, this file is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-03-15 | last-audited=2026-03-21 | version=2 | tree-sig=dirs:0,files:1,exts:ts:1 -->
