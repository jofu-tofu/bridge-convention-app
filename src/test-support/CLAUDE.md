# Test Support

Shared test factories and stubs used across module boundaries (stores, components, drill).

## Exports

| File             | Exports                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| `convention-factories.ts` | `makeSurface`, `makeRanking`, `buildMachine`, `makeCall`, `makePass`, `makeFactCatalogEntry`, `makeMeaningCatalogEntry`, `makeCatalogEntry` — canonical factories for convention system types |
| `engine-stub.ts` | `createStubEngine(overrides?)`, `makeDeal()`                                                     |
| `fixtures.ts`    | `makeCard`, `ALL_RANKS`, `makeSimpleTestDeal`, `makeDrillSession`, `makeContract`, `flushWithFakeTimers`, `flushWithRealTimers` |
| `tiers.ts`       | `refDescribe`, `policyDescribe`, `PolicyRationale`, `TestTier`, `TierEntry`, `getTierRegistry`, `clearTierRegistry` |

## Conventions

- **Convention factories:** Canonical source for `makeSurface`, `makeRanking`, `buildMachine`, `makeCall`, `makePass`. Pipeline/runtime/strategy test-helpers re-export these to preserve backward compatibility.
- **Engine stub:** Creates minimal `EnginePort` with safe defaults (pass-only, balanced hand). Override per test.
- **Fixtures:** Create minimal valid domain objects. No test-specific logic.
- **Dependency rule:** Imports from `engine/`, `bootstrap/`, `contracts/` only — never from `components/`, `stores/`, or `conventions/`.

## Gotchas

- Component test wrappers (`ButtonTestWrapper`, `BridgeTableTestWrapper`) stay in `components/__tests__/` — moving them here would create a backwards dependency on `components/`.
- `convention-factories.ts` imports from `conventions/core/runtime/machine-types` — this is an exception to the dependency rule, justified because these are test-only factories.

---

**Staleness anchor:** This file assumes `engine-stub.ts` exists. If it doesn't, this file is stale.

<!-- context-layer: generated=2026-02-25 | version=2 | tree-sig=dirs:1,files:4,exts:ts:3,md:1 -->
