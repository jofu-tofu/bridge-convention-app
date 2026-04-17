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
- Bid buttons have `data-testid="bid-{callKey}"` selectors (e.g., `bid-1C`, `bid-P`) — use these instead of unicode suit symbols
- Dev URL params available: `?convention=nt-bundle&seed=42` for deterministic scenarios, `?phase=review` for instant skip-to-phase, `?dev=debug,expanded,autoDismiss` for friction-free debug probing, `?screen=settings|coverage|workshop` for direct screen nav

## Architecture

**Key files:**

| File                                   | Role                                                               |
| -------------------------------------- | ------------------------------------------------------------------ |
| `e2e/smoke.spec.ts`                    | Core app smoke: home search/filter, picker, deep links, blocking feedback, settings/home nav |
| `e2e/helpers.ts`                      | Shared Playwright helpers for debug-drawer cleanup, drawer text reads, and bid test IDs |
| `e2e/session-modes.spec.ts`           | Session-mode wiring smoke: default decision drill, full-auction label, autoplay→review, review analysis tab |
| `e2e/representative-conventions.spec.ts` | Desktop-only representative bundle flows: Jacoby Transfers and Bergen Raises |
| `e2e/responsive-layout.spec.ts`       | Responsive shell checks for home, game, and settings. Desktop also runs it; mobile/tablet run this file only |
| `e2e/billing.spec.ts`                 | Billing + auth flows against bridge-api built with `--features dev-tools`: anon paywall, free-tier paywall, paid-user portal navigation (mock Stripe), `subscription.deleted` webhook leaves tier Paid until period_end. The `bridge-api` webServer command wipes `/tmp/bridge-api-e2e.db` on startup so migrations run on a clean schema; `dev_login` is also idempotent on `stripe_customer_id` so reused servers don't collide on the unique index. |

## Constraints

- Full testing playbook in **TESTING.md** at project root
- E2E tests are smoke tests only — keep them focused on routing, session behavior, and a small number of representative bundle flows
- Do not add per-convention seed sweeps to Playwright. Convention correctness matrices belong in service, Rust, or CLI tests
- Mobile/tablet projects run `responsive-layout.spec.ts` only; all other E2E coverage is desktop-only
- The default representative bundles are Jacoby Transfers and Bergen Raises. Adding a third representative bundle needs a concrete UI-behavior gap the existing two do not cover
- If a browser test idea needs the debug drawer to prove convention correctness, it almost certainly belongs at a lower layer instead
- Prefer extending `session-modes.spec.ts` when the user-visible difference is about drill lifecycle or practice-mode semantics rather than a specific convention

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

**Staleness anchor:** This file assumes `e2e/smoke.spec.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-02-20 | last-audited=2026-04-05 | version=11 | dir-commits-at-audit=21 | tree-sig=dirs:1,files:6,exts:ts:6,md:1 -->
