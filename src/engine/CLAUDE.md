# Engine

Pure TypeScript game logic. Zero platform dependencies.

## Conventions

- Never import from: `svelte`, `@tauri-apps/*`, `window`, `document`, `localStorage`
- `suggestBid` is NOT on EnginePort — it's a standalone function in `bid-suggester.ts` (can't cross IPC/HTTP because BiddingStrategy has methods)
- All `EnginePort` methods are async (`Promise<T>`) — callers use `await` from day one for V2 Tauri IPC compatibility
- `HandEvaluationStrategy` interface enables pluggable evaluation; V1 ships `hcpStrategy` only
- Utility functions (`calculateHcp`, `getSuitLength`, `isBalanced`) exported separately for reuse by deal-generator
- Phase 1.5 bidding/scoring/play implemented; `solveDeal` works via Rust backends (HttpEngine, TauriIpcEngine). `suggestPlay` throws everywhere.

## Architecture

**Module dependency graph:**

```
types.ts → constants.ts → hand-evaluator.ts → deal-generator.ts
                        ↘ auction.ts → auction-helpers.ts       ↘
                        ↘ play.ts            → port.ts
         types.ts → scoring.ts
         call-helpers.ts (standalone, no engine imports)
```

**Key files:**

| File                  | Role                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `types.ts`            | All enums (`Suit`, `Rank`, `Seat`) and interfaces (`Card`, `Hand`, `Deal`, `Contract`)    |
| `constants.ts`        | Suit/rank orderings, display mappings                                                     |
| `hand-evaluator.ts`   | HCP calculation, strategy pattern for evaluation                                          |
| `deal-generator.ts`   | Rejection sampling with Fisher-Yates shuffle, constraint relaxation                       |
| `port.ts`             | `EnginePort` interface — async boundary between UI and engine                             |
| `auction.ts`          | Auction logic: bid comparison, legality, completion, contract/declarer extraction         |
| `play.ts`             | Trick play rules: legal plays (follow suit), lead suit, trick winner determination        |
| `scoring.ts`          | Contract scoring: trick points, bonuses, penalties, unified score calculation             |
| `auction-helpers.ts`  | Auction query utils: lastContractBid, bidsInSequence, auctionMatchesExact, buildAuction   |
| `notation.ts`         | Card notation parser (`parseCard`, `parseHand`) — shared by CLI and test fixtures         |
| `bid-suggester.ts`    | Standalone `suggestBid()` — extracted from EnginePort (can't cross IPC/HTTP)              |
| `call-helpers.ts`     | Canonical `callsMatch()` — call equality check shared by stores and inference             |
| `tauri-ipc-engine.ts` | `TauriIpcEngine` — EnginePort via Tauri `invoke()`, strips `customCheck`/`rng`            |
| `http-engine.ts`      | `HttpEngine` — EnginePort via HTTP `fetch()` to bridge-server, strips `customCheck`/`rng` |

## Gotchas

- Bid strain ordering (C<D<H<S<NT in `auction.ts`) differs from `SUIT_ORDER` (S,H,D,C in `constants.ts`) — they serve different purposes
- Declarer = first player on declaring side to name the final strain (not last bidder)
- `calculateScore` returns positive for declarer making, negative for going down
- Total HCP invariant: every valid deal has exactly 40 HCP across all 4 hands
- `getContract` returns `null` for passout — all callers must null-check
- `addCall` throws on illegal calls — validate with `isLegalCall` or use `getLegalCalls`
- Only duplicate bridge scoring implemented (not rubber bridge)

## Constraints

- Deal generation: flat rejection sampling, default 10,000 max attempts (configurable via `maxAttempts`). Convention deal constraints use `minLengthAny` for OR constraints and `customCheck` for exotic filters. `DealConstraints.rng` accepts an optional PRNG function for deterministic deals (used by dev seed feature).
- Tests colocated in `__tests__/<module>.test.ts`; use `import type` for interfaces
- Coverage: 90% branches, 90% functions, 85% lines (enforced in `vitest.config.ts`)

## Rust Backend Integration

- **Engine transports:** `TauriIpcEngine` (desktop) and `HttpEngine` (dev:web, port 3001) — Rust server required, no TS fallback
- **RNG incompatibility:** Same seed produces different deals in Rust (ChaCha8Rng) vs TS (mulberry32). Seeds are not cross-engine portable.
- **Stateless HTTP:** Every request sends full state. No sessions. Error format: plain text body, 400 status code.
- **`HttpEngine` strips** `customCheck` and `rng` from constraints before serialization. Preserves `seed` field for Rust-side deterministic generation (`seed: Option<u64>`). `DealConstraints` carries both `rng` (TS engine) and `seed` (Rust engine) — callers set both when deterministic deals are needed.

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

**Staleness anchor:** This file assumes `types.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-02-20 | last-audited=2026-02-25 | version=7 | dir-commits-at-audit=23 | tree-sig=dirs:1,files:29,exts:ts:28,md:1 -->
