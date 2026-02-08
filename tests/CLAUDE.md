# E2E Tests

## Purpose

End-to-end smoke tests using Playwright. Test user-facing behavior in a real browser.

## Config

- Config file: `playwright.config.ts`
- Test directory: `tests/e2e/`
- Dev server: Auto-starts `npm run dev` on port 1420
- Base URL: `http://localhost:1420`
- Reuses existing dev server if already running

## Current Tests

| File | Tests |
|------|-------|
| `convention-select.spec.ts` | App loads with main content area; heading and description render |

## Running

```bash
npm run test:e2e     # Playwright only
npm run test:all     # Unit + E2E together
```

## Full Testing Guide

See **TESTING.md** for the complete testing playbook including test pyramid, verification flows, and mocking strategy.
