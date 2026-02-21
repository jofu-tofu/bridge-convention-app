# AI

Bidding AI strategies. Consumer of `conventions/` and `engine/` via `shared/types`.

## Conventions

- **Dependency direction:** `ai/ → shared/ + conventions/ + engine/`. Engine never imports from ai/. Conventions never import from ai/.
- **Strategy pattern.** `BiddingStrategy` (defined in `shared/types.ts`) is the core interface. Strategies are passed to `EnginePort.suggestBid()` by the caller.
- **`null` means "no opinion."** A strategy returning `null` defers to the next strategy in a chain. `TsEngine.suggestBid()` wraps `null` into a pass at the boundary.
- **Convention adapter.** `conventionToStrategy()` wraps a `ConventionConfig` as a `BiddingStrategy`. Callers (CLI, tests) construct strategies explicitly — the engine never resolves convention IDs to strategies.

## Architecture

**Module graph:**
```
shared/types.ts (BidResult, BiddingStrategy)
  ↑ import type
ai/convention-strategy.ts → conventions/registry (evaluateBiddingRules)
ai/pass-strategy.ts
ai/types.ts (DrillConfig, DrillSession — Phase 4 prep)
```

**Key files:**

| File | Role |
|------|------|
| `convention-strategy.ts` | `conventionToStrategy()` — wraps `ConventionConfig` as `BiddingStrategy` |
| `pass-strategy.ts` | Always-pass placeholder strategy |
| `types.ts` | `DrillConfig`, `DrillSession` — Phase 4 types (not yet implemented) |

## Adding a Strategy

1. Create `src/ai/{name}-strategy.ts` — export an object or factory satisfying `BiddingStrategy`
2. `suggest()` returns `BidResult | null`. Return `null` to defer.
3. Write tests in `src/ai/__tests__/{name}-strategy.test.ts`
4. Strategy chaining: callers can try strategies in sequence, using the first non-null result

## Gotchas

- `DrillConfig` and `DrillSession` are type-only — no implementation until Phase 4
- `conventionToStrategy` maps `BiddingRuleResult.rule` to `BidResult.ruleName` (field name change)
- Tests use `clearRegistry()`/`registerConvention()` in `beforeEach` for isolation

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Staleness anchor:** This file assumes `convention-strategy.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-02-21 | last-audited=2026-02-21 | version=1 -->
