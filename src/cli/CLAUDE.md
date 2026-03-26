# cli — Convention Evaluation CLI

Headless CLI for evaluating bridge convention correctness. Two evaluation modes: **per-atom** (targeted, orchestrator-driven) and **playthrough** (end-to-end, agent-driven). No browser, no Svelte — pure strategy evaluation via JSON.

Includes a **compositional verification framework** (`verify` namespace) for catching composition bugs through static analysis, runtime exploration, and property-based fuzz testing.

## Commands

```
── Self-discovery ─────────────────────────────────────────────
  bundles                                    List all available bundles (JSON)
  systems                                    List all available base systems (JSON)
  describe  --bundle=<id>                    Inspect a bundle (atoms, depth, coverage)

── Planning & diagnostics ──────────────────────────────────────
  list      --bundle=<id>                    List all coverage atoms
  plan      --bundle=<id> --agents=N [...]   Precompute two-phase evaluation plan
  selftest  --bundle=<id> | --all            Strategy self-test (CI)

── Per-atom evaluation (Phase 1) ───────────────────────────────
  eval      --bundle=<id> --atom=<atomId> --seed=N
  eval      --bundle=<id> --atom=<atomId> --seed=N --bid=<bid>

── Playthrough evaluation (Phase 2) ────────────────────────────
  play      --bundle=<id> --seed=N
  play      --bundle=<id> --seed=N --step=N [--bid=<bid>]
  play      --bundle=<id> --seed=N --reveal

── Help ────────────────────────────────────────────────────────
  help                                       Show global help
  <subcommand> --help                        Show subcommand help
```

Global settings: `--system=<sayc|two-over-one|acol>`, `--vuln=<none|ns|ew|both>`, `--opponents=<natural|none>`, `--help`.

Exit codes: 0=correct/pass, 1=wrong/fail, 2=arg error.
Same seed = same deal across all commands. Deterministic (Mulberry32 PRNG).

Bundle IDs are discovered at runtime via `bundles` subcommand. Do not hardcode bundle IDs — use self-discovery.

## Verification Commands

```
── Compositional verification ──────────────────────────────────
  verify explore   --bundle=<id> [--depth=6] [--seed=42] [--trials=50]
  verify motif     --bundle=<id> --pair=A,B [--depth=8] [--seed=42] [--trials=100]
  verify fuzz      --bundle=<id> [--trials=200] [--seed=0] [--vuln=mixed]
  verify preflight --bundle=<id> [--budget=fast|full]
```

All verify commands output JSON to stdout. Exit codes: 0=pass, 1=fail, 2=arg error.

Static analysis (lint, interference) runs as regular vitest tests (see `src/conventions/__tests__/infrastructure/structural-health.test.ts`) and also as part of `verify preflight` internally. There are no standalone `verify lint` or `verify interfere` CLI subcommands.

### verify explore
Bounded state exploration with invariant checks. Generates deals, runs strategy-driven auctions, checks invariants at each step. Tracks coverage: modules activated, phases reached, rules fired, atoms exercised.

### verify fuzz
Property-based fuzz testing. Runs many random deals through the strategy, checking invariants and catching crashes. Deterministic via mulberry32 seed.

### verify motif
Pairwise motif testing. Focuses exploration on a specific module pair, tracking co-activation and pair-specific conflicts.

### verify preflight
Bundle certification. Orchestrates: lint → interfere → explore → motif (if flagged pairs) → fuzz. Returns pass/fail verdict. Fast budget: 20 explore trials, 50 fuzz trials. Full budget: 100/200 + motif on flagged pairs.

## CLI Output Philosophy

**Pipeline results, not internals.** The CLI is an agent-facing interface. All output is expressed in terms of pipeline results — modules, atoms, bids, grades, violations — not implementation internals like kernel state fields, FSM phase names, or observation logs.

Kernel state, local phases, and observation logs are consumed internally by invariant checks, rule matching, and exploration loops. They appear in the code but never in JSON output unless they directly serve the agent's decision-making.

Concrete rules:
- Output identifies modules by `moduleId`, not by phase vectors or kernel snapshots
- Coverage is expressed as "which atoms were exercised" and "which modules activated"
- Violations include enough context to reproduce (seed, step, auction sequence) but describe the problem in pipeline terms
- Invariant checks read kernel/phase internals to detect problems, but violation messages translate findings into agent-comprehensible descriptions

