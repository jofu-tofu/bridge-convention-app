# cli — Headless Coverage Test Runner

Tests convention correctness by running the evaluation pipeline without browser/DOM/Svelte.

## Usage

Four subcommands. Same seed = same deal across `present` and `grade`. Exit codes: 0=correct, 1=wrong, 2=arg error.

```bash
# List all targets for a bundle
npx tsx src/cli/coverage-runner.ts list --bundle=nt-bundle

# Present a hand (agent reads viewport, decides bid) — NO correct answer shown
npx tsx src/cli/coverage-runner.ts present --bundle=nt-bundle --target=STATE --surface=SURFACE --seed=N

# Grade a bid (agent submits, gets feedback)
npx tsx src/cli/coverage-runner.ts grade --bundle=nt-bundle --target=STATE --surface=SURFACE --seed=N --bid=2C

# CI self-test (strategy vs itself)
npx tsx src/cli/coverage-runner.ts selftest --bundle=nt-bundle --seed=42
npx tsx src/cli/coverage-runner.ts selftest --all --seed=42
```

## How It Works — Agent Protocol

1. **`list`** → Discover targets: enumerates all (state, surface) pairs for a bundle
2. **`present`** → Show viewport: generates a deal and returns hand, auction, legal calls, alerts — no answer key
3. **`grade`** → Submit bid and get feedback: returns `yourBid`, `grade`, `correct`, `requiresRetry`, `correctBid`, `conditions` as structured JSON
4. **`selftest`** → CI mode: engine's own strategy bids against itself across all targets

The `present`/`grade` split enforces the PlayerViewport boundary — the agent never sees the answer before committing a bid.

## Key Design

- Consumes `BiddingViewport` from `src/core/viewport/` — same boundary as UI
- Uses `EvaluationOracle` for grading — never exposed to the "agent"
- Seedable PRNG (`--seed=N`) for reproducible results; same seed = same deal across `present` and `grade`
- Self-test mode (`selftest`): engine evaluates against itself

---

## Context Maintenance

**Staleness anchor:** This file assumes `coverage-runner.ts` exists. If it doesn't, regenerate.

<!-- context-layer: generated=2026-03-18 | last-audited=2026-03-18 | version=1 | tree-sig=dirs:1,files:1,exts:ts:1,md:1 -->
