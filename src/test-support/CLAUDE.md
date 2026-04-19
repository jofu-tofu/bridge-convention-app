# Test Support

Shared test factories used across module boundaries (stores, components).

## Exports

| File                      | Exports                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| `fixtures.ts`             | `makeSimpleTestDeal` — pure engine-type factory; `TEST_DRILL_SEED` and `TEST_DRILL_TUNABLES` — default snapshot / spread used by drill-store and DrillForm tests so they can call `createDrillsStore({ ..., seedFromPrefs })` and `drillsStore.create({ ..., ...TEST_DRILL_TUNABLES })` without restating the four gameplay tunables on every call |
| `response-factories.ts`   | `makeBiddingViewport`, `makeDrillStartResult`, `makeBidSubmitResult`, `makePlayEntryResult`, `makePlayCardResult`, `makePlayingViewport`, `makeDeclarerPromptViewport`, `makeExplanationViewport` — viewport/response factories for store tests (no vitest dependency) |
| `service-mocks.ts`        | `createMockService` — type-safe mock `DevServicePort` factory with `satisfies` constraint ensuring compile-time drift detection |

## Conventions

- **Fixtures:** Create minimal valid domain objects. No test-specific logic.
- **Dependency rule:** Imports from `engine/`, `service/` are the default; `stores/` types (e.g., `DrillSeed`) may be imported when fixtures must mirror a store's public schema. Never import from `components/`.

## Gotchas

- Component test wrappers (`ButtonTestWrapper`, `BridgeTableTestWrapper`) stay in `components/__tests__/` — moving them here would create a backwards dependency on `components/`.

---

**Staleness anchor:** This file assumes `fixtures.ts`, `response-factories.ts`, and `service-mocks.ts` exist. If they don't, this file is stale.
