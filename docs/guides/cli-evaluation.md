# CLI Evaluation Pipeline

Current design and known gaps for the session-based convention CLI.

## Current Commands

The CLI surface in `src/cli/main.ts` is:

```bash
npx tsx src/cli/main.ts bundles
npx tsx src/cli/main.ts modules
npx tsx src/cli/main.ts describe --bundle=nt-bundle
npx tsx src/cli/main.ts play --help
npx tsx src/cli/main.ts selftest --help
```

There is no `eval`, `list`, `plan`, or `systems` command in the current CLI.

## Evaluation Model

### Baseline: `selftest`

`selftest` is the quickest health check. For each seed it:

1. creates a drill session
2. asks the strategy for the expected bid
3. submits that bid back through the same session path
4. verifies it grades as correct or acceptable

Use it for:

- bundle-wide sanity checks
- regression checks after convention edits
- cross-system spot checks (`sayc`, `two-over-one`, `acol`)

### Runtime review: `play`

`play` is the interactive evaluation path. It exposes the same user-facing session flow as the app:

- `play --bundle=<id> --seed=N` returns the first decision viewport
- `play --bundle=<id> --seed=N --bid=<call>` grades a single user bid
- `play --bundle=<id> --seed=N --bids=<c1,c2,...>` replays earlier user bids and grades the final one

This is the right command for expert review agents because it keeps the evaluation framed around what the player sees.

## Design Decisions

### Session-first, not atom-first

The current CLI is intentionally session-based. It tests the real drill/session path instead of a special per-atom evaluator.

### Stateless replay

Each invocation recreates the session from seed and settings. `--bids=` is the mechanism for jumping to later user decision points without storing handles across commands.

### Teaching feedback matches the app

`play --bid` returns the same feedback/teaching structures the app renders. That makes it useful for reviewing both bid correctness and explanation quality.

## Known Gaps

| Gap | Description |
|-----|-------------|
| **No per-atom CLI command** | Completeness audit still has to read module fixtures directly. |
| **No dynamic systems discovery** | Supported systems are static flags, not a discoverable CLI list. |
| **Teaching review is manual** | The CLI returns feedback payloads, but there is no built-in scorer for explanation quality. |
