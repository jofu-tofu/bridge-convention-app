# Engine Layer

## Purpose

Pure TypeScript game logic. Zero platform dependencies. No imports from svelte, tauri, or DOM APIs.

## TDD Workflow

Write tests first. Run `npm run test` for watch mode. See **TESTING.md** for the full Red-Green-Refactor workflow.

## Purity Constraint

Never import from:
- `svelte` or `svelte/*`
- `@tauri-apps/*`
- `window`, `document`, `localStorage`, or any browser API

All engine code must be pure TypeScript functions and types.

## Coverage Requirements

Enforced in `vitest.config.ts`: 90% branches, 90% functions, 85% lines. See **TESTING.md** for details.

## Test File Conventions

- Location: `__tests__/<module>.test.ts` (colocated with source)
- Use `import type` for interfaces, value import for enums
- Import `describe`, `test`, `expect` from `vitest`

## Current Types (types.ts)

| Type | Kind | Values |
|------|------|--------|
| `Suit` | enum | C, D, H, S |
| `Rank` | enum | 2-9, T, J, Q, K, A |
| `Card` | interface | `{ suit: Suit, rank: Rank }` |
| `Seat` | enum | N, E, S, W |

## What Comes Next (Phase 1)

- `Hand` — 13-card collection with suit/rank queries
- `Deck` — 52-card shuffler
- `BiddingSequence` — Call history
- `HCP` — High Card Points (A=4, K=3, Q=2, J=1)
