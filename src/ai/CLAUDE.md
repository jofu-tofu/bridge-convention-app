# AI

Bidding AI strategies. Consumer of `conventions/` and `engine/` via `shared/types`.

## Conventions

- **Dependency direction:** `ai/ → shared/ + conventions/ + engine/`. Engine never imports from ai/. Conventions never import from ai/.
- **Strategy pattern.** `BiddingStrategy` (defined in `shared/types.ts`) is the core interface. Strategies are passed to `EnginePort.suggestBid()` by the caller.
- **`null` means "no opinion."** A strategy returning `null` defers to the next strategy in a chain. `TsEngine.suggestBid()` wraps `null` into a pass at the boundary.
- **Convention adapter.** `conventionToStrategy()` wraps a `ConventionConfig` as a `BiddingStrategy`. Callers (CLI, tests) construct strategies explicitly — the engine never resolves convention IDs to strategies.

## Architecture

**Module graph:**

```
shared/types.ts (BidResult, BiddingStrategy)
  ↑ import type
ai/convention-strategy.ts → conventions/registry (evaluateBiddingRules — tree-aware dispatch via config param)
ai/pass-strategy.ts
ai/types.ts (DrillConfig, DrillSession — Phase 4 prep)
```

**Key files:**

| File                      | Role                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `convention-strategy.ts`  | `conventionToStrategy()` — wraps `ConventionConfig` as `BiddingStrategy`                  |
| `pass-strategy.ts`        | Always-pass placeholder strategy                                                          |
| `types.ts`                | `DrillConfig`, `DrillSession` — interfaces for drill mode                                 |
| `drill-session.ts`        | `createDrillSession()` — DrillSession implementation with null-contract for user/AI seats |
| `drill-config-factory.ts` | `createDrillConfig()` — builds DrillConfig from convention ID and user seat. Wires both `nsInferenceConfig` and `ewInferenceConfig`. Options: `opponentBidding` (enables E-W convention inference), `opponentConventionId` (defaults to "sayc", falls back to natural on invalid ID). |

## Adding a Strategy

1. Create `src/ai/{name}-strategy.ts` — export an object or factory satisfying `BiddingStrategy`
2. `suggest()` returns `BidResult | null`. Return `null` to defer.
3. Write tests in `src/ai/__tests__/{name}-strategy.test.ts`
4. Strategy chaining: callers can try strategies in sequence, using the first non-null result

## Play AI

| File                         | Role                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| `play-strategy.ts`           | `randomPlay(legalCards)` (legacy) + `randomPlayStrategy` (PlayStrategy interface wrapper)  |
| `heuristic-play-strategy.ts` | `createHeuristicPlayStrategy()` — chain-of-responsibility heuristic play (Tier 1 Smart AI) |

**Heuristic priority chain** (first non-null wins): opening-lead → second-hand-low → third-hand-high → cover-honor-with-honor → trump-management → discard-management → default-lowest.

- `second-hand-low` only fires when following suit (defers to trump/discard when void)
- `trump-management` won't ruff partner's winning trick
- All heuristics return cards from `legalPlays` only; fallback always returns lowest legal card

**Roadmap:**

- **Tier 2 — DDS-assisted:** Use `suggestPlay()` backed by DDS double-dummy solver (requires Rust engine)
- **Tier 3 — convention-aware:** Signal/discard conventions (attitude, count, suit preference)

## Gotchas

- `DrillSession.getNextBid()` returns `null` for user seats (signals UI to wait), wraps null strategy results as pass for AI seats
- `conventionToStrategy` maps `BiddingRuleResult.rule` to `BidResult.ruleName` (field name change)
- Tests use `clearRegistry()`/`registerConvention()` in `beforeEach` for isolation
- `DrillConfig.ewInferenceConfig` — E-W inference config: natural by default, convention-aware (SAYC or custom) when `opponentBidding: true`. Invalid `opponentConventionId` falls back to natural provider.

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Staleness anchor:** This file assumes `convention-strategy.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-02-21 | last-audited=2026-02-22 | version=3 | dir-commits-at-audit=5 | tree-sig=dirs:2,files:13,exts:ts:12,md:1 -->
