# E2E Tests

Playwright end-to-end smoke tests for user-facing behavior.

## Commands

| Command            | Purpose              |
| ------------------ | -------------------- |
| `npm run test:e2e` | Run Playwright tests |
| `npm run test:all` | Unit + E2E together  |

## Conventions

- Config: `playwright.config.ts` at project root
- Test location: `tests/e2e/<flow>.spec.ts`
- Dev server auto-starts on port 1420 if not running
- Base URL: `http://localhost:1420`
- Test structural concerns (elements render, navigation works), not specific copy
- Bid buttons have `data-testid="bid-{callKey}"` selectors (e.g., `bid-1C`, `bid-pass`) — use these instead of unicode suit symbols
- Dev URL params available: `?convention=nt-bundle&seed=42` for deterministic test scenarios

## Architecture

**Key files:**

| File                                   | Role                                                               |
| -------------------------------------- | ------------------------------------------------------------------ |
| `e2e/smoke.spec.ts`                    | Primary smoke tests: home, navigation, bidding, settings, all conventions |
| `e2e/convention-select.spec.ts`        | App loads with main content area; heading and description render    |
| `e2e/game-lifecycle.spec.ts`           | Full game lifecycle: start drill, bid, review, next deal           |
| `e2e/play-phase.spec.ts`              | Autoplay reaches review; review content renders                    |
| `e2e/dds-browser.spec.ts`             | DDS analysis tab renders in review phase                           |
| `e2e/explore-home.spec.ts`            | Home/explore screen rendering                                      |
| `e2e/responsive-layout.spec.ts`       | Responsive mobile/tablet layout behavior                           |
| `e2e/alert-audit.spec.ts`             | Alert annotation correctness audit                                 |
| `e2e/my-review.spec.ts`               | Review phase UI and content validation                             |
| `e2e/flow-test.spec.ts`               | General bidding flow smoke tests                                   |
| `e2e/flow-stayman.spec.ts`            | Stayman convention-specific flow                                   |
| `e2e/flow-dont-bergen.spec.ts`        | DONT and Bergen convention flows                                   |
| `e2e/flow-auction-complete.spec.ts`   | Auction completion and phase transition                            |
| `e2e/flow-details.spec.ts`            | Bid details and explanation UI flow                                |
| `e2e/flow-edge-cases.spec.ts`         | Edge case handling in bidding flow                                 |
| `e2e/flow-multi-convention.spec.ts`   | Multi-convention switching flow                                    |
| `e2e/test-1nt-full.spec.ts`           | Full 1NT response convention coverage                              |
| `e2e/test-bergen.spec.ts`             | Bergen Raises convention coverage                                  |
| `e2e/test-dont.spec.ts`               | DONT convention coverage                                           |
| `e2e/test-transfers.spec.ts`          | Jacoby Transfers convention coverage                               |
| `e2e/test-weak-two.spec.ts`           | Weak Twos convention coverage                                      |

## Constraints

- Full testing playbook in **TESTING.md** at project root
- E2E tests are smoke tests only — keep count low and focused on user-facing behavior

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Add** an entry only if an agent would fail without knowing it, it is not obvious from
the code, and it belongs at this scope (project-wide rule → root CLAUDE.md; WHY decision
→ inline comment or ADR; inferable from code → nowhere).

**Remove** any entry that fails the falsifiability test: if removing it would not change
how an agent acts here, remove it. If a convention here conflicts with the codebase,
the codebase wins — update this file, do not work around it. Prune aggressively.

**Track follow-up work:** After modifying files, evaluate whether changes create incomplete
work or break an assumption tracked elsewhere. If so, create a task or update tracking before ending.

**Staleness anchor:** This file assumes `e2e/convention-select.spec.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-02-20 | last-audited=2026-03-20 | version=8 | dir-commits-at-audit=21 | tree-sig=dirs:1,files:21,exts:ts:21,md:1 -->
