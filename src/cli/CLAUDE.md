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

## Agent Self-Discovery Workflow

Agents should discover the CLI's capabilities at runtime rather than relying on documentation:

```bash
# 1. List available bundles
npx tsx src/cli/main.ts bundles

# 2. Inspect a specific bundle (atoms, depth, strategy coverage)
npx tsx src/cli/main.ts describe --bundle=nt-bundle

# 3. Get per-subcommand help
npx tsx src/cli/main.ts eval --help
```

`bundles` returns a JSON array with `id`, `name`, `description`, `category`, `atomCount` for each bundle. `describe` returns full atom list with IDs usable in `eval --atom=<id>`.

## Two-Phase Evaluation Pipeline

### Phase 1: Per-Atom Targeted (orchestrator-driven)

Tests each coverage atom independently with a dedicated seed. The orchestrator
reads the plan, walks atoms grouped by module, and calls `eval` for each.

```bash
# Viewport only — sanitized (seat, hand, HCP, auction, legal calls). No answer.
npx tsx src/cli/main.ts eval --bundle=nt-bundle \
  --atom=responder-r1/sf:responder-r1/stayman:ask-major --seed=3

# Submit bid — returns full teaching feedback (ViewportBidFeedback + TeachingDetail)
npx tsx src/cli/main.ts eval --bundle=nt-bundle \
  --atom=responder-r1/sf:responder-r1/stayman:ask-major --seed=3 --bid=2C
```

**Key properties:**
- `eval` output is always sanitized — no internal state IDs, expected bids, or dependency tree
- `--atom` takes an atomId from the plan output (format: `moduleId/meaningId`). Invalid atom IDs are rejected with exit code 2
- With `--bid`: returns `ViewportBidFeedback` (conditions, alternatives, near-misses, conventions) + `TeachingDetail` (whyNot, meaningViews, callViews, ambiguityScore, partner hand space)
- 5-level grading: correct, correct-not-preferred, acceptable, near-miss, incorrect
- Both opener (N) and responder (S) atoms are testable — the active seat is determined by the BFS path
- Stop-on-error: orchestrator uses the plan's `dependencyGraph` to skip child atoms when a parent fails

### Phase 2: Playthrough Integration (agent-driven)

Tests end-to-end auction flow. Agents receive seed lists and step through
full auctions, catching issues that per-atom testing misses (bids that are
individually correct but don't compose into a coherent sequence).

```bash
# Start playthrough — returns totalSteps + first viewport
npx tsx src/cli/main.ts play --bundle=nt-bundle --seed=1

# Get viewport for step N
npx tsx src/cli/main.ts play --bundle=nt-bundle --seed=1 --step=0

# Submit bid — returns grade + teaching + next step viewport (one fewer round-trip)
npx tsx src/cli/main.ts play --bundle=nt-bundle --seed=1 --step=0 --bid=2H

# Full reveal — all steps with recommendations and atom IDs
npx tsx src/cli/main.ts play --bundle=nt-bundle --seed=1 --reveal
```

**Key properties:**
- `play --step=N --bid=X` returns `{ grade, feedback, teaching, nextStep, complete }` — the next viewport is included so the agent doesn't need a separate call
- Both convention players (opener + responder) are presented as steps — `isUserStep` includes the N-S partnership, not just South
- No information leak: agent sees hand/auction/legal-calls before committing, gets grade + feedback after

### Plan Command

Precomputes the evaluation plan with two sections:

```bash
npx tsx src/cli/main.ts plan --bundle=nt-bundle --agents=3 --coverage=2
```

Output has:
- **`phase1`** — Orchestrator-private. Per-atom list grouped by module with `atomId`, `expectedBid`, `seeds`, `turnGuard`, `primaryPhaseGuard`. **Never sent to agents.**
- **`phase2`** — Agent-facing. Seed assignments per agent, balanced by step count.

## Design Decisions

### Per-atom testing guarantees deep state coverage
Playthrough-based testing over-covers shallow atoms (depth 0 is hit on every seed) and under-covers deep atoms. Per-atom targeted testing guarantees each atom — regardless of depth — gets dedicated seed coverage. Playthroughs are Phase 2, for integration testing.

### Agent context stays clean
`eval` always outputs sanitized viewports. The plan's `phase1` data (expected bids, state IDs, dependency tree) stays with the orchestrator. Phase 2 agents receive only bundle + seed lists. Agents evaluate using bridge knowledge, not the app's own clauses.

### Full teaching feedback mirrors the app UI
`eval --bid` and `play --bid` return `ViewportBidFeedback` + `TeachingDetail` — the same types the Svelte UI renders. Built via `buildViewportFeedback()` and `buildTeachingDetail()` from `src/core/viewport/build-viewport.ts`, using the `BidFeedbackLike` interface (designed for CLI use, no Svelte dependency).

### Both seats are testable
Atoms include both opener (North) and responder (South) states. The BFS path determines which seat is active. In playthroughs, both convention-player bids are presented as steps.

## Settings Flags

### `--system=<sayc|two-over-one|acol>`
Selects the base bidding system. Affects HCP thresholds, forcing durations, and system-fact-gated surface evaluation. Default: `sayc`. The system ID is threaded through all spec resolution, strategy creation, and evaluation — no backend code defaults silently.

### `--vuln=<none|ns|ew|both>`
Sets vulnerability for deal generation and bidding context. Maps to the app's `VulnerabilityDistribution` setting — the CLI uses explicit values rather than weighted random distribution since it's about deterministic, reproducible evaluation. Default: `none`.

### `--opponents=<natural|none>`
Controls opponent (E/W) bidding behavior. Maps to the app's `OpponentMode` setting.
- **`none`** (default): Opponents always pass. Used for targeted evaluation where the auction path is controlled.
- **`natural`**: Opponents bid naturally (6+ HCP, 5+ card suit). Affects `play` and `plan` subcommands where full auctions are run. In `eval` targeted auctions, opponents still pass to maintain the BFS path.

## Known Gaps (Future Work)

| Gap | Description |
|-----|-------------|
| **Seed selection bias** | Phase 1 only tests hands where the convention *should* apply. No ambiguous/negative cases. |
| **Multi-bundle interaction** | Bundles tested in isolation. No cross-bundle convention conflict testing. |
| **Teaching feedback accuracy** | We grade bids, not feedback text. Feedback could be wrong even when the bid is right. |

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
| `src/core/viewport/build-viewport.ts` | `buildViewportFeedback()`, `buildTeachingDetail()` — information boundary |
| `src/core/viewport/player-viewport.ts` | `ViewportBidFeedback`, `TeachingDetail` type definitions |
| `src/core/contracts/teaching-grading.ts` | `BidGrade`, `TeachingResolution`, `AcceptableBid` — grading contracts |
| `src/teaching/teaching-resolution.ts` | `resolveTeachingAnswer()`, `gradeBid()` — 5-level grading implementation |
| `src/strategy/bidding/protocol-adapter.ts` | `protocolSpecToStrategy()` — ConventionSpec to strategy |
| `src/conventions/core/pipeline/rule-enumeration.ts` | Rule-based atom enumeration, coverage manifest |
| `src/engine/deal-generator.ts` | Constraint-based deal generation with seeded PRNG |
| `src/core/util/seeded-rng.ts` | `mulberry32()` — deterministic PRNG |
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
