# Test Support

Shared test factories and stubs used across module boundaries (stores, components, drill).

## Exports

| File             | Exports                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| `engine-stub.ts` | `createStubEngine(overrides?)`, `makeDeal()`                                                     |
| `fixtures.ts`    | `makeCard`, `ALL_RANKS`, `makeSimpleTestDeal`, `makeDrillSession`, `makeContract`, `flushWithFakeTimers`, `flushWithRealTimers` |

## Conventions

- **Engine stub:** Creates minimal `EnginePort` with safe defaults (pass-only, balanced hand). Override per test.
- **Fixtures:** Create minimal valid domain objects. No test-specific logic.
- **Dependency rule:** Imports from `engine/`, `drill/`, `shared/` only — never from `components/`, `stores/`, or `conventions/`.

## Gotchas

- Component test wrappers (ContextWrapper, ButtonTestWrapper, BridgeTableTestWrapper) stay in `components/__tests__/` — moving them here would create a backwards dependency on `components/`.

---

**Staleness anchor:** This file assumes `engine-stub.ts` exists. If it doesn't, this file is stale.

<!-- context-layer: generated=2026-02-25 | version=1 | tree-sig=dirs:1,files:3,exts:ts:2,md:1 -->
