# Engine

Pure TypeScript game logic. Zero platform dependencies.

## Conventions

- Pure engine logic modules (`auction.ts`, `scoring.ts`, `play.ts`, `deal-generator.ts`, etc.) never import from `svelte`, `@tauri-apps/*`, `window`, `document`, or `localStorage`. DDS modules (`dds-client.ts`, `dds-worker.ts`) and `mc-dds-play.ts` are the explicit exceptions (DDS uses Worker API; mc-dds-play imports `ServiceDerivedRanges` type from `service/response-types`).
- Engine is a leaf module — it does not import from `strategy/`, `conventions/`, `inference/`, `stores/`, `components/`, or other higher-level modules. Cross-boundary types that engine needs are defined locally in `engine/` or passed in by callers.
- `HandEvaluationStrategy` interface enables pluggable evaluation; V1 ships `hcpStrategy` only
- Utility functions (`calculateHcp`, `getSuitLength`, `isBalanced`) exported separately for reuse by deal-generator
- All bidding/scoring/play methods implemented. DDS works via native Tauri (desktop) or DDS Web Worker (browser). `suggestPlay` throws in all builds — not yet implemented.

## Architecture

**Module dependency graph:**

```
types.ts → constants.ts → hand-evaluator.ts → deal-generator.ts
                        ↘ auction.ts → auction-helpers.ts
                        ↘ play.ts
         types.ts → scoring.ts
         call-helpers.ts (standalone, no engine imports)
```

**Key files:**

| File                  | Role                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `types.ts`            | All enums (`Suit`, `Rank`, `Seat`) and interfaces (`Card`, `Hand`, `Deal`, `Contract`)    |
| `constants.ts`        | Suit/rank orderings, display mappings                                                     |
| `hand-evaluator.ts`   | HCP calculation, strategy pattern for evaluation                                          |
| `deal-generator.ts`   | Rejection sampling with Fisher-Yates shuffle, seat constraints                            |
| `auction.ts`          | Auction logic: bid comparison, legality, completion, contract/declarer extraction         |
| `play.ts`             | Trick play rules: legal plays (follow suit), lead suit, trick winner determination        |
| `scoring.ts`          | Contract scoring: trick points, bonuses, penalties, unified score calculation             |
| `auction-helpers.ts`  | Auction query utils: lastContractBid, bidsInSequence, auctionMatchesExact, buildAuction   |
| `notation.ts`         | Card notation parser (`parseCard`, `parseHand`) — shared by CLI and test fixtures         |
| `call-helpers.ts`     | Canonical `callsMatch()` — call equality check shared by stores and inference             |
| `constraint-utils.ts` | `cleanConstraints()` / `cleanSeatConstraint()` — strips non-serializable fields          |
| `dds-wasm.ts`         | DDS PBN conversion, struct pack/unpack, `solveFromPBN()` (PBN-based table solve), `solveWithModule()` (Deal-based wrapper), `solveBoardWithModule()` (per-card) — pure logic, no DOM/Worker. Exports `handsToPBN()`, `cardsToPBNHand()`, DDS index helpers (`trumpToDdsIndex`, `seatToDdsIndex`, `rankToDdsValue`), and index mapping constants (`DDS_STRAIN_MAP`, `DDS_SEAT_MAP`, `DDS_SUIT_MAP_PLAY`, `DDS_RANK_MAP`). |
| `dds-worker.ts`       | Classic Web Worker — loads DDS WASM via `importScripts`, handles `CalcAllTablesPBN` (Deal or PBN) and `SolveBoardPBN` requests |
| `dds-client.ts`       | Main thread API — `initDDS()`, `isDDSAvailable()`, `solveDealWasm()`, `solveDealFromPBN()`, `solveBoardWasm()` via Worker messages |
| `mc-dds-play.ts`      | MC+DDS play: deal sampling + batched DDS evaluation for Expert/WorldClass profiles. Pure functions, no service/store deps. |

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

- **Engine called from Rust directly.** The Rust `bridge-engine` crate is the primary engine. TS engine modules (`deal-generator.ts`, `auction.ts`, `scoring.ts`, `play.ts`) exist as reference implementations but are not used at runtime — all game logic flows through `bridge-service` → `bridge-session` → `bridge-engine` in Rust.
- **RNG:** Rust uses ChaCha8Rng. TS uses mulberry32. Same seed produces different deals — seeds are not cross-engine portable.
- **DDS browser support:** DDS works via DDS Web Worker (Emscripten-compiled C++ DDS in browser) or native `dds-bridge` FFI (Tauri desktop). `initDDS()` fires in background; `isDDSAvailable()` gates calls. Par is always null in browser (mode=-1). `solveBoardWasm()` exposes per-card optimal play via `SolveBoardPBN`.

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

<!-- context-layer: generated=2026-02-20 | last-audited=2026-03-29 | version=8 | dir-commits-at-audit=25 | tree-sig=dirs:1,files:19,exts:ts:18,md:1 -->
