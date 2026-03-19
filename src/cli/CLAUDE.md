# cli — Headless Coverage Test Runner

Tests convention correctness by running the evaluation pipeline without browser/DOM/Svelte.

## Usage
```
npx tsx src/cli/coverage-runner.ts --bundle=nt-bundle
npx tsx src/cli/coverage-runner.ts --all --json --seed=42
```

## How It Works

1. Loads bundle from convention registry
2. Generates optimized coverage manifest (tree LP + two-phase algorithm)
3. For each (state, surface) target: generates deal, runs strategy, grades result
4. Outputs structured results (human-readable or JSON)

## Key Design

- Consumes `BiddingViewport` from `src/core/viewport/` — same boundary as UI
- Uses `EvaluationOracle` for grading — never exposed to the "agent"
- Seedable PRNG (`--seed=N`) for reproducible results
- Self-test mode: engine evaluates against itself

---

## Context Maintenance

**Staleness anchor:** This file assumes `coverage-runner.ts` exists. If it doesn't, regenerate.

<!-- context-layer: generated=2026-03-18 | last-audited=2026-03-18 | version=1 | tree-sig=dirs:1,files:1,exts:ts:1,md:1 -->
