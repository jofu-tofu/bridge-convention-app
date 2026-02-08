# Engine Layer

## Purpose

Pure TypeScript game logic. Zero platform dependencies.

## Purity Constraint

Never import from: `svelte`, `@tauri-apps/*`, `window`, `document`, `localStorage`.

## Module Dependency Graph

```
types.ts → constants.ts → hand-evaluator.ts → deal-generator.ts
                                             ↘ port.ts → ts-engine.ts
```

## Key Patterns

### Strategy Pattern (hand-evaluator.ts)
- `HandEvaluationStrategy` interface enables pluggable evaluation
- V1 ships `hcpStrategy` only. Default parameter hides it from callers.
- Future: LTC, Bergen points, Zar points implement the same interface
- Utility functions (`calculateHcp`, `getSuitLength`, `isBalanced`) exported separately for use by deal-generator

### EnginePort (port.ts)
- ALL methods are async (`Promise<T>`) for V2 Tauri IPC compatibility
- V1: `TsEngine` wraps sync functions in `Promise.resolve()`
- V2: `TauriIpcEngine` will route to Rust backend for DDS
- Phase 2+ methods throw `'Not implemented until Phase N'`
- DDS methods throw `'DDS not available in V1'`
- Callers use `await` from day one — no refactoring needed for V2

### Deal Generation (deal-generator.ts)
- Rejection sampling with Fisher-Yates shuffle
- Constraint relaxation: widens HCP by ±1 per step, shape stays fixed
- Max 10 relaxation steps × 1000 iterations = 11,000 max attempts
- `checkConstraints` is pure, exported for deterministic testing
- `generateDeal` uses `Math.random()` — tested statistically (N=50)

## Types Reference

| Type | Kind | Import Style |
|------|------|-------------|
| `Suit`, `Rank`, `Seat` | enum | `import { Suit }` |
| `Vulnerability`, `BidSuit`, `SpecialBid` | enum | `import { Vulnerability }` |
| `Card`, `Hand`, `Deal`, `Contract` | interface | `import type { Hand }` |
| `Call` | type alias (union) | `import type { Call }` |
| `SuitLength` | type alias (tuple) | `import type { SuitLength }` |
| `HandEvaluationStrategy` | interface | `import type { HandEvaluationStrategy }` |
| `DealConstraints`, `SeatConstraint` | interface | `import type { DealConstraints }` |
| `EnginePort` | interface (port.ts) | `import type { EnginePort }` |

## Coverage Requirements

90% branches, 90% functions, 85% lines — enforced in `vitest.config.ts`.

## Test Fixtures

- Inline factory functions per test file (not shared)
- `card('SA')` shorthand for Card construction
- Pre-built hands with known HCP for deterministic evaluation tests
- Statistical tests (N=50) for deal generation constraint validation

## Test File Conventions

- Location: `__tests__/<module>.test.ts` (colocated with source)
- Use `import type` for interfaces, value import for enums
- Import `describe`, `test`, `expect` from `vitest`
