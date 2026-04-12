# Engine

TypeScript engine types, hand evaluation, and DDS browser support. All game logic (auction, deal generation, scoring, play) runs in Rust — this module provides types, constants, HCP evaluation, `isVulnerable()`, and DDS Worker integration.

## Conventions

- Engine is a leaf module — it does not import from `strategy/`, `conventions/`, `inference/`, `stores/`, `components/`, or other higher-level modules.
- DDS modules (`dds-client.ts`, `dds-worker.ts`) are the explicit exceptions (DDS uses Worker API).
- `HandEvaluationStrategy` interface enables pluggable evaluation; V1 ships `hcpStrategy` only.

## Architecture

**Module dependency graph:**

```
types.ts → constants.ts → hand-evaluator.ts
         types.ts → scoring.ts (isVulnerable only)
         call-helpers.ts (standalone, no engine imports)
```

**Key files:**

| File                  | Role                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `types.ts`            | All enums (`Suit`, `Rank`, `Seat`) and interfaces (`Card`, `Hand`, `Deal`, `Contract`)    |
| `constants.ts`        | Suit/rank orderings, display mappings                                                     |
| `hand-evaluator.ts`   | HCP calculation, strategy pattern for evaluation                                          |
| `scoring.ts`          | `isVulnerable()` utility only — all other scoring logic runs in Rust                      |
| `call-helpers.ts`     | Canonical `callsMatch()` — call equality check shared by stores and inference             |
| `dds-wasm.ts`         | DDS PBN conversion, struct pack/unpack, `solveFromPBN()` (PBN-based table solve), `solveWithModule()` (Deal-based wrapper), `solveBoardWithModule()` (per-card) — pure logic, no DOM/Worker. Exports `handsToPBN()`, `cardsToPBNHand()`, `unpackTricksTable()` (shared 5×4 tricks unpacker with pluggable readInt32 callback), DDS index helpers (`trumpToDdsIndex`, `seatToDdsIndex`, `rankToDdsValue`), and index mapping constants (`DDS_STRAIN_MAP`, `DDS_SEAT_MAP`, `DDS_SUIT_MAP_PLAY`, `DDS_RANK_MAP`). |
| `dds-worker.ts`       | Module Worker — loads DDS WASM by fetching `/dds/dds.js` and `eval`ing the Emscripten factory, handles `CalcAllTablesPBN` (Deal or PBN) and `SolveBoardPBN` requests |
| `dds-client.ts`       | Main thread API — `initDDS()`, `isDDSAvailable()`, `solveDealFromPBN()`, `solveBoardWasm()` via Worker messages |

## Gotchas

- Total HCP invariant: every valid deal has exactly 40 HCP across all 4 hands

## Constraints

- Tests colocated in `__tests__/<module>.test.ts`; use `import type` for interfaces
- Coverage: 90% branches, 90% functions, 85% lines (enforced in `vitest.config.ts`)

## Rust Backend Integration

- **All game logic runs in Rust.** The Rust `bridge-engine` crate is the primary engine. TS engine modules are types, constants, DDS browser support, and `isVulnerable()` — no auction, deal generation, or scoring logic remains in TS.
- **RNG:** Rust uses ChaCha8Rng. TS uses mulberry32. Same seed produces different deals — seeds are not cross-engine portable.
- **DDS browser support:** DDS works via DDS Web Worker (Emscripten-compiled C++ DDS in browser). `initDDS()` fires in background; `isDDSAvailable()` gates calls. Par is always null (mode=-1). `solveBoardWasm()` exposes per-card optimal play via `SolveBoardPBN`.

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

<!-- context-layer: generated=2026-02-20 | last-audited=2026-04-12 | version=9 | dir-commits-at-audit=25 | tree-sig=dirs:1,files:19,exts:ts:18,md:1 -->
