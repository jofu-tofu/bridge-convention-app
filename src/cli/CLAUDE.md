<!-- context-layer: cli | version: 3 | last-audited: 2026-04-05 -->

# cli — Session-Based Convention CLI

Headless CLI for evaluating bridge convention correctness. Uses the same session API as the UI (`createDrillSession` -> `startDrill` -> `submitBid`). No browser, no Svelte — pure strategy evaluation via JSON.

## Commands

```
-- Discovery -------------------------------------------------------
  bundles                                    List all available bundles (JSON)
  modules                                    List all available modules (JSON)
  describe  --bundle=<id>                    Inspect a bundle and its modules

-- Playthrough evaluation ------------------------------------------
  play      --bundle=<id> --seed=N [--bid=X] Session-based playthrough
  play      --bundle=<id> --seed=N --bids=X,Y Submit multiple user-seat bids

-- Self-test -------------------------------------------------------
  selftest  --bundle=<id> [--seed=N] [--count=N]  Strategy self-consistency check
  selftest  --all [--seed=N] [--count=N]

-- Help ------------------------------------------------------------
  help                                       Show global help
  <subcommand> --help                        Show subcommand help
```

Global settings: `--system=<sayc|two-over-one|acol>`, `--vuln=<none|ns|ew|both>`, `--opponents=<natural|none>`, `--help`.

Exit codes: 0=correct/pass, 1=wrong/fail, 2=arg error.
Same seed = same deal across all commands. Deterministic (ChaCha8Rng in Rust).

Bundle IDs are discovered at runtime via `bundles` subcommand. Do not hardcode bundle IDs — use self-discovery.

## Architecture

The CLI uses the same session API as the UI — no special evaluation code path.

**Session-based playthrough (`play`):** Each invocation creates a fresh session via `createDrillSession()` with deterministic seed. Same seed = same deal. `startDrill()` returns the first viewport. `submitBid()` grades a bid, applies it, runs AI bids, and returns the next viewport.

**Stateless replay:** The `--bids=X,Y,Z` flag replays previous user bids to advance the session to the target step. The session is recreated from scratch each invocation — no handle persistence needed.

**Selftest:** For each seed, creates a session, gets the strategy's recommended bid via `getExpectedBid()` (DevServicePort), submits it, and verifies it grades as correct. Requires a dev WASM build.

## CLI Output Philosophy

All output is JSON on stdout. Errors go to stderr. The CLI is an agent-facing interface — output is expressed in terms of viewports, grades, and teaching feedback, not implementation internals.

## Settings Flags

### `--system=<sayc|two-over-one|acol>`
Selects the base bidding system. Default: `sayc`.

### `--vuln=<none|ns|ew|both>`
Sets vulnerability. Default: `none`.

### `--opponents=<natural|none>`
Controls opponent (E/W) bidding behavior. Default: `natural`.

### `--module=<id>`
Target module focus (play command only). Threads through SessionConfig.targetModuleId.

### `--mode=<decision-drill|full-auction>`
Practice mode (play command only).

### `--role=<opener|responder|both>`
Practice role (play command only).

## Key Source Files

| File | Purpose |
|------|---------|
| `src/cli/main.ts` | CLI entry point — dispatch + WASM init |
| `src/cli/shared.ts` | Shared utilities — arg parsing, call parsing, settings resolution |
| `src/cli/help.ts` | Usage text and per-subcommand help |
| `src/cli/commands/info.ts` | `bundles`, `modules`, `describe` subcommands |
| `src/cli/commands/play.ts` | `play` subcommand — session-based playthrough |
| `src/cli/commands/selftest.ts` | `selftest` subcommand — strategy self-consistency check |

## Module Boundary

**Staleness anchor:** `src/cli/main.ts` must exist and import from `./shared` and `./commands/*`.
