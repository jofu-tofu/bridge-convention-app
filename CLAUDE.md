# Bridge Practice App

Desktop app for drilling bridge bidding conventions (Stayman, Gerber, DONT, Bergen Raises). Tauri 2 + Svelte 5 (runes) + TypeScript strict.

## Commands

| Command                 | Purpose                                                  |
| ----------------------- | -------------------------------------------------------- |
| `npm run dev`           | Start dev server (port 1420)                             |
| `npm run build`         | Build production bundle                                  |
| `npm run check`         | Svelte type-check                                        |
| `npx tsc --noEmit`      | TypeScript type-check                                    |
| `npm run test`          | Vitest watch mode                                        |
| `npm run test:run`      | Vitest single run                                        |
| `npm run test:coverage` | Coverage report (90% branches, 90% functions, 85% lines) |
| `npm run test:e2e`      | Playwright E2E tests                                     |
| `npm run test:all`      | Unit + E2E together                                      |
| `npm run cli`           | Run CLI in dev mode (via tsx)                             |
| `npm run build:cli`     | Compile CLI to dist/                                      |

## Conventions

- **Pure engine.** `src/engine/` has zero imports from svelte, tauri, or DOM APIs
- **Registry pattern.** Use registries for conventions and strategies, not hardcoded switch statements
- **EnginePort abstraction.** UI communicates with engine through `EnginePort` interface; engine never imports UI
- **Svelte 5 runes.** Use `$state`, `$derived`, `$effect` — no legacy `$:` reactive statements
- **Named exports only.** No `export default` — for greppability
- **No `const enum`** — breaks Vite/isolatedModules; use regular `enum`
- **No `any` without comment** — annotate with `// any: <reason>`
- **No mocking own modules** — use dependency injection instead

## Architecture

```
src/
  engine/          Pure TS game logic (zero platform deps)
    __tests__/     Unit tests colocated with source
  cli/             CLI interface — consumer of engine, JSON-first output
    commands/      Command handlers (generate, evaluate, stubs for future phases)
    __tests__/     CLI unit tests
  conventions/     Convention definitions (Phase 2)
  ai/              AI drill logic (Phase 3)
  components/      Svelte UI components (Phase 4)
  stores/          Svelte stores (Phase 4)
src-tauri/         Rust Tauri backend (scaffold only until Phase 5)
tests/
  e2e/             Playwright E2E tests
```

**Subsystems:**

- **Engine:** Pure TS game logic — types, hand evaluation, deal generation, auction, scoring, play rules, EnginePort (entry: `src/engine/types.ts`)
- **Conventions:** Registry of convention configs — each convention = one file exporting `ConventionConfig` with deal constraints, bidding rules, explanations, example hands (entry: `src/conventions/registry.ts`)
- **AI:** Partner bids textbook-correct per convention; opponents use standard SAYC (entry: `src/ai/bidding-ai.ts`)
- **CLI:** Command-line interface wrapping EnginePort — JSON default, text opt-in, phase-gated future commands (entry: `src/cli/runner.ts`)
- **Tests:** Vitest unit + Playwright E2E (entry: `tests/e2e/`)

**Game phases:** BIDDING → PLAYING → EXPLANATION (tracked in `stores/game.svelte.ts`)

**V1 storage:** localStorage for user preferences only — no stats/progress tracking until V2 (SQLite)

## Phase Tracking

| Phase | Status  | Description                                                               |
| ----- | ------- | ------------------------------------------------------------------------- |
| 0     | Done    | Scaffold, types, testing pipeline, CLAUDE.md                              |
| 1     | Done    | Engine core: types, constants, hand-evaluator, deal-generator, EnginePort, CLI |
| 1.5   | Done    | Auction mechanics, scoring engine, play rules, convention test fixtures    |
| 2     | Pending | Convention registry + Stayman implementation                              |
| 3     | Pending | AI opponent engine                                                        |
| 4     | Pending | Drill UI with feedback                                                    |
| 5     | Pending | Tauri desktop integration                                                 |

## Gotchas

- Read a subsystem's CLAUDE.md before working in that directory
- Full testing playbook is in **TESTING.md**, not here
- `src-tauri/` is boilerplate scaffold until Phase 5 — don't add custom Rust commands yet
- No vendored bridge libraries — clean-room implementation only
- DONT and Bergen Raises variant selection must be resolved before Phase 4 implementation
- Only duplicate bridge scoring implemented (rubber bridge out of scope for V1)

**Reference docs** (detailed architecture, not auto-loaded):

- `docs/architecture-reference.md` — convention constraints, AI heuristics, screen flow, phase details
- `docs/bridge-rules-sources.md` — authoritative bridge rules sources, coverage gaps, ambiguity resolution

**Context tree** (read the relevant one before working in that directory):

- `src/engine/CLAUDE.md` — engine purity, module graph, key patterns
- `src/cli/CLAUDE.md` — JSON-first output, PhaseGate, how to add commands
- `tests/CLAUDE.md` — E2E config, test running

---

## Context Maintenance

**After modifying files in this project:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Add** an entry only if an agent would fail without knowing it, it is not obvious from
the code, and applies project-wide (not just one directory).

**Remove** any entry that fails the falsifiability test: if removing it would not change
how an agent acts, remove it. If a convention here conflicts with the codebase, the
codebase wins — update this file, do not work around it. Prune aggressively.

**Staleness anchor:** This file assumes `src/engine/types.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

**Trigger Audit or Generate:**

- Rename/move files or dirs → Audit
- > 20% of files changed → Generate
- 30+ days without touching this file → Audit
- Agent mistake caused by this file → fix immediately, then Audit

<!-- context-layer: generated=2026-02-20 | last-audited=2026-02-20 | version=3 -->
