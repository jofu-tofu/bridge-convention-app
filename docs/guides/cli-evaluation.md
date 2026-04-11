# CLI Evaluation Pipeline

Detailed design and known gaps for the convention evaluation CLI.

## Agent Self-Discovery Workflow

Agents should discover the CLI's capabilities at runtime:

```bash
# 1. List available bundles
npx tsx src/cli/main.ts bundles

# 2. Inspect a specific bundle (atoms, depth, strategy coverage)
npx tsx src/cli/main.ts describe --bundle=nt-bundle

# 3. Get per-subcommand help
npx tsx src/cli/main.ts eval --help
```

`bundles` returns a JSON array with `id`, `name`, `description`, `category`, `atomCount`. `describe` returns full atom list with IDs usable in `eval --atom=<id>`.

## Two-Phase Evaluation Pipeline

### Phase 1: Per-Atom Targeted (orchestrator-driven)

Tests each coverage atom independently with a dedicated seed. The orchestrator reads the plan, walks atoms grouped by module, and calls `eval` for each.

**Key properties:**
- `eval` output is always sanitized — no internal state IDs, expected bids, or dependency tree
- `--atom` takes an atomId from the plan output (format: `moduleId/meaningId`)
- With `--bid`: returns `ViewportBidFeedback` + `TeachingDetail`
- 4-level grading: correct, acceptable, near-miss, incorrect
- Both opener (N) and responder (S) atoms are testable
- Stop-on-error: orchestrator uses the plan's `dependencyGraph` to skip child atoms

### Phase 2: Playthrough Integration (agent-driven)

Tests end-to-end auction flow. Agents receive seed lists and step through full auctions, catching issues that per-atom testing misses (bids individually correct but don't compose).

**Key properties:**
- `play --step=N --bid=X` returns `{ grade, feedback, teaching, nextStep, complete }`
- Both convention players (opener + responder) are presented as steps
- No information leak: agent sees hand/auction/legal-calls before committing

### Plan Command

Precomputes evaluation plan with two sections:
- **`phase1`** — Orchestrator-private. Per-atom list with `atomId`, `expectedBid`, `seeds`, `turnGuard`, `primaryPhaseGuard`. Never sent to agents.
- **`phase2`** — Agent-facing. Seed assignments per agent, balanced by step count.

## Design Decisions

### Per-atom testing guarantees deep state coverage
Playthrough-based testing over-covers shallow atoms (depth 0 hit on every seed) and under-covers deep atoms. Per-atom targeted testing guarantees each atom gets dedicated seed coverage. Playthroughs are Phase 2 for integration testing.

### Agent context stays clean
`eval` always outputs sanitized viewports. Plan `phase1` data stays with the orchestrator. Phase 2 agents receive only bundle + seed lists. Agents evaluate using bridge knowledge, not the app's own clauses.

### Full teaching feedback mirrors the app UI
`eval --bid` and `play --bid` return `ViewportBidFeedback` + `TeachingDetail` — the same types the Svelte UI renders. Built via `buildViewportFeedback()` and `buildTeachingDetail()` from `src/service/build-viewport.ts`.

### Both seats are testable
Atoms include both opener (North) and responder (South) states. The BFS path determines which seat is active. In playthroughs, both convention-player bids are presented as steps.

## Known Gaps

| Gap | Description |
|-----|-------------|
| **Seed selection bias** | Phase 1 only tests hands where the convention *should* apply. No ambiguous/negative cases. |
| **Multi-bundle interaction** | Bundles tested in isolation. No cross-bundle convention conflict testing. |
| **Teaching feedback accuracy** | We grade bids, not feedback text. Feedback could be wrong even when the bid is right. |