See `docs/cli-evaluation.md` for the two-phase evaluation pipeline design, agent self-discovery workflow, design decisions, and known gaps.

## Settings Flags

### `--system=<sayc|two-over-one|acol>`
Selects the base bidding system. Affects HCP thresholds, forcing durations, and system-fact-gated surface evaluation. Default: `sayc`. The system ID is threaded through all spec resolution, strategy creation, and evaluation — no backend code defaults silently.

### `--vuln=<none|ns|ew|both>`
Sets vulnerability for deal generation and bidding context. Maps to the app's `VulnerabilityDistribution` setting — the CLI uses explicit values rather than weighted random distribution since it's about deterministic, reproducible evaluation. Default: `none`.

### `--opponents=<natural|none>`
Controls opponent (E/W) bidding behavior. Maps to the app's `OpponentMode` setting.
- **`none`** (default): Opponents always pass. Used for targeted evaluation where the auction path is controlled.
- **`natural`**: Opponents bid naturally (6+ HCP, 5+ card suit). Affects `play` and `plan` subcommands where full auctions are run. In `eval` targeted auctions, opponents still pass to maintain the BFS path.

## Key Source Files

| File | Purpose |
|------|---------|
| `src/cli/main.ts` | CLI entry point — dispatch + settings |
| `src/cli/shared.ts` | Shared utilities — arg parsing, spec/bundle/system resolution, deal generation, context construction |
| `src/cli/playthrough.ts` | Playthrough infrastructure — types, single-run, grading |
| `src/cli/commands/info.ts` | `list`, `bundles`, `describe` subcommands |
| `src/cli/commands/eval.ts` | `eval` subcommand — per-atom targeted evaluation |
| `src/cli/commands/selftest.ts` | `selftest` subcommand — strategy self-test |
| `src/cli/commands/play.ts` | `play` subcommand — playthrough evaluation |
| `src/cli/commands/plan.ts` | `plan` subcommand — two-phase evaluation plan |
| `src/cli/help.ts` | Usage text and per-subcommand help |
| `src/service/build-viewport.ts` | `buildViewportFeedback()`, `buildTeachingDetail()` — information boundary |
| `src/service/response-types.ts` | `ViewportBidFeedback`, `TeachingDetail` type definitions |
| `src/conventions/teaching/teaching-types.ts` | `BidGrade`, `TeachingResolution`, `AcceptableBid` — grading contracts |
| `src/conventions/teaching/teaching-resolution.ts` | `resolveTeachingAnswer()`, `gradeBid()` — 5-level grading implementation |
| `src/strategy/bidding/protocol-adapter.ts` | `protocolSpecToStrategy()` — ConventionSpec to strategy |
| `src/conventions/pipeline/rule-enumeration.ts` | Rule-based atom enumeration, coverage manifest |
| `src/engine/deal-generator.ts` | Constraint-based deal generation with seeded PRNG |
| `src/engine/seeded-rng.ts` | `mulberry32()` — deterministic PRNG |
| `src/cli/verify/index.ts` | Verify subcommand dispatcher |
| `src/cli/verify/types.ts` | Shared types for verification framework |
| `src/cli/verify/lint.ts` | Module linting (static analysis) |
| `src/cli/verify/interfere.ts` | Pairwise interference analysis |
| `src/cli/verify/invariants.ts` | Invariant definitions for exploration |
| `src/cli/verify/explore.ts` | Bounded state exploration |
| `src/cli/verify/motif.ts` | Pairwise motif testing |
| `src/cli/verify/fuzz.ts` | Property-based fuzz testing |
| `src/cli/verify/preflight.ts` | Bundle certification orchestrator |

### Static checks are tests, runtime exploration is CLI
Static analysis (lint, interference) runs as vitest tests for fast CI feedback. Runtime verification (explore, motif, fuzz, preflight) lives in `src/cli/verify/` as CLI subcommands — these generate deals and run strategy-driven auctions, which requires the full pipeline. Preflight orchestrates both static and runtime stages internally.

## Module Boundary

**Staleness anchor:** `src/cli/main.ts` must exist and import from `./shared` and `./commands/*`.
