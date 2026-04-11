# Testing Playbook

## Test Pyramid

| Layer     | Tool                    | Location                             | Count Target       |
| --------- | ----------------------- | ------------------------------------ | ------------------ |
| Unit      | Vitest                  | `src/<module>/__tests__/*.test.ts`   | 190+ at completion |
| Component | @testing-library/svelte | `src/components/__tests__/*.test.ts` | 25 at completion   |
| E2E       | Playwright              | `tests/e2e/*.spec.ts`                | 3-6 focused specs  |

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

**Scope:** `src/engine/**`, `src/conventions/**`, `src/ai/**`

Coverage is enforced in `vitest.config.ts`. Runs with `npm run test:coverage`.

## Bridge Rules as Tests

Tests encode bridge rules as executable assertions, serving as both verification and living documentation. Each test name references the bridge rule being tested (e.g., "auction ends after three consecutive passes following a bid").

**Rule Sources:** See `docs/guides/convention-authoring.md` § Authoritative Bridge Rules Sources for references.

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
- **Philosophy:** Test structural concerns, session behavior, and a small number of representative bundle flows. Convention correctness matrices belong at lower layers
- **Project split:** Desktop runs the full E2E suite. Mobile/tablet run `responsive-layout.spec.ts` only

### Current E2E Scope

Playwright covers only four categories:

1. `smoke.spec.ts` — app shell and routing smoke: home search, picker flow, deep links, blocking feedback, navigation
2. `session-modes.spec.ts` — session semantics: decision-drill default, full-auction/continuation wiring, autoplay to review, next-deal loop, review analysis tab
3. `representative-conventions.spec.ts` — two representative bundles only: Jacoby Transfers and Bergen Raises
4. `responsive-layout.spec.ts` — responsive shell checks; this is the only file that runs on mobile/tablet projects

### What Must Not Go In Playwright

Do not add any of the following to browser E2E:

- Per-convention browser matrices
- Seed sweeps across many hands
- Convention rule verification via debug-drawer parsing
- Exhaustive bundle-by-bundle deep-link checks
- Logic-heavy assertions that can be expressed through service, Rust, or CLI tests

If a test idea depends on checking many seeds, many bundles, or exact convention-rule correctness, it belongs below the browser layer.

### Where That Coverage Goes Instead

- Convention correctness and bidding-rule matrices: Rust tests or service tests
- Seed sweeps and broad session enumeration: CLI/self-test coverage
- UI wiring, routing, and stable visible behavior: Playwright
- Responsive shell behavior: Playwright responsive project only

### E2E Admission Rule

Before adding a new Playwright test, ask:

1. Does this prove a user-visible workflow rather than convention logic?
2. Would one or two representative bundles cover the same UI behavior?
3. Would this still be worth running on every UI change?

If any answer is "no", do not add it to Playwright.

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

## TDD Philosophy

**Core insight:** If you have to change your tests to make them pass after a legitimate refactoring, your tests are testing the wrong thing.

### Principles (ranked by priority when they conflict)

1. **Behavior Over Implementation** — Test WHAT, not HOW. Assert outputs and observable effects, never internal method calls, SQL queries, or data structure choices. A test should survive: algorithm rewrites, caching layers, ORM migrations, internal refactors.
2. **Characterize Before Changing** — When modifying unfamiliar code, write tests that capture current behavior first. These are your safety net — they detect unintended changes during refactoring.
3. **Test Pyramid** — Many fast unit tests, fewer integration tests, minimal E2E. If the suite is slow or flaky, you likely have an inverted pyramid (too many E2E, too few unit).
4. **FIRST** — Fast (< 2s total), Independent (no test ordering), Repeatable (no flakiness), Self-Validating (pass/fail, no manual inspection), Timely (written with or before the code).
5. **Side-Effect Isolation** — Pure logic needs no mocks. If testing requires many mocks, the code mixes logic with side effects — fix the design. This is why `engine/` has zero framework imports.

### Red-Green-Refactor Workflow

1. **RED:** Write a failing test in `__tests__/<module>.test.ts`. Run `npm run test:run`. See it fail.
2. **GREEN:** Write minimum code in `<module>.ts` to make it pass. Run tests. See green.
3. **REFACTOR:** Clean up while tests stay green. Run tests after each change.
4. Repeat for the next behavior.

### Decision Tree

```
Is this legacy/unfamiliar code?
├─ YES → Write characterization tests first (capture behavior as-is)
└─ NO → Is this new development?
        ├─ YES → Red-Green-Refactor (write failing test first)
        └─ NO → Are tests breaking on refactoring?
                ├─ YES → Tests are coupled to implementation — rewrite to test behavior
                └─ NO → Do tests require many mocks?
                        ├─ YES → Code mixes logic with side effects — refactor to pure core
                        └─ NO → Evaluate with FIRST principles
```

### Anti-Patterns to Avoid

- **Over-Mocked Tests** — Testing wiring instead of behavior. If a test has more mock setup than assertions, it's testing the wrong thing.
- **The Liar** — Always-passing test whose assertion never actually runs (hidden behind early returns or wrong async handling).
- **God Test** — One test verifying too many unrelated behaviors. Each `test` block verifies one behavior.
- **Ice Cream Cone** — Inverted pyramid (many E2E, few unit). Slow, flaky, hard to debug. If a browser test loops through many seeds or validates a full convention matrix, move it to service, Rust, or CLI tests.
- **Browser Matrix Creep** — Repeating the same UI assertions across every bundle or many seeds. Keep Playwright on representative flows and move combinatorial coverage down a layer.

### Test Organization

Keep test files focused on one module. One `describe` block per type or function. Each `test` block verifies one behavior.
