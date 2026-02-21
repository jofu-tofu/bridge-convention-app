# CLI

Command-line interface for the bridge practice engine. Consumer of `src/engine/`, not a peer.

## Conventions

- **JSON-first output** — JSON is the default; text is opt-in via `--format text`. Enables piping between commands.
- **CommandResult envelope** — all commands emit `{ type, data, meta? }`. Piped commands read the envelope and unwrap `data`.
- **PhaseGate** — `CURRENT_PHASE` in `constants.ts` is the sole coordination point. Commands with `phase > CURRENT_PHASE` are blocked before the handler runs. To unlock a phase, bump `CURRENT_PHASE`.
- **No mocking own modules** — tests use real `TsEngine` via `createCliDependencies()`.
- **Named exports only** — no `export default` anywhere in CLI.

## Architecture

**Module graph:**
```
engine/types.ts → engine/constants.ts → engine/hand-evaluator.ts → engine/deal-generator.ts
                                                                  ↘ engine/port.ts → engine/ts-engine.ts
                                                                                          ↑
                                                                               cli/engine-factory.ts
                                                                                          ↑
                                                                                    cli/runner.ts
                                                                                          ↑
                                                                              cli/commands/*.ts
```

**Key files:**

| File                     | Role                                                          |
| ------------------------ | ------------------------------------------------------------- |
| `types.ts`               | CommandResult, CommandHandler, CommandDef, CliDependencies     |
| `constants.ts`           | CURRENT_PHASE, PHASE_DESCRIPTIONS                             |
| `engine-factory.ts`      | CliEngine (extends EnginePort + diagnostics), dependency factory |
| `runner.ts`              | Command registry, dispatcher, PhaseGate, --help/--version     |
| `formatter.ts`           | JSON default, text opt-in, bridge display helpers             |
| `stdin.ts`               | Piped input reader with TTY detection and envelope validation |
| `errors.ts`              | CliError type and formatError()                               |
| `commands/generate.ts`   | Phase 1: deal generation with constraints                     |
| `commands/evaluate.ts`   | Phase 1: hand evaluation                                      |
| `commands/*.ts` (stubs)  | Phase 2/3/6: gate-locked, ~15 lines each                     |

## How to Add a Command

1. Create `src/cli/commands/{name}.ts` — export a `CommandDef` with name, description, phase, options, handler
2. Import and add to `ALL_COMMANDS` array in `src/cli/runner.ts`
3. When the phase ships: bump `CURRENT_PHASE` in `src/cli/constants.ts`
4. Write tests in `src/cli/__tests__/{name}.test.ts`

## CliEngine Diagnostics Bypass

`CliEngine` extends `EnginePort` with `generateDealWithDiagnostics()` that calls `generateDeal()` directly from `deal-generator.ts` to get iteration/relaxation data. All other operations go through the standard `EnginePort` interface.

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Staleness anchor:** This file assumes `runner.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-02-20 | last-audited=2026-02-20 | version=1 -->
