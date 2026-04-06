# Test Support

Shared test factories used across module boundaries (stores, components).

## Exports

| File                      | Exports                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| `fixtures.ts`             | `makeSimpleTestDeal` — pure engine-type factory |
| `response-factories.ts`   | `makeBiddingViewport`, `makeDrillStartResult`, `makeBidSubmitResult`, `makePlayEntryResult`, `makePlayCardResult`, `makePlayingViewport`, `makeDeclarerPromptViewport`, `makeExplanationViewport` — viewport/response factories for store tests (no vitest dependency) |
| `service-mocks.ts`        | `createMockService` — type-safe mock `DevServicePort` factory with `satisfies` constraint ensuring compile-time drift detection |

## Conventions

- **Fixtures:** Create minimal valid domain objects. No test-specific logic.
- **Dependency rule:** Imports from `engine/`, `service/` only — never from `components/`, `stores/`.

## Gotchas

- Component test wrappers (`ButtonTestWrapper`, `BridgeTableTestWrapper`) stay in `components/__tests__/` — moving them here would create a backwards dependency on `components/`.

---

**Staleness anchor:** This file assumes `fixtures.ts`, `response-factories.ts`, and `service-mocks.ts` exist. If they don't, this file is stale.
