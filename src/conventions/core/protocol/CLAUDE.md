# Protocol Types

Retained type definitions for `ConventionSpec` and related protocol frame types. The runtime protocol infrastructure (boot router, replay, surface stack, spec assembler, bridge schema) has been removed. All bundles now use rule-based surface selection via unified `ConventionModule`.

## File Roles

| File | Role |
|------|------|
| `types.ts` | Declarative expression types (`BoolExpr`, `Ref`, `EffectSpec`) with helpers (`and`, `or`, `not`, `exists`, `eq`, `reg`, `activeTag`, `cap`). Public semantic schema (`RegisterSpec`, `CapabilitySpec`, `PublicSemanticSchema`). Event patterns (`EventPattern`). Transition types (`TransitionSpec`, `ReactionSpec`). Surface composition (`SurfaceFragment`, `SurfaceRelation`). Top-level `ConventionSpec` (`{ id, name, modules }`). Used by strategy and service layers. |

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Staleness anchor:** This file assumes `types.ts` exports `ConventionSpec`. If it doesn't, this file is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-03-15 | last-audited=2026-03-21 | version=2 | tree-sig=dirs:0,files:1,exts:ts:1 -->
