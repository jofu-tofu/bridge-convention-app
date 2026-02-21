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

## Architecture

**Key files:**

| File                            | Role                                                             |
| ------------------------------- | ---------------------------------------------------------------- |
| `e2e/convention-select.spec.ts` | App loads with main content area; heading and description render |

## Constraints

- Full testing playbook in **TESTING.md** at project root
- E2E tests are smoke tests only — keep count low (2-5 target)

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

**Staleness anchor:** This file assumes `e2e/convention-select.spec.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-02-20 | last-audited=never | version=1 -->
