# Testing Playbook

## Test Pyramid

| Layer     | Tool                    | Location                             | Count Target       |
| --------- | ----------------------- | ------------------------------------ | ------------------ |
| Unit      | Vitest                  | `src/<module>/__tests__/*.test.ts`   | 190+ at completion |
| Component | @testing-library/svelte | `src/components/__tests__/*.test.ts` | 25 at completion   |
| E2E       | Playwright              | `tests/e2e/*.spec.ts`                | 2-5 smoke tests    |

**Current (Phase 2):** 291 unit tests, 0 component tests, 2 E2E tests.

**Runtime targets:** Unit <2s, Component ~5s, E2E ~30s, Total <40s.

## Commands

| Command                 | Purpose                  | When                  |
| ----------------------- | ------------------------ | --------------------- |
| `npm run test`          | Vitest watch mode        | During development    |
| `npm run test:run`      | Vitest single run        | Before commit         |
| `npm run test:coverage` | Coverage with thresholds | Before PR             |
| `npm run test:e2e`      | Playwright E2E           | After UI changes      |
| `npm run test:all`      | Unit + E2E together      | Full verification     |
| `npx tsc --noEmit`      | TypeScript type-check    | Before commit         |
| `npm run check`         | Svelte type-check        | After .svelte changes |

## Unit Tests (Vitest)

- **Location:** `src/<module>/__tests__/<file>.test.ts`
- **Environment:** jsdom (configured in `vitest.config.ts`)
- **When:** Engine logic, pure functions, data transformations
- **Import pattern:** `import { describe, test, expect } from 'vitest'`
- **Import types:** Use `import type { X }` for interfaces (required by `verbatimModuleSyntax`)

### Coverage Thresholds

| Metric    | Threshold |
| --------- | --------- |
| Branches  | 90%       |
| Functions | 90%       |
| Lines     | 85%       |

**Scope:** `src/engine/**`, `src/conventions/**`, `src/ai/**`, `src/cli/**`

Coverage is enforced in `vitest.config.ts`. Runs with `npm run test:coverage`.

## Bridge Rules as Tests

Tests encode bridge rules as executable assertions, serving as both verification and living documentation. Each test name references the bridge rule being tested (e.g., "auction ends after three consecutive passes following a bid").

**Rule Sources:** See `docs/bridge-rules-sources.md` for authoritative references.

**Test Organization:**

- One test file per engine module: `auction.test.ts`, `scoring.test.ts`, `play.test.ts`
- Convention tests in `src/conventions/__tests__/`
- Engine test fixtures in `src/engine/__tests__/fixtures.ts`

## Convention Test Patterns

Template: `src/conventions/__tests__/_convention-template.test.ts`

**Fixture API** (from `src/conventions/__tests__/fixtures.ts`):

```typescript
// Build auction from shorthand bid strings
auctionFromBids(dealer: Seat, bids: string[]): Auction
// e.g. auctionFromBids(Seat.North, ["1NT", "P", "2C", "P"])

// Create auction with single opening bid
makeOpening(dealer: Seat, bid: string): Auction

// Assert last auction entry matches expected
expectBid(auction: Auction, seat: Seat, expected: string): void

// Parse bid notation: "1C"-"7NT", "P", "X", "XX"
parseCallString(str: string): Call
```

Also re-exports `hand()` and `card()` from engine fixtures.

## Component Tests (@testing-library/svelte)

- **Location:** `src/components/__tests__/<Component>.test.ts`
- **When:** Svelte component rendering, user interactions
- **Pattern:** Render component → query DOM → assert behavior
- **Philosophy:** Test what the user sees and clicks, not Svelte internals

## E2E Tests (Playwright)

- **Location:** `tests/e2e/<flow>.spec.ts`
- **Config:** `playwright.config.ts`
- **Dev server:** Auto-started on port 1420 if not running
- **Base URL:** `http://localhost:1420`
- **When:** Critical user journey smoke tests only
- **Philosophy:** Test structural concerns (elements render, navigation works) not specific copy

## Dev-Time Browser Testing

For interactive, visible testing during development:

1. Start the dev server: `npm run dev`
2. Open `http://localhost:1420` in a browser (or use a browser automation tool)
3. Verify the UI renders correctly
4. Check the browser console for errors
5. Take screenshots for evidence if needed

| Scenario                | Approach                                   |
| ----------------------- | ------------------------------------------ |
| CI/CD pipeline          | Playwright headless (`npm run test:e2e`)   |
| Verifying UI during dev | Browser at localhost:1420                  |
| Regression testing      | Playwright headless                        |
| Debugging visual issues | Browser with devtools open                 |
| Screenshot evidence     | Browser screenshot or Playwright artifacts |

## Verification Flow

Run these in order to fully verify the project:

```bash
# 1. TypeScript compiles
npx tsc --noEmit

# 2. Svelte checks pass
npm run check

# 3. Unit tests pass
npm run test:run

# 4. Coverage meets thresholds
npm run test:coverage

# 5. E2E tests pass
npm run test:e2e

# 6. Full pipeline
npm run test:all
```

## Evidence and Artifacts

| Source               | Location             | Gitignored |
| -------------------- | -------------------- | ---------- |
| Playwright artifacts | `test-results/`      | Yes        |
| Playwright report    | `playwright-report/` | Yes        |
| Coverage report      | `coverage/`          | Yes        |

## Mocking Strategy

| Layer             | Mock?             | Why                      |
| ----------------- | ----------------- | ------------------------ |
| Engine unit tests | No                | Pure functions, no deps  |
| Convention tests  | No                | Pure decision trees      |
| AI tests          | No                | Real hands, real bids    |
| Component tests   | Yes — mock engine | Pass known data as props |
| E2E tests         | No                | Test the real app        |

## TDD Workflow (Engine)

1. **RED:** Write a failing test in `__tests__/<module>.test.ts`. Run `npm run test:run`. See it fail.
2. **GREEN:** Write minimum code in `<module>.ts` to make it pass. Run tests. See green.
3. **REFACTOR:** Clean up while tests stay green. Run tests after each change.
4. Repeat for the next behavior.

Keep test files focused on one module. One `describe` block per type or function. Each `test` block verifies one behavior.
