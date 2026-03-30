# Test Support

Shared test factories used across module boundaries (stores, components).

## Exports

| File             | Exports                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| `fixtures.ts`    | `makeCard`, `makeSimpleTestDeal`, `makeContract`, `flushWithFakeTimers` — pure engine-type factories |
| `wasm-test-helpers.ts` | `initTestService()`, `createTestSession(conventionId, opts?)` — WASM service test setup |
| `tiers.ts`       | `refDescribe`, `policyDescribe`, `PolicyRationale`, `TestTier`, `TierEntry`, `getTierRegistry`, `clearTierRegistry` |
| `vitest-setup.ts` | Vitest global setup (referenced by vitest.config.ts) |

## Conventions

- **Fixtures:** Create minimal valid domain objects. No test-specific logic.
- **WASM test helpers:** Replace the deleted `createStubEngine` + `createLocalService` pattern. Tests that need a real service use `createTestSession`.
- **Dependency rule:** Imports from `engine/`, `service/` only — never from `components/`, `stores/`.

## Gotchas

- Component test wrappers (`ButtonTestWrapper`, `BridgeTableTestWrapper`) stay in `components/__tests__/` — moving them here would create a backwards dependency on `components/`.

---

**Staleness anchor:** This file assumes `fixtures.ts` exists. If it doesn't, this file is stale.
