# cli — Convention Evaluation CLI

Headless CLI for evaluating bridge convention correctness. Two evaluation modes: **per-atom** (targeted, orchestrator-driven) and **playthrough** (end-to-end, agent-driven). No browser, no Svelte — pure strategy evaluation via JSON.

## Commands

```
── Global settings (apply to all subcommands) ────────────────
  --vuln=<none|ns|ew|both>        Vulnerability (default: none)
  --opponents=<natural|none>      Opponent bidding mode (default: none)

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
```

Exit codes: 0=correct/pass, 1=wrong/fail, 2=arg error.
Same seed = same deal across all commands. Deterministic (Mulberry32 PRNG).

Available bundles: `nt-bundle`, `bergen-bundle`, `weak-twos-bundle`, `dont-bundle`.

## Two-Phase Evaluation Pipeline

### Phase 1: Per-Atom Targeted (orchestrator-driven)

Tests each coverage atom independently with a dedicated seed. The orchestrator
reads the plan, walks atoms in BFS order, and calls `eval` for each.

```bash
# Viewport only — sanitized (seat, hand, HCP, auction, legal calls). No answer.
npx tsx src/cli/coverage-runner.ts eval --bundle=nt-bundle \
  --atom=responder-r1/sf:responder-r1/stayman:ask-major --seed=3

# Submit bid — returns full teaching feedback (ViewportBidFeedback + TeachingDetail)
npx tsx src/cli/coverage-runner.ts eval --bundle=nt-bundle \
  --atom=responder-r1/sf:responder-r1/stayman:ask-major --seed=3 --bid=2C
```

**Key properties:**
- `eval` output is always sanitized — no internal state IDs, expected bids, or dependency tree
- `--atom` takes an atomId from the plan output (format: `stateId/surfaceId/meaningId`)
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
npx tsx src/cli/coverage-runner.ts play --bundle=nt-bundle --seed=1

# Get viewport for step N
npx tsx src/cli/coverage-runner.ts play --bundle=nt-bundle --seed=1 --step=0

# Submit bid — returns grade + teaching + next step viewport (one fewer round-trip)
npx tsx src/cli/coverage-runner.ts play --bundle=nt-bundle --seed=1 --step=0 --bid=2H

# Full reveal — all steps with recommendations and atom IDs
npx tsx src/cli/coverage-runner.ts play --bundle=nt-bundle --seed=1 --reveal
```

**Key properties:**
- `play --step=N --bid=X` returns `{ grade, feedback, teaching, nextStep, complete }` — the next viewport is included so the agent doesn't need a separate call
- Both convention players (opener + responder) are presented as steps — `isUserStep` includes the N-S partnership, not just South
- No information leak: agent sees hand/auction/legal-calls before committing, gets grade + feedback after

### Plan Command

Precomputes the evaluation plan with two sections:

```bash
npx tsx src/cli/coverage-runner.ts plan --bundle=nt-bundle --agents=3 --coverage=2
```

Output has:
- **`phase1`** — Orchestrator-private. Per-atom BFS-ordered list with `atomId`, `expectedBid`, `seeds`, `depth`, `parentStateId`. Plus `dependencyGraph` for stop-on-error propagation. **Never sent to agents.**
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
| **Protocol atom approximation** | `wouldProtocolLikelyAttach()` is heuristic. Some protocol atoms may be missed. |
| **Teaching feedback accuracy** | We grade bids, not feedback text. Feedback could be wrong even when the bid is right. |

## Key Source Files

| File | Purpose |
|------|---------|
| `src/cli/coverage-runner.ts` | CLI entry point — all subcommands |
| `src/core/viewport/build-viewport.ts` | `buildViewportFeedback()`, `buildTeachingDetail()` — information boundary |
| `src/core/viewport/player-viewport.ts` | `ViewportBidFeedback`, `TeachingDetail` type definitions |
| `src/teaching/teaching-resolution.ts` | `resolveTeachingAnswer()`, `gradeBid()`, `BidGrade` — 5-level grading |
| `src/strategy/bidding/protocol-adapter.ts` | `protocolSpecToStrategy()` — ConventionSpec → strategy |
| `src/conventions/core/protocol/coverage-enumeration.ts` | BFS atom enumeration, coverage manifest |
| `src/engine/deal-generator.ts` | Constraint-based deal generation with seeded PRNG |
| `src/core/util/seeded-rng.ts` | `mulberry32()` — deterministic PRNG |
